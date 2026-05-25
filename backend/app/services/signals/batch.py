"""Signal batch generation — extracted from orchestrator.py in Phase I commit 6/11.

Houses _generate_signals_batch_impl (shared body) and the two public
backend-variant wrappers (generate_signals_batch for Groq, _claude for
Anthropic+Tavily).

batch.py uses search.search_signals via module-import + namespace-prefix
to keep mocker.patch effective (see feedback_phase_h_module_import_pattern.md).
"""
import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.core.logging import logger
from app.models.market_research import MarketRequest
from app.services._retrieval import (
    _build_signal_context_queries,
    _fetch_pinecone_supporting_context,
)
from app.services.signals import persistence, search


async def _generate_signals_batch_impl(driver, mongo, pc, agent_chain, request: MarketRequest, llm_backend: str) -> dict:
    """Shared implementation for batch signal generation (Groq and Claude)."""
    # Prepare data for the signals functions
    pre_data = request.data

    # Fetch existing headlines from signal_track collection
    existing_headlines = []
    track_key: Optional[str] = None
    if request.org_id or request.user_id:
        track_key = request.org_id if request.org_id else f"user_{request.user_id}"
        existing_headlines = await asyncio.to_thread(
            persistence._get_existing_headlines, mongo, track_key,
        )

    # Add existing headlines to pre_data
    if isinstance(pre_data, dict):
        pre_data["existing_headlines"] = existing_headlines
    else:
        try:
            pre_data_dict = json.loads(pre_data) if isinstance(pre_data, str) else {}
            pre_data_dict["existing_headlines"] = existing_headlines
            pre_data = pre_data_dict
        except Exception:
            pre_data = {"company_profile": pre_data, "existing_headlines": existing_headlines}

    scout_signal_context_queries = _build_signal_context_queries("scout", pre_data)
    scout_pinecone_context = await asyncio.to_thread(
        _fetch_pinecone_supporting_context,
        pc,
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
            from app.services.leads import get_leads_for_org
            leads_data, _ = get_leads_for_org(driver, org_id=request.org_id, limit=100, offset=0)
            logger.info(f"[Batch Signals] Fetched {len(leads_data)} leads for org_id: {request.org_id}")
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
    else:
        logger.warning(f"[Batch Signals] No org_id provided, skipping leads fetch for user_id: {request.user_id}")

    # For profiler agent, also include ICP data if available - filter by user_id
    profiler_pre_data = pre_data.copy() if isinstance(pre_data, dict) else pre_data
    try:
        icp_data = persistence._get_user_icp_config(mongo, request.user_id)
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
        pc,
        profiler_signal_context_queries,
        request.org_id,
        3
    )
    if isinstance(profiler_pre_data, dict):
        profiler_pre_data["pinecone_context_queries"] = profiler_signal_context_queries
        profiler_pre_data["pinecone_supporting_context"] = profiler_pinecone_context

    generated_signals = []
    batch_id = f"batch_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"

    # Generate 2 signals for scout
    for i in range(2):
        try:
            logger.info(f"Generating scout signal {i+1}...")
            signals_result = await asyncio.to_thread(search.search_signals, agent_chain, pre_data, "scout", llm_backend)
            signal_id = str(uuid.uuid4())
            signals_result.update({
                "id": signal_id,
                "signal_id": signal_id,  # Ensure signal_id is also present
                "user_id": request.user_id,
                "agent": "scout",
                "timestamp": datetime.now(timezone.utc),
                "batch_id": batch_id
            })
            if request.org_id:
                signals_result["org_id"] = request.org_id

            # Save signal + (if headline) upsert into signal_track.
            await asyncio.to_thread(
                persistence._save_signal_and_track_headline, mongo, signals_result, track_key,
            )

            # Mirror the headline into pre_data for the next iteration's prompt.
            if signals_result.get("headline") and track_key and isinstance(pre_data, dict):
                pre_data["existing_headlines"].append(signals_result.get("headline"))
            signals_result.pop("_id", None)
            generated_signals.append(signals_result)
            logger.info(f"Successfully generated scout signal {i+1}")

        except Exception as e:
            logger.error(f"Error generating scout signal {i+1}: {e}")
            raise

    # Generate 2 signals for profiler
    for i in range(2):
        try:
            logger.info(f"Generating profiler signal {i+1}...")
            signals_result = await asyncio.to_thread(search.search_signals, agent_chain, profiler_pre_data, "profiler", llm_backend)
            signal_id = str(uuid.uuid4())
            signals_result.update({
                "id": signal_id,
                "signal_id": signal_id,  # Ensure signal_id is also present
                "user_id": request.user_id,
                "agent": "profiler",
                "timestamp": datetime.now(timezone.utc),
                "batch_id": batch_id
            })
            if request.org_id:
                signals_result["org_id"] = request.org_id

            # Save signal + (if headline) upsert into signal_track.
            await asyncio.to_thread(
                persistence._save_signal_and_track_headline, mongo, signals_result, track_key,
            )

            # Mirror the headline into profiler_pre_data for the next iteration's prompt.
            if signals_result.get("headline") and track_key and isinstance(profiler_pre_data, dict):
                profiler_pre_data["existing_headlines"].append(signals_result.get("headline"))
            signals_result.pop("_id", None)
            generated_signals.append(signals_result)
            logger.info(f"Successfully generated profiler signal {i+1}")

        except Exception as e:
            logger.error(f"Error generating profiler signal {i+1}: {e}")
            raise

    return {
        "status": "success",
        "message": f"Generated {len(generated_signals)} signals",
        "data": generated_signals
    }


async def generate_signals_batch(driver, mongo, pc, agent_chain, request: MarketRequest) -> dict:
    """Generate 2 signals for scout and 2 signals for profiler (Groq)."""
    return await _generate_signals_batch_impl(driver, mongo, pc, agent_chain, request, "default")


async def generate_signals_batch_claude(driver, mongo, pc, agent_chain, request: MarketRequest) -> dict:
    """Same as generate_signals_batch but signal text is produced with Claude.
    The `CLAUDE_API_KEY` availability check lives in the router. The
    Groq/Claude pair stays parallel — Groq uses `agent_chain`; Claude does
    direct HTTP with per-window budget tracking — divergence too large to
    collapse cleanly.
    """
    return await _generate_signals_batch_impl(driver, mongo, pc, agent_chain, request, "claude")
