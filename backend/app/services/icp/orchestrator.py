"""ICP (Ideal Customer Profile) generation and research service.

Includes:
  - ICP_generator: main ICP synthesis from company profile
  - icp_research_1..4: 4-component ICP-research breakdown
  - _icp_research_agent_output: prompt-dispatch helper (default vs claude)
  - ICP_FUNCTIONS, ICP_FUNCTIONS_CLAUDE dispatch dicts
  - _run_icp_research_impl: shared worker for POST /icp-research[_claude]
  - run_icp_research: router-facing wrapper for POST /icp-research and /icp-research_claude

Each prompt-using function returns a `(parsed_json, prompt_meta)` tuple. The
`prompt_meta` sub-doc (shape defined by `app.core.prompts.prompt_meta_from`) is
threaded through `_run_icp_research_impl` and `list_icps` into Mongo writes
for observability (which prompt version produced the cached result).

Persistence helpers (list_icps, delete_recommended_icp, _ensure_icp_indexes,
_reserve_unique_icp_id, _release_icp_id) live in persistence.py and are
re-exported by __init__.py per spec §3.7.
"""
import asyncio
import json
from datetime import datetime, timezone
from typing import Any, Dict, List

from app.core import prompts
from app.core.exceptions import (
    CompanyProfileNotFoundError,
    UnsupportedComponentError,
)
from app.core.logging import logger
from app.services.icp.llm import _icp_research_agent_output
from app.services.icp.parsing import _extract_icp_json
from app.services._neo4j_helpers import fetch_company_profile as _fetch_company_profile
from app.services._retrieval import (
    _build_market_context_queries,
    _fetch_pinecone_supporting_context,
)


def ICP_generator(agent_chain, pre_data: str) -> tuple[dict, dict]:
    """Returns (parsed_json, prompt_meta). Caller merges prompt_meta into Mongo write."""
    rendered = prompts.render("icp_generator", pre_data=pre_data)
    prompt_meta = prompts.prompt_meta_from(rendered)

    def _invoke_generator(body: str) -> dict:
        raw_response = agent_chain.invoke({'input': body})
        response = raw_response["output"]
        try:
            logger.debug("[ICP_generator] Raw LLM output (first 500 chars): %s", str(response)[:500])
        except Exception:
            pass
        return _extract_icp_json(response)

    # First attempt
    parsed_json = _invoke_generator(rendered.body)

    # If empty, retry with stricter requirement
    if not parsed_json.get("suggestedICPs"):
        retry_body = rendered.body + "\n\nYou must return at least 3 ICP entries in suggestedICPs. Do not return an empty list."
        parsed_json = _invoke_generator(retry_body)

    # If still empty, fail fast to surface the issue
    if not parsed_json.get("suggestedICPs"):
        raise ValueError("LLM returned empty suggestedICPs after retry.")

    try:
        if isinstance(parsed_json, dict) and "suggestedICPs" in parsed_json:
            logger.debug("[ICP_generator] Parsed suggestedICPs count: %s", len(parsed_json.get("suggestedICPs", [])))
    except Exception:
        pass

    return parsed_json, prompt_meta


def icp_research_1(agent_chain, pre_data: str, llm_backend: str = "qwen") -> tuple[dict, dict]:
    rendered = prompts.render("icp_research_1", pre_data=pre_data)
    prompt_meta = prompts.prompt_meta_from(rendered)

    response = _icp_research_agent_output(agent_chain, rendered.body, pre_data, llm_backend)

    # Parse cleaned JSON (strips ``` fences, escapes \\n in 'description' values)
    parsed_json = _extract_icp_json(response)

    return parsed_json, prompt_meta


def icp_research_2(agent_chain, pre_data: str, llm_backend: str = "qwen") -> tuple[dict, dict]:
    rendered = prompts.render("icp_research_2", pre_data=pre_data)
    prompt_meta = prompts.prompt_meta_from(rendered)

    # Get LLM response with retries
    max_retries = 3
    last_response = None
    for attempt in range(1, max_retries + 1):
        try:
            response = _icp_research_agent_output(agent_chain, rendered.body, pre_data, llm_backend)
            last_response = response

            # Parse cleaned JSON (Final Answer split + brace trim + description/blurb escaping)
            parsed_json = _extract_icp_json(
                response,
                escape_keys=("description", "blurb"),
                trim_braces=True,
                strip_final_answer=True,
            )

            # Validate structure
            if "currentData" not in parsed_json:
                raise ValueError("Missing 'currentData' key in response")

            return parsed_json, prompt_meta

        except json.JSONDecodeError as e:
            if attempt == max_retries:
                raise ValueError(f"Failed to parse JSON after {max_retries} attempts: {str(e)}. Response: {(last_response or '')[:500]}")
            continue
        except Exception as e:
            if attempt == max_retries:
                raise ValueError(f"Error in icp_research_2 after {max_retries} attempts: {str(e)}")
            continue


def icp_research_3(agent_chain, pre_data: str, llm_backend: str = "qwen") -> tuple[dict, dict]:
    rendered = prompts.render("icp_research_3", pre_data=pre_data)
    prompt_meta = prompts.prompt_meta_from(rendered)

    # Get LLM response with retries
    max_retries = 3
    last_response = None
    for attempt in range(1, max_retries + 1):
        try:
            response = _icp_research_agent_output(agent_chain, rendered.body, pre_data, llm_backend)
            last_response = response

            # Parse cleaned JSON (Final Answer split + brace trim + description/blurb/headline escaping)
            parsed_json = _extract_icp_json(
                response,
                escape_keys=("description", "blurb", "headline"),
                trim_braces=True,
                strip_final_answer=True,
            )

            # Validate structure
            if "currentData" not in parsed_json:
                raise ValueError("Missing 'currentData' key in response")
            if "buyingSignals" not in parsed_json.get("currentData", {}):
                raise ValueError("Missing 'buyingSignals' key in currentData")

            return parsed_json, prompt_meta

        except json.JSONDecodeError as e:
            if attempt == max_retries:
                raise ValueError(f"Failed to parse JSON after {max_retries} attempts: {str(e)}. Response: {(last_response or '')[:500]}")
            continue
        except Exception as e:
            if attempt == max_retries:
                raise ValueError(f"Error in icp_research_3 after {max_retries} attempts: {str(e)}")
            continue


def icp_research_4(agent_chain, pre_data: str, llm_backend: str = "qwen") -> tuple[dict, dict]:
    rendered = prompts.render("icp_research_4", pre_data=pre_data)
    prompt_meta = prompts.prompt_meta_from(rendered)

    # Get LLM response with retries
    max_retries = 3
    last_response = None
    for attempt in range(1, max_retries + 1):
        try:
            response = _icp_research_agent_output(agent_chain, rendered.body, pre_data, llm_backend)
            last_response = response

            # Parse cleaned JSON (Final Answer split + brace trim + description/blurb escaping)
            parsed_json = _extract_icp_json(
                response,
                escape_keys=("description", "blurb"),
                trim_braces=True,
                strip_final_answer=True,
            )

            # Validate structure
            if "currentData" not in parsed_json:
                raise ValueError("Missing 'currentData' key in response")
            if "icpRefinementRecommendations" not in parsed_json.get("currentData", {}):
                raise ValueError("Missing 'icpRefinementRecommendations' key in currentData")

            return parsed_json, prompt_meta

        except json.JSONDecodeError as e:
            if attempt == max_retries:
                raise ValueError(f"Failed to parse JSON after {max_retries} attempts: {str(e)}. Response: {(last_response or '')[:500]}")
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
    "icp summary & market opportunity": lambda agent_chain, d: icp_research_1(agent_chain, d, "claude"),
    "buyer map & roles, pain points, triggers": lambda agent_chain, d: icp_research_2(agent_chain, d, "claude"),
    "competitive overlap & buying signals": lambda agent_chain, d: icp_research_3(agent_chain, d, "claude"),
    "regulatory, compliance & recommended icp": lambda agent_chain, d: icp_research_4(agent_chain, d, "claude"),
}


# ---------------------------------------------------------------------------
# Router-facing service functions
# ---------------------------------------------------------------------------

async def _run_icp_research_impl(driver, mongo, pc, agent_chain, request: Any, llm_backend: str) -> Dict[str, Any]:
    """Shared async worker for POST /icp-research and POST /icp-research_claude.

    Parameters
    ----------
    request:
        A ``MarketRequest`` instance (imported lazily to avoid circular import).
    llm_backend:
        ``"qwen"`` — uses ICP_FUNCTIONS (Qwen/Together agent_chain pipeline).
        ``"claude"`` — uses ICP_FUNCTIONS_CLAUDE (Tavily + Anthropic).
    """
    component_name = request.component_name.strip().lower()

    if llm_backend == "claude":
        research_function = ICP_FUNCTIONS_CLAUDE.get(component_name)
    else:
        research_function = ICP_FUNCTIONS.get(component_name)

    if not research_function:
        raise UnsupportedComponentError(
            f"Unsupported component_name: {request.component_name}"
        )

    db = mongo["Profiler"]
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
    company_profile = await asyncio.to_thread(_fetch_company_profile, driver, request.org_id)
    if company_profile is None:
        org_msg = f" for org_id: {request.org_id}" if request.org_id else ""
        raise CompanyProfileNotFoundError(f"No company profile found in Neo4j{org_msg}")

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
        pc,
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
    prompt_meta: dict = {}
    for attempt in range(1, max_retries + 1):
        try:
            research_result, prompt_meta = await asyncio.to_thread(research_function, agent_chain, context_json)
            break
        except Exception:
            if attempt == max_retries:
                raise
            await asyncio.sleep(1)  # retry delay

    # Coerce to dict (Claude variant guard)
    if not isinstance(research_result, dict):
        research_result = {"data": research_result}

    # Add metadata - filter by user_id only
    research_result.update({
        "user_id": request.user_id,
        "component_name": component_name,
        "timestamp": datetime.now(timezone.utc),
        "prompt_meta": prompt_meta,
    })
    if request.org_id:
        research_result["org_id"] = request.org_id

    # Save to DB
    await asyncio.to_thread(collection.insert_one, research_result)

    research_result.pop("_id", None)
    return {"status": "success", "data": research_result}


async def run_icp_research(driver, mongo, pc, agent_chain, request: Any, llm_backend: str = "qwen") -> Dict[str, Any]:
    """Unified worker for POST /icp-research and POST /icp-research_claude.
    Dispatches to `_run_icp_research_impl` with the chosen backend. The
    `CLAUDE_API_KEY` availability check lives in the router.

    Parameters
    ----------
    request:
        A ``MarketRequest`` instance.
    llm_backend:
        ``"qwen"`` (default) or ``"claude"``.
    """
    return await _run_icp_research_impl(driver, mongo, pc, agent_chain, request, llm_backend=llm_backend)
