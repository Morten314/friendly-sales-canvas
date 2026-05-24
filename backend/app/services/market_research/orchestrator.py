"""Market research service: 5-component report generation. Cross-domain LLM
helpers live in `app.services._llm_helpers`. `run_market_research` is the
unified Groq/Claude worker.
"""
import asyncio
import json
import os
import re
from datetime import datetime, timezone
from typing import List

from app.core.exceptions import (
    BudgetExhaustedError,
    CompanyProfileNotFoundError,
    UnsupportedComponentError,
)
from app.models.market_research import MarketRequest
from app.services._retrieval import (
    _build_market_context_queries,
    _fetch_pinecone_supporting_context,
)
from app.services.market_research.persistence import (
    _find_latest_market_research_report,
    _insert_market_research_report,
)

# Re-exported for backward compat (any callsite within this module or
# external callers that import from market_research directly).
from app.services._llm_helpers import (  # noqa: F401
    CLAUDE_RESEARCH_MAX_TOKENS,
    _tavily_context_and_urls,
    _claude_messages_text,
)


def _market_research_agent_output(agent_chain, prompt: str, company_profile_json: str, llm_backend: str) -> str:
    if llm_backend != "claude":
        raw_response = agent_chain.invoke({"input": prompt})
        return raw_response["output"]
    seed = " ".join(str(company_profile_json).split())[:1200]
    web_ctx, _ = _tavily_context_and_urls(f"market research industry trends data 2026 {seed}")
    augmented = f"""{prompt}

WEB SEARCH RESULTS (primary external evidence — synthesize with company profile):
{web_ctx}
"""
    return _claude_messages_text(augmented, max_tokens=CLAUDE_RESEARCH_MAX_TOKENS)


# Research Market Functions
def Research_Market_1(agent_chain, pre_data, llm_backend: str = "default") -> dict:
    # Convert company profile to JSON string (handle both dict and string inputs)
    if isinstance(pre_data, dict):
        company_profile_json = json.dumps(pre_data, indent=2)
    elif isinstance(pre_data, str):
        # If it's already a string, try to parse and reformat for better readability
        try:
            parsed = json.loads(pre_data)
            company_profile_json = json.dumps(parsed, indent=2)
        except Exception:
            company_profile_json = pre_data
    else:
        company_profile_json = str(pre_data)
    
    # Construct prompt with full company profile and WebSearch instructions
    template = """Task: Research and compile an updated overview of market, including size, segment breakdown, growth projections, strategic recommendations, and market drivers.

STEP 1 - COMPANY PROFILE DATA:
Review the complete company profile data below. Extract all relevant information about the company's industry, target markets, regions, company size, strategic goals, and any other relevant attributes. Use this information to guide your research.

Company Profile Data:
{company_profile_json}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
You MUST use the WebSearch tool to find real, up-to-date market data. Based on the company profile above, identify the industry and target markets/regions, then perform comprehensive research:

1. Market Size Research:
   - Search for market size (TAM/SAM) for the company's industry in their target markets/regions
   - Include recent data (2026-2027) when available
   - Example searches: "[industry] market size TAM SAM [regions] 2026 2027"

2. Growth Rate Research:
   - Search for growth rates in the company's primary target market/region
   - Find market growth projections for their target regions
   - Example searches: "[industry] growth rate [primary region] 2026 2027"

3. Market Segmentation:
   - Search for market segment breakdowns (Enterprise, Mid-Market, SMB)
   - Find market size distribution by segment
   - Example searches: "[industry] market segments Enterprise Mid-Market SMB breakdown"

4. Market Entry & Strategy:
   - Search for market entry strategies relevant to the company's target markets
   - Find market drivers and trends in their target regions
   - Example searches: "[industry] market entry strategy [regions]"

IMPORTANT RESEARCH GUIDELINES:
- Perform at least 5-7 WebSearch queries to ensure comprehensive coverage
- Cross-reference data from multiple sources for accuracy
- Focus on recent data (2026-2027) when available
- Provide specific metrics with sources where possible
- Extract industry and target markets/regions from the company profile - do NOT assume or hardcode regions
- The GrowthRate field should reflect growth rate for the PRIMARY target market/region identified from the company profile
- Market entry strategy should be based on the company's actual target markets/regions from the profile
- Do NOT use hardcoded regions like APAC, North America, etc. - use what's in the company profile

STEP 3 - OUTPUT FORMAT:
Return your findings in the following exact JSON format (use exact keys as shown):

{{
  "executiveSummary": "[1-2 sentence summary of overall market opportunity and trends based on company profile]",
  "tamValue": "[Total Addressable Market size, e.g., '$4.2B']",
  "samValue": "[Serviceable Addressable Market size, e.g., '$2.1B']",
  "GrowthRate": "[Growth rate for primary target market/region from company profile, e.g., '25%']",
  "strategicRecommendations": [
    "[Recommendation #1 based on company profile]",
    "[Recommendation #2 based on company profile]",
    "[Recommendation #3 based on company profile]"
  ],
  "marketEntry": "[Brief description of phased market entry strategy based on company's target markets from profile]",
  "marketDrivers": [
    "[Key driver #1 based on company profile]",
    "[Key driver #2 based on company profile]",
    "[Key driver #3 based on company profile]",
    "[Key driver #4 based on company profile]"
  ],
  "marketSizeBySegment": {{
    "Enterprise": "[e.g., '45%']",
    "Mid-Market": "[e.g., '35%']",
    "SMB": "[e.g., '20%']"
  }},
  "growthProjections": {{
    "2023": "[value or index]",
    "2026": "[value or index]",
    "2027": "[value or index]",
    "2026": "[value or index]"
  }}
}}

⚠️ OUTPUT NOTES:
- Use USD for monetary values in billions (B) or millions (M)
- If numeric growth values aren't available for projections, provide a normalized trend (e.g., index from 1.0 to 2.5)
- Pie chart data under marketSizeBySegment must sum to ~100%
- Keep bullet point recommendations short and actionable
- GrowthRate must be for the PRIMARY target market/region from the company profile, not APAC or any hardcoded region
- Market entry strategy must be based on actual target markets/regions from the company profile
- Return ONLY valid JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your JSON answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = template.format(company_profile_json=company_profile_json)

    # Step 3: Get LLM response
    response = _market_research_agent_output(agent_chain, prompt, company_profile_json, llm_backend)

    # Clean and escape the JSON string
    cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    # Escape newline and other control characters within string values
    cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

    # Parse to JSON (Python dict)
    parsed_json = json.loads(cleaned_str)

    # ✅ Return the Python dict
    return parsed_json

def Research_Market_2(agent_chain, pre_data, llm_backend: str = "default") -> dict:
    # Convert company profile to JSON string (handle both dict and string inputs)
    if isinstance(pre_data, dict):
        company_profile_json = json.dumps(pre_data, indent=2)
    elif isinstance(pre_data, str):
        # If it's already a string, try to parse and reformat for better readability
        try:
            parsed = json.loads(pre_data)
            company_profile_json = json.dumps(parsed, indent=2)
        except Exception:
            company_profile_json = pre_data
    else:
        company_profile_json = str(pre_data)
    
    # Construct prompt with full company profile and WebSearch instructions
    template = """Task: Research and compile an updated overview of industry trends, including technology adoption, regulatory changes, regional hotspots, and strategic recommendations.

STEP 1 - COMPANY PROFILE DATA:
Review the complete company profile data below. Extract all relevant information about the company's industry, target markets, regions, and any other relevant attributes. Use this information to guide your research.

Company Profile Data:
{company_profile_json}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
You MUST use the WebSearch tool to find real, up-to-date industry trend data. Based on the company profile above, identify the industry and target markets/regions, then perform comprehensive research:

1. Technology Adoption Research:
   - Search for AI adoption rates, cloud migration percentages, and technology trends in the company's industry
   - Include recent data (2026-2027) when available
   - Example searches: "[industry] AI adoption rate 2026 2027"
   - Example searches: "[industry] cloud migration percentage [regions]"

2. Regulatory Changes Research:
   - Search for recent regulatory changes and compliance updates in the company's industry and target regions
   - Find number of regulatory changes and their impact
   - Example searches: "[industry] regulatory changes [regions] 2026 2027"

3. Regional Hotspots Research:
   - Search for regional market hotspots and growth areas in the company's target markets/regions
   - Find percentage values for different regions based on the company profile
   - Example searches: "[industry] market growth [regions] 2026 2027"
   - Extract regions from company profile - do NOT use hardcoded regions like APAC, Europe, North America

4. Industry Trends Research:
   - Search for current industry trends, adoption patterns, and performance metrics
   - Find technology budget allocation trends
   - Example searches: "[industry] trends 2026 2027"
   - Example searches: "[industry] technology budget allocation"

IMPORTANT RESEARCH GUIDELINES:
- Perform at least 5-7 WebSearch queries to ensure comprehensive coverage
- Cross-reference data from multiple sources for accuracy
- Focus on recent data (2026-2027) when available
- Provide specific metrics with sources where possible
- Extract target markets/regions from the company profile - do NOT assume or hardcode regions
- The regionalHotspots object should contain regions from the company profile, not hardcoded APAC/Europe/North America
- If company profile has 2 regions, include 2 in regionalHotspots; if 5 regions, include 5
- Do NOT use hardcoded regions - use what's in the company profile

STEP 3 - OUTPUT FORMAT:
Return your findings in the following exact JSON format (use exact keys as shown):

{{
  "executiveSummary": "[1-2 sentence summary of overall industry trends and opportunities based on company profile]",
  "aiAdoption": "[AI adoption percentage, e.g., '78%']",
  "cloudMigration": "[Cloud migration percentage, e.g., '45%']",
  "regulatory": "[Number of regulatory changes, e.g., '12']",
  "trendSnapshots": [
    {{
      "title": "[Trend title based on company profile]",
      "metric": "[Metric value]",
      "type": "[adoption|growth|performance]"
    }},
    {{
      "title": "[Trend title based on company profile]",
      "metric": "[Metric value]",
      "type": "[adoption|growth|performance]"
    }},
    {{
      "title": "[Trend title based on company profile]",
      "metric": "[Metric value]",
      "type": "[adoption|growth|performance]"
    }}
  ],
  "regionalHotspots": {{
    "[Region 1 from company profile]": "[Percentage value]",
    "[Region 2 from company profile]": "[Percentage value]",
    "[Region 3 from company profile if exists]": "[Percentage value]"
  }},
  "recommendations": {{
    "primaryFocus": "[Primary focus recommendation based on company profile]",
    "marketEntry": "[Market entry strategy recommendation based on company profile]"
  }},
  "risks": [
    "[Risk #1 based on company profile]",
    "[Risk #2 based on company profile]",
    "[Risk #3 based on company profile]"
  ],
  "visualCharts": {{
    "aiAdoptionTrends": ["[Quarter labels]"],
    "technologyBudgetAllocation": {{
      "[Category]": "[Percentage]",
      "[Category]": "[Percentage]",
      "[Category]": "[Percentage]"
    }}
  }}
}}

⚠️ OUTPUT NOTES:
- Use USD for monetary values in billions (B) or millions (M)
- regionalHotspots must use regions from the company profile, not hardcoded APAC/Europe/North America
- Include 2-5 regions in regionalHotspots based on what's in the company profile
- Keep bullet point recommendations short and actionable
- Return ONLY valid JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your JSON answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = template.format(company_profile_json=company_profile_json)

    # Step 3: Get LLM response
    response = _market_research_agent_output(agent_chain, prompt, company_profile_json, llm_backend)

    # Clean and escape the JSON string
    cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    # Escape newline and other control characters within string values
    cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

    # Parse to JSON (Python dict)
    parsed_json = json.loads(cleaned_str)

    # ✅ Return the Python dict
    return parsed_json

def Research_Market_3(agent_chain, pre_data, llm_backend: str = "default") -> dict:
    # Convert company profile to JSON string (handle both dict and string inputs)
    if isinstance(pre_data, dict):
        company_profile_json = json.dumps(pre_data, indent=2)
    elif isinstance(pre_data, str):
        # If it's already a string, try to parse and reformat for better readability
        try:
            parsed = json.loads(pre_data)
            company_profile_json = json.dumps(parsed, indent=2)
        except Exception:
            company_profile_json = pre_data
    else:
        company_profile_json = str(pre_data)
    
    # Construct prompt with full company profile and WebSearch instructions
    template = """Task: Research and compile a comprehensive competitive landscape analysis, including competitor identification, market share data, SWOT analysis, recent news, feature comparisons, and market trends.

STEP 1 - COMPANY PROFILE DATA:
Review the complete company profile data below. Extract all relevant information about the company's industry, target markets, regions, and any other relevant attributes. Use this information to guide your competitive research.

Company Profile Data:
{company_profile_json}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
You MUST use the WebSearch tool extensively to find real, up-to-date competitive data. Based on the company profile above, identify the industry and target markets/regions, then perform comprehensive research:

1. Competitor Identification Research:
   - Search for real competitors operating in the company's industry and target markets/regions
   - Find actual competitor names, not generic examples
   - Example searches: "[industry] competitors [regions] 2026"
   - Example searches: "[industry] top companies [regions]"

2. Market Share Research:
   - Search for market share data by region for the company's target markets
   - Find competitor market share percentages from industry reports
   - Example searches: "[industry] market share [region] 2026"
   - Example searches: "[industry] competitor market share [regions]"
   - Extract regions from company profile for marketShareCharts - do NOT use hardcoded regions

3. Competitor News & Events Research:
   - Search for recent news, product launches, and events from competitors
   - Find M&A activity and strategic moves
   - Example searches: "[competitor name] news 2026 2027"
   - Example searches: "[industry] M&A activity [regions] 2026"

4. SWOT Analysis Research:
   - Search for competitor strengths, weaknesses, opportunities, and threats from industry reports
   - Find competitive positioning data and market opportunities
   - Find competitive threats and risks
   - Example searches: "[competitor name] SWOT analysis"
   - Example searches: "[industry] competitive analysis [regions]"
   - Example searches: "[competitor name] opportunities threats [regions]"

5. Feature Comparison Research:
   - Search for product/feature comparisons in the industry
   - Find competitive feature matrices
   - Example searches: "[industry] product comparison [regions]"
   - Example searches: "[industry] feature comparison tools"

6. Market Trends Research:
   - Search for current market trends and competitive dynamics
   - Find industry trend reports
   - Example searches: "[industry] market trends 2026 2027"

IMPORTANT RESEARCH GUIDELINES:
- Perform at least 7-10 WebSearch queries to ensure comprehensive coverage
- Cross-reference data from multiple sources for accuracy
- Focus on recent data (2026-2027) when available
- Provide specific metrics, competitor names, and sources where possible
- Extract target markets/regions from the company profile - do NOT assume or hardcode regions
- The marketShareCharts regions array should use regions from the company profile
- Competitor names must be REAL companies, not generic examples
- News headlines must be REAL recent news with sources
- Do NOT use hardcoded regions - use what's in the company profile

STEP 3 - OUTPUT FORMAT:
Return your findings in the following exact JSON format (use exact keys as shown):

{{
  "uiComponents": [
    {{
      "type": "section",
      "title": "[Section title based on company profile]",
      "description": "[Section description based on company profile]",
      "metrics": [
        {{ "label": "[Metric label]", "value": "[Metric value]", "trend": "[up|down|stable]" }},
        {{ "label": "[Metric label]", "value": "[Metric value]", "trend": "[up|down|stable]" }}
      ],
      "tags": ["[Real Competitor name]", "[Real Competitor name]", "[Real Competitor name]"]
    }},
    {{
      "type": "report",
      "title": "[Report title based on company profile]",
      "executiveSummary": "[Executive summary of competitive landscape based on company profile]",
      "dataPoints": [
        {{
          "label": "[Data point label]",
          "value": "[Data point value]"
        }},
        {{
          "label": "[Data point label]",
          "value": "[Data point value]"
        }},
        {{
          "label": "[Data point label]",
          "value": "[Data point value]"
        }}
      ]
    }},
    {{
      "type": "swotAnalysis",
      "entities": [
        {{
          "name": "[Real Competitor name]",
          "strengths": ["[Strength]", "[Strength]"],
          "weaknesses": ["[Weakness]", "[Weakness]"],
          "opportunities": ["[Opportunity]", "[Opportunity]"],
          "threats": ["[Threat]", "[Threat]"]
        }},
        {{
          "name": "[Real Competitor name]",
          "strengths": ["[Strength]", "[Strength]"],
          "weaknesses": ["[Weakness]", "[Weakness]"],
          "opportunities": ["[Opportunity]", "[Opportunity]"],
          "threats": ["[Threat]", "[Threat]"]
        }}
      ]
    }},
    {{
      "type": "news",
      "headlines": [
        "[Real News headline #1 with source]",
        "[Real News headline #2 with source]",
        "[Real News headline #3 with source]"
      ]
    }},
    {{
      "type": "marketShareCharts",
      "regions": [
        {{
          "name": "[Region from company profile]",
          "data": {{
            "[Real Competitor]": "[Market share percentage]",
            "[Real Competitor]": "[Market share percentage]",
            "[Real Competitor]": "[Market share percentage]",
            "Others": "[Market share percentage]"
          }}
        }},
        {{
          "name": "[Region from company profile]",
          "data": {{
            "[Real Competitor]": "[Market share percentage]",
            "[Real Competitor]": "[Market share percentage]",
            "[Real Competitor]": "[Market share percentage]",
            "Others": "[Market share percentage]"
          }}
        }}
      ]
    }},
    {{
      "type": "featureComparison",
      "features": ["[Feature]", "[Feature]", "[Feature]", "[Feature]"],
      "tools": {{
        "[Real Tool/Competitor name]": ["[Comparison value]", "[Comparison value]", "[Comparison value]", "[Comparison value]"],
        "[Real Tool/Competitor name]": ["[Comparison value]", "[Comparison value]", "[Comparison value]", "[Comparison value]"],
        "[Real Tool/Competitor name]": ["[Comparison value]", "[Comparison value]", "[Comparison value]", "[Comparison value]"],
        "[Real Tool/Competitor name]": ["[Comparison value]", "[Comparison value]", "[Comparison value]", "[Comparison value]"]
      }}
    }},
    {{
      "type": "mnaInsights",
      "insights": [
        {{
          "label": "[Insight label]",
          "description": "[Insight description]"
        }},
        {{
          "label": "[Insight label]",
          "description": "[Insight description]"
        }},
        {{
          "label": "[Insight label]",
          "description": "[Insight description]"
        }}
      ]
    }},
    {{
      "type": "marketTrends",
      "charts": [
        {{ "name": "[Chart name]", "xAxis": "[X-axis labels]" }},
        {{ "name": "[Chart name]", "xAxis": ["[X-axis label]", "[X-axis label]"] }}
      ]
    }}
  ]
}}

⚠️ OUTPUT NOTES:
- Use USD for monetary values in billions (B) or millions (M)
- Competitor names must be REAL companies, not generic examples
- News headlines must be REAL recent news (within 6 months) with sources
- Market share percentages must have sources
- marketShareCharts regions must use regions from the company profile, not hardcoded regions
- Include 2-5 regions in marketShareCharts based on what's in the company profile
- Keep bullet point recommendations short and actionable
- Return ONLY valid JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your JSON answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = template.format(company_profile_json=company_profile_json)

    # Step 3: Get LLM response
    response = _market_research_agent_output(agent_chain, prompt, company_profile_json, llm_backend)

    # Clean and escape the JSON string
    cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    # Escape newline and other control characters within string values
    cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

    # Parse to JSON (Python dict)
    parsed_json = json.loads(cleaned_str)

    # ✅ Return the Python dict
    return parsed_json

def Research_Market_4(agent_chain, pre_data, llm_backend: str = "default") -> dict:
    # Convert company profile to JSON string (handle both dict and string inputs)
    if isinstance(pre_data, dict):
        company_profile_json = json.dumps(pre_data, indent=2)
    elif isinstance(pre_data, str):
        # If it's already a string, try to parse and reformat for better readability
        try:
            parsed = json.loads(pre_data)
            company_profile_json = json.dumps(parsed, indent=2)
        except Exception:
            company_profile_json = pre_data
    else:
        company_profile_json = str(pre_data)
    
    # Construct prompt with full company profile and WebSearch instructions
    template = """Task: Research and compile a comprehensive regulatory and compliance analysis, including key regulatory updates, compliance frameworks, regional requirements, and strategic recommendations.

STEP 1 - COMPANY PROFILE DATA:
Review the complete company profile data below. Extract all relevant information about the company's industry, target markets, regions, and any other relevant attributes. Use this information to guide your regulatory research.

Company Profile Data:
{company_profile_json}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
You MUST use the WebSearch tool extensively to find real, up-to-date regulatory and compliance data. Based on the company profile above, identify the industry and target markets/regions, then perform comprehensive research:

1. Regulatory Framework Research:
   - Search for region-specific regulatory frameworks for the company's target markets/regions
   - Find industry-specific compliance requirements
   - Example searches: "[region] [industry] regulatory framework 2026 2027"
   - Example searches: "[region] [industry] compliance requirements"

2. Regulatory Updates Research:
   - Search for recent regulatory changes and updates (2026-2027) in the company's industry and target regions
   - Find upcoming mandates and deadlines
   - Example searches: "[industry] regulatory changes [regions] 2026 2027"
   - Example searches: "[industry] upcoming regulations [regions]"

3. Compliance Deadlines Research:
   - Search for specific compliance deadlines and timelines
   - Find mandatory requirements with dates
   - Example searches: "[region] [industry] compliance deadlines 2026 2027"
   - Example searches: "[industry] regulatory deadlines [regions]"

4. Regional Compliance Research:
   - Search for compliance requirements for each target region from the company profile
   - Find region-specific regulatory bodies and frameworks
   - Example searches: "[region] [industry] compliance framework"
   - Extract regions from company profile - do NOT use hardcoded regions

5. Impact Assessment Research:
   - Search for impact assessments of regulatory changes on the industry
   - Find risk levels and compliance priorities
   - Example searches: "[industry] regulatory impact assessment [regions]"

IMPORTANT RESEARCH GUIDELINES:
- Perform at least 7-10 WebSearch queries to ensure comprehensive coverage
- Cross-reference data from multiple sources for accuracy
- Focus on recent data (2026-2027) when available
- Provide specific framework names, regulatory body names, and deadline dates
- Extract target markets/regions from the company profile - do NOT assume or hardcode regions
- The regionalData array should use regions from the company profile
- Framework names must be official (e.g., "GDPR", "HIPAA", "SOC 2", not generic)
- Deadlines must be specific dates (YYYY-MM-DD format when possible)
- Do NOT use hardcoded regions - use what's in the company profile

STEP 3 - OUTPUT FORMAT:
Return your findings in the following exact JSON format (use exact keys as shown):

{{
  "executiveSummary": "[1-2 sentence summary of regulatory landscape and compliance requirements based on company profile]",
  "keyUpdates": [
    {{
      "title": "[Real regulatory update title]",
      "description": "[Real update description with date/source]",
      "tag": "[New|Update|Risk|High Priority]",
      "icon": "[icon name]"
    }},
    {{
      "title": "[Real regulatory update title]",
      "description": "[Real update description with date/source]",
      "tag": "[New|Update|Risk|High Priority]",
      "icon": "[icon name]"
    }},
    {{
      "title": "[Real regulatory update title]",
      "description": "[Real update description with date/source]",
      "tag": "[New|Update|Risk|High Priority]",
      "icon": "[icon name]"
    }},
    {{
      "title": "[Real regulatory update title]",
      "description": "[Real update description with date/source]",
      "tag": "[New|Update|Risk|High Priority]",
      "icon": "[icon name]"
    }}
  ],
  "visualDataCards": [
    {{
      "title": "[Card title]",
      "type": "[bar-chart|timeline|percentage]",
      "data": [
        {{ "label": "[Label]", "value": [numeric value] }},
        {{ "label": "[Label]", "value": [numeric value] }},
        {{ "label": "[Label]", "value": [numeric value] }},
        {{ "label": "[Label]", "value": [numeric value] }}
      ]
    }},
    {{
      "title": "[Card title]",
      "type": "[bar-chart|timeline|percentage]",
      "data": [
        {{ "label": "[Label]", "time": "[Time period]" }},
        {{ "label": "[Label]", "time": "[Time period]" }},
        {{ "label": "[Label]", "time": "[Time period]" }}
      ]
    }},
    {{
      "title": "[Card title]",
      "type": "[bar-chart|timeline|percentage]",
      "data": [
        {{ "label": "[Label]", "value": [numeric value] }},
        {{ "label": "[Label]", "value": [numeric value] }},
        {{ "label": "[Label]", "value": [numeric value] }}
      ]
    }}
  ],
  "regionalData": [
    {{
      "region": "[Region from company profile]",
      "framework": "[Official regulatory framework name]",
      "deadline": "[Specific deadline date or status]",
      "impact": "[High|Medium|Low]",
      "status": "[Active|Evolving|Mandatory]",
      "requirements": "[Key requirements]"
    }},
    {{
      "region": "[Region from company profile]",
      "framework": "[Official regulatory framework name]",
      "deadline": "[Specific deadline date or status]",
      "impact": "[High|Medium|Low]",
      "status": "[Active|Evolving|Mandatory]",
      "requirements": "[Key requirements]"
    }},
    {{
      "region": "[Region from company profile]",
      "framework": "[Official regulatory framework name]",
      "deadline": "[Specific deadline date or status]",
      "impact": "[High|Medium|Low]",
      "status": "[Active|Evolving|Mandatory]",
      "requirements": "[Key requirements]"
    }},
    {{
      "region": "[Region from company profile]",
      "framework": "[Official regulatory framework name]",
      "deadline": "[Specific deadline date or status]",
      "impact": "[High|Medium|Low]",
      "status": "[Active|Evolving|Mandatory]",
      "requirements": "[Key requirements]"
    }}
  ],
  "strategicRecommendations": {{
    "mitigateRegulatoryRisks": [
      "[Recommendation #1 based on company profile]",
      "[Recommendation #2 based on company profile]",
      "[Recommendation #3 based on company profile]",
      "[Recommendation #4 based on company profile]"
    ],
    "competitivePositioning": [
      "[Recommendation #1 based on company profile]",
      "[Recommendation #2 based on company profile]",
      "[Recommendation #3 based on company profile]",
      "[Recommendation #4 based on company profile]"
    ],
    "goToMarketStrategy": [
      "[Recommendation #1 based on company profile]",
      "[Recommendation #2 based on company profile]",
      "[Recommendation #3 based on company profile]",
      "[Recommendation #4 based on company profile]"
    ]
  }}
}}

⚠️ OUTPUT NOTES:
- Use USD for monetary values in billions (B) or millions (M)
- Framework names must be official (e.g., "GDPR", "HIPAA", "SOC 2", "ISO 27001", not generic)
- Deadlines must be specific dates (YYYY-MM-DD format when possible) or clear status
- regionalData must use regions from the company profile, not hardcoded regions
- Include 2-5 regions in regionalData based on what's in the company profile
- Key updates must be REAL regulatory updates with dates/sources, not generic examples
- Keep bullet point recommendations short and actionable
- Return ONLY valid JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your JSON answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = template.format(company_profile_json=company_profile_json)

    # Step 3: Get LLM response
    response = _market_research_agent_output(agent_chain, prompt, company_profile_json, llm_backend)

    # Clean and escape the JSON string
    cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    # Escape newline and other control characters within string values
    cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

    # Parse to JSON (Python dict)
    parsed_json = json.loads(cleaned_str)

    # ✅ Return the Python dict
    return parsed_json

def Research_Market_5(agent_chain, pre_data, llm_backend: str = "default") -> dict:
    # Convert company profile to JSON string (handle both dict and string inputs)
    if isinstance(pre_data, dict):
        company_profile_json = json.dumps(pre_data, indent=2)
    elif isinstance(pre_data, str):
        # If it's already a string, try to parse and reformat for better readability
        try:
            parsed = json.loads(pre_data)
            company_profile_json = json.dumps(parsed, indent=2)
        except Exception:
            company_profile_json = pre_data
    else:
        company_profile_json = str(pre_data)
    
    # Construct prompt with full company profile and WebSearch instructions
    template = """Task: Research and compile a comprehensive market entry and growth strategy analysis, including entry barriers, channel strategies, competitive differentiation, SWOT analysis, and strategic timeline.

STEP 1 - COMPANY PROFILE DATA:
Review the complete company profile data below. Extract all relevant information about the company's industry, target markets, regions, company size, strategic goals, and any other relevant attributes. Use this information to guide your market entry research.

Company Profile Data:
{company_profile_json}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
You MUST use the WebSearch tool extensively to find real, up-to-date market entry and growth strategy data. Based on the company profile above, identify the industry and target markets/regions, then perform comprehensive research:

1. Market Entry Barriers Research:
   - Search for market entry barriers and challenges in the company's industry and target regions
   - Find regulatory, competitive, and operational barriers
   - Example searches: "[industry] market entry barriers [regions] 2026"
   - Example searches: "[industry] entry challenges [regions]"

2. Channel Strategy Research:
   - Search for successful channel strategies and go-to-market approaches in the industry
   - Find distribution and sales channel best practices
   - Example searches: "[industry] channel strategy [regions]"
   - Example searches: "[industry] go-to-market strategy [regions]"

3. Competitive Differentiation Research:
   - Search for competitive differentiation strategies in the industry
   - Find unique value propositions and positioning strategies
   - Example searches: "[industry] competitive differentiation [regions]"
   - Example searches: "[industry] value proposition [regions]"

4. Market Entry Timeline Research:
   - Search for market entry timelines and phases from case studies
   - Find typical time-to-market estimates for the industry
   - Example searches: "[industry] market entry timeline [regions]"
   - Example searches: "[industry] time to market [regions]"

5. SWOT Analysis Research:
   - Search for industry SWOT analysis and competitive positioning
   - Find strengths, weaknesses, opportunities, and threats in the market
   - Example searches: "[industry] SWOT analysis [regions]"
   - Example searches: "[industry] market opportunities [regions]"

6. Risk Assessment Research:
   - Search for market entry risks and mitigation strategies
   - Find risk factors specific to the industry and regions
   - Example searches: "[industry] market entry risks [regions]"
   - Example searches: "[industry] risk assessment [regions]"

IMPORTANT RESEARCH GUIDELINES:
- Perform at least 7-10 WebSearch queries to ensure comprehensive coverage
- Cross-reference data from multiple sources for accuracy
- Focus on recent data (2026-2027) when available
- Provide specific examples, case studies, and sources where possible
- Extract target markets/regions from the company profile - do NOT assume or hardcode regions
- Entry barriers, channel strategies, and recommendations must be based on the company's actual industry and target markets
- Timeline should be realistic based on industry standards and company profile
- Do NOT use generic examples - use real industry data

STEP 3 - OUTPUT FORMAT:
Return your findings in the following exact JSON format (use exact keys as shown):

{{
  "executiveSummary": "[1-2 sentence summary of market entry opportunity and challenges based on company profile]",
  "entryBarriers": [
    "[Real entry barrier #1 based on company profile]",
    "[Real entry barrier #2 based on company profile]",
    "[Real entry barrier #3 based on company profile]",
    "[Real entry barrier #4 based on company profile]"
  ],
  "recommendedChannel": "[Recommended channel strategy based on company profile]",
  "timeToMarket": "[Time to market estimate based on company profile, e.g., '12-18 months']",
  "topBarrier": "[Top barrier description based on company profile]",
  "competitiveDifferentiation": [
    "[Differentiation factor #1 based on company profile]",
    "[Differentiation factor #2 based on company profile]",
    "[Differentiation factor #3 based on company profile]",
    "[Differentiation factor #4 based on company profile]"
  ],
  "strategicRecommendations": [
    "[Strategic recommendation #1 based on company profile]",
    "[Strategic recommendation #2 based on company profile]",
    "[Strategic recommendation #3 based on company profile]",
    "[Strategic recommendation #4 based on company profile]"
  ],
  "riskAssessment": [
    "[Risk #1 based on company profile]",
    "[Risk #2 based on company profile]",
    "[Risk #3 based on company profile]"
  ],
  "swot": {{
    "strengths": ["[Strength based on company profile]", "[Strength based on company profile]"],
    "weaknesses": ["[Weakness based on company profile]", "[Weakness based on company profile]"],
    "opportunities": ["[Opportunity based on company profile]", "[Opportunity based on company profile]"],
    "threats": ["[Threat based on company profile]", "[Threat based on company profile]"]
  }},
  "timeline": [
    {{
      "label": "[Timeline label]",
      "phase": "[Phase name]",
      "quarter": "[Quarter, e.g., 'Q1 2027']",
      "timestamp": "[ISO timestamp, e.g., '2027-01-01']"
    }},
    {{
      "label": "[Timeline label]",
      "phase": "[Phase name]",
      "quarter": "[Quarter, e.g., 'Q2 2027']",
      "timestamp": "[ISO timestamp, e.g., '2027-04-01']"
    }},
    {{
      "label": "[Timeline label]",
      "phase": "[Phase name]",
      "quarter": "[Quarter, e.g., 'Q3 2027']",
      "timestamp": "[ISO timestamp, e.g., '2027-07-01']"
    }}
  ]
}}

⚠️ OUTPUT NOTES:
- Use USD for monetary values in billions (B) or millions (M)
- Entry barriers must be REAL barriers for the company's industry and target markets
- Channel strategy must be relevant to the company's industry and target markets
- Time to market should be realistic based on industry standards
- SWOT analysis must be specific to the company profile, not generic
- Timeline should be based on realistic market entry phases
- Keep bullet point recommendations short and actionable
- Return ONLY valid JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your JSON answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = template.format(company_profile_json=company_profile_json)

    # Step 3: Get LLM response
    response = _market_research_agent_output(agent_chain, prompt, company_profile_json, llm_backend)

    # Clean and escape the JSON string
    cleaned_str = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    # Escape newline and other control characters within string values
    cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r') + '"', cleaned_str, flags=re.DOTALL)

    # Parse to JSON (Python dict)
    parsed_json = json.loads(cleaned_str)

    # ✅ Return the Python dict
    return parsed_json



COMPONENT_FUNCTIONS = {
    "market size & opportunity": Research_Market_1,
    "industry trends report": Research_Market_2,
    "competitor landscape": Research_Market_3,
    "regulatory & compliance highlights" : Research_Market_4,
    "market entry & growth strategy" : Research_Market_5
}

COMPONENT_FUNCTIONS_CLAUDE = {
    "market size & opportunity": lambda agent_chain, d: Research_Market_1(agent_chain, d, "claude"),
    "industry trends report": lambda agent_chain, d: Research_Market_2(agent_chain, d, "claude"),
    "competitor landscape": lambda agent_chain, d: Research_Market_3(agent_chain, d, "claude"),
    "regulatory & compliance highlights": lambda agent_chain, d: Research_Market_4(agent_chain, d, "claude"),
    "market entry & growth strategy": lambda agent_chain, d: Research_Market_5(agent_chain, d, "claude"),
}


async def run_market_research(driver, mongo, pc, agent_chain, request: MarketRequest, llm_backend: str = "groq") -> dict:
    """Unified worker for both Groq and Claude market-research variants.

    The caller (router) is responsible for:
    - API-key precheck before invoking with llm_backend="claude"
    - Catching BudgetExhaustedError around this call for the Claude variant
    """
    component_name = request.component_name.strip().lower()

    components = COMPONENT_FUNCTIONS_CLAUDE if llm_backend == "claude" else COMPONENT_FUNCTIONS
    research_function = components.get(component_name)
    if not research_function:
        raise UnsupportedComponentError(
            f"Unsupported component_name: {request.component_name}"
        )

    if not request.refresh:
        latest_report = await asyncio.to_thread(
            _find_latest_market_research_report,
            mongo,
            request.user_id,
            component_name,
        )
        if latest_report:
            return {"status": "success", "data": latest_report}

    def fetch_company_profile():
        with driver.session() as session:
            if request.org_id:
                result = session.run(
                    "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                    org_id=request.org_id,
                )
            else:
                result = session.run("MATCH (c:CompanyProfile) RETURN c LIMIT 1")
            return result.single()

    record = await asyncio.to_thread(fetch_company_profile)
    if not record:
        org_msg = f" for org_id: {request.org_id}" if request.org_id else ""
        raise CompanyProfileNotFoundError(f"No company profile found in Neo4j{org_msg}")

    company_profile = dict(record.values()[0])
    if "socialMediaUrls" in company_profile and isinstance(company_profile["socialMediaUrls"], str):
        try:
            company_profile["socialMediaUrls"] = json.loads(company_profile["socialMediaUrls"])
        except json.JSONDecodeError:
            pass

    market_context_queries = _build_market_context_queries(component_name, company_profile)
    pinecone_context = await asyncio.to_thread(
        _fetch_pinecone_supporting_context,
        pc,
        market_context_queries,
        request.org_id,
        3,
    )
    company_profile["pinecone_context_queries"] = market_context_queries
    company_profile["pinecone_supporting_context"] = pinecone_context

    max_retries = 2
    research_result = None
    for attempt in range(1, max_retries + 1):
        try:
            research_result = await asyncio.to_thread(research_function, agent_chain, company_profile)
            break
        except BudgetExhaustedError:
            # Re-raise immediately — caller (router) catches and maps to HTTP 429
            raise
        except Exception:
            if attempt == max_retries:
                raise
            await asyncio.sleep(1)

    if not isinstance(research_result, dict):
        research_result = {"data": research_result}

    research_result["user_id"] = request.user_id
    if request.org_id:
        research_result["org_id"] = request.org_id
    research_result["component_name"] = component_name
    research_result["timestamp"] = datetime.now(timezone.utc)

    await asyncio.to_thread(_insert_market_research_report, mongo, research_result)
    research_result.pop("_id", None)
    return {"status": "success", "data": research_result}

