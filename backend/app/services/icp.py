"""ICP (Ideal Customer Profile) generation and research service.

Includes:
  - ICP_generator: main ICP synthesis from company profile
  - icp_research_1..4: 4-component ICP-research breakdown
  - _icp_research_agent_output: prompt-dispatch helper (default vs claude)
  - _ensure_icp_id_registry_indexes / _reserve_unique_icp_id / _release_icp_id:
    Mongo-backed ICP-id reservation (moved here from api.py in commit 13/16)
  - ICP_FUNCTIONS, ICP_FUNCTIONS_CLAUDE dispatch dicts
  - list_icps: router-facing wrapper for GET /icp
  - _run_icp_research_impl: shared worker for POST /icp-research[_claude]
  - run_icp_research: router-facing wrapper for POST /icp-research and /icp-research_claude
  - delete_recommended_icp: router-facing wrapper for DELETE /icp/recommended/{icp_id}

Extracted from services.py + api.py during phase A (commit 13/16).
Router-facing wrappers added during phase B (commit 11/25).
"""
import asyncio
import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import HTTPException
from langchain_core.prompts import PromptTemplate
from pymongo.errors import DuplicateKeyError

from app.core import clients, llm_config
from app.core.exceptions import ICPIdRegistryError
from app.services._llm_helpers import (
    CLAUDE_RESEARCH_MAX_TOKENS,
    _tavily_context_and_urls,
    _claude_messages_text,
)


def _icp_research_agent_output(prompt: str, pre_data: str, llm_backend: str) -> str:
    """Dispatcher for ICP research LLM call. Mirrors _market_research_agent_output."""
    if llm_backend != "claude":
        raw_response = llm_config.agent_chain.invoke({"input": prompt})
        return raw_response["output"]
    seed = " ".join(str(pre_data).split())[:1200]
    web_ctx, _ = _tavily_context_and_urls(
        f"ICP buyer persona pain points buying triggers competitors compliance 2026 {seed}"
    )
    augmented = f"""{prompt}

WEB SEARCH RESULTS (primary external evidence — synthesize with company profile and ICP card):
{web_ctx}
"""
    return _claude_messages_text(augmented, max_tokens=CLAUDE_RESEARCH_MAX_TOKENS)


def ICP_generator(pre_data: str) -> dict:
    # Construct prompt by embedding the entire JSON string
    template = """Task: Based on the provided company_profile below, analyze the data and research the market to suggest the most relevant Ideal Customer Profiles (ICPs). Consider industry fit, strategic alignment, and known patterns of technology adoption.

CRITICAL INSTRUCTIONS:
1. Extract the company's ACTUAL industry, target markets, regions, and business model from the company_profile data provided
2. Use WebSearch to find real ICPs that match the company's ACTUAL industry and target markets
3. DO NOT use the example values below - they are ONLY showing the JSON format/structure
4. All ICPs must be based on the company profile's actual industry, regions, and business context
5. You MUST populate the new schema fields: title, why_suggested, how_it_differs, firmographics, key_decision_makers, pain_points_and_triggers, competitors
6. For backward compatibility, also include these keys for each ICP: regions, confidenceScore, decisionMakers

Company Profile Data:
{pre_data}

STEP 1 - EXTRACT COMPANY DETAILS:
From the company_profile above, extract:
- Company's actual industry and sub-industry
- Actual target markets and regions (use specific countries/cities, not generic regions)
- Company size and business model
- Technology stack and focus areas
- Any other relevant attributes

STEP 2 - RESEARCH ICPs (USE WEB SEARCH):
You MUST use the WebSearch tool to find real ICPs that match the company's actual industry and target markets:
- Search for ICPs in the company's actual industry
- Find ICPs that target the company's actual regions/markets
- Research real customer segments, company sizes, and decision makers relevant to the company's industry
- Research common pain points and buying triggers for each segment (use credible sources)
- Research competitors relevant to selling into that ICP (peer tools/platforms they evaluate)
- Research how each ICP differs from the others (distinct segment + pains + triggers + buyers)
- Example searches: "[company's actual industry] ideal customer profiles [company's actual regions]"
- Example searches: "[company's actual industry] target customer segments [company's actual regions]"
- Example searches: "[industry] [segment] common pain points buying triggers"
- Example searches: "[industry] [segment] buying committee decision makers titles"
- Example searches: "[industry] [segment] alternatives competitors vendor landscape"

STEP 3 - OUTPUT FORMAT:
Return your results in the following JSON format. The examples below show ONLY the structure - you MUST replace ALL values with data based on the company profile:

{{"suggestedICPs": [
    {{
      "id": "[optional. if you include, it must be unique; otherwise omit and API will generate]",
      "title": "[short descriptive title for this ICP, e.g., 'Mid-market logistics operators modernizing dispatch']",
      "is_new": true,
      "is_agentic": true,
      "why_suggested": [
        "[Reason 1 why this ICP aligns with company profile and strategy]",
        "[Reason 2 with market evidence from WebSearch]"
      ],
      "how_it_differs": [
        "[Key differentiator vs other suggested ICPs: different segment, buyer, trigger, or buying motion]",
        "[Another differentiator]"
      ],
      "firmographics": {{
        "industry": "[company's ACTUAL industry from profile]",
        "segment": "[specific segment relevant to company's industry]",
        "company_size": "[realistic company size range for this ICP, e.g., '50–200 employees']",
        "market_size": "[Estimated market size for this segment, e.g., '$45B' or '€12B']"
      }},
      "key_decision_makers": ["[actual decision maker roles/titles]", "[another role]"],
      "decisionMakers": ["[same decision makers for backward compatibility]"],
      "regions": ["[specific target markets/regions from company profile]"],
      "confidenceScore": "[high|medium|low]",
      "pain_points_and_triggers": {{
        "critical": "[Most relevant pain point for this ICP segment]",
        "others": [
          "[Buying trigger 1 based on industry dynamics]",
          "[Buying trigger 2 based on regulatory/technology/market shifts]"
        ]
      }},
      "competitors": ["[Competitor 1]", "[Competitor 2]", "[Competitor 3]"]
    }},
    {{
      "id": "[optional unique id or omit]",
      "title": "[short descriptive title]",
      "is_new": true,
      "is_agentic": true,
      "why_suggested": ["[Reason 1]", "[Reason 2]"],
      "how_it_differs": ["[Differentiator 1]", "[Differentiator 2]"],
      "firmographics": {{
        "industry": "[industry]",
        "segment": "[another specific segment]",
        "company_size": "[different company size range]",
        "market_size": "[Market size]"
      }},
      "key_decision_makers": ["[relevant decision makers]", "[another role]"],
      "decisionMakers": ["[same decision makers for backward compatibility]"],
      "regions": ["[specific target markets/regions from company profile]"],
      "confidenceScore": "[high|medium|low]",
      "pain_points_and_triggers": {{
        "critical": "[Top pain point]",
        "others": ["[Trigger 1]", "[Trigger 2]"]
      }},
      "competitors": ["[Competitor 1]", "[Competitor 2]", "[Competitor 3]"]
    }}
]}}

⚠️ CRITICAL NOTES:
- DO NOT copy the example values (fintech-neobanks, Healthcare SaaS, etc.) - they are FORMAT examples only
- Extract and use the company's ACTUAL industry, regions, and business context from the company_profile
- Use WebSearch to find real ICPs that match the company's actual industry and markets
- All firmographics, decision makers, regions, confidence scoring, pain points, triggers, and competitors must be based on the company profile data + WebSearch
- Use reasoning + WebSearch evidence to populate why_suggested, how_it_differs, firmographics.market_size, pain_points_and_triggers, and competitors
- Return realistic business values (no placeholders, no "TBD", no example text)
- Return at least 2-3 ICPs, all relevant to the company's actual industry and target markets
- Only return JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = PromptTemplate(
    input_variables=["pre_data"],
    template=template
    ).format(pre_data=pre_data)

    def _invoke_generator(pmt: str) -> dict:
        raw_response = llm_config.agent_chain.invoke({'input': pmt})
        response = raw_response["output"]
        try:
            print("[ICP_generator] Raw LLM output (first 500 chars):", str(response)[:500])
        except Exception:
            pass
        cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        cleaned_str = re.sub(
            r'\"description\": \"(.*?)\"',
            lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"',
            cleaned_str,
            flags=re.DOTALL
        )
        return json.loads(cleaned_str)

    # First attempt
    parsed_json = _invoke_generator(prompt)

    # If empty, retry with stricter requirement
    if not parsed_json.get("suggestedICPs"):
        retry_template = template + "\n\nYou must return at least 3 ICP entries in suggestedICPs. Do not return an empty list."
        retry_prompt = PromptTemplate(
            input_variables=["pre_data"],
            template=retry_template
        ).format(pre_data=pre_data)
        parsed_json = _invoke_generator(retry_prompt)

    # If still empty, fail fast to surface the issue
    if not parsed_json.get("suggestedICPs"):
        raise ValueError("LLM returned empty suggestedICPs after retry.")

    try:
        if isinstance(parsed_json, dict) and "suggestedICPs" in parsed_json:
            print("[ICP_generator] Parsed suggestedICPs count:", len(parsed_json.get("suggestedICPs", [])))
    except Exception:
        pass

    # ✅ Return the Python dict
    return parsed_json

def icp_research_1(pre_data: str, llm_backend: str = "default") -> dict:
    # Construct prompt by embedding the entire JSON string
    template = """Task: Research and compile an updated overview of icp  in the exact format given at end, based on the data below based on this ( follow this strictly and do research based on what all provided here - {pre_data}.

Return your findings in the following exact JSON format --  use this data to do the research - {pre_data}


{{
  "currentData": {{
    "title": "Healthcare Providers - Hospitals/Clinics (201-500 employees)",
    "blurb": "Hospitals/Clinics companies in Healthcare Providers seeking innovative solutions to scale their operations across Germany, DACH, EU markets. Key focus areas include High cloud adoption and HIPAA/GDPR compliance.",
    "_metadata": {{
      "dataSource": "api"
    }},
    "marketSize": "€51.6B",
    "growth": "+30%",
    "urgency": "High",
    "timeToClose": "4-6 months",
    "marketAnalysis": {{
      "totalMarketSize": "€51.7B",
      "marketGrowth": "+30%",
      "servicableMarket": "€17.5B",
      "targetableMarket": "€4.1B",
      "segments": [
        {{
          "name": "Advanced Hospitals/Clinics",
          "share": "45%",
          "size": "€22.0B",
          "growth": "+40%"
        }},
        {{
          "name": "Traditional Hospitals/Clinics",
          "share": "35%",
          "size": "€17.0B",
          "growth": "+22%"
        }}
      ],
      "growthTrajectory": {{
        "units": "index(2023=100)",
        "points": [
          {{ "year": 2023, "index": 100 }},
          {{ "year": 2026, "index": 103 }},
          {{ "year": 2027, "index": 107 }},
          {{ "year": 2026, "index": 112 }}
        ]
      }},
      "marketShareDistribution": [
        {{ "name": "Advanced Hospitals/Clinics", "share": "45%" }},
        {{ "name": "Traditional Hospitals/Clinics", "share": "35%" }},
        {{ "name": "Other", "share": "20%" }}
      ],
      "keyChallenges": [
        "Healthcare Providers sector complexity requiring specialized high cloud adoption",
        "Hospitals/Clinics integration challenges for 201-500 employees organizations"
      ],
      "strategicRecommendations": [
        "Target Healthcare Providers companies specifically needing high cloud adoption",
        "Focus hospitals/clinics messaging on high cloud adoption and HIPAA/GDPR compliance benefits"
      ],
      "signalsToMonitor": [
        "Healthcare Providers sector funding and hospitals/clinics investment announcements",
        "Germany regulatory changes affecting healthcare providers high cloud adoption"
      ]
    }},
  }}
}}


⚠️ Notes:

Use USD for monetary values in billions (B) or millions (M).

If numeric growth values aren't available for projections, provide a normalized trend (e.g., index from 1.0 to 2.5).

Pie chart data under marketSizeBySegment must sum to ~100%.

Keep bullet point recommendations short and actionable.

give only json , nothing else , nothing at all

When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = PromptTemplate(
    input_variables=["pre_data"],
    template=template
    ).format(pre_data=pre_data)

    # Step 3: Get LLM response
    response = _icp_research_agent_output(prompt, pre_data, llm_backend)

    # Clean and escape the JSON string
    cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    # Escape newline and other control characters within string values
    cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

    # Parse to JSON (Python dict)
    parsed_json = json.loads(cleaned_str)

    # ✅ Return the Python dict
    return parsed_json

def icp_research_2(pre_data: str, llm_backend: str = "default") -> dict:
    # Construct prompt by embedding the entire JSON string
    # The pre_data contains both company_profile and icp_card (flexible data structure)
    template = """Task: Research and compile a detailed "Buyer Map & Roles, Pain Points, Triggers" analysis based on the provided company profile and ICP data.

IMPORTANT: Use ALL the information provided in the context data below. Extract relevant details about industries, company sizes, buyer roles, regions, and any other relevant ICP information from the data provided.

Company Profile and ICP Data Context:
{pre_data}

Based on the information provided in the context data above, research and identify:
1. Core buyer personas (decision makers) specific to the industries and roles mentioned
2. Key pain points these buyer personas face in the specified industries
3. Buying triggers that would cause these specific ICP segments to purchase

Return your findings in the following exact JSON format:

{{
  "currentData": {{
    "title": "Buyer Map & Roles, Pain Points, Triggers",
    "blurb": "[2-3 sentence summary focusing on the specific buyer roles, pain points, and triggers based on the ICP data provided]",
    "_metadata": {{
      "dataSource": "api"
    }},
    "coreBuyerPersonas": [number of distinct buyer personas],
    "topPainPoint": "[Most critical pain point for the ICP]",
    "buyingTriggersIdentified": [number of triggers],
    "buyingTriggers": [
      {{
        "trigger": "[Specific trigger name]",
        "description": "[Detailed description of why this trigger matters for the ICP]"
      }},
      {{
        "trigger": "[Another specific trigger]",
        "description": "[Detailed description]"
      }}
    ]
  }}
}}

⚠️ Notes:
- Extract and use buyer roles/decision makers from the provided data
- Research pain points specific to the industries mentioned in the data
- Identify buying triggers relevant to the company sizes and regions specified
- Provide at least 5-6 accurate buying triggers
- Use real research data, not generic examples
- Give only JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = PromptTemplate(
        input_variables=["pre_data"],
        template=template
    ).format(pre_data=pre_data)

    # Step 3: Get LLM response with retries
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            response = _icp_research_agent_output(prompt, pre_data, llm_backend)

            # Extract JSON from response
            if "Final Answer:" in response:
                response = response.split("Final Answer:")[-1].strip()

            # Clean and escape the JSON string
            cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            # Remove any leading/trailing text before first { or after last }
            if "{" in cleaned_str:
                cleaned_str = cleaned_str[cleaned_str.index("{"):]
            if "}" in cleaned_str:
                cleaned_str = cleaned_str[:cleaned_str.rindex("}") + 1]

            # Escape newline and other control characters within string values
            cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)
            cleaned_str = re.sub(r'\"blurb\": \"(.*?)\"', lambda m: '"blurb": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

            # Parse to JSON (Python dict)
            parsed_json = json.loads(cleaned_str)

            # Validate structure
            if "currentData" not in parsed_json:
                raise ValueError("Missing 'currentData' key in response")

            return parsed_json

        except json.JSONDecodeError as e:
            if attempt == max_retries:
                raise ValueError(f"Failed to parse JSON after {max_retries} attempts: {str(e)}. Response: {response[:500]}")
            continue
        except Exception as e:
            if attempt == max_retries:
                raise ValueError(f"Error in icp_research_2 after {max_retries} attempts: {str(e)}")
            continue

def icp_research_3(pre_data: str, llm_backend: str = "default") -> dict:
    # Construct prompt by embedding the entire JSON string
    # The pre_data contains both company_profile and icp_card (flexible data structure)
    template = """Task: Research and compile a detailed "Competitive Overlap & Buying Signals" analysis based on the provided company profile and ICP data.

IMPORTANT: Use ALL the information provided in the context data below. Extract relevant details about industries, company sizes, regions, accounts, competitors, and any other relevant ICP information from the data provided.

Company Profile and ICP Data Context:
{pre_data}

Based on the information provided in the context data above, research and identify:
1. Real competitors operating in the industries and regions mentioned
2. Actual buying signals relevant to these ICP segments (funding rounds, hiring, product launches, regulatory changes)
3. Competitive landscape specific to the industries and company sizes mentioned

Return your findings in the following exact JSON format:

{{
  "currentData": {{
    "title": "Competitive Overlap & Buying Signals",
    "blurb": "[2-3 sentence summary of competitive landscape and buying signals based on the ICP data provided]",
    "_metadata": {{
      "dataSource": "api"
    }},
    "numberOfMainCompetitors": [actual number],
    "recentWinLossChange": "[percentage change, e.g., +11% or -5%]",
    "activeBuyingSignals": [number of signals],
    "competitiveMap": [
      {{
        "competitor": "[Real competitor name]",
        "segment": "[Specific segment they target]",
        "share": "[Market share percentage]",
        "winsLosses": "[Win/loss pattern description]",
        "differentiators": "[Key differentiators]"
      }}
    ],
    "competitiveNewsAndEvents": [
      {{
        "headline": "[Recent news headline]",
        "source": "[Source name]",
        "date": "[YYYY-MM-DD format]"
      }}
    ],
    "buyingSignals": [
      {{
        "signalType": "[Signal type: Funding Round, Hiring, Product Launch, Regulatory, etc.]",
        "description": "[Detailed description relevant to the ICP industries and company sizes]",
        "source": "[Source name]",
        "recency": "[How recent, e.g., '2 weeks ago']"
      }},
      {{
        "signalType": "[Another signal type]",
        "description": "[Detailed description]",
        "source": "[Source name]",
        "recency": "[How recent]"
      }}
    ]
  }}
}}

⚠️ Notes:
- Research REAL competitors in the industries and regions mentioned in the data
- Identify ACTUAL buying signals (funding, hiring, product launches) relevant to the ICP
- Use any accounts_on_watchlist or accounts_to_avoid information if provided in the data
- Provide at least 3-4 buying signals with real data
- Use real research data, not generic examples
- Give only JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = PromptTemplate(
        input_variables=["pre_data"],
        template=template
    ).format(pre_data=pre_data)

    # Step 3: Get LLM response with retries
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            response = _icp_research_agent_output(prompt, pre_data, llm_backend)

            # Extract JSON from response
            if "Final Answer:" in response:
                response = response.split("Final Answer:")[-1].strip()

            # Clean and escape the JSON string
            cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            # Remove any leading/trailing text before first { or after last }
            if "{" in cleaned_str:
                cleaned_str = cleaned_str[cleaned_str.index("{"):]
            if "}" in cleaned_str:
                cleaned_str = cleaned_str[:cleaned_str.rindex("}") + 1]

            # Escape newline and other control characters within string values
            cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)
            cleaned_str = re.sub(r'\"blurb\": \"(.*?)\"', lambda m: '"blurb": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)
            cleaned_str = re.sub(r'\"headline\": \"(.*?)\"', lambda m: '"headline": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

            # Parse to JSON (Python dict)
            parsed_json = json.loads(cleaned_str)

            # Validate structure
            if "currentData" not in parsed_json:
                raise ValueError("Missing 'currentData' key in response")
            if "buyingSignals" not in parsed_json.get("currentData", {}):
                raise ValueError("Missing 'buyingSignals' key in currentData")

            return parsed_json

        except json.JSONDecodeError as e:
            if attempt == max_retries:
                raise ValueError(f"Failed to parse JSON after {max_retries} attempts: {str(e)}. Response: {response[:500]}")
            continue
        except Exception as e:
            if attempt == max_retries:
                raise ValueError(f"Error in icp_research_3 after {max_retries} attempts: {str(e)}")
            continue

def icp_research_4(pre_data: str, llm_backend: str = "default") -> dict:
    # Construct prompt by embedding the entire JSON string
    # The pre_data contains both company_profile and icp_card (flexible data structure)
    template = """Task: Research and compile a detailed "Regulatory, Compliance & Recommended ICP" analysis based on the provided company profile and ICP data.

IMPORTANT: This is DIFFERENT from the Buyer Map component. This component focuses on:
1. Regulatory and compliance frameworks relevant to the industries and regions mentioned in the data
2. Upcoming mandates and regulatory changes affecting these industries
3. ICP fit score and confidence assessment
4. Specific recommendations for refining the ICP based on regulatory and compliance requirements

Company Profile and ICP Data Context:
{pre_data}

Based on the information provided in the context data above, research regulatory and compliance requirements and provide ICP refinement recommendations.

Return your findings in the following exact JSON format:

{{
  "currentData": {{
    "title": "Regulatory, Compliance & Recommended ICP",
    "blurb": "[2-3 sentence summary of regulatory landscape and ICP refinement recommendations based on the ICP data provided]",
    "_metadata": {{
      "dataSource": "api"
    }},
    "keyComplianceFrameworks": [
      "[Framework name relevant to the industries mentioned]",
      "[Another framework]"
    ],
    "upcomingMandates": "[Specific upcoming mandate with timeline, e.g., 'Q4 2027 GDPR Updates' or '2027 Industry Standard Changes']",
    "icpFitScore": "[Percentage match, e.g., '85% match' or '92% match']",
    "recommendationConfidence": "[High/Medium/Low]",
    "icpRefinementRecommendations": [
      {{
        "title": "[Specific recommendation title]",
        "description": "[Detailed description of how to refine the ICP based on regulatory/compliance insights]"
      }},
      {{
        "title": "[Another specific recommendation]",
        "description": "[Detailed description]"
      }},
      {{
        "title": "[Third recommendation]",
        "description": "[Detailed description]"
      }},
      {{
        "title": "[Fourth recommendation]",
        "description": "[Detailed description]"
      }}
    ]
  }}
}}

⚠️ Notes:
- Research ACTUAL compliance frameworks relevant to the industries mentioned in the data (e.g., GDPR for EU, HIPAA for healthcare, etc.)
- Identify REAL upcoming mandates and regulatory changes for these industries
- Calculate ICP fit score based on how well the ICP data aligns with regulatory requirements
- Provide specific, actionable recommendations for refining the ICP
- Use real research data, not generic examples
- Give only JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = PromptTemplate(
        input_variables=["pre_data"],
        template=template
    ).format(pre_data=pre_data)

    # Step 3: Get LLM response with retries
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            response = _icp_research_agent_output(prompt, pre_data, llm_backend)

            # Extract JSON from response
            if "Final Answer:" in response:
                response = response.split("Final Answer:")[-1].strip()

            # Clean and escape the JSON string
            cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            # Remove any leading/trailing text before first { or after last }
            if "{" in cleaned_str:
                cleaned_str = cleaned_str[cleaned_str.index("{"):]
            if "}" in cleaned_str:
                cleaned_str = cleaned_str[:cleaned_str.rindex("}") + 1]

            # Escape newline and other control characters within string values
            cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)
            cleaned_str = re.sub(r'\"blurb\": \"(.*?)\"', lambda m: '"blurb": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

            # Parse to JSON (Python dict)
            parsed_json = json.loads(cleaned_str)

            # Validate structure
            if "currentData" not in parsed_json:
                raise ValueError("Missing 'currentData' key in response")
            if "icpRefinementRecommendations" not in parsed_json.get("currentData", {}):
                raise ValueError("Missing 'icpRefinementRecommendations' key in currentData")

            return parsed_json

        except json.JSONDecodeError as e:
            if attempt == max_retries:
                raise ValueError(f"Failed to parse JSON after {max_retries} attempts: {str(e)}. Response: {response[:500]}")
            continue
        except Exception as e:
            if attempt == max_retries:
                raise ValueError(f"Error in icp_research_4 after {max_retries} attempts: {str(e)}")
            continue

# Function mappings
ICP_FUNCTIONS = {
    "icp summary & market opportunity": icp_research_1,
    "buyer map & roles, pain points, triggers" : icp_research_2,
    "competitive overlap & buying signals" : icp_research_3,
    "regulatory, compliance & recommended icp" : icp_research_4
}

ICP_FUNCTIONS_CLAUDE = {
    "icp summary & market opportunity": lambda d: icp_research_1(d, "claude"),
    "buyer map & roles, pain points, triggers": lambda d: icp_research_2(d, "claude"),
    "competitive overlap & buying signals": lambda d: icp_research_3(d, "claude"),
    "regulatory, compliance & recommended icp": lambda d: icp_research_4(d, "claude"),
}


# ---------------------------------------------------------------------------
# Router-facing service functions (added phase B, commit 11/25)
# ---------------------------------------------------------------------------

def list_icps(user_id: str, refresh: bool = False) -> Dict[str, Any]:
    """Fetch or generate ICPs for a given user_id.

    Implements the GET /icp handler logic:
      - Returns cached ICPs from MongoDB unless refresh=True.
      - On cache miss or refresh, generates new ICPs via ICP_generator() from
        a Neo4j company profile, normalises the payload, and persists to Mongo.
    """
    from app.services._retrieval import (  # lazy to avoid circular imports
        _build_market_context_queries,
        _fetch_pinecone_supporting_context,
    )

    print(f"[ICP] Request - user_id: {user_id}, refresh: {refresh}")

    def normalize_icp_response(payload: Any) -> Dict[str, Any]:
        """
        Normalize ICP payload to the required schema:
        {"suggestedICPs": [{...required keys...}]}
        """
        if isinstance(payload, dict) and isinstance(payload.get("suggestedICPs"), list):
            raw_icps = payload.get("suggestedICPs", [])
        elif isinstance(payload, dict) and isinstance(payload.get("icps"), list):
            raw_icps = payload.get("icps", [])
        elif isinstance(payload, list):
            raw_icps = payload
        else:
            raw_icps = []

        normalized_icps = []
        seen_ids = set()
        for idx, icp in enumerate(raw_icps):
            if not isinstance(icp, dict):
                icp = {}

            # Backend-controlled id generation with global uniqueness across ICP datasets.
            # Keep existing id only if non-empty and not duplicated in current response.
            preferred_id = str(icp.get("id") or "").strip()
            if preferred_id in seen_ids:
                preferred_id = ""
            candidate_id = _reserve_unique_icp_id(
                db,
                id_type="recommended_icp",
                owner_key=str(user_id),
                preferred_id=preferred_id
            )
            seen_ids.add(candidate_id)

            # Backward/forward-compatible mapping to the expanded suggested ICP schema.
            # Old keys: industry, segment, companySize, decisionMakers, whySuggested, marketSize, topPainPoint, buyingTriggers
            # New keys: title, is_new, is_agentic, why_suggested, how_it_differs, firmographics, key_decision_makers, pain_points_and_triggers
            firmographics = icp.get("firmographics") if isinstance(icp.get("firmographics"), dict) else {}
            pain_points_and_triggers = icp.get("pain_points_and_triggers") if isinstance(icp.get("pain_points_and_triggers"), dict) else {}

            old_industry = str(icp.get("industry") or "").strip()
            old_segment = str(icp.get("segment") or "").strip()
            old_company_size = str(icp.get("companySize") or "").strip()
            old_market_size = str(icp.get("marketSize") or "").strip()

            new_title = str(icp.get("title") or "").strip()
            if not new_title:
                # Fallback title derived from firmographics (or old keys)
                title_parts = [p for p in [firmographics.get("industry") or old_industry,
                                          firmographics.get("segment") or old_segment,
                                          firmographics.get("company_size") or old_company_size] if isinstance(p, str) and p.strip()]
                new_title = " - ".join([str(p).strip() for p in title_parts]) or f"Suggested ICP {idx + 1}"

            why_suggested = icp.get("why_suggested") if isinstance(icp.get("why_suggested"), list) else None
            if why_suggested is None:
                why_suggested = icp.get("whySuggested") if isinstance(icp.get("whySuggested"), list) else []

            how_it_differs = icp.get("how_it_differs") if isinstance(icp.get("how_it_differs"), list) else []

            key_decision_makers = icp.get("key_decision_makers") if isinstance(icp.get("key_decision_makers"), list) else None
            if key_decision_makers is None:
                key_decision_makers = icp.get("decisionMakers") if isinstance(icp.get("decisionMakers"), list) else []
            if not key_decision_makers:
                key_decision_makers = ["unknown"]

            competitors = icp.get("competitors") if isinstance(icp.get("competitors"), list) else []
            if not competitors:
                competitors = ["unknown"]

            # Build firmographics block with fallbacks
            firmographics_out = {
                "industry": str(firmographics.get("industry") or old_industry),
                "segment": str(firmographics.get("segment") or old_segment),
                "company_size": str(firmographics.get("company_size") or old_company_size),
                "market_size": str(firmographics.get("market_size") or old_market_size),
            }

            # Build pain points & triggers block with fallbacks
            critical_pp = pain_points_and_triggers.get("critical")
            if not (isinstance(critical_pp, str) and critical_pp.strip()):
                critical_pp = str(icp.get("topPainPoint") or "").strip()
            others_list = pain_points_and_triggers.get("others") if isinstance(pain_points_and_triggers.get("others"), list) else None
            if others_list is None:
                others_list = icp.get("buyingTriggers") if isinstance(icp.get("buyingTriggers"), list) else []

            pain_points_out = {
                "critical": str(critical_pp or ""),
                "others": others_list,
            }

            # Derive legacy output keys from new schema whenever possible.
            derived_regions = icp.get("regions") if isinstance(icp.get("regions"), list) else []
            if not derived_regions:
                derived_regions = ["global"]

            derived_confidence = str(icp.get("confidenceScore") or "").strip()
            if not derived_confidence:
                derived_confidence = "medium"

            normalized_icps.append({
                "id": candidate_id,
                "title": new_title,
                "is_new": bool(icp.get("is_new", True)),
                "is_agentic": bool(icp.get("is_agentic", True)),
                "why_suggested": why_suggested,
                "how_it_differs": how_it_differs,
                "firmographics": firmographics_out,
                "key_decision_makers": key_decision_makers,
                "pain_points_and_triggers": pain_points_out,
                # Keep legacy keys for backward compatibility
                "industry": str(icp.get("industry") or ""),
                "segment": str(icp.get("segment") or ""),
                "companySize": str(icp.get("companySize") or ""),
                "decisionMakers": icp.get("decisionMakers") if isinstance(icp.get("decisionMakers"), list) and icp.get("decisionMakers") else key_decision_makers,
                "regions": derived_regions,
                "keyAttributes": icp.get("keyAttributes") if isinstance(icp.get("keyAttributes"), list) else [],
                "growthIndicator": str(icp.get("growthIndicator") or ""),
                "whySuggested": icp.get("whySuggested") if isinstance(icp.get("whySuggested"), list) else [],
                "confidenceScore": derived_confidence,
                "marketSize": str(icp.get("marketSize") or ""),
                "growth": str(icp.get("growth") or ""),
                "topPainPoint": str(icp.get("topPainPoint") or ""),
                "buyingTriggers": icp.get("buyingTriggers") if isinstance(icp.get("buyingTriggers"), list) else [],
                "competitors": competitors
            })

        return {"suggestedICPs": normalized_icps}

    try:
        # MongoDB connection — use singleton from app.core.clients
        db = clients.client["Profiler"]
        _ensure_icp_id_registry_indexes(db)
        collection = db["ICP_config"]

        # Filter by user_id only for multitenancy
        existing_icp = collection.find_one({"user_id": user_id})

        if existing_icp:
            print(f"[ICP] Found existing ICP for user_id: {user_id}")
            if existing_icp.get("icps"):
                icps_data = existing_icp.get("icps")
                if isinstance(icps_data, dict) and "suggestedICPs" in icps_data:
                    print(f"[ICP] Existing ICP count: {len(icps_data.get('suggestedICPs', []))}")
                elif isinstance(icps_data, list):
                    print(f"[ICP] Existing ICP count (list): {len(icps_data)}")
        else:
            print(f"[ICP] No existing ICP found for user_id: {user_id}")

        if existing_icp and not refresh:
            print(f"[ICP] Returning cached ICP for user_id: {user_id}")
            normalized_cached = normalize_icp_response(existing_icp.get("icps", {"suggestedICPs": []}))
            # Persist normalized payload so ids/shape remain stable for subsequent fetches.
            collection.update_one(
                {"user_id": user_id},
                {"$set": {"user_id": user_id, "icps": normalized_cached}},
                upsert=True
            )
            return normalized_cached

        print(f"[ICP] Generating new ICPs for user_id: {user_id}")

        # Generate new ICPs from Neo4j company profile - get shared company profile
        with clients.driver.session() as session:
            result = session.run(
                "MATCH (c:CompanyProfile) RETURN c LIMIT 1"
            )
            record = result.single()

            if not record:
                print(f"[ICP] ERROR: No company profile in Neo4j")
                raise HTTPException(status_code=404, detail="No company profile found in Neo4j")

            company_profile = dict(record.values()[0])
            print(f"[ICP] Company profile retrieved from Neo4j")

            # Convert JSON string if needed
            if "socialMediaUrls" in company_profile and isinstance(company_profile["socialMediaUrls"], str):
                try:
                    company_profile["socialMediaUrls"] = json.loads(company_profile["socialMediaUrls"])
                except json.JSONDecodeError:
                    pass

            # Generate ICPs
            print(f"[ICP] Calling ICP_generator() for user_id: {user_id}")
            try:
                icp_result = ICP_generator(company_profile)
                if isinstance(icp_result, dict) and "suggestedICPs" in icp_result:
                    print(f"[ICP] Generated {len(icp_result.get('suggestedICPs', []))} ICPs for user_id: {user_id}")
                else:
                    print(f"[ICP] ICP_generator returned: {type(icp_result)}")
                icp_result = normalize_icp_response(icp_result)
            except Exception as gen_error:
                print(f"[ICP] ERROR in ICP_generator: {str(gen_error)}")
                raise HTTPException(status_code=500, detail=f"ICP generation failed: {str(gen_error)}")

            # Upsert the result in MongoDB - filter by user_id only
            print(f"[ICP] Saving to MongoDB for user_id: {user_id}")
            try:
                update_result = collection.update_one(
                    {"user_id": user_id},
                    {"$set": {"user_id": user_id, "icps": icp_result}},
                    upsert=True
                )
                print(f"[ICP] Saved to MongoDB - matched: {update_result.matched_count}, modified: {update_result.modified_count}")
            except Exception as save_error:
                print(f"[ICP] ERROR saving to MongoDB: {str(save_error)}")
                raise HTTPException(status_code=500, detail=f"Failed to save ICP: {str(save_error)}")

            print(f"[ICP] Successfully returned ICPs for user_id: {user_id}")
            return icp_result

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ICP] ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


async def _run_icp_research_impl(request: Any, llm_backend: str) -> Dict[str, Any]:
    """Shared async worker for POST /icp-research and POST /icp-research_claude.

    Parameters
    ----------
    request:
        A ``MarketRequest`` instance (imported lazily to avoid circular import).
    llm_backend:
        ``"groq"`` — uses ICP_FUNCTIONS (default Groq/Together pipeline).
        ``"claude"`` — uses ICP_FUNCTIONS_CLAUDE (Tavily + Anthropic).
    """
    from app.services._retrieval import (
        _build_market_context_queries,
        _fetch_pinecone_supporting_context,
    )

    component_name = request.component_name.strip().lower()

    if llm_backend == "claude":
        research_function = ICP_FUNCTIONS_CLAUDE.get(component_name)
    else:
        research_function = ICP_FUNCTIONS.get(component_name)

    if not research_function:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported component_name: {request.component_name}"
        )

    db = clients.client["Profiler"]
    collection = db["ICPs"]

    # Filter by user_id only for multitenancy
    query = {
        "user_id": request.user_id,
        "component_name": component_name
    }

    # If refresh is False, fetch the latest report
    if not request.refresh:
        latest_report = await asyncio.to_thread(
            collection.find_one, query, sort=[("timestamp", -1)]
        )
        if latest_report:
            latest_report.pop("_id", None)
            return {"status": "success", "data": latest_report}

    # --- Neo4j query inside a thread - get company profile by org_id ---
    def fetch_company_profile():
        with clients.driver.session() as session:
            # Get the company profile filtered by org_id (if provided)
            if request.org_id:
                result = session.run(
                    "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                    org_id=request.org_id
                )
            else:
                # Fallback: get any company profile (backward compatibility)
                result = session.run(
                    "MATCH (c:CompanyProfile) RETURN c LIMIT 1"
                )
            record = result.single()
            return record

    record = await asyncio.to_thread(fetch_company_profile)
    if not record:
        org_msg = f" for org_id: {request.org_id}" if request.org_id else ""
        raise HTTPException(status_code=404, detail=f"No company profile found in Neo4j{org_msg}")

    company_profile = dict(record.values()[0])
    if "socialMediaUrls" in company_profile and isinstance(company_profile["socialMediaUrls"], str):
        try:
            company_profile["socialMediaUrls"] = json.loads(company_profile["socialMediaUrls"])
        except json.JSONDecodeError:
            pass

    # --- Get ICP card/data from request body (flexible data field) ---
    # Prepare combined context data with company profile and ICP card from request
    context_data: Dict[str, Any] = {
        "company_profile": company_profile
    }

    # Add ICP card data from request body if available
    if request.data:
        # The request.data is flexible and should contain ICP card data
        context_data["icp_card"] = request.data

    market_context_queries = _build_market_context_queries(component_name, context_data)
    pinecone_context = await asyncio.to_thread(
        _fetch_pinecone_supporting_context,
        market_context_queries,
        request.org_id,
        3
    )
    context_data["pinecone_context_queries"] = market_context_queries
    context_data["pinecone_supporting_context"] = pinecone_context

    # Convert to JSON string for the research function
    context_json = json.dumps(context_data)

    # --- Run research with retries (max 2 attempts) ---
    max_retries = 2
    research_result: Any = None
    for attempt in range(1, max_retries + 1):
        try:
            research_result = await asyncio.to_thread(research_function, context_json)
            break
        except Exception as e:
            if attempt == max_retries:
                raise HTTPException(
                    status_code=500,
                    detail=f"Research function failed after {max_retries} attempts: {str(e)}"
                )
            await asyncio.sleep(1)  # retry delay

    # Coerce to dict (Claude variant guard)
    if not isinstance(research_result, dict):
        research_result = {"data": research_result}

    # Add metadata - filter by user_id only
    research_result.update({
        "user_id": request.user_id,
        "component_name": component_name,
        "timestamp": datetime.utcnow()
    })
    if request.org_id:
        research_result["org_id"] = request.org_id

    # Save to DB
    await asyncio.to_thread(collection.insert_one, research_result)

    research_result.pop("_id", None)
    return {"status": "success", "data": research_result}


async def run_icp_research(request: Any, llm_backend: str = "groq") -> Dict[str, Any]:
    """Router-facing wrapper for POST /icp-research and POST /icp-research_claude.

    Parameters
    ----------
    request:
        A ``MarketRequest`` instance.
    llm_backend:
        ``"groq"`` (default) or ``"claude"``.
    """
    if llm_backend == "claude":
        from app.services._claude_budget import CLAUDE_API_KEY
        if not CLAUDE_API_KEY:
            raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")
    return await _run_icp_research_impl(request, llm_backend=llm_backend)


def delete_recommended_icp(icp_id: str, user_id: str) -> Dict[str, Any]:
    """Delete a single recommended ICP from ICP_config by icp_id for a given user_id."""
    try:
        db = clients.client["Profiler"]
        _ensure_icp_id_registry_indexes(db)
        collection = db["ICP_config"]

        document = collection.find_one({"user_id": user_id})
        if not document:
            raise HTTPException(status_code=404, detail=f"No ICP config found for user_id: {user_id}")

        icps_payload = document.get("icps") or {}
        suggested = []
        if isinstance(icps_payload, dict) and isinstance(icps_payload.get("suggestedICPs"), list):
            suggested = icps_payload.get("suggestedICPs", [])
        elif isinstance(icps_payload, list):
            suggested = icps_payload

        updated_suggested = []
        deleted_icp = None
        for icp in suggested:
            if isinstance(icp, dict) and str(icp.get("id")) == str(icp_id):
                deleted_icp = icp
                continue
            updated_suggested.append(icp)

        if not deleted_icp:
            raise HTTPException(status_code=404, detail=f"Recommended ICP not found for icp_id: {icp_id}")

        new_payload = {"suggestedICPs": updated_suggested}
        collection.update_one(
            {"user_id": user_id},
            {"$set": {"user_id": user_id, "icps": new_payload}},
            upsert=True
        )
        _release_icp_id(db, icp_id)

        return {
            "success": True,
            "message": "Recommended ICP deleted successfully",
            "data": {
                "deleted_icp_id": str(icp_id),
                "remaining_count": len(updated_suggested)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- ICP-id registry helpers (moved from api.py in commit 13/16) ---
def _ensure_icp_id_registry_indexes(db) -> None:
    registry = db["ICP_ID_REGISTRY"]
    registry.create_index("id", unique=True)
    registry.create_index("id_type")


def _reserve_unique_icp_id(db, id_type: str, owner_key: str = "", preferred_id: str = "") -> str:
    """
    Reserve a globally unique ICP id across recommended ICPs + customer profile ICPs.
    Uses ICP_ID_REGISTRY with a unique index on `id`.
    """
    registry = db["ICP_ID_REGISTRY"]
    candidate = str(preferred_id or "").strip()
    for _ in range(20):
        if not candidate:
            candidate = str(uuid.uuid4())
        try:
            registry.insert_one({
                "id": candidate,
                "id_type": id_type,
                "owner_key": owner_key,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            return candidate
        except DuplicateKeyError:
            # If the same owner/type already reserved this id, keep it stable.
            existing = registry.find_one({"id": candidate})
            if existing and str(existing.get("id_type")) == str(id_type) and str(existing.get("owner_key")) == str(owner_key):
                return candidate
            candidate = ""
    raise ICPIdRegistryError("Failed to generate globally unique ICP id.")


def _release_icp_id(db, icp_id: str) -> None:
    if not icp_id:
        return
    registry = db["ICP_ID_REGISTRY"]
    registry.delete_one({"id": str(icp_id)})
