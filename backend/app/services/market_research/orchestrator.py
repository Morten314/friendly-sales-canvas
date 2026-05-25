"""Market research service: 5-component report generation. Cross-domain LLM
helpers live in `app.services._llm_helpers`. `run_market_research` is the
unified Groq/Claude worker.
"""
import asyncio
import json
from datetime import datetime, timezone

from app.core.exceptions import (
    BudgetExhaustedError,
    CompanyProfileNotFoundError,
    UnsupportedComponentError,
)
from app.models.market_research import MarketRequest
from app.services._neo4j_helpers import fetch_company_profile as _fetch_company_profile
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
from app.services.market_research.llm import _market_research_agent_output
from app.services.market_research.parsing import _extract_research_json

# Re-exported for backward compat (any callsite within this module or
# external callers that import from market_research directly).
from app.services._llm_helpers import (  # noqa: F401
    CLAUDE_RESEARCH_MAX_TOKENS,
    _tavily_context_and_urls,
    _claude_messages_text,
)


COMPONENT_TEMPLATES = {
    1: RESEARCH_MARKET_1_TEMPLATE,
    2: RESEARCH_MARKET_2_TEMPLATE,
    3: RESEARCH_MARKET_3_TEMPLATE,
    4: RESEARCH_MARKET_4_TEMPLATE,
    5: RESEARCH_MARKET_5_TEMPLATE,
}


def _build_research_prompt(component_n: int, company_profile_json: str) -> str:
    """Format the research-market template for ``component_n`` against the given profile JSON.

    Extracted as a testable seam so the K3 dispatch's output can be asserted
    byte-equal to a pre-refactor fixture. The dispatch (_run_research_component)
    calls through this helper.
    """
    return COMPONENT_TEMPLATES[component_n].format(company_profile_json=company_profile_json)


def _run_research_component(
    component_n: int,
    agent_chain,
    pre_data,
    llm_backend: str = "default",
) -> dict:
    """Run one of the 5 market-research components via prompted LLM agent.

    Replaces the pre-refactor Research_Market_1..5 functions, which were
    byte-identical except for the template constant. The template now comes
    from COMPONENT_TEMPLATES via _build_research_prompt.
    """
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
    prompt = _build_research_prompt(component_n, company_profile_json)

    # Step 3: Get LLM response
    response = _market_research_agent_output(agent_chain, prompt, company_profile_json, llm_backend)

    # Strip code fences, escape embedded newlines in description fields, parse JSON.
    parsed_json = _extract_research_json(response)

    # Return the Python dict
    return parsed_json


COMPONENT_FUNCTIONS = {
    "market size & opportunity": lambda agent_chain, d: _run_research_component(1, agent_chain, d),
    "industry trends report": lambda agent_chain, d: _run_research_component(2, agent_chain, d),
    "competitor landscape": lambda agent_chain, d: _run_research_component(3, agent_chain, d),
    "regulatory & compliance highlights": lambda agent_chain, d: _run_research_component(4, agent_chain, d),
    "market entry & growth strategy": lambda agent_chain, d: _run_research_component(5, agent_chain, d),
}

COMPONENT_FUNCTIONS_CLAUDE = {
    "market size & opportunity": lambda agent_chain, d: _run_research_component(1, agent_chain, d, "claude"),
    "industry trends report": lambda agent_chain, d: _run_research_component(2, agent_chain, d, "claude"),
    "competitor landscape": lambda agent_chain, d: _run_research_component(3, agent_chain, d, "claude"),
    "regulatory & compliance highlights": lambda agent_chain, d: _run_research_component(4, agent_chain, d, "claude"),
    "market entry & growth strategy": lambda agent_chain, d: _run_research_component(5, agent_chain, d, "claude"),
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

    company_profile = await asyncio.to_thread(_fetch_company_profile, driver, request.org_id)
    if company_profile is None:
        org_msg = f" for org_id: {request.org_id}" if request.org_id else ""
        raise CompanyProfileNotFoundError(f"No company profile found in Neo4j{org_msg}")

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

