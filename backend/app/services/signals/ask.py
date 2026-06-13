"""Signal Q&A — interactive query against signal/lead data.

Houses signal_ask (Groq-backed) and signal_ask_claude (Anthropic-backed).
Both answer questions about signals using company profile, customer profile
(ICPs), uploaded data sources (Pinecone), chat history, and WebSearch context.

Cross-package imports:
  - app.services._claude_budget — token counting + budget reservation
  - app.services._retrieval — Pinecone retrieval of uploaded data-source context
  - requests — direct HTTP calls to Claude API (signal_ask_claude path)
"""
import asyncio
import json
from typing import Any, Dict, Optional

import requests

from app.core import prompts
from app.core.config import claude_sonnet_model, tavily_api_key
from app.core.exceptions import ServiceError
from app.core.logging import logger
from app.models.signals import SignalAskRequest
from app.services._claude_budget import (
    CLAUDE_API_KEY,
    CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS,
    CLAUDE_SIGNAL_TOKEN_LIMIT_5M,
    _estimate_token_count,
    _finalize_claude_signal_budget,
    _reserve_claude_signal_budget,
)
from app.services._neo4j_helpers import fetch_company_profile
from app.services._retrieval import _fetch_pinecone_supporting_context
from app.services.signals import persistence


def _resolve_customer_profile(mongo, org_id, user_id) -> Optional[Dict[str, Any]]:
    """Resolve the customer profile (ICPs) for the signal-ask context.

    Reads the org-scoped saved customer profile first
    (``Profiler.Company_Profile`` via ``_get_signal_ask_customer_profile``).
    When the org has no saved ICPs (a common case — the user may only have
    *suggested* ICPs that were never saved into the customer profile), falls
    back to the user-scoped ``Profiler.ICP_config`` so the customer profile
    still informs the answer. Returns ``{"icps": [list]}`` or None — the inner
    ``icps`` is always normalized to a list of ICP dicts regardless of which
    source supplied it. Never raises.
    """
    customer_profile = None
    try:
        customer_profile = persistence._get_signal_ask_customer_profile(mongo, org_id)
    except Exception as e:
        logger.warning(f"Could not fetch customer profile: {e}")

    if customer_profile and customer_profile.get("icps"):
        return customer_profile

    # Fall back to the user-scoped ICP config (suggested ICPs live here).
    # ICP_config stores `icps` as either {"suggestedICPs": [...]} or a bare
    # list — normalize to a list so the returned shape matches the primary path.
    try:
        icp_config = persistence._get_user_icp_config(mongo, user_id)
        raw_icps = icp_config.get("icps") if icp_config else None
        if isinstance(raw_icps, dict):
            suggested = raw_icps.get("suggestedICPs", [])
        elif isinstance(raw_icps, list):
            suggested = raw_icps
        else:
            suggested = []
        if suggested:
            return {"icps": suggested}
    except Exception as e:
        logger.warning(f"Could not fetch ICP config fallback for customer profile: {e}")

    return customer_profile


async def _fetch_signal_ask_data_sources(pc, question, org_id) -> list:
    """Best-effort retrieval of uploaded data-source context (Pinecone) relevant
    to the question. Runs the blocking retrieval in a thread; never raises."""
    if not question or not org_id:
        return []
    try:
        return await asyncio.to_thread(
            _fetch_pinecone_supporting_context, pc, [question], org_id, 3
        )
    except Exception as e:
        logger.warning(f"Could not fetch data-source context: {e}")
        return []


async def signal_ask(driver, mongo, pc, agent_chain, request: SignalAskRequest) -> dict:
    """Answer a question about signals using company profile, customer profile,
    uploaded data sources, history, and WebSearch."""
    try:
        # Fetch company profile from Neo4j
        company_profile = None
        try:
            company_profile = fetch_company_profile(driver, request.org_id)
        except Exception as e:
            logger.warning(f"Could not fetch company profile: {e}")

        # Fetch customer profile (org-scoped, falling back to user ICP config).
        customer_profile = _resolve_customer_profile(mongo, request.org_id, request.user_id)

        # Fetch uploaded data-source context (Pinecone), best-effort.
        data_source_context = await _fetch_signal_ask_data_sources(
            pc, request.question, request.org_id
        )

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
            customer_profile_json = json.dumps(customer_profile, indent=2, default=str)
            context_parts.append(f"CUSTOMER PROFILE (ICPs):\n{customer_profile_json}")

        if data_source_context:
            data_source_json = json.dumps(data_source_context, indent=2, default=str)
            context_parts.append(f"DATA SOURCES (uploaded documents):\n{data_source_json}")

        context = "\n\n".join(context_parts)

        # Render the prompt via the registry
        rendered = prompts.render(
            "signals_signal_ask_groq",
            context=context,
            history_text=history_text,
            question=request.question,
        )
        prompt_meta = prompts.prompt_meta_from(rendered)

        # Use agent_chain to answer with WebSearch
        raw_response = await asyncio.to_thread(
            agent_chain.invoke,
            {'input': rendered.body}
        )

        answer = raw_response.get("output", "")

        return {
            "status": "success",
            "answer": answer,
            "org_id": request.org_id,
            "user_id": request.user_id,
            "question": request.question,
            "prompt_meta": prompt_meta,
        }

    except Exception as e:
        logger.error(f"Error in signal_ask: {str(e)}")
        raise


async def signal_ask_claude(driver, mongo, pc, request: SignalAskRequest) -> dict:
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
            company_profile = fetch_company_profile(driver, request.org_id)
        except Exception as e:
            logger.warning(f"Could not fetch company profile (Claude): {e}")

        # Fetch customer profile (org-scoped, falling back to user ICP config).
        customer_profile = _resolve_customer_profile(mongo, request.org_id, request.user_id)

        # Fetch uploaded data-source context (Pinecone), best-effort.
        data_source_context = await _fetch_signal_ask_data_sources(
            pc, request.question, request.org_id
        )

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
            customer_profile_json = json.dumps(customer_profile, indent=2, default=str)
            context_parts.append(f"CUSTOMER PROFILE (ICPs):\n{customer_profile_json}")

        if data_source_context:
            data_source_json = json.dumps(data_source_context, indent=2, default=str)
            context_parts.append(f"DATA SOURCES (uploaded documents):\n{data_source_json}")

        context = "\n\n".join(context_parts)

        web_search_results = ""
        try:
            from langchain_community.tools.tavily_search.tool import TavilySearchResults
            search_tool = TavilySearchResults(k=10, tavily_api_key=tavily_api_key)
            web_search_results = await asyncio.to_thread(search_tool.run, request.question)
        except Exception as e:
            logger.warning(f"WebSearch failed in signal_ask_claude: {e}")

        rendered = prompts.render(
            "signals_signal_ask_claude",
            context=context,
            history_text=history_text,
            web_search_results=web_search_results,
            question=request.question,
        )
        prompt_meta = prompts.prompt_meta_from(rendered)
        prompt = rendered.body

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
            "prompt_meta": prompt_meta,
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
