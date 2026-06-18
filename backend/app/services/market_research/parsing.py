"""Response parsing for market_research/ — JSON extraction shared across
Research_Market_N workers.

Thin adapter over _extract_research_json. Uses the default
escape_keys=("description",) plus trim_braces + strip_final_answer so the
Claude path's prompt-mandated "Final Answer: <JSON>" framing parses (the
bare defaults previously raised JSONDecodeError and 500'd every
/market-research_claude component).

Module-import pattern used here to avoid name shadow (the local function
and the shared helper both want the name _extract_research_json).
"""
from app.services import _llm_helpers


def _extract_research_json(raw_response: str) -> dict:
    """Strip 'Final Answer:' framing + code fences and parse JSON from the LLM response.

    The Claude variant returns the prompt-mandated ``Final Answer: <JSON>`` text
    verbatim (see prompts/_shared/final_answer_json_directive.md.j2), so
    strip_final_answer + trim_braces are required — without them json.loads
    raised JSONDecodeError on every component and the route 500'd. These match
    the robust settings the signals path uses (signals/parsing.py).
    """
    return _llm_helpers._extract_research_json(
        raw_response, trim_braces=True, strip_final_answer=True
    )
