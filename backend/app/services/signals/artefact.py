"""Recommendation artefact — Claude-backed GTM playbook generation.

Generates the five LLM sections (what-to-do / strategy / how-to-communicate /
channel / template) for one accepted-signal recommendation, returned as
structured JSON. Mirrors signal_ask_claude's Claude-call mechanics (token/run
budget via _claude_budget, direct requests.post to Anthropic) but is
self-contained from the request body — the FE supplies the signal context,
matched leads, recommendation, and cached answer, so there is no Neo4j/Mongo/
Pinecone fetch here.
"""
import asyncio
import json
from typing import Any, Dict, Optional

import requests

from app.core import prompts
from app.core.config import claude_sonnet_model
from app.core.exceptions import ServiceError
from app.core.logging import logger
from app.models.signals import RecommendationArtefactRequest
from app.services._claude_budget import (
    CLAUDE_API_KEY,
    CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS,
    _estimate_token_count,
    _finalize_claude_signal_budget,
    _reserve_claude_signal_budget,
)

_ARTEFACT_FIELDS = (
    "what_to_do",
    "strategy",
    "how_to_communicate",
    "communication_channel",
    "communication_template",
)


def _parse_recommendation_artefact_response(text: str) -> Dict[str, str]:
    """Extract the five playbook fields from the model's JSON output.

    Total + degrade-never-throw: strips a ```json fence, takes the outermost
    {...}, json.loads, and reads each field as a string (coercing non-strings,
    treating None/missing as ""). ANY failure yields all-empty — never raises.
    """
    empty = {k: "" for k in _ARTEFACT_FIELDS}
    if not text:
        return empty
    cleaned = text.strip()
    if cleaned.startswith("```"):
        # drop the opening fence line (``` or ```json) and a trailing fence
        cleaned = cleaned.split("\n", 1)[-1] if "\n" in cleaned else ""
        if cleaned.rstrip().endswith("```"):
            cleaned = cleaned.rstrip()[:-3]
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end < start:
        return empty
    try:
        parsed = json.loads(cleaned[start : end + 1])
    except Exception:
        return empty
    if not isinstance(parsed, dict):
        return empty
    result: Dict[str, str] = {}
    for k in _ARTEFACT_FIELDS:
        v = parsed.get(k, "")
        result[k] = v if isinstance(v, str) else ("" if v is None else str(v))
    return result


async def generate_recommendation_artefact_claude(
    request: RecommendationArtefactRequest,
) -> dict:
    """Claude-powered GTM-playbook generator with the shared token/run limiter."""
    if not CLAUDE_API_KEY:
        raise ServiceError("ANTHROPIC_API_KEY is not configured")

    reservation: Optional[Dict[str, Any]] = None
    input_tokens_estimate = 0
    output_tokens_estimate = 0

    try:
        matched_leads_json = json.dumps(
            [lead.model_dump() for lead in request.matched_leads], indent=2, default=str
        )
        signal_sources = "\n".join(s for s in request.signal_sources if s) or "(none provided)"

        rendered = prompts.render(
            "signals_recommendation_artefact_claude",
            signal_headline=request.signal_headline,
            signal_description=request.signal_description,
            signal_sources=signal_sources,
            matched_leads=matched_leads_json,
            recommendation=request.recommendation,
            recommendation_answer=request.recommendation_answer,
        )
        prompt = rendered.body

        input_tokens_estimate = _estimate_token_count(prompt)
        reservation = _reserve_claude_signal_budget(
            input_tokens_estimate=input_tokens_estimate,
            max_output_tokens=CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS,
        )

        response = await asyncio.to_thread(
            requests.post,
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": CLAUDE_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": claude_sonnet_model,
                "max_tokens": CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS,
                "temperature": 0.3,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=120,
        )

        if response.status_code >= 400:
            raise ServiceError(
                f"Claude API call failed ({response.status_code}): {response.text[:1000]}"
            )

        payload = response.json()
        answer_parts = [
            block.get("text", "")
            for block in payload.get("content", [])
            if isinstance(block, dict) and block.get("type") == "text"
        ]
        answer = "\n".join(x for x in answer_parts if x).strip()

        fields = _parse_recommendation_artefact_response(answer)

        output_tokens_estimate = _estimate_token_count(answer)
        _finalize_claude_signal_budget(
            run_id=reservation["run_id"],
            actual_total_tokens=input_tokens_estimate + output_tokens_estimate,
        )
        reservation = None

        return {"status": "success", **fields}

    except Exception as e:
        logger.error(f"Error in generate_recommendation_artefact_claude: {str(e)}")
        raise
    finally:
        if reservation and reservation.get("run_id"):
            _finalize_claude_signal_budget(
                run_id=reservation["run_id"],
                actual_total_tokens=input_tokens_estimate + output_tokens_estimate,
            )
