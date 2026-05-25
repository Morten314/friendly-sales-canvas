"""Response parsing for signals/ — LLM output -> structured signal records.

_parse_search_signals_response: thin adapter over _llm_helpers._extract_research_json
  with signals-specific kwargs (3 escape_keys, trim_braces, strip_final_answer).
  IMPORTANT: signals does NOT perform quote-escaping inside matched
  description/snippet/headline values. All 3 research services use the
  simpler \\n/\\r-only escape rule. See spec §1.

_validate_url: signals-specific URL validator against the tavily allowlist.

_normalize_search_signals_result: signals-specific post-processor that
  validates URLs, assembles the final signal record, adds default fields.
  Called by search_signals after _parse_search_signals_response.
"""
from typing import Any, Dict, List

from app.services._llm_helpers import _extract_research_json


def _parse_search_signals_response(response: str) -> Dict[str, Any]:
    """Parse the raw LLM response from a signal search into a dict.

    Handles Final Answer prefix, ```json fences, and escapes newlines
    inside description/snippet/headline string fields before json.loads.
    Quote-escaping is intentionally NOT performed (unified with other
    research services on the simpler \\n/\\r-only escape rule).
    """
    return _extract_research_json(
        response,
        escape_keys=("description", "snippet", "headline"),
        trim_braces=True,
        strip_final_answer=True,
    )


def _validate_url(url: str, tavily_urls_list: List[str]) -> str:
    """Validate URL and replace with Tavily URL if invalid."""
    if not url or not isinstance(url, str):
        return tavily_urls_list[0] if tavily_urls_list else ""
    if not url.startswith(('http://', 'https://')):
        return tavily_urls_list[0] if tavily_urls_list else ""
    if tavily_urls_list:
        url_domain = url.split('/')[2] if len(url.split('/')) > 2 else ""
        for tavily_url in tavily_urls_list:
            tavily_domain = tavily_url.split('/')[2] if len(tavily_url.split('/')) > 2 else ""
            if url_domain and url_domain == tavily_domain:
                return tavily_url
        return tavily_urls_list[0]
    return url


def _normalize_search_signals_result(
    parsed_json: Dict[str, Any],
    tavily_urls: List[str],
    persona: str,
) -> Dict[str, Any]:
    """Validate URLs and assemble the final signal record from parsed JSON.

    Returns the shape expected by search_signals' callers: keys agent,
    timestamp, headline, snippet, description, sourceUrl, sourceLabel,
    source, nextBestMoves, NBAs, contextualSuggestions.
    """
    source_url = _validate_url(parsed_json.get("sourceUrl", ""), tavily_urls)

    validated_sources = []
    for i, src in enumerate(parsed_json.get("source", [])[:2]):
        if isinstance(src, dict) and "url" in src:
            validated_url = _validate_url(src["url"], tavily_urls[i:] if i < len(tavily_urls) else tavily_urls)
            validated_sources.append({"citation": src.get("citation", ""), "url": validated_url})

    if not validated_sources and tavily_urls:
        for i, tavily_url in enumerate(tavily_urls[:2]):
            validated_sources.append({"citation": f"Source {i+1}", "url": tavily_url})

    hours_ago = 1
    timestamp = f"{hours_ago}h ago"

    return {
        "agent": persona,
        "timestamp": timestamp,
        "headline": parsed_json.get("headline", ""),
        "snippet": parsed_json.get("snippet", ""),
        "description": parsed_json.get("description", ""),
        "sourceUrl": source_url if source_url else (validated_sources[0]["url"] if validated_sources else ""),
        "sourceLabel": parsed_json.get("sourceLabel", ""),
        "source": validated_sources if validated_sources else parsed_json.get("source", []),
        "nextBestMoves": parsed_json.get("nextBestMoves", []),
        "NBAs": parsed_json.get("NBAs", []),
        "contextualSuggestions": parsed_json.get("contextualSuggestions", []),
    }
