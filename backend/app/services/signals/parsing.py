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

from app.services._llm_helpers import _extract_research_json, _filter_source_urls, _sanitize_source_url


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


def _registrable_host(url: str) -> str:
    """Best-effort host for same-source matching: the netloc minus a leading
    'www.'. Not a full public-suffix parse — enough to treat www.x.com and
    x.com (and blog.x.com, via _same_site) as the same publication."""
    from urllib.parse import urlparse

    host = urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host


def _same_site(a: str, b: str) -> bool:
    """True when two URLs belong to the same publication (equal host, or one is
    a subdomain of the other), ignoring a leading 'www.'."""
    ha, hb = _registrable_host(a), _registrable_host(b)
    if not ha or not hb:
        return False
    return ha == hb or ha.endswith("." + hb) or hb.endswith("." + ha)


def _validate_url(
    url: str, tavily_urls_list: List[str], allow_unrelated_fallback: bool = True
) -> str:
    """Return a citation URL corroborated by the verified Tavily search results.

    A syntactically-valid LLM URL may still be fabricated (a plausible but
    non-existent article path), so it is trusted ONLY when corroborated by what
    the agent actually retrieved:
      1. Exact match in the verified Tavily set -> keep the LLM's URL as-is.
      2. Same publication (same-site) as a verified result -> substitute that
         verified URL (the article is real, the exact path is unverified).
      3. Otherwise -> fall back to the first verified Tavily URL, or — when
         allow_unrelated_fallback is False (labeled source[] entries) or no
         verified URL exists — drop it ("") rather than show an unverified link.

    Blocked/invalid URLs (empty, non-http, api.tavily.com) sanitize to "" and
    take the same fallback path.
    """
    valid_tavily = _filter_source_urls(tavily_urls_list)
    sanitized = _sanitize_source_url(url)
    if sanitized:
        if sanitized in valid_tavily:
            return sanitized
        same = next((u for u in valid_tavily if _same_site(u, sanitized)), None)
        if same:
            return same
    if allow_unrelated_fallback:
        return valid_tavily[0] if valid_tavily else ""
    return ""


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
    valid_tavily_urls = _filter_source_urls(tavily_urls)
    source_url = _validate_url(parsed_json.get("sourceUrl", ""), valid_tavily_urls)

    validated_sources = []
    seen_source_urls: set[str] = set()
    for src in parsed_json.get("source", [])[:2]:
        if isinstance(src, dict) and "url" in src:
            # Labeled citations must be corroborated against the FULL verified
            # set; an uncorroborated URL is dropped (not relabeled onto an
            # unrelated verified URL) so the citation text never mismatches.
            validated_url = _validate_url(
                src["url"], valid_tavily_urls, allow_unrelated_fallback=False
            )
            if validated_url and validated_url not in seen_source_urls:
                seen_source_urls.add(validated_url)
                validated_sources.append({"citation": src.get("citation", ""), "url": validated_url})

    if not validated_sources and valid_tavily_urls:
        for i, tavily_url in enumerate(valid_tavily_urls[:2]):
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
        # Only corroborated sources — never the raw, unvalidated parsed_json["source"],
        # which would re-introduce uncorroborated/hallucinated citation URLs.
        "source": validated_sources,
        "nextBestMoves": parsed_json.get("nextBestMoves", []),
        "NBAs": parsed_json.get("NBAs", []),
        "contextualSuggestions": parsed_json.get("contextualSuggestions", []),
    }
