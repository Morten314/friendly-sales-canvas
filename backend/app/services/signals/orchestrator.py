"""Signals service: Scout/Profiler signal search + batch generation."""
import json
import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

import requests

from app.core.config import tavily_api_key, claude_sonnet_model
from app.core.exceptions import (
    ServiceError,
    UnsupportedComponentError,
)
from app.models.market_research import MarketRequest
from app.models.signals import SignalAskRequest
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
from app.services.signals import persistence, search
from app.services.signals.prompts import (
    _SCOUT_PROMPT_TEMPLATE,
    _PROFILER_PROMPT_TEMPLATE,
    _LEADS_SECTION_TEMPLATE,
    _LEADS_SECTION_FALLBACK_TEMPLATE,
    _EXISTING_HEADLINES_SECTION_TEMPLATE,
    _SIGNAL_ASK_PROMPT_TEMPLATE,
    _SIGNAL_ASK_CLAUDE_PROMPT_TEMPLATE,
)
from app.services.signals.llm import _signals_agent_output
from app.services.signals.parsing import (
    _parse_search_signals_response,
    _normalize_search_signals_result,
)

from app.core.logging import logger


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


async def signal_ask(driver, mongo, agent_chain, request: SignalAskRequest) -> dict:
    """Answer a question about signals using company profile, customer profile, history, and WebSearch."""
    try:
        # Fetch company profile from Neo4j
        company_profile = None
        try:
            with driver.session() as session:
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
            customer_profile = persistence._get_signal_ask_customer_profile(mongo, request.org_id)
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
        prompt = _SIGNAL_ASK_PROMPT_TEMPLATE.format(
            context=context,
            history_text=history_text,
            question=request.question,
        )

        # Use agent_chain to answer with WebSearch
        raw_response = await asyncio.to_thread(
            agent_chain.invoke,
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

    except Exception as e:
        logger.error(f"Error in signal_Ask: {str(e)}")
        raise


async def signal_ask_claude(driver, mongo, request: SignalAskRequest) -> dict:
    """Claude-powered signal ask endpoint with local token/run limiter."""
    if not CLAUDE_API_KEY:
        raise ServiceError("ANTHROPIC_API_KEY is not configured")

    reservation: Optional[Dict[str, Any]] = None
    input_tokens_estimate = 0
    output_tokens_estimate = 0
    answer = ""

    try:
        # Fetch company profile from Neo4j
        company_profile = None
        try:
            with driver.session() as session:
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
            customer_profile = persistence._get_signal_ask_customer_profile(mongo, request.org_id)
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

        prompt = _SIGNAL_ASK_CLAUDE_PROMPT_TEMPLATE.format(
            context=context,
            history_text=history_text,
            web_search_results=web_search_results,
            question=request.question,
        )

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
            raise ServiceError(
                f"Claude API call failed ({response.status_code}): {response_text}"
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

    except Exception as e:
        logger.error(f"Error in signal_ask_claude: {str(e)}")
        raise
    finally:
        # Release reservation if we errored before final accounting.
        if reservation and reservation.get("run_id"):
            _finalize_claude_signal_budget(
                run_id=reservation["run_id"],
                actual_total_tokens=input_tokens_estimate + output_tokens_estimate
            )
