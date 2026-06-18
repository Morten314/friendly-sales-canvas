"""Unit tests for signal citation URL sanitization."""
from app.services._llm_helpers import _filter_source_urls, _sanitize_source_url
from app.services.signals.parsing import _normalize_search_signals_result, _validate_url


def test_sanitize_source_url_strips_trailing_junk_and_blocks_tavily_api():
    assert _sanitize_source_url("https://api.tavily.com/search')") == ""
    assert _sanitize_source_url("https://www.gartner.com/report')") == "https://www.gartner.com/report"
    assert _sanitize_source_url("not-a-url") == ""


def test_sanitize_source_url_preserves_balanced_trailing_parens():
    """A load-bearing trailing ')' that closes a '(' inside the path (e.g. a
    Wikipedia disambiguation link) must NOT be stripped — stripping it yields a
    different, often 404, URL."""
    assert (
        _sanitize_source_url("https://en.wikipedia.org/wiki/Python_(programming_language)")
        == "https://en.wikipedia.org/wiki/Python_(programming_language)"
    )


def test_sanitize_source_url_strips_only_unbalanced_trailing_wrappers():
    """Prose/markdown wrapping adds an UNbalanced ')' plus sentence punctuation;
    strip those down to the balanced URL, not into the path."""
    assert (
        _sanitize_source_url("https://en.wikipedia.org/wiki/Foo_(bar)).")
        == "https://en.wikipedia.org/wiki/Foo_(bar)"
    )


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


def test_validate_url_keeps_exactly_corroborated_url():
    valid = ["https://www.gartner.com/report", "https://statista.com/topic"]
    # The model echoed a genuinely retrieved URL verbatim -> kept as-is.
    assert _validate_url("https://www.gartner.com/report", valid) == "https://www.gartner.com/report"


def test_validate_url_falls_back_to_verified_when_url_is_blocked():
    valid = ["https://www.gartner.com/report", "https://statista.com/topic"]
    # api.tavily.com sanitizes to "" -> first verified URL.
    assert _validate_url("https://api.tavily.com/search')", valid) == "https://www.gartner.com/report"


def test_validate_url_substitutes_verified_same_site_for_uncorroborated_path():
    valid = ["https://www.gartner.com/report", "https://statista.com/topic"]
    # An uncorroborated path on a retrieved publication's domain is replaced by
    # the verified same-site URL rather than trusted as-is (it may be fabricated).
    # NOTE: this intentionally reverses the fc505822 "trust the specific LLM URL"
    # behaviour, which is what allowed hallucinated article paths to 404.
    assert (
        _validate_url("https://www.gartner.com/other-unverified", valid)
        == "https://www.gartner.com/report"
    )


def test_validate_url_falls_back_to_verified_for_unrelated_uncorroborated_url():
    valid = ["https://www.gartner.com/report"]
    assert _validate_url("https://fabricated.example/fake", valid) == "https://www.gartner.com/report"


def test_validate_url_drops_uncorroborated_url_when_no_verified_set():
    # No retrieved URLs to corroborate against -> drop rather than show an
    # unverified (possibly hallucinated) link.
    assert _validate_url("https://fabricated.example/fake", []) == ""


def test_validate_url_source_entry_drops_uncorroborated_without_unrelated_fallback():
    valid = ["https://www.gartner.com/report"]
    # allow_unrelated_fallback=False (used for labeled source[] entries): an
    # uncorroborated, different-domain URL is dropped, not relabeled onto a
    # mismatched verified URL.
    assert (
        _validate_url("https://fabricated.example/fake", valid, allow_unrelated_fallback=False) == ""
    )


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


def test_normalize_drops_uncorroborated_sources_and_does_not_leak_raw():
    # No tavily corroboration available: an uncorroborated source must be dropped,
    # and the result must NOT leak the raw unvalidated parsed_json["source"].
    result = _normalize_search_signals_result(
        {
            "headline": "H",
            "snippet": "S",
            "description": "D",
            "sourceUrl": "https://fabricated.example/made-up",
            "source": [
                {"citation": "Fab", "url": "https://fabricated.example/made-up"},
            ],
            "nextBestMoves": [],
            "NBAs": [],
            "contextualSuggestions": [],
        },
        [],
        "scout",
    )
    assert result["source"] == []
    assert result["sourceUrl"] == ""
