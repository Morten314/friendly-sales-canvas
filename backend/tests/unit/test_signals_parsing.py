"""Unit tests for signal citation URL sanitization."""
from app.services._llm_helpers import _filter_source_urls, _sanitize_source_url
from app.services.signals.parsing import _normalize_search_signals_result, _validate_url


def test_sanitize_source_url_strips_trailing_junk_and_blocks_tavily_api():
    assert _sanitize_source_url("https://api.tavily.com/search')") == ""
    assert _sanitize_source_url("https://www.gartner.com/report')") == "https://www.gartner.com/report"
    assert _sanitize_source_url("not-a-url") == ""


def test_filter_source_urls_dedupes_and_drops_invalid():
    urls = _filter_source_urls(
        [
            "https://example.com/a",
            "https://example.com/a",
            "https://api.tavily.com/search')",
            "https://statista.com/topic')",
        ]
    )
    assert urls == ["https://example.com/a", "https://statista.com/topic"]


def test_validate_url_prefers_real_article_over_tavily_api():
    valid = ["https://www.gartner.com/report", "https://statista.com/topic"]
    assert _validate_url("https://api.tavily.com/search')", valid) == "https://www.gartner.com/report"
    assert _validate_url("https://www.gartner.com/other", valid) == "https://www.gartner.com/other"


def test_normalize_search_signals_result_omits_invalid_citation_urls():
    result = _normalize_search_signals_result(
        {
            "headline": "Test",
            "snippet": "Snippet",
            "description": "Desc",
            "sourceUrl": "https://api.tavily.com/search')",
            "source": [
                {"citation": "Gartner", "url": "https://api.tavily.com/search')"},
                {"citation": "Statista", "url": "https://statista.com/topic')"},
            ],
            "nextBestMoves": [],
            "NBAs": [],
            "contextualSuggestions": [],
        },
        ["https://api.tavily.com/search')", "https://statista.com/topic')"],
        "scout",
    )
    assert result["sourceUrl"] == "https://statista.com/topic"
    assert len(result["source"]) == 1
    assert result["source"][0]["url"] == "https://statista.com/topic"
