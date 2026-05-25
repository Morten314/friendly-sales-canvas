"""Unit tests for app/services/_llm_helpers.py shared helpers.

Covers _research_agent_output (Groq + Claude paths, URL extraction)
and _extract_research_json (escape_keys, trim_braces, strip_final_answer).
"""
from unittest.mock import MagicMock

import pytest

from app.services._llm_helpers import (
    _research_agent_output,
    _extract_research_json,
)


# ---------------------------------------------------------------------------
# _research_agent_output — Groq path
# ---------------------------------------------------------------------------

def test_research_agent_output_groq_returns_text_and_empty_urls_by_default():
    """Default (extract_intermediate_urls=False) returns (text, [])."""
    agent_chain = MagicMock()
    agent_chain.invoke.return_value = {"output": "agent response text"}

    text, urls = _research_agent_output(
        agent_chain, prompt="hello", seed_text="seed", llm_backend="groq",
        search_query_template="market research {seed}",
    )
    assert text == "agent response text"
    assert urls == []


def test_research_agent_output_groq_extracts_intermediate_urls_when_flagged():
    """extract_intermediate_urls=True walks intermediate_steps for tavily URLs."""
    agent_chain = MagicMock()
    raw = MagicMock()
    raw.__getitem__.side_effect = lambda k: "response text" if k == "output" else None
    raw.intermediate_steps = [
        ("step1", [{"url": "https://a.com"}, {"url": "https://b.com"}])
    ]
    agent_chain.invoke.return_value = raw

    text, urls = _research_agent_output(
        agent_chain, prompt="x", seed_text="s", llm_backend="groq",
        search_query_template="q {seed}",
        extract_intermediate_urls=True,
    )
    assert text == "response text"
    assert "https://a.com" in urls
    assert "https://b.com" in urls


def test_research_agent_output_groq_regex_fallback_when_no_intermediate_urls():
    """extract_intermediate_urls=True falls back to regex on the response text."""
    agent_chain = MagicMock()
    raw = MagicMock()
    raw.__getitem__.side_effect = lambda k: "see https://x.com and https://y.com here" if k == "output" else None
    raw.intermediate_steps = []
    agent_chain.invoke.return_value = raw

    text, urls = _research_agent_output(
        agent_chain, prompt="x", seed_text="s", llm_backend="groq",
        search_query_template="q {seed}",
        extract_intermediate_urls=True,
    )
    assert "https://x.com" in urls
    assert "https://y.com" in urls


# ---------------------------------------------------------------------------
# _research_agent_output — Claude path
# ---------------------------------------------------------------------------

def test_research_agent_output_claude_substitutes_seed_into_query_template(mocker):
    """Claude path: search_query_template gets {seed} replaced; calls _tavily_context_and_urls + _claude_messages_text."""
    mock_tavily = mocker.patch(
        "app.services._llm_helpers._tavily_context_and_urls",
        return_value=("web ctx", ["https://t1.com"]),
    )
    mocker.patch(
        "app.services._llm_helpers._claude_messages_text",
        return_value="claude response",
    )

    text, urls = _research_agent_output(
        MagicMock(), prompt="P", seed_text="acme corp", llm_backend="claude",
        search_query_template="industry trends {seed}",
    )
    assert text == "claude response"
    assert urls == ["https://t1.com"]
    # Seed was normalized + substituted into template
    mock_tavily.assert_called_once_with("industry trends acme corp")


def test_research_agent_output_claude_normalizes_whitespace_and_truncates_seed(mocker):
    """Seed text: whitespace collapsed via " ".join(str(x).split()), truncated to 1200 chars."""
    mock_tavily = mocker.patch(
        "app.services._llm_helpers._tavily_context_and_urls",
        return_value=("ctx", []),
    )
    mocker.patch(
        "app.services._llm_helpers._claude_messages_text",
        return_value="resp",
    )

    long_seed = "  word1   word2\n\tword3  " + ("x" * 2000)
    _research_agent_output(
        MagicMock(), prompt="P", seed_text=long_seed, llm_backend="claude",
        search_query_template="q {seed}",
    )
    call_arg = mock_tavily.call_args[0][0]
    # Whitespace collapsed
    assert "  " not in call_arg.replace("q ", "", 1)
    # Truncated to 1200 chars worth of seed
    assert len(call_arg) <= len("q ") + 1200


def test_research_agent_output_claude_uses_custom_suffix_template(mocker):
    """claude_prompt_suffix_template is appended with {web_ctx} substituted."""
    mocker.patch(
        "app.services._llm_helpers._tavily_context_and_urls",
        return_value=("WEBCTX", []),
    )
    mock_claude = mocker.patch(
        "app.services._llm_helpers._claude_messages_text",
        return_value="r",
    )

    _research_agent_output(
        MagicMock(), prompt="PROMPT", seed_text="s", llm_backend="claude",
        search_query_template="q {seed}",
        claude_prompt_suffix_template="\n--CUSTOM--\n{web_ctx}\n--END--",
    )
    augmented = mock_claude.call_args[0][0]
    assert augmented.startswith("PROMPT")
    assert "--CUSTOM--" in augmented
    assert "WEBCTX" in augmented


# ---------------------------------------------------------------------------
# _extract_research_json — defaults (icp/market_research baseline)
# ---------------------------------------------------------------------------

def test_extract_research_json_defaults_strip_fences_and_escape_description_newlines():
    """Default: strip ```json fences, escape \\n inside "description" value."""
    raw = '```json\n{"description": "line1\nline2"}\n```'
    result = _extract_research_json(raw)
    assert result == {"description": "line1\nline2"}


def test_extract_research_json_trim_braces_drops_surrounding_prose():
    """trim_braces=True keeps only content between first '{' and last '}'."""
    raw = 'Sure, here you go:\n{"k": "v"}\nLet me know.'
    result = _extract_research_json(raw, trim_braces=True)
    assert result == {"k": "v"}


def test_extract_research_json_strip_final_answer_extracts_tail():
    """strip_final_answer=True keeps only text after 'Final Answer:'."""
    raw = 'Thought: ...\nFinal Answer: {"k": "v"}'
    result = _extract_research_json(raw, strip_final_answer=True)
    assert result == {"k": "v"}


def test_extract_research_json_multiple_escape_keys():
    """escape_keys: each named key's \\n inside its string value gets escaped."""
    raw = '{"description": "a\nb", "snippet": "c\nd", "other": "no escape needed"}'
    result = _extract_research_json(raw, escape_keys=("description", "snippet"))
    assert result["description"] == "a\nb"
    assert result["snippet"] == "c\nd"
    assert result["other"] == "no escape needed"


def test_extract_research_json_does_not_escape_quotes():
    """Round-1 review decision: \" inside values is NOT escaped (signals' historical
    quote-escaping is dropped during I-A consolidation; all 3 services unified)."""
    # If we had \"-escaping, a value containing literal " would parse cleanly.
    # Without it, an unescaped " inside a value would break json.loads. This test
    # documents that the shared helper does NOT add quote-escaping.
    raw = '{"k": "no quote here"}'   # plain case, just confirms baseline still works
    result = _extract_research_json(raw)
    assert result == {"k": "no quote here"}
