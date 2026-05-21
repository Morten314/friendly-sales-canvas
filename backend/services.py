import os
import json
import re
import shutil
import pandas as pd
import requests
import speech_recognition as sr
import pytz
import datetime
import urllib.parse
from typing import List, Optional, Dict, Any
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.prompts import PromptTemplate
from app.core.config import PREDEFINED_QUESTIONS, rapidapi_key, claude_sonnet_model, tavily_api_key
from app.core.database import query  # function — local binding ok
from app.core import database
from app.core import llm_config

# NOTE: convert_audio_to_text, create_prospect_node, get_linkedin_followers,
# get_linkedin_recent_activity, extract_linkedin_username,
# calculate_prospect_score, get_ranked_prospects, extract_number,
# score_prospect — all moved to app.services.graph_chat in commit 10/16.
# (No aliases needed: nothing remaining in services.py references them.)

# --- Claude-backed research helpers moved to app.services.market_research in commit 12/16. ---
# Re-imported here because _signals_agent_output below still uses them;
# that dispatcher moves to app.services.signals in commit 14/16.
# (_icp_research_agent_output moved to app.services.icp in commit 13/16.)
from app.services.market_research import (  # noqa: E402
    CLAUDE_RESEARCH_MAX_TOKENS,
    _tavily_context_and_urls,
    _claude_messages_text,
)

# --- ICP_generator, icp_research_1..4, _icp_research_agent_output, ICP_FUNCTIONS,
#     ICP_FUNCTIONS_CLAUDE moved to app.services.icp in commit 13/16. ---


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


# COMPONENT_FUNCTIONS / COMPONENT_FUNCTIONS_CLAUDE moved to app.services.market_research
# in commit 12/16. The canonical MARKET_SCORE_COMPONENT_KEYS lives in app.models; re-imported
# here so the remaining services.py callers (score_single_lead_against_market,
# get_market_reports_for_org) keep working until they themselves move in commit 15/16.
from app.models import MARKET_SCORE_COMPONENT_KEYS  # noqa: E402

# Temporary alias — function moved to app.services.leads in commit 9/16.
# This alias keeps services.py callers (e.g. score_single_lead_against_market)
# working until they themselves move in commit 15/16.
from app.services.leads import fetch_leads_for_org  # noqa: F401


def get_company_profile_for_org(org_id: str) -> Dict[str, Any]:
    """Fetch a single company profile for an org."""
    with database.driver.session() as session:
        result = session.run(
            "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
            org_id=org_id,
        )
        record = result.single()
        if not record:
            return {}
        company_profile = dict(record.values()[0])
        if "socialMediaUrls" in company_profile and isinstance(company_profile["socialMediaUrls"], str):
            try:
                company_profile["socialMediaUrls"] = json.loads(company_profile["socialMediaUrls"])
            except json.JSONDecodeError:
                pass
        return company_profile


def get_market_reports_for_org(user_id: str, org_id: str) -> Dict[str, Dict[str, Any]]:
    """Fetch latest market research reports for all five components."""
    db = database.client["Scout_Agent"]
    collection = db["Market_Intelligence"]
    reports: Dict[str, Dict[str, Any]] = {}
    for component_name in MARKET_SCORE_COMPONENT_KEYS:
        doc = collection.find_one(
            {"user_id": user_id, "org_id": org_id, "component_name": component_name},
            sort=[("timestamp", -1)],
        )
        if doc:
            doc.pop("_id", None)
            reports[component_name] = doc
    return reports


def _clean_and_parse_json(raw_text: str) -> Dict[str, Any]:
    cleaned = (
        str(raw_text)
        .strip()
        .removeprefix("```json")
        .removeprefix("```")
        .removesuffix("```")
        .strip()
    )
    return json.loads(cleaned)


def score_single_lead_against_market(
    lead: Dict[str, Any],
    company_profile: Dict[str, Any],
    market_reports: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Score one lead against all five market components with explanations.
    Returns component_scores, component_descriptions and total score.
    """
    prompt = f"""
You are scoring a sales lead fit against five market-research components.
Return strict JSON only.

Component keys (must match exactly):
{json.dumps(MARKET_SCORE_COMPONENT_KEYS)}

Company profile:
{json.dumps(company_profile, default=str)}

Lead data:
{json.dumps(lead, default=str)}

Market research component reports:
{json.dumps(market_reports, default=str)}

Return JSON schema:
{{
  "component_scores": {{
    "market size & opportunity": <number 0-100>,
    "industry trends report": <number 0-100>,
    "competitor landscape": <number 0-100>,
    "regulatory & compliance highlights": <number 0-100>,
    "market entry & growth strategy": <number 0-100>
  }},
  "component_descriptions": {{
    "market size & opportunity": "<short reason>",
    "industry trends report": "<short reason>",
    "competitor landscape": "<short reason>",
    "regulatory & compliance highlights": "<short reason>",
    "market entry & growth strategy": "<short reason>"
  }}
}}
"""
    response = llm_config.llm2.invoke([HumanMessage(content=prompt)])
    content = getattr(response, "content", response)
    parsed = _clean_and_parse_json(content)
    scores = parsed.get("component_scores", {}) if isinstance(parsed, dict) else {}
    descriptions = parsed.get("component_descriptions", {}) if isinstance(parsed, dict) else {}

    normalized_scores: Dict[str, float] = {}
    normalized_descriptions: Dict[str, str] = {}
    for component in MARKET_SCORE_COMPONENT_KEYS:
        raw_score = scores.get(component, 0)
        try:
            score = float(raw_score)
        except (TypeError, ValueError):
            score = 0.0
        score = max(0.0, min(100.0, score))
        normalized_scores[component] = round(score, 2)

        description = descriptions.get(component)
        if not isinstance(description, str) or not description.strip():
            description = "Score generated with limited evidence from available lead/profile context."
        normalized_descriptions[component] = description.strip()

    total_score = round(sum(normalized_scores.values()) / float(len(MARKET_SCORE_COMPONENT_KEYS)), 2)
    return {
        "component_scores": normalized_scores,
        "component_descriptions": normalized_descriptions,
        "market_total_score": total_score,
    }

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