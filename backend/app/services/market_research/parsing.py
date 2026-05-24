"""Response parsing for market_research/ — JSON extraction shared across
Research_Market_N workers.

The agent-chain output is markdown-wrapped JSON. ``_extract_research_json``
strips code fences, escapes embedded newlines inside ``"description"`` string
values (which would otherwise break json.loads), then parses to a Python dict.
Behavior is byte-identical to the inline blocks that previously appeared at
the end of each ``Research_Market_N``.
"""
import json
import re


def _extract_research_json(raw_response: str) -> dict:
    """Strip code fences and parse JSON from agent-chain output.

    Handles three input shapes produced by the LLM:
      - bare JSON
      - ```json ... ``` fenced
      - ``` ... ``` fenced (no language tag)

    Then runs the description-newline-escape pattern so multiline values
    inside the ``"description"`` field survive json.loads.
    """
    cleaned_str = (
        raw_response.strip()
        .removeprefix("```json")
        .removeprefix("```")
        .removesuffix("```")
        .strip()
    )
    cleaned_str = re.sub(
        r'\"description\": \"(.*?)\"',
        lambda m: '"description": "'
        + m.group(1).replace("\n", "\\n").replace("\r", "\\r")
        + '"',
        cleaned_str,
        flags=re.DOTALL,
    )
    return json.loads(cleaned_str)
