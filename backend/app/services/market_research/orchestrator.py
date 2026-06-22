"""Market research service: 5-component report generation. Cross-domain LLM
helpers live in `app.services._llm_helpers`. `run_market_research` is the
unified Qwen/Claude worker.
"""
import asyncio
import json
from datetime import datetime, timezone

from app.core import prompts
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
    format_supporting_documents,
)
from app.services.market_research.persistence import (
    _find_latest_market_research_report,
    _insert_market_research_report,
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


# Map component_n → registry prompt name. Replaces the pre-migration
# COMPONENT_TEMPLATES dict that held inline Python strings (deleted with
# market_research/prompts.py in plan-13 Task 10).
COMPONENT_PROMPT_NAMES = {
    1: "research_market_1",
    2: "research_market_2",
    3: "research_market_3",
    4: "research_market_4",
    5: "research_market_5",
}


def _run_research_component(
    component_n: int,
    agent_chain,
    pre_data,
    llm_backend: str = "qwen",
    supporting_documents: "str | None" = None,
) -> tuple[dict, dict]:
    """Run one of the 5 market-research components via prompted LLM agent.

    Returns ``(parsed_json, prompt_meta)``. The orchestrator unpacks the
    tuple and merges prompt_meta into the Mongo doc. Replaces the pre-refactor
    Research_Market_1..5 functions, which were byte-identical except for the
    template constant. The prompt now comes from the registry via
    COMPONENT_PROMPT_NAMES.
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

    # Render prompt from registry and capture observability metadata.
    rendered = prompts.render(
        COMPONENT_PROMPT_NAMES[component_n],
        company_profile_json=company_profile_json,
        supporting_documents=supporting_documents,
    )
    prompt_meta = prompts.prompt_meta_from(rendered)

    # Step 3: Get LLM response (agent-chain or claude backend)
    response = _market_research_agent_output(agent_chain, rendered.body, company_profile_json, llm_backend)

    # Strip code fences, escape embedded newlines in description fields, parse JSON.
    parsed_json = _extract_research_json(response)

    return parsed_json, prompt_meta


COMPONENT_FUNCTIONS = {
    "market size & opportunity": lambda agent_chain, d, supporting_documents=None: _run_research_component(1, agent_chain, d, supporting_documents=supporting_documents),
    "industry trends report": lambda agent_chain, d, supporting_documents=None: _run_research_component(2, agent_chain, d, supporting_documents=supporting_documents),
    "competitor landscape": lambda agent_chain, d, supporting_documents=None: _run_research_component(3, agent_chain, d, supporting_documents=supporting_documents),
    "regulatory & compliance highlights": lambda agent_chain, d, supporting_documents=None: _run_research_component(4, agent_chain, d, supporting_documents=supporting_documents),
    "market entry & growth strategy": lambda agent_chain, d, supporting_documents=None: _run_research_component(5, agent_chain, d, supporting_documents=supporting_documents),
}

COMPONENT_FUNCTIONS_CLAUDE = {
    "market size & opportunity": lambda agent_chain, d, supporting_documents=None: _run_research_component(1, agent_chain, d, "claude", supporting_documents=supporting_documents),
    "industry trends report": lambda agent_chain, d, supporting_documents=None: _run_research_component(2, agent_chain, d, "claude", supporting_documents=supporting_documents),
    "competitor landscape": lambda agent_chain, d, supporting_documents=None: _run_research_component(3, agent_chain, d, "claude", supporting_documents=supporting_documents),
    "regulatory & compliance highlights": lambda agent_chain, d, supporting_documents=None: _run_research_component(4, agent_chain, d, "claude", supporting_documents=supporting_documents),
    "market entry & growth strategy": lambda agent_chain, d, supporting_documents=None: _run_research_component(5, agent_chain, d, "claude", supporting_documents=supporting_documents),
}


async def run_market_research(driver, mongo, pc, agent_chain, request: MarketRequest, llm_backend: str = "qwen") -> dict:
    """Unified worker for both Qwen and Claude market-research variants.

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
    supporting_documents = format_supporting_documents(pinecone_context)

    max_retries = 2
    research_result = None
    prompt_meta: dict = {}
    for attempt in range(1, max_retries + 1):
        try:
            research_result, prompt_meta = await asyncio.to_thread(research_function, agent_chain, company_profile, supporting_documents)
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
    research_result["prompt_meta"] = prompt_meta

    await asyncio.to_thread(_insert_market_research_report, mongo, research_result)
    research_result.pop("_id", None)
    return {"status": "success", "data": research_result}
