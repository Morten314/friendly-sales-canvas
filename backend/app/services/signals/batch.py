"""Signal batch generation — batched persona-shared signal discovery.

Houses _generate_signals_batch_impl (shared body) and the two public
backend-variant wrappers (generate_signals_batch for Qwen via the Together
agent_chain, _claude for Anthropic+Tavily).

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
from app.services.signals.lead_fetch import fetch_org_leads_for_signals
from app.services.signals import persistence, search


# Per-signal LLM-call attempt budget for the batch path (2 = one initial try
# plus one retry — a *total attempts* count, not a retry count). Named to mirror
# run_signals_research's `max_retries = 2`, which is likewise a total-attempts
# count; kept parallel deliberately so a transient Claude/Tavily/JSON failure is
# retried rather than aborting the batch.
_SIGNAL_BATCH_MAX_RETRIES = 2


async def _generate_one_signal(
    persona: str,
    pre_data,
    *,
    agent_chain,
    llm_backend: str,
    request: MarketRequest,
    batch_id: str,
) -> Optional[dict]:
    """Generate a single persona signal (scout or profiler).

    Retries the ``search_signals`` LLM call up to ``_SIGNAL_BATCH_MAX_RETRIES``
    times (matching ``run_signals_research``). Returns the assembled signal dict
    (id/metadata attached) on success, or ``None`` if the LLM call failed all
    retries — the caller skips a ``None`` so one bad signal cannot abort the
    whole batch with an HTTP 500. The retry/skip is scoped to the LLM call (the
    root cause); persistence is the caller's responsibility (after de-dup),
    where a DB failure deliberately propagates so a real outage surfaces.

    Side-effect-free w.r.t. shared state: it does NOT persist and does NOT
    mutate ``pre_data``, so all four signals can run concurrently under
    ``asyncio.gather`` without races.
    """
    signals_result = None
    last_error: Optional[Exception] = None
    for attempt in range(1, _SIGNAL_BATCH_MAX_RETRIES + 1):
        try:
            logger.info(
                f"Generating {persona} signal (attempt {attempt}/{_SIGNAL_BATCH_MAX_RETRIES})..."
            )
            signals_result = await asyncio.to_thread(
                search.search_signals, agent_chain, pre_data, persona, llm_backend
            )
            break
        except Exception as e:
            last_error = e
            logger.warning(
                f"Attempt {attempt}/{_SIGNAL_BATCH_MAX_RETRIES} for {persona} signal failed: {e}"
            )
            if attempt < _SIGNAL_BATCH_MAX_RETRIES:
                await asyncio.sleep(1)  # retry delay

    if signals_result is None:
        logger.error(
            f"Failed to generate {persona} signal after "
            f"{_SIGNAL_BATCH_MAX_RETRIES} attempts; skipping: {last_error}"
        )
        return None

    signal_id = str(uuid.uuid4())
    signals_result.update({
        "id": signal_id,
        "signal_id": signal_id,  # Ensure signal_id is also present
        "user_id": request.user_id,
        "agent": persona,
        "timestamp": datetime.now(timezone.utc),
        "batch_id": batch_id,
    })
    if request.org_id:
        signals_result["org_id"] = request.org_id
    signals_result.pop("_id", None)
    return signals_result


async def _generate_signals_batch_impl(driver, mongo, pc, agent_chain, request: MarketRequest, llm_backend: str) -> dict:
    """Shared implementation for batch signal generation (Qwen and Claude)."""
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

    # Fetch leads for org_id if available, capped by the admin lead_fetch_limit
    # setting (spec 47). pre_data is always a dict by this point.
    leads_data = []
    if request.org_id:
        leads_data = fetch_org_leads_for_signals(driver, mongo, request.org_id)
        logger.info(f"[Batch Signals] Fetched {len(leads_data)} leads for org_id: {request.org_id}")
        if isinstance(pre_data, dict):
            pre_data["leads_data"] = leads_data
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

    batch_id = f"batch_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"

    # Generate 2 scout + 2 profiler signals CONCURRENTLY. Each is an independent
    # Claude+Tavily call (~30s); the old code awaited them sequentially (~4x,
    # ~120s) which pushed the request past upstream proxy timeouts. asyncio is
    # already the batch concurrency primitive (search_signals already runs via
    # asyncio.to_thread); gather just lets those calls overlap. A failed signal
    # returns None and is skipped.
    signal_specs = [
        ("scout", pre_data),
        ("scout", pre_data),
        ("profiler", profiler_pre_data),
        ("profiler", profiler_pre_data),
    ]
    results = await asyncio.gather(*[
        _generate_one_signal(
            persona, data,
            agent_chain=agent_chain, llm_backend=llm_backend,
            request=request, batch_id=batch_id,
        )
        for persona, data in signal_specs
    ])

    # Drop skipped (None) signals and de-duplicate by headline within the batch.
    # Concurrency loses the old per-iteration headline-feedback dedup; this
    # restores it. Survivors are persisted sequentially so signal_track's
    # $addToSet headline writes stay consistent. A DB write failure here is NOT
    # swallowed — it propagates so a real infra outage surfaces as a 500 rather
    # than a silently-empty "success" batch.
    generated_signals = []
    seen_headlines: set = set()
    for signals_result in results:
        if signals_result is None:
            continue
        headline = (signals_result.get("headline") or "").strip()
        if headline and headline in seen_headlines:
            logger.info(f"Skipping duplicate signal headline within batch: {headline[:80]}")
            continue
        if headline:
            seen_headlines.add(headline)
        await asyncio.to_thread(
            persistence._save_signal_and_track_headline, mongo, signals_result, track_key,
        )
        # insert_one mutates signals_result in place, assigning a bson ObjectId
        # `_id`. Strip it AFTER the write (matching run_signals_research) so the
        # dict stays JSON-serializable — an ObjectId in the response body makes
        # FastAPI's serialize_response raise PydanticSerializationError → 500.
        signals_result.pop("_id", None)
        generated_signals.append(signals_result)

    return {
        "status": "success",
        "message": f"Generated {len(generated_signals)} signals",
        "data": generated_signals
    }


async def generate_signals_batch(driver, mongo, pc, agent_chain, request: MarketRequest) -> dict:
    """Generate 2 signals for scout and 2 signals for profiler (Qwen via agent_chain)."""
    return await _generate_signals_batch_impl(driver, mongo, pc, agent_chain, request, "qwen")


async def generate_signals_batch_claude(driver, mongo, pc, agent_chain, request: MarketRequest) -> dict:
    """Same as generate_signals_batch but signal text is produced with Claude.
    The `CLAUDE_API_KEY` availability check lives in the router. The
    Qwen/Claude pair stays parallel — Qwen uses `agent_chain` (Together); Claude
    does direct HTTP with per-window budget tracking — divergence too large to
    collapse cleanly.
    """
    return await _generate_signals_batch_impl(driver, mongo, pc, agent_chain, request, "claude")
