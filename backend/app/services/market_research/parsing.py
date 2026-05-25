"""Response parsing for market_research/ — JSON extraction shared across
Research_Market_N workers.

Thin adapter over _extract_research_json. Behavior is byte-identical to
the previous inline implementation: same fence-stripping, same default
escape_keys=("description",), no trim_braces, no strip_final_answer.

Module-import pattern used here to avoid name shadow (the local function
and the shared helper both want the name _extract_research_json).
"""
from app.services import _llm_helpers


def _extract_research_json(raw_response: str) -> dict:
    """Strip code fences and parse JSON from agent-chain output."""
    return _llm_helpers._extract_research_json(raw_response)
