"""Signal search core — persona-shared signal discovery and research entry points.

Houses search_signals (persona-shared core) and run_signals_research
(async wrapper around search_signals for the research pipeline).

Submodule dependencies (intra-signals): .llm, .parsing, .persistence.
Cross-package: app.services._retrieval (_fetch_pinecone_supporting_context,
_build_signal_context_queries), app.core.prompts (render + prompt_meta_from).
"""
import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from app.core import prompts
from app.core.exceptions import UnsupportedComponentError
from app.core.logging import logger
from app.models.market_research import MarketRequest
from app.services._retrieval import (
    _build_signal_context_queries,
    _fetch_pinecone_supporting_context,
)
from app.services.leads import get_leads_for_org
from app.services.signals import persistence
from app.services.signals.llm import _signals_agent_output
from app.services.signals.parsing import (
    _parse_search_signals_response,
    _normalize_search_signals_result,
)


# ---------------------------------------------------------------------------
# Unified signal search (replaces search_signals_scout + search_signals_profiler)
# ---------------------------------------------------------------------------

def search_signals(
    agent_chain,
    pre_data,
    persona: Literal["scout", "profiler"] = "scout",
    llm_backend: str = "qwen",
) -> dict:
    """Unified scout/profiler signal search.

    Replaces search_signals_scout and search_signals_profiler.
    Persona switches:
      - data extraction strategy (scout: flat dict; profiler: nested company_profile/icp_data)
      - leads text label (scout: "signal"; profiler: "ICP signal")
      - prompt name (signals_scout_search vs signals_profiler_search)
      - result "agent" field

    Returns a dict with the parsed signal payload plus a ``prompt_meta`` key
    (shape: ``app.core.prompts.prompt_meta_from``) that the caller persists
    into Mongo for observability.
    """
    if persona not in ("scout", "profiler"):
        raise ValueError(f"unknown persona: {persona!r}")

    # ------------------------------------------------------------------
    # 1. Extract existing_headlines, leads_data, and context_json
    # ------------------------------------------------------------------
    existing_headlines: list = []
    leads_data: list = []

    if persona == "scout":
        # Scout: flat dict — company profile is everything except metadata keys
        if isinstance(pre_data, dict):
            existing_headlines = pre_data.get("existing_headlines", [])
            leads_data = pre_data.get("leads_data", [])
            company_profile_data = {k: v for k, v in pre_data.items() if k not in ["existing_headlines", "leads_data", "icp_data"]}
            context_json = json.dumps(company_profile_data, indent=2)
        elif isinstance(pre_data, str):
            try:
                parsed = json.loads(pre_data)
                existing_headlines = parsed.get("existing_headlines", [])
                leads_data = parsed.get("leads_data", [])
                company_profile_data = {k: v for k, v in parsed.items() if k not in ["existing_headlines", "leads_data", "icp_data"]}
                context_json = json.dumps(company_profile_data, indent=2)
            except Exception:
                context_json = pre_data
        else:
            context_json = str(pre_data)
    else:
        # Profiler: may have nested company_profile / icp_data keys
        company_profile: dict = {}
        icp_data: dict = {}
        if isinstance(pre_data, dict):
            existing_headlines = pre_data.get("existing_headlines", [])
            leads_data = pre_data.get("leads_data", [])
            if "company_profile" in pre_data:
                company_profile = pre_data["company_profile"]
                icp_data = pre_data.get("icp_data", {})
            else:
                company_profile = {k: v for k, v in pre_data.items() if k not in ["existing_headlines", "leads_data", "icp_data"]}
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
            except Exception:
                company_profile = {}
                icp_data = {}
        context_json = json.dumps({"company_profile": company_profile, "icp_data": icp_data}, indent=2)

    # ------------------------------------------------------------------
    # 2. Prepare leads + existing-headlines inputs (label differs by persona).
    #    The Jinja2 template's {% if leads %} / {% if existing_headlines %}
    #    blocks decide whether to inline the sub-templates.
    # ------------------------------------------------------------------
    signal_label = "ICP signal" if persona == "profiler" else "signal"
    leads_count = len(leads_data) if leads_data else 0
    try:
        leads_json_str = json.dumps(leads_data[:50], indent=2, default=str) if leads_data else ""
    except Exception as e:
        logger.error(f"[ERROR] Failed to serialize leads data: {e}")
        leads_json_str = ""

    headlines_list_str = "\n".join([f"- {h}" for h in existing_headlines[:30]]) if existing_headlines else ""

    # ------------------------------------------------------------------
    # 3. Render the prompt + capture prompt_meta
    # ------------------------------------------------------------------
    prompt_name = "signals_scout_search" if persona == "scout" else "signals_profiler_search"
    rendered = prompts.render(
        prompt_name,
        context_json=context_json,
        leads=leads_data,
        leads_count=leads_count,
        leads_json=leads_json_str,
        signal_label=signal_label,
        existing_headlines=existing_headlines,
        headlines_list=headlines_list_str,
    )
    prompt_meta = prompts.prompt_meta_from(rendered)

    response, tavily_urls = _signals_agent_output(agent_chain, rendered.body, context_json, llm_backend)

    # ------------------------------------------------------------------
    # 4. Parse response + validate URLs + assemble result
    # ------------------------------------------------------------------
    parsed_json = _parse_search_signals_response(response)
    result = _normalize_search_signals_result(parsed_json, tavily_urls, persona)
    result["prompt_meta"] = prompt_meta
    return result


# ---------------------------------------------------------------------------
# Router-facing service functions
# ---------------------------------------------------------------------------

async def run_signals_research(driver, mongo, pc, agent_chain, request: MarketRequest) -> dict:
    """Research web signals for specific agents (scout/profiler)."""
    agent_name = request.component_name.strip().lower()

    if agent_name not in ("scout", "profiler"):
        raise UnsupportedComponentError(
            f"Unsupported agent: {request.component_name}. Supported agents: scout, profiler"
        )

    # If refresh is False, fetch the latest signal for this (user_id, agent)
    if not request.refresh:
        latest_signal = await asyncio.to_thread(
            persistence._get_latest_signal_for_user_agent,
            mongo, request.user_id, agent_name,
        )
        if latest_signal:
            return {"status": "success", "data": latest_signal}

    # Prepare data for the signals function
    pre_data = request.data

    # Fetch existing headlines from signal_track collection
    existing_headlines = []
    track_key: Optional[str] = None
    if request.org_id or request.user_id:
        track_key = request.org_id if request.org_id else f"user_{request.user_id}"
        existing_headlines = await asyncio.to_thread(
            persistence._get_existing_headlines, mongo, track_key,
        )

    # Add existing headlines to pre_data for prompt injection
    if isinstance(pre_data, dict):
        pre_data["existing_headlines"] = existing_headlines
    else:
        # If pre_data is a string, convert to dict
        try:
            pre_data_dict = json.loads(pre_data) if isinstance(pre_data, str) else {}
            pre_data_dict["existing_headlines"] = existing_headlines
            pre_data = pre_data_dict
        except Exception:
            pre_data = {"company_profile": pre_data, "existing_headlines": existing_headlines}

    signal_context_queries = _build_signal_context_queries(agent_name, pre_data)
    pinecone_context = await asyncio.to_thread(
        _fetch_pinecone_supporting_context,
        pc,
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
            leads_data, _ = get_leads_for_org(driver, org_id=request.org_id, limit=100, offset=0)
            if isinstance(pre_data, dict):
                pre_data["leads_data"] = leads_data
            else:
                if not isinstance(pre_data, dict):
                    try:
                        pre_data = json.loads(pre_data) if isinstance(pre_data, str) else {}
                    except Exception:
                        pre_data = {}
                pre_data["leads_data"] = leads_data
                if "company_profile" not in pre_data:
                    pre_data["company_profile"] = request.data
        except Exception as e:
            logger.warning(f"Could not fetch leads: {e}")

    # For profiler agent, also include ICP data if available - filter by user_id
    if agent_name == "profiler":
        try:
            icp_data = persistence._get_user_icp_config(mongo, request.user_id)
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
            signals_result = await asyncio.to_thread(search_signals, agent_chain, pre_data, agent_name)
            break
        except Exception:
            if attempt == max_retries:
                raise
            await asyncio.sleep(1)  # retry delay

    # Generate unique ID for signal
    signal_id = str(uuid.uuid4())

    # Add metadata - filter by user_id only. prompt_meta is already on
    # signals_result (set by search_signals); keep it there so the Mongo
    # write carries it.
    signals_result.update({
        "id": signal_id,
        "signal_id": signal_id,  # Ensure signal_id is also present
        "user_id": request.user_id,
        "agent": agent_name,
        "timestamp": datetime.now(timezone.utc)
    })
    if request.org_id:
        signals_result["org_id"] = request.org_id

    # Save signal + (if headline present) upsert into signal_track. track_key
    # was computed above when fetching existing_headlines; None if neither
    # org_id nor user_id was present.
    await asyncio.to_thread(
        persistence._save_signal_and_track_headline, mongo, signals_result, track_key,
    )

    signals_result.pop("_id", None)
    return {"status": "success", "data": signals_result}
