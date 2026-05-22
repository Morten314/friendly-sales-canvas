"""Signals service: Scout/Profiler signal search + batch generation.

Phase B will dedupe search_signals_scout and search_signals_profiler
(~80% overlapping). For now they remain near-duplicates.
"""
import json
import re
import asyncio
import uuid
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from fastapi import HTTPException

from app.core import clients
from app.core import llm_config
from app.core.config import tavily_api_key, claude_sonnet_model
from app.models.market_research import MarketRequest
from app.models.signals import SignalActionRequest, SignalAskRequest
from app.services._llm_helpers import (
    CLAUDE_RESEARCH_MAX_TOKENS,
    _tavily_context_and_urls,
    _claude_messages_text,
)
from app.services._retrieval import (
    _build_signal_context_queries,
    _fetch_pinecone_supporting_context,
)
from app.services._claude_budget import (
    CLAUDE_SIGNAL_TOKEN_LIMIT_5M,
    CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS,
    CLAUDE_API_KEY,
    _estimate_token_count,
    _reserve_claude_signal_budget,
    _finalize_claude_signal_budget,
)

logger = logging.getLogger(__name__)


def _signals_agent_output(prompt: str, company_profile_seed: str, llm_backend: str) -> tuple:
    """Returns (model_output_text, tavily_urls) for signal JSON parsing."""
    tavily_urls: List[str] = []
    if llm_backend != "claude":
        raw_response = llm_config.agent_chain.invoke({"input": prompt})
        response = raw_response["output"]
        try:
            if hasattr(raw_response, "intermediate_steps"):
                for step in raw_response.intermediate_steps:
                    if len(step) > 1 and isinstance(step[1], list):
                        for result in step[1]:
                            if isinstance(result, dict) and "url" in result:
                                tavily_urls.append(result["url"])
            if not tavily_urls:
                url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
                found_urls = re.findall(url_pattern, response)
                tavily_urls = list(set(found_urls))[:5]
        except Exception:
            pass
        return response, tavily_urls

    seed = " ".join(str(company_profile_seed).split())[:1200]
    web_ctx, tavily_urls = _tavily_context_and_urls(
        f"B2B market competitor industry news ICP customer trends 2026 {seed}"
    )
    augmented = f"{prompt}\n\nWEB SEARCH RESULTS:\n{web_ctx}\n"
    response = _claude_messages_text(augmented, max_tokens=CLAUDE_RESEARCH_MAX_TOKENS)
    if not tavily_urls:
        url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
        found_urls = re.findall(url_pattern, response)
        tavily_urls = list(set(found_urls))[:5]
    return response, tavily_urls


# Signals Research Functions
def search_signals_scout(pre_data, llm_backend: str = "default") -> dict:
    """Search for market, competitor, and industry trend signals for Scout agent using WebSearch"""

    # Extract existing headlines and leads if present
    existing_headlines = []
    leads_data = []
    company_profile_data = pre_data

    if isinstance(pre_data, dict):
        existing_headlines = pre_data.get("existing_headlines", [])
        leads_data = pre_data.get("leads_data", [])
        # Remove metadata fields from dict for company profile
        company_profile_data = {k: v for k, v in pre_data.items() if k not in ["existing_headlines", "leads_data", "icp_data"]}
        company_profile_json = json.dumps(company_profile_data, indent=2)
    elif isinstance(pre_data, str):
        # If it's already a string, try to parse and reformat for better readability
        try:
            parsed = json.loads(pre_data)
            existing_headlines = parsed.get("existing_headlines", [])
            leads_data = parsed.get("leads_data", [])
            company_profile_data = {k: v for k, v in parsed.items() if k not in ["existing_headlines", "leads_data", "icp_data"]}
            company_profile_json = json.dumps(company_profile_data, indent=2)
        except:
            company_profile_json = pre_data
    else:
        company_profile_json = str(pre_data)

    # Format leads data for prompt - pass all data without field name assumptions
    leads_text = ""
    if leads_data and len(leads_data) > 0:
        print(f"[DEBUG Scout] Processing {len(leads_data)} leads for signal generation")
        # Convert all leads to JSON string - no field name assumptions, pass everything
        try:
            # Limit to 50 leads to avoid prompt size issues, but include all fields
            leads_for_context = leads_data[:50]
            leads_json = json.dumps(leads_for_context, indent=2, default=str)

            leads_text = f"""
STEP 1.2 - LEADS DATA (CRITICAL - Use this to prioritize signal relevance):
Your organization has {len(leads_data)} active leads in your pipeline. Below is the complete lead data with all available fields. You MUST analyze this data and use it when generating signals.

Complete Leads Data (showing up to 50 most recent leads):
{leads_json}

CRITICAL INSTRUCTIONS:
- Analyze ALL fields in the leads data above - do not assume any specific field names
- Extract any company names, industries, regions, technologies, or other relevant information from whatever fields exist
- Prioritize signals that relate to companies, industries, regions, or any other attributes found in your leads pipeline
- If a signal mentions a company or organization, check if it matches any entity in your leads data
- Focus on signals that would be relevant to your actual sales pipeline based on the lead data structure
- Use the lead data to understand your target market, customer segments, and sales priorities
- This will make the signals more actionable for your sales team
"""
        except Exception as e:
            print(f"[ERROR] Failed to format leads data: {e}")
            # Fallback: just mention leads exist
            leads_text = f"""
STEP 1.2 - LEADS DATA:
Your organization has {len(leads_data)} active leads in your pipeline. Use this information to prioritize signals relevant to your actual sales pipeline.
"""

    # Format existing headlines for prompt
    existing_headlines_text = ""
    if existing_headlines:
        headlines_list = "\n".join([f"- {h}" for h in existing_headlines[:30]])  # Limit to 30 for prompt size
        existing_headlines_text = f"""
STEP 1.5 - EXISTING SIGNALS (CRITICAL - AVOID DUPLICATES):
You MUST avoid generating signals similar to these existing signal headlines. Review them carefully and ensure your new signal is completely different and unique:

Existing Signal Headlines:
{headlines_list}

IMPORTANT: Your new signal headline must be about a DIFFERENT news story, market development, or industry trend. Do NOT generate a signal about the same event, company news, or market development as any of the above headlines, even if worded differently. Search for NEW and UNIQUE signals that haven't been covered yet.
"""

    # Construct prompt with full company profile and WebSearch instructions
    template = """Task: Research and identify a high-quality, actionable market signal for a sales scout agent. This signal should help the sales team understand market opportunities, competitor movements, or industry trends that could impact their sales strategy.

STEP 1 - COMPANY PROFILE DATA:
Review the complete company profile data below. Extract all relevant information about the company's industry, target markets, regions, company size, strategic goals, and any other relevant attributes.

Company Profile Data:
{company_profile_json}
{leads_section}
{existing_headlines_section}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
You MUST use the WebSearch tool to find a REAL, RECENT, and ACTIONABLE market signal. Based on the company profile above, perform comprehensive research to identify:

1. Market Opportunity Signals:
   - Search for recent market growth, trends, or opportunities in the company's industry
   - Find market size changes, adoption rates, or emerging segments
   - Example searches: "[industry] market trends [regions] 2026"
   - Example searches: "[industry] growth opportunities 2026"

2. Competitor Activity Signals:
   - Search for competitor funding rounds, product launches, or strategic moves
   - Find market share changes or competitive landscape shifts
   - Example searches: "[industry] competitor funding 2026"
   - Example searches: "[industry] competitor product launch 2026"

3. Industry Trend Signals:
   - Search for technology adoption, regulatory changes, or industry shifts
   - Find emerging trends that could impact sales strategy
   - Example searches: "[industry] technology adoption 2026"
   - Example searches: "[industry] regulatory changes 2026"

4. Market Dynamics Signals:
   - Search for buying behavior changes, market disruptions, or new opportunities
   - Find signals that indicate market readiness or buying intent
   - Example searches: "[industry] buying trends [regions] 2026"
   - Example searches: "[industry] market disruption 2026"

IMPORTANT RESEARCH GUIDELINES:
- Perform at least 5-7 WebSearch queries to find the BEST signal
- Focus on RECENT signals from 2026 and recent past (within last 1-3 months when possible)
- CURRENT YEAR IS 2026 - Do NOT use future dates like 2027 in signals. Use actual current dates from 2026 or recent past dates.
- The signal must be REAL and ACTIONABLE - not generic
- Extract industry and target markets from the company profile
- Cross-reference multiple sources to verify signal accuracy
- Find 1-2 different source URLs for the signal (preferably from different publications/sources)
- Prioritize signals that are relevant to the company's specific industry and target markets
- Generate 3 thoughtful NBA questions that help users dive deeper into the signal's implications

STEP 3 - OUTPUT FORMAT:
Return your findings in the following exact JSON format (use exact keys as shown):

{{
  "headline": "[Compelling, specific headline about the signal - must be real and recent]",
  "snippet": "[Brief 1-2 sentence summary of the signal]",
  "description": "[One full paragraph (4-6 sentences) providing detailed context about the signal. Explain what the signal means, why it matters for the company's sales strategy, what opportunities or challenges it presents, and how the sales team should respond. Make it descriptive and actionable.]",
  "sourceUrl": "[Real source URL where this signal was found]",
  "sourceLabel": "[Source type: Industry report, News article, Research report, Funding news, etc.]",
  "source": [
    {{
      "citation": "[Publication name - Article title - Date if available, e.g., 'TechCrunch - AI Market Growth Report - January 15, 2026']. Use actual dates from 2026 or recent past, NOT future dates.",
      "url": "[First source URL where this signal was found]"
    }},
    {{
      "citation": "[Publication name - Article title - Date if available, e.g., 'Industry Research Report - Market Trends Analysis - January 2026']",
      "url": "[Second source URL (if available from different source)]"
    }}
  ],
  "nextBestMoves": [
    "[Actionable question/suggestion #1 related to the signal]",
    "[Actionable question/suggestion #2 related to the signal]"
  ],
  "NBAs": [
    {{
      "nba": "[First suggested question the user should ask based on this signal]",
      "prompt": "[Detailed prompt that includes the signal context, company profile information, and specific question to ask an LLM for a comprehensive answer. The prompt should be self-contained and provide all necessary context for the LLM to answer the question in detail.]"
    }},
    {{
      "nba": "[Second suggested question the user should ask based on this signal]",
      "prompt": "[Detailed prompt that includes the signal context, company profile information, and specific question to ask an LLM for a comprehensive answer. The prompt should be self-contained and provide all necessary context for the LLM to answer the question in detail.]"
    }},
    {{
      "nba": "[Third suggested question the user should ask based on this signal]",
      "prompt": "[Detailed prompt that includes the signal context, company profile information, and specific question to ask an LLM for a comprehensive answer. The prompt should be self-contained and provide all necessary context for the LLM to answer the question in detail.]"
    }}
  ],
  "contextualSuggestions": [
    {{"icon": "[icon name]", "text": "[Suggestion text related to signal]"}},
    {{"icon": "[icon name]", "text": "[Suggestion text related to signal]"}}
  ]
}}

⚠️ OUTPUT NOTES:
- headline must be REAL and SPECIFIC - include actual numbers, dates, or company names when available
- snippet should be concise (1-2 sentences)
- description must be ONE FULL PARAGRAPH (4-6 sentences) with detailed context
- sourceUrl must be a REAL, accessible URL
- sourceLabel should accurately describe the source type
- source must be an array with 1-2 objects, each containing "citation" and "url" fields
- citation should include publication name, article title, and date if available (e.g., "TechCrunch - AI Market Growth Report - January 15, 2026")
- IMPORTANT: Use actual dates from 2026 or recent past. Do NOT use future dates like 2027. Current year is 2026.
- url must be a REAL, accessible URL
- If only one source found, include one object in the array; if two sources found, include both
- nextBestMoves should be actionable questions related to the specific signal
- NBAs must contain exactly 3 suggested questions with detailed prompts for LLM queries
- Each NBA prompt should include: signal headline, signal description, company profile context, and the specific question to answer
- contextualSuggestions should be relevant to the signal content
- Return ONLY valid JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your JSON answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = template.format(
        company_profile_json=company_profile_json,
        leads_section=leads_text,
        existing_headlines_section=existing_headlines_text
    )

    response, tavily_urls = _signals_agent_output(prompt, company_profile_json, llm_backend)

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
    cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r').replace('"', '\\"') + '"', cleaned_str, flags=re.DOTALL)
    cleaned_str = re.sub(r'\"snippet\": \"(.*?)\"', lambda m: '"snippet": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r').replace('"', '\\"') + '"', cleaned_str, flags=re.DOTALL)
    cleaned_str = re.sub(r'\"headline\": \"(.*?)\"', lambda m: '"headline": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r').replace('"', '\\"') + '"', cleaned_str, flags=re.DOTALL)

    # Parse to JSON (Python dict)
    parsed_json = json.loads(cleaned_str)

    # Validate and fix URLs using Tavily URLs if available
    def validate_url(url, tavily_urls_list):
        """Validate URL and replace with Tavily URL if invalid"""
        if not url or not isinstance(url, str):
            return tavily_urls_list[0] if tavily_urls_list else ""

        # Check if URL is valid format
        if not url.startswith(('http://', 'https://')):
            return tavily_urls_list[0] if tavily_urls_list else ""

        # If Tavily URLs available, try to match or use first one
        if tavily_urls_list:
            # Check if URL domain matches any Tavily URL
            url_domain = url.split('/')[2] if len(url.split('/')) > 2 else ""
            for tavily_url in tavily_urls_list:
                tavily_domain = tavily_url.split('/')[2] if len(tavily_url.split('/')) > 2 else ""
                if url_domain and url_domain == tavily_domain:
                    return tavily_url
            # If no match, use first Tavily URL
            return tavily_urls_list[0]

        return url

    # Validate sourceUrl
    source_url = validate_url(parsed_json.get("sourceUrl", ""), tavily_urls)

    # Validate source array URLs
    validated_sources = []
    source_array = parsed_json.get("source", [])
    for i, src in enumerate(source_array[:2]):  # Max 2 sources
        if isinstance(src, dict) and "url" in src:
            validated_url = validate_url(src["url"], tavily_urls[i:] if i < len(tavily_urls) else tavily_urls)
            validated_sources.append({
                "citation": src.get("citation", ""),
                "url": validated_url
            })

    # If no sources validated, use Tavily URLs directly
    if not validated_sources and tavily_urls:
        for i, tavily_url in enumerate(tavily_urls[:2]):
            validated_sources.append({
                "citation": f"Source {i+1}",
                "url": tavily_url
            })

    # Add metadata (ID will be generated in API layer to ensure uniqueness per org_id)
    from datetime import datetime
    hours_ago = 1  # Default, can be made dynamic based on signal recency
    timestamp = f"{hours_ago}h ago"

    result = {
        "agent": "scout",
        "timestamp": timestamp,
        "headline": parsed_json.get("headline", ""),
        "snippet": parsed_json.get("snippet", ""),
        "description": parsed_json.get("description", ""),
        "sourceUrl": source_url if source_url else (validated_sources[0]["url"] if validated_sources else ""),
        "sourceLabel": parsed_json.get("sourceLabel", ""),
        "source": validated_sources if validated_sources else parsed_json.get("source", []),
        "nextBestMoves": parsed_json.get("nextBestMoves", []),
        "NBAs": parsed_json.get("NBAs", []),
        "contextualSuggestions": parsed_json.get("contextualSuggestions", [])
    }

    return result

def search_signals_profiler(pre_data, llm_backend: str = "default") -> dict:
    """Search for ICP and customer-related signals for Profiler agent using WebSearch"""

    # Extract existing headlines and leads if present
    existing_headlines = []
    leads_data = []
    company_profile = {}
    icp_data = {}

    if isinstance(pre_data, dict):
        existing_headlines = pre_data.get("existing_headlines", [])
        leads_data = pre_data.get("leads_data", [])
        if "company_profile" in pre_data:
            company_profile = pre_data["company_profile"]
            icp_data = pre_data.get("icp_data", {})
        else:
            # Remove metadata fields from dict
            company_profile = {k: v for k, v in pre_data.items() if k not in ["existing_headlines", "leads_data", "icp_data"]}
            icp_data = {}
    else:
        try:
            parsed = json.loads(pre_data) if isinstance(pre_data, str) else {}
            existing_headlines = parsed.get("existing_headlines", [])
            leads_data = parsed.get("leads_data", [])
            if "company_profile" in parsed:
                company_profile = parsed["company_profile"]
                icp_data = parsed.get("icp_data", {})
            else:
                company_profile = {k: v for k, v in parsed.items() if k not in ["existing_headlines", "leads_data", "icp_data"]}
                icp_data = parsed.get("icp_data", {})
        except:
            company_profile = {}
            icp_data = {}

    # Format leads data for prompt - pass all data without field name assumptions
    leads_text = ""
    if leads_data and len(leads_data) > 0:
        print(f"[DEBUG Profiler] Processing {len(leads_data)} leads for signal generation")
        # Convert all leads to JSON string - no field name assumptions, pass everything
        try:
            # Limit to 50 leads to avoid prompt size issues, but include all fields
            leads_for_context = leads_data[:50]
            leads_json = json.dumps(leads_for_context, indent=2, default=str)

            leads_text = f"""
STEP 1.2 - LEADS DATA (CRITICAL - Use this to prioritize ICP signal relevance):
Your organization has {len(leads_data)} active leads in your pipeline. Below is the complete lead data with all available fields. You MUST analyze this data and use it when generating ICP signals.

Complete Leads Data (showing up to 50 most recent leads):
{leads_json}

CRITICAL INSTRUCTIONS:
- Analyze ALL fields in the leads data above - do not assume any specific field names
- Extract any company names, industries, regions, company sizes, technologies, buyer personas, or other relevant ICP information from whatever fields exist
- Prioritize ICP signals that relate to companies, industries, regions, company sizes, or any other attributes found in your leads pipeline
- If a signal mentions a company or organization, check if it matches any entity in your leads data
- Focus on ICP signals that would be relevant to your actual sales/profiling pipeline based on the lead data structure
- Use the lead data to understand your target ICP segments, customer profiles, and sales priorities
- This will make the ICP signals more actionable for your sales/profiling team
"""
        except Exception as e:
            print(f"[ERROR] Failed to format leads data: {e}")
            # Fallback: just mention leads exist
            leads_text = f"""
STEP 1.2 - LEADS DATA:
Your organization has {len(leads_data)} active leads in your pipeline. Use this information to prioritize ICP signals relevant to your actual sales pipeline.
"""

    # Convert to JSON string for prompt
    context_data = {
        "company_profile": company_profile,
        "icp_data": icp_data
    }
    context_json = json.dumps(context_data, indent=2)

    # Format existing headlines for prompt
    existing_headlines_text = ""
    if existing_headlines:
        headlines_list = "\n".join([f"- {h}" for h in existing_headlines[:30]])  # Limit to 30 for prompt size
        existing_headlines_text = f"""
STEP 1.5 - EXISTING SIGNALS (CRITICAL - AVOID DUPLICATES):
You MUST avoid generating signals similar to these existing signal headlines. Review them carefully and ensure your new signal is completely different and unique:

Existing Signal Headlines:
{headlines_list}

IMPORTANT: Your new signal headline must be about a DIFFERENT news story, market development, or industry trend. Do NOT generate a signal about the same event, company news, or market development as any of the above headlines, even if worded differently. Search for NEW and UNIQUE signals that haven't been covered yet.
"""

    # Construct prompt with full company profile/ICP data and WebSearch instructions
    template = """Task: Research and identify a high-quality, actionable ICP/customer signal for a profiler agent. This signal should help the sales team understand customer buying behavior, ICP trends, or customer acquisition opportunities.

STEP 1 - COMPANY PROFILE AND ICP DATA:
Review the complete company profile and ICP data below. Extract all relevant information about the company's industry, target markets, regions, ICP segments, company sizes, buyer personas, and any other relevant attributes.

Company Profile and ICP Data:
{context_json}
{leads_section}
{existing_headlines_section}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
You MUST use the WebSearch tool to find a REAL, RECENT, and ACTIONABLE ICP/customer signal. Based on the company profile and ICP data above, perform comprehensive research to identify:

1. ICP Buying Behavior Signals:
   - Search for buying trends, purchase patterns, or buying signals in the company's ICP segments
   - Find customer acquisition trends or buying committee changes
   - Example searches: "[industry] [ICP segment] buying trends 2026"
   - Example searches: "[industry] customer acquisition [ICP segment] 2026"

2. Customer Spending Signals:
   - Search for tech spending, budget allocation, or investment trends in target ICP segments
   - Find customer spending patterns or budget increases
   - Example searches: "[industry] tech spending [company size] 2026"
   - Example searches: "[industry] budget allocation [ICP segment] 2026"

3. ICP Market Dynamics Signals:
   - Search for ICP segment growth, market expansion, or customer behavior changes
   - Find signals about target customer needs or pain points
   - Example searches: "[industry] [ICP segment] market trends 2026"
   - Example searches: "[industry] customer needs [ICP segment] 2026"

4. Customer Success Signals:
   - Search for customer success metrics, retention trends, or customer satisfaction in ICP segments
   - Find signals about customer lifecycle or engagement patterns
   - Example searches: "[industry] customer success [ICP segment] 2026"
   - Example searches: "[industry] customer retention [company size] 2026"

5. Buyer Persona Signals:
   - Search for decision maker trends, buying committee changes, or buyer behavior in target segments
   - Find signals about how target customers make purchasing decisions
   - Example searches: "[industry] buying committee [ICP segment] 2026"
   - Example searches: "[industry] decision maker trends 2026"

IMPORTANT RESEARCH GUIDELINES:
- Perform at least 5-7 WebSearch queries to find the BEST signal
- Focus on RECENT signals from 2026 and recent past (within last 1-3 months when possible)
- CURRENT YEAR IS 2026 - Do NOT use future dates like 2027 in signals. Use actual current dates from 2026 or recent past dates.
- The signal must be REAL and ACTIONABLE - not generic
- Extract industry, ICP segments, and target markets from the provided data
- Cross-reference multiple sources to verify signal accuracy
- Find 1-2 different source URLs for the signal (preferably from different publications/sources)
- Prioritize signals that are relevant to the company's specific ICP segments and target customers
- If ICP data is available, use it to make the signal more specific and relevant
- Generate 3 thoughtful NBA questions that help users dive deeper into the signal's implications for their ICP and sales strategy

STEP 3 - OUTPUT FORMAT:
Return your findings in the following exact JSON format (use exact keys as shown):

{{
  "headline": "[Compelling, specific headline about the ICP/customer signal - must be real and recent]",
  "snippet": "[Brief 1-2 sentence summary of the signal]",
  "description": "[One full paragraph (4-6 sentences) providing detailed context about the signal. Explain what the signal means for the company's ICP and target customers, why it matters for customer acquisition and sales strategy, what opportunities or challenges it presents for reaching the target ICP, and how the sales/profiling team should respond. Make it descriptive and actionable.]",
  "sourceUrl": "[Real source URL where this signal was found]",
  "sourceLabel": "[Source type: Market research, Customer research, Sales report, ICP analysis, etc.]",
  "source": [
    {{
      "citation": "[Publication name - Article title - Date if available, e.g., 'Market Research Report - Customer Buying Trends - January 15, 2026']. Use actual dates from 2026 or recent past, NOT future dates.",
      "url": "[First source URL where this signal was found]"
    }},
    {{
      "citation": "[Publication name - Article title - Date if available, e.g., 'Sales Report - ICP Analysis - January 2026']",
      "url": "[Second source URL (if available from different source)]"
    }}
  ],
  "nextBestMoves": [
    "[Actionable question/suggestion #1 related to the ICP signal]",
    "[Actionable question/suggestion #2 related to the ICP signal]"
  ],
  "NBAs": [
    {{
      "nba": "[First suggested question the user should ask based on this ICP signal]",
      "prompt": "[Detailed prompt that includes the signal context, company profile information, ICP data, and specific question to ask an LLM for a comprehensive answer. The prompt should be self-contained and provide all necessary context for the LLM to answer the question in detail.]"
    }},
    {{
      "nba": "[Second suggested question the user should ask based on this ICP signal]",
      "prompt": "[Detailed prompt that includes the signal context, company profile information, ICP data, and specific question to ask an LLM for a comprehensive answer. The prompt should be self-contained and provide all necessary context for the LLM to answer the question in detail.]"
    }},
    {{
      "nba": "[Third suggested question the user should ask based on this ICP signal]",
      "prompt": "[Detailed prompt that includes the signal context, company profile information, ICP data, and specific question to ask an LLM for a comprehensive answer. The prompt should be self-contained and provide all necessary context for the LLM to answer the question in detail.]"
    }}
  ],
  "contextualSuggestions": [
    {{"icon": "[icon name]", "text": "[Suggestion text related to ICP signal]"}},
    {{"icon": "[icon name]", "text": "[Suggestion text related to ICP signal]"}}
  ]
}}

⚠️ OUTPUT NOTES:
- headline must be REAL and SPECIFIC - include actual numbers, dates, or ICP segment details when available
- snippet should be concise (1-2 sentences)
- description must be ONE FULL PARAGRAPH (4-6 sentences) with detailed context about ICP/customer implications
- sourceUrl must be a REAL, accessible URL
- sourceLabel should accurately describe the source type
- source must be an array with 1-2 objects, each containing "citation" and "url" fields
- citation should include publication name, article title, and date if available (e.g., "Market Research Report - Customer Buying Trends - January 15, 2026")
- IMPORTANT: Use actual dates from 2026 or recent past. Do NOT use future dates like 2027. Current year is 2026.
- url must be a REAL, accessible URL
- If only one source found, include one object in the array; if two sources found, include both
- nextBestMoves should be actionable questions related to the specific ICP signal
- NBAs must contain exactly 3 suggested questions with detailed prompts for LLM queries
- Each NBA prompt should include: signal headline, signal description, company profile context, ICP data, and the specific question to answer
- contextualSuggestions should be relevant to the ICP signal content
- Return ONLY valid JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your JSON answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

    prompt = template.format(
        context_json=context_json,
        leads_section=leads_text,
        existing_headlines_section=existing_headlines_text
    )

    response, tavily_urls = _signals_agent_output(prompt, context_json, llm_backend)

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
    cleaned_str = re.sub(r'\"description\": \"(.*?)\"', lambda m: '"description": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r').replace('"', '\\"') + '"', cleaned_str, flags=re.DOTALL)
    cleaned_str = re.sub(r'\"snippet\": \"(.*?)\"', lambda m: '"snippet": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r').replace('"', '\\"') + '"', cleaned_str, flags=re.DOTALL)
    cleaned_str = re.sub(r'\"headline\": \"(.*?)\"', lambda m: '"headline": "' + m.group(1).replace('\n', '\\n').replace('\r', '\\r').replace('"', '\\"') + '"', cleaned_str, flags=re.DOTALL)

    # Parse to JSON (Python dict)
    parsed_json = json.loads(cleaned_str)

    # Validate and fix URLs using Tavily URLs if available
    def validate_url(url, tavily_urls_list):
        """Validate URL and replace with Tavily URL if invalid"""
        if not url or not isinstance(url, str):
            return tavily_urls_list[0] if tavily_urls_list else ""

        # Check if URL is valid format
        if not url.startswith(('http://', 'https://')):
            return tavily_urls_list[0] if tavily_urls_list else ""

        # If Tavily URLs available, try to match or use first one
        if tavily_urls_list:
            # Check if URL domain matches any Tavily URL
            url_domain = url.split('/')[2] if len(url.split('/')) > 2 else ""
            for tavily_url in tavily_urls_list:
                tavily_domain = tavily_url.split('/')[2] if len(tavily_url.split('/')) > 2 else ""
                if url_domain and url_domain == tavily_domain:
                    return tavily_url
            # If no match, use first Tavily URL
            return tavily_urls_list[0]

        return url

    # Validate sourceUrl
    source_url = validate_url(parsed_json.get("sourceUrl", ""), tavily_urls)

    # Validate source array URLs
    validated_sources = []
    source_array = parsed_json.get("source", [])
    for i, src in enumerate(source_array[:2]):  # Max 2 sources
        if isinstance(src, dict) and "url" in src:
            validated_url = validate_url(src["url"], tavily_urls[i:] if i < len(tavily_urls) else tavily_urls)
            validated_sources.append({
                "citation": src.get("citation", ""),
                "url": validated_url
            })

    # If no sources validated, use Tavily URLs directly
    if not validated_sources and tavily_urls:
        for i, tavily_url in enumerate(tavily_urls[:2]):
            validated_sources.append({
                "citation": f"Source {i+1}",
                "url": tavily_url
            })

    # Add metadata (ID will be generated in API layer to ensure uniqueness per org_id)
    from datetime import datetime
    hours_ago = 1  # Default, can be made dynamic based on signal recency
    timestamp = f"{hours_ago}h ago"

    result = {
        "agent": "profiler",
        "timestamp": timestamp,
        "headline": parsed_json.get("headline", ""),
        "snippet": parsed_json.get("snippet", ""),
        "description": parsed_json.get("description", ""),
        "sourceUrl": source_url if source_url else (validated_sources[0]["url"] if validated_sources else ""),
        "sourceLabel": parsed_json.get("sourceLabel", ""),
        "source": validated_sources if validated_sources else parsed_json.get("source", []),
        "nextBestMoves": parsed_json.get("nextBestMoves", []),
        "NBAs": parsed_json.get("NBAs", []),
        "contextualSuggestions": parsed_json.get("contextualSuggestions", [])
    }

    return result

# Signals function mapping
SIGNALS_FUNCTIONS = {
    "scout": search_signals_scout,
    "profiler": search_signals_profiler
}


# ---------------------------------------------------------------------------
# Router-facing service functions (Phase B extraction)
# ---------------------------------------------------------------------------

async def run_signals_research(request: MarketRequest) -> dict:
    """Research web signals for specific agents (scout/profiler)."""
    agent_name = request.component_name.strip().lower()

    # Lookup the function for the given agent
    signals_function = SIGNALS_FUNCTIONS.get(agent_name)
    if not signals_function:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported agent: {request.component_name}. Supported agents: scout, profiler"
        )

    db = clients.client["Signals"]
    collection = db["signals"]

    # Filter by user_id only for multitenancy
    query = {
        "user_id": request.user_id,
        "agent": agent_name
    }

    # If refresh is False, fetch the latest signal
    if not request.refresh:
        latest_signal = await asyncio.to_thread(
            collection.find_one, query, sort=[("timestamp", -1)]
        )
        if latest_signal:
            latest_signal.pop("_id", None)
            return {"status": "success", "data": latest_signal}

    # Prepare data for the signals function
    pre_data = request.data

    # Fetch existing headlines from signal_track collection
    existing_headlines = []
    if request.org_id or request.user_id:
        track_db = clients.client["Signals"]
        track_collection = track_db["signal_track"]
        track_key = request.org_id if request.org_id else f"user_{request.user_id}"

        def fetch_existing_headlines():
            track_doc = track_collection.find_one({"_id": track_key})
            if track_doc and track_doc.get("headlines"):
                return track_doc.get("headlines", [])
            return []

        existing_headlines = await asyncio.to_thread(fetch_existing_headlines)

    # Add existing headlines to pre_data for prompt injection
    if isinstance(pre_data, dict):
        pre_data["existing_headlines"] = existing_headlines
    else:
        # If pre_data is a string, convert to dict
        try:
            pre_data_dict = json.loads(pre_data) if isinstance(pre_data, str) else {}
            pre_data_dict["existing_headlines"] = existing_headlines
            pre_data = pre_data_dict
        except:
            pre_data = {"company_profile": pre_data, "existing_headlines": existing_headlines}

    signal_context_queries = _build_signal_context_queries(agent_name, pre_data)
    pinecone_context = await asyncio.to_thread(
        _fetch_pinecone_supporting_context,
        signal_context_queries,
        request.org_id,
        3
    )
    if isinstance(pre_data, dict):
        pre_data["pinecone_context_queries"] = signal_context_queries
        pre_data["pinecone_supporting_context"] = pinecone_context

    # Fetch leads for org_id if available
    leads_data = []
    if request.org_id:
        try:
            from app.services.leads import fetch_leads_for_org
            leads_data = fetch_leads_for_org(request.org_id, limit=100)
            if isinstance(pre_data, dict):
                pre_data["leads_data"] = leads_data
            else:
                if not isinstance(pre_data, dict):
                    try:
                        pre_data = json.loads(pre_data) if isinstance(pre_data, str) else {}
                    except:
                        pre_data = {}
                pre_data["leads_data"] = leads_data
                if "company_profile" not in pre_data:
                    pre_data["company_profile"] = request.data
        except Exception as e:
            logger.warning(f"Could not fetch leads: {e}")

    # For profiler agent, also include ICP data if available - filter by user_id
    if agent_name == "profiler":
        # Try to get ICP data from Profiler database
        try:
            profiler_db = clients.client["Profiler"]
            icp_collection = profiler_db["ICP_config"]
            icp_data = icp_collection.find_one({"user_id": request.user_id})
            if icp_data:
                if isinstance(pre_data, dict):
                    pre_data["icp_data"] = icp_data.get("icps", {})
                    if "company_profile" not in pre_data:
                        pre_data["company_profile"] = request.data
                else:
                    pre_data = {
                        "company_profile": request.data,
                        "icp_data": icp_data.get("icps", {}),
                        "existing_headlines": existing_headlines,
                        "leads_data": leads_data
                    }
        except Exception as e:
            logger.warning(f"Could not fetch ICP data: {e}")

    # Run signals research with retries (max 2 attempts)
    max_retries = 2
    for attempt in range(1, max_retries + 1):
        try:
            signals_result = await asyncio.to_thread(signals_function, pre_data)
            break
        except Exception as e:
            if attempt == max_retries:
                raise HTTPException(
                    status_code=500,
                    detail=f"Signals research failed after {max_retries} attempts: {str(e)}"
                )
            await asyncio.sleep(1)  # retry delay

    # Generate unique ID for signal
    signal_id = str(uuid.uuid4())

    # Add metadata - filter by user_id only
    signals_result.update({
        "id": signal_id,
        "signal_id": signal_id,  # Ensure signal_id is also present
        "user_id": request.user_id,
        "agent": agent_name,
        "timestamp": datetime.utcnow()
    })
    if request.org_id:
        signals_result["org_id"] = request.org_id

    # Save to Signals DB
    await asyncio.to_thread(collection.insert_one, signals_result)

    # Store headline in signal_track collection
    if signals_result.get("headline") and (request.org_id or request.user_id):
        track_db = clients.client["Signals"]
        track_collection = track_db["signal_track"]
        track_key = request.org_id if request.org_id else f"user_{request.user_id}"

        def update_signal_track():
            track_collection.update_one(
                {"_id": track_key},
                {
                    "$addToSet": {"headlines": signals_result.get("headline")},
                    "$set": {"last_updated": datetime.utcnow()}
                },
                upsert=True
            )

        await asyncio.to_thread(update_signal_track)

    signals_result.pop("_id", None)
    return {"status": "success", "data": signals_result}


async def _generate_signals_batch_impl(request: MarketRequest, llm_backend: str) -> dict:
    """Shared implementation for batch signal generation (Groq and Claude)."""
    db = clients.client["Signals"]
    collection = db["signals"]

    # Prepare data for the signals functions
    pre_data = request.data

    # Fetch existing headlines from signal_track collection
    existing_headlines = []
    if request.org_id or request.user_id:
        track_db = clients.client["Signals"]
        track_collection = track_db["signal_track"]
        track_key = request.org_id if request.org_id else f"user_{request.user_id}"

        def fetch_existing_headlines():
            track_doc = track_collection.find_one({"_id": track_key})
            if track_doc and track_doc.get("headlines"):
                return track_doc.get("headlines", [])
            return []

        existing_headlines = await asyncio.to_thread(fetch_existing_headlines)

    # Add existing headlines to pre_data
    if isinstance(pre_data, dict):
        pre_data["existing_headlines"] = existing_headlines
    else:
        try:
            pre_data_dict = json.loads(pre_data) if isinstance(pre_data, str) else {}
            pre_data_dict["existing_headlines"] = existing_headlines
            pre_data = pre_data_dict
        except:
            pre_data = {"company_profile": pre_data, "existing_headlines": existing_headlines}

    scout_signal_context_queries = _build_signal_context_queries("scout", pre_data)
    scout_pinecone_context = await asyncio.to_thread(
        _fetch_pinecone_supporting_context,
        scout_signal_context_queries,
        request.org_id,
        3
    )
    if isinstance(pre_data, dict):
        pre_data["pinecone_context_queries"] = scout_signal_context_queries
        pre_data["pinecone_supporting_context"] = scout_pinecone_context

    # Fetch leads for org_id if available
    leads_data = []
    if request.org_id:
        try:
            from app.services.leads import fetch_leads_for_org
            leads_data = fetch_leads_for_org(request.org_id, limit=100)
            logger.info(f"[Batch Signals] Fetched {len(leads_data)} leads for org_id: {request.org_id}")
            if isinstance(pre_data, dict):
                pre_data["leads_data"] = leads_data
            else:
                if not isinstance(pre_data, dict):
                    try:
                        pre_data = json.loads(pre_data) if isinstance(pre_data, str) else {}
                    except:
                        pre_data = {}
                pre_data["leads_data"] = leads_data
                if "company_profile" not in pre_data:
                    pre_data["company_profile"] = request.data
        except Exception as e:
            logger.warning(f"Could not fetch leads: {e}")
    else:
        logger.warning(f"[Batch Signals] No org_id provided, skipping leads fetch for user_id: {request.user_id}")

    # For profiler agent, also include ICP data if available - filter by user_id
    profiler_pre_data = pre_data.copy() if isinstance(pre_data, dict) else pre_data
    try:
        profiler_db = clients.client["Profiler"]
        icp_collection = profiler_db["ICP_config"]
        icp_data = icp_collection.find_one({"user_id": request.user_id})
        if icp_data:
            if isinstance(profiler_pre_data, dict):
                profiler_pre_data["icp_data"] = icp_data.get("icps", {})
                if "company_profile" not in profiler_pre_data:
                    profiler_pre_data["company_profile"] = request.data
                # Ensure leads_data is included
                if leads_data and "leads_data" not in profiler_pre_data:
                    profiler_pre_data["leads_data"] = leads_data
            else:
                profiler_pre_data = {
                    "company_profile": request.data,
                    "icp_data": icp_data.get("icps", {}),
                    "existing_headlines": existing_headlines,
                    "leads_data": leads_data
                }
        else:
            # Even if no ICP data, ensure leads_data is included
            if isinstance(profiler_pre_data, dict) and leads_data and "leads_data" not in profiler_pre_data:
                profiler_pre_data["leads_data"] = leads_data
    except Exception as e:
        logger.warning(f"Could not fetch ICP data: {e}")

    profiler_signal_context_queries = _build_signal_context_queries("profiler", profiler_pre_data)
    profiler_pinecone_context = await asyncio.to_thread(
        _fetch_pinecone_supporting_context,
        profiler_signal_context_queries,
        request.org_id,
        3
    )
    if isinstance(profiler_pre_data, dict):
        profiler_pre_data["pinecone_context_queries"] = profiler_signal_context_queries
        profiler_pre_data["pinecone_supporting_context"] = profiler_pinecone_context

    generated_signals = []
    batch_id = f"batch_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

    # Generate 2 signals for scout
    for i in range(2):
        try:
            print(f"Generating scout signal {i+1}...")
            signals_result = await asyncio.to_thread(search_signals_scout, pre_data, llm_backend)
            signal_id = str(uuid.uuid4())
            signals_result.update({
                "id": signal_id,
                "signal_id": signal_id,  # Ensure signal_id is also present
                "user_id": request.user_id,
                "agent": "scout",
                "timestamp": datetime.utcnow(),
                "batch_id": batch_id
            })
            if request.org_id:
                signals_result["org_id"] = request.org_id

            # Save to Signals DB
            await asyncio.to_thread(collection.insert_one, signals_result)

            # Store headline in signal_track collection
            if signals_result.get("headline") and (request.org_id or request.user_id):
                track_db = clients.client["Signals"]
                track_collection = track_db["signal_track"]
                track_key = request.org_id if request.org_id else f"user_{request.user_id}"

                def update_signal_track():
                    track_collection.update_one(
                        {"_id": track_key},
                        {
                            "$addToSet": {"headlines": signals_result.get("headline")},
                            "$set": {"last_updated": datetime.utcnow()}
                        },
                        upsert=True
                    )

                await asyncio.to_thread(update_signal_track)

                # Update existing_headlines list for next iteration
                if isinstance(pre_data, dict):
                    pre_data["existing_headlines"].append(signals_result.get("headline"))
            signals_result.pop("_id", None)
            generated_signals.append(signals_result)
            print(f"Successfully generated scout signal {i+1}")

        except Exception as e:
            print(f"Error generating scout signal {i+1}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate scout signal {i+1}: {str(e)}"
            )

    # Generate 2 signals for profiler
    for i in range(2):
        try:
            print(f"Generating profiler signal {i+1}...")
            signals_result = await asyncio.to_thread(search_signals_profiler, profiler_pre_data, llm_backend)
            signal_id = str(uuid.uuid4())
            signals_result.update({
                "id": signal_id,
                "signal_id": signal_id,  # Ensure signal_id is also present
                "user_id": request.user_id,
                "agent": "profiler",
                "timestamp": datetime.utcnow(),
                "batch_id": batch_id
            })
            if request.org_id:
                signals_result["org_id"] = request.org_id

            # Save to Signals DB
            await asyncio.to_thread(collection.insert_one, signals_result)

            # Store headline in signal_track collection
            if signals_result.get("headline") and (request.org_id or request.user_id):
                track_db = clients.client["Signals"]
                track_collection = track_db["signal_track"]
                track_key = request.org_id if request.org_id else f"user_{request.user_id}"

                def update_signal_track():
                    track_collection.update_one(
                        {"_id": track_key},
                        {
                            "$addToSet": {"headlines": signals_result.get("headline")},
                            "$set": {"last_updated": datetime.utcnow()}
                        },
                        upsert=True
                    )

                await asyncio.to_thread(update_signal_track)

                # Update existing_headlines list for next iteration
                if isinstance(profiler_pre_data, dict):
                    profiler_pre_data["existing_headlines"].append(signals_result.get("headline"))
            signals_result.pop("_id", None)
            generated_signals.append(signals_result)
            print(f"Successfully generated profiler signal {i+1}")

        except Exception as e:
            print(f"Error generating profiler signal {i+1}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate profiler signal {i+1}: {str(e)}"
            )

    return {
        "status": "success",
        "message": f"Generated {len(generated_signals)} signals",
        "data": generated_signals
    }


async def generate_signals_batch(request: MarketRequest) -> dict:
    """Generate 2 signals for scout and 2 signals for profiler (Groq)."""
    return await _generate_signals_batch_impl(request, "default")


async def generate_signals_batch_claude(request: MarketRequest) -> dict:
    """Same as generate_signals_batch but signal text is produced with Claude."""
    if not CLAUDE_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")
    return await _generate_signals_batch_impl(request, "claude")


async def fetch_signals(user_id: str, limit: int = 10) -> dict:
    """Fetch signals and return them in a simple list format - filtered by user_id only."""
    db = clients.client["Signals"]
    collection = db["signals"]

    # Fetch signals for the user only (multitenancy), ordered by timestamp (newest first)
    signals_cursor = collection.find(
        {"user_id": user_id}
    ).sort("timestamp", -1).limit(limit)

    signals_list = []
    for signal in signals_cursor:
        # Remove MongoDB _id and format for simple list
        signal.pop("_id", None)
        # Ensure signal_id is present (use "id" if signal_id doesn't exist)
        if "signal_id" not in signal and "id" in signal:
            signal["signal_id"] = signal["id"]
        elif "id" not in signal and "signal_id" in signal:
            signal["id"] = signal["signal_id"]
        signals_list.append(signal)

    return {
        "status": "success",
        "count": len(signals_list),
        "signals": signals_list
    }


async def record_signal_action(request: SignalActionRequest) -> dict:
    """Accept or reject a signal."""
    try:
        db = clients.client["Signals"]
        collection = db["signals"]

        # Find the signal by signal_id (check both "id" and "signal_id" fields)
        signal = collection.find_one({
            "$or": [
                {"id": request.signal_id},
                {"signal_id": request.signal_id}
            ]
        })

        if not signal:
            raise HTTPException(
                status_code=404,
                detail=f"Signal with signal_id {request.signal_id} not found"
            )

        if request.action == "accept":
            # Update the signal to ensure it has the org_id
            update_result = collection.update_one(
                {"_id": signal["_id"]},
                {
                    "$set": {
                        "org_id": request.org_id,
                        "status": "accepted",
                        "actioned_at": datetime.utcnow()
                    }
                }
            )

            if update_result.modified_count > 0:
                return {
                    "status": "success",
                    "message": f"Signal {request.signal_id} accepted and assigned to org {request.org_id}",
                    "signal_id": request.signal_id,
                    "org_id": request.org_id,
                    "action": "accept"
                }
            else:
                return {
                    "status": "success",
                    "message": f"Signal {request.signal_id} already has org_id {request.org_id}",
                    "signal_id": request.signal_id,
                    "org_id": request.org_id,
                    "action": "accept"
                }

        elif request.action == "reject":
            # Delete the signal
            delete_result = collection.delete_one({"_id": signal["_id"]})

            if delete_result.deleted_count > 0:
                return {
                    "status": "success",
                    "message": f"Signal {request.signal_id} rejected and deleted",
                    "signal_id": request.signal_id,
                    "action": "reject"
                }
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to delete signal"
                )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid action: {request.action}. Must be 'accept' or 'reject'"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing signal action: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process signal action: {str(e)}")


async def signal_ask(request: SignalAskRequest) -> dict:
    """Answer a question about signals using company profile, customer profile, history, and WebSearch."""
    try:
        # Fetch company profile from Neo4j
        company_profile = None
        try:
            with clients.driver.session() as session:
                result = session.run(
                    "MATCH (p:CompanyProfile {org_id: $org_id}) RETURN p LIMIT 1",
                    org_id=request.org_id
                )
                record = result.single()
                if record:
                    company_profile = dict(record["p"].items())
        except Exception as e:
            logger.warning(f"Could not fetch company profile: {e}")

        # Fetch customer profile from MongoDB
        customer_profile = None
        try:
            db = clients.client["Profiler"]
            collection = db["Company_Profile"]

            filter_query = {"profile_type": "company", "org_id": request.org_id}
            document = collection.find_one(filter_query)

            if document:
                customer_profiles = document.get("customer_profiles", {})
                icps = customer_profiles.get("icps", [])
                # Remove MongoDB _id if present
                for icp in icps:
                    if "_id" in icp:
                        del icp["_id"]
                customer_profile = {"icps": icps}

        except Exception as e:
            logger.warning(f"Could not fetch customer profile: {e}")

        # Format history for prompt
        history_text = ""
        if request.history:
            history_text = "\n\nCONVERSATION HISTORY:\n"
            for i, entry in enumerate(request.history, 1):
                if isinstance(entry, dict):
                    user_msg = entry.get("user", entry.get("question", ""))
                    assistant_msg = entry.get("assistant", entry.get("answer", ""))
                    history_text += f"\nTurn {i}:\n"
                    if user_msg:
                        history_text += f"User: {user_msg}\n"
                    if assistant_msg:
                        history_text += f"Assistant: {assistant_msg}\n"
                else:
                    history_text += f"\nTurn {i}: {str(entry)}\n"

        # Build context for prompt
        context_parts = []

        if company_profile:
            company_profile_json = json.dumps(company_profile, indent=2)
            context_parts.append(f"COMPANY PROFILE:\n{company_profile_json}")

        if customer_profile:
            customer_profile_json = json.dumps(customer_profile, indent=2)
            context_parts.append(f"CUSTOMER PROFILE (ICPs):\n{customer_profile_json}")

        context = "\n\n".join(context_parts)

        # Build prompt
        prompt = f"""You are an intelligent assistant helping answer questions about market signals, company strategy, and customer insights.

{context}
{history_text}

CURRENT QUESTION:
{request.question}

INSTRUCTIONS:
1. Use the WebSearch tool to find the most up-to-date and accurate information to answer the question
2. Consider the company profile and customer profile (ICPs) when providing context-specific answers
3. Reference the conversation history to maintain context and continuity
4. Provide a comprehensive, well-structured answer that directly addresses the question
5. If the question relates to market signals, trends, or industry insights, use WebSearch to find recent data (2026-2027)
6. Cite sources when using information from WebSearch
7. Be specific and actionable in your response

Please use the WebSearch tool to gather current information and provide a detailed answer."""

        # Use agent_chain to answer with WebSearch
        raw_response = await asyncio.to_thread(
            llm_config.agent_chain.invoke,
            {'input': prompt}
        )

        answer = raw_response.get("output", "")

        return {
            "status": "success",
            "answer": answer,
            "org_id": request.org_id,
            "user_id": request.user_id,
            "question": request.question
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in signal_Ask: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to answer question: {str(e)}")


async def signal_ask_claude(request: SignalAskRequest) -> dict:
    """Claude-powered signal ask endpoint with local token/run limiter."""
    if not CLAUDE_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")

    reservation: Optional[Dict[str, Any]] = None
    input_tokens_estimate = 0
    output_tokens_estimate = 0
    answer = ""

    try:
        # Fetch company profile from Neo4j
        company_profile = None
        try:
            with clients.driver.session() as session:
                result = session.run(
                    "MATCH (p:CompanyProfile {org_id: $org_id}) RETURN p LIMIT 1",
                    org_id=request.org_id
                )
                record = result.single()
                if record:
                    company_profile = dict(record["p"].items())
        except Exception as e:
            logger.warning(f"Could not fetch company profile (Claude): {e}")

        # Fetch customer profile from MongoDB
        customer_profile = None
        try:
            db = clients.client["Profiler"]
            collection = db["Company_Profile"]

            filter_query = {"profile_type": "company", "org_id": request.org_id}
            document = collection.find_one(filter_query)

            if document:
                customer_profiles = document.get("customer_profiles", {})
                icps = customer_profiles.get("icps", [])
                for icp in icps:
                    if "_id" in icp:
                        del icp["_id"]
                customer_profile = {"icps": icps}

        except Exception as e:
            logger.warning(f"Could not fetch customer profile (Claude): {e}")

        # Format history for prompt
        history_text = ""
        if request.history:
            history_text = "\n\nCONVERSATION HISTORY:\n"
            for i, entry in enumerate(request.history, 1):
                if isinstance(entry, dict):
                    user_msg = entry.get("user", entry.get("question", ""))
                    assistant_msg = entry.get("assistant", entry.get("answer", ""))
                    history_text += f"\nTurn {i}:\n"
                    if user_msg:
                        history_text += f"User: {user_msg}\n"
                    if assistant_msg:
                        history_text += f"Assistant: {assistant_msg}\n"
                else:
                    history_text += f"\nTurn {i}: {str(entry)}\n"

        # Build context for prompt
        context_parts = []
        if company_profile:
            company_profile_json = json.dumps(company_profile, indent=2)
            context_parts.append(f"COMPANY PROFILE:\n{company_profile_json}")

        if customer_profile:
            customer_profile_json = json.dumps(customer_profile, indent=2)
            context_parts.append(f"CUSTOMER PROFILE (ICPs):\n{customer_profile_json}")

        context = "\n\n".join(context_parts)

        web_search_results = ""
        try:
            from langchain_community.tools.tavily_search.tool import TavilySearchResults
            search_tool = TavilySearchResults(k=10, tavily_api_key=tavily_api_key)
            web_search_results = await asyncio.to_thread(search_tool.run, request.question)
        except Exception as e:
            logger.warning(f"WebSearch failed in signal_ask_claude: {e}")

        prompt = f"""You are an intelligent assistant helping answer questions about market signals, company strategy, and customer insights.

{context}
{history_text}

WEB SEARCH RESULTS:
{web_search_results}

CURRENT QUESTION:
{request.question}

INSTRUCTIONS:
1. Use the provided web search results as the freshest external context.
2. Consider the company profile and customer profile (ICPs) when providing context-specific answers.
3. Reference the conversation history to maintain context and continuity.
4. Provide a comprehensive, well-structured answer that directly addresses the question.
5. If the question relates to market signals, trends, or industry insights, prioritize recent data (2026-2027).
6. Cite sources if they appear in web search results.
7. Be specific and actionable in your response.
"""

        input_tokens_estimate = _estimate_token_count(prompt)
        reservation = _reserve_claude_signal_budget(
            input_tokens_estimate=input_tokens_estimate,
            max_output_tokens=CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS
        )

        response = await asyncio.to_thread(
            requests.post,
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": CLAUDE_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            json={
                "model": claude_sonnet_model,
                "max_tokens": CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS,
                "temperature": 0.2,
                "messages": [{"role": "user", "content": prompt}]
            },
            timeout=120
        )

        if response.status_code >= 400:
            response_text = response.text[:1000]
            raise HTTPException(
                status_code=500,
                detail=f"Claude API call failed ({response.status_code}): {response_text}"
            )

        payload = response.json()
        content_blocks = payload.get("content", [])
        answer_parts = []
        for block in content_blocks:
            if isinstance(block, dict) and block.get("type") == "text":
                answer_parts.append(block.get("text", ""))
        answer = "\n".join([x for x in answer_parts if x]).strip()

        output_tokens_estimate = _estimate_token_count(answer)
        finalized = _finalize_claude_signal_budget(
            run_id=reservation["run_id"],
            actual_total_tokens=input_tokens_estimate + output_tokens_estimate
        )
        reservation = None

        logger.info(
            "signal_ask_claude usage | org_id=%s | in=%s | out=%s | total=%s | window_tokens_5m=%s | run_count_5m=%s | run_count_total=%s",
            request.org_id,
            input_tokens_estimate,
            output_tokens_estimate,
            input_tokens_estimate + output_tokens_estimate,
            finalized["window_tokens_5m"],
            finalized["run_count_5m"],
            finalized["run_count_total"]
        )

        return {
            "status": "success",
            "answer": answer,
            "org_id": request.org_id,
            "user_id": request.user_id,
            "question": request.question,
            "provider": "anthropic",
            "model": claude_sonnet_model,
            "usage": {
                "estimated_input_tokens": input_tokens_estimate,
                "estimated_output_tokens": output_tokens_estimate,
                "estimated_total_tokens": input_tokens_estimate + output_tokens_estimate,
                "window_total_tokens_5m": finalized["window_tokens_5m"],
                "run_count_5m": finalized["run_count_5m"],
                "run_count_total": finalized["run_count_total"],
                "token_limit_5m": CLAUDE_SIGNAL_TOKEN_LIMIT_5M
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in signal_ask_claude: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to answer question (Claude): {str(e)}")
    finally:
        # Release reservation if we errored before final accounting.
        if reservation and reservation.get("run_id"):
            _finalize_claude_signal_budget(
                run_id=reservation["run_id"],
                actual_total_tokens=input_tokens_estimate + output_tokens_estimate
            )
