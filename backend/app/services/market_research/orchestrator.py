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
from app.services.market_research.prompts import (
    RESEARCH_MARKET_1_TEMPLATE,
    RESEARCH_MARKET_2_TEMPLATE,
    RESEARCH_MARKET_3_TEMPLATE,
    RESEARCH_MARKET_4_TEMPLATE,
    RESEARCH_MARKET_5_TEMPLATE,
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
    template = RESEARCH_MARKET_1_TEMPLATE

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
    template = RESEARCH_MARKET_2_TEMPLATE

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
    template = RESEARCH_MARKET_3_TEMPLATE

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
    template = RESEARCH_MARKET_4_TEMPLATE

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
    template = RESEARCH_MARKET_5_TEMPLATE

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

