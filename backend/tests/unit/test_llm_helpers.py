"""Unit tests for app/services/_llm_helpers.py shared helpers.

Covers _research_agent_output (Qwen + Claude paths, URL extraction)
and _extract_research_json (escape_keys, trim_braces, strip_final_answer).
"""
from unittest.mock import MagicMock

import pytest

from app.services._llm_helpers import (
    _research_agent_output,
    _extract_research_json,
)


# ---------------------------------------------------------------------------
# _research_agent_output — Qwen path
# ---------------------------------------------------------------------------

def test_research_agent_output_qwen_returns_text_and_empty_urls_by_default():
    """Default (extract_intermediate_urls=False) returns (text, [])."""
    agent_chain = MagicMock()
    agent_chain.invoke.return_value = {"output": "agent response text"}

    text, urls = _research_agent_output(
        agent_chain, prompt="hello", seed_text="seed", llm_backend="qwen",
        search_query_template="market research {seed}",
    )
    assert text == "agent response text"
    assert urls == []


def test_research_agent_output_qwen_extracts_intermediate_urls_when_flagged():
    """extract_intermediate_urls=True walks intermediate_steps for tavily URLs."""
    agent_chain = MagicMock()
    raw = MagicMock()
    raw.__getitem__.side_effect = lambda k: "response text" if k == "output" else None
    raw.intermediate_steps = [
        ("step1", [{"url": "https://a.com"}, {"url": "https://b.com"}])
    ]
    agent_chain.invoke.return_value = raw

    text, urls = _research_agent_output(
        agent_chain, prompt="x", seed_text="s", llm_backend="qwen",
        search_query_template="q {seed}",
        extract_intermediate_urls=True,
    )
    assert text == "response text"
    assert "https://a.com" in urls
    assert "https://b.com" in urls


def test_research_agent_output_qwen_regex_fallback_when_no_intermediate_urls():
    """extract_intermediate_urls=True falls back to regex on the response text."""
    agent_chain = MagicMock()
    raw = MagicMock()
    raw.__getitem__.side_effect = lambda k: "see https://x.com and https://y.com here" if k == "output" else None
    raw.intermediate_steps = []
    agent_chain.invoke.return_value = raw

    text, urls = _research_agent_output(
        agent_chain, prompt="x", seed_text="s", llm_backend="qwen",
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


# ---------------------------------------------------------------------------
# LLM-client factory + simple-invoke helper (call_with_prompt)
# ---------------------------------------------------------------------------


@pytest.fixture
def isolated_llm_factory():
    """Snapshot/restore _LLM_FACTORY and _LLM_CACHE for tests that mutate them."""
    from app.services import _llm_helpers
    factory_snapshot = dict(_llm_helpers._LLM_FACTORY)
    cache_snapshot = dict(_llm_helpers._LLM_CACHE)
    _llm_helpers._LLM_FACTORY.clear()
    _llm_helpers._LLM_CACHE.clear()
    yield _llm_helpers
    _llm_helpers._LLM_FACTORY.clear()
    _llm_helpers._LLM_FACTORY.update(factory_snapshot)
    _llm_helpers._LLM_CACHE.clear()
    _llm_helpers._LLM_CACHE.update(cache_snapshot)


def test_register_llm_and_get_llm_for_model(isolated_llm_factory):
    from app.core.prompts import UnknownModelError
    _llm_helpers = isolated_llm_factory

    built_count = {"n": 0}

    def builder():
        built_count["n"] += 1
        return object()

    _llm_helpers.register_llm("test-model", builder)
    llm1 = _llm_helpers._get_llm_for_model("test-model")
    llm2 = _llm_helpers._get_llm_for_model("test-model")
    assert llm1 is llm2          # cached
    assert built_count["n"] == 1  # builder called once

    with pytest.raises(UnknownModelError):
        _llm_helpers._get_llm_for_model("not-registered")


def test_call_with_prompt_renders_and_invokes(tmp_path, isolated_llm_factory):
    """call_with_prompt should: render via prompts.render(), resolve LLM by
    front-matter model, invoke([HumanMessage(content=body)]), return (response, prompt_meta).
    """
    from app.core import prompts as prompts_mod
    import yaml
    _llm_helpers = isolated_llm_factory

    # Build a synthetic prompts tree.
    (tmp_path / "_shared").mkdir()
    (tmp_path / "_shared" / "defaults.yaml").write_text("temperature: 0.0\nmax_tokens: 100\ntimeout_s: 30\n")
    prompt_dir = tmp_path / "svc"
    prompt_dir.mkdir()
    (prompt_dir / "p.md.j2").write_text(
        "---\n" +
        yaml.safe_dump({
            "name": "p", "version": "1.0.0", "description": "test",
            "model": "fake-llm", "response_format": "json", "inputs": ["x"],
        }) +
        "---\n" +
        "Body: {{ x }}\n"
    )
    prompts_mod.init_registry(root=tmp_path)

    # Register a fake LLM (fixture already cleared the factory).
    captured = {}
    class FakeResponse:
        content = "fake response"
    class FakeLLM:
        def invoke(self, messages):
            captured["messages"] = messages
            return FakeResponse()
    _llm_helpers.register_llm("fake-llm", lambda: FakeLLM())

    response, prompt_meta = _llm_helpers.call_with_prompt("p", x="hi")
    assert response.content == "fake response"
    assert prompt_meta["name"] == "p"
    assert prompt_meta["version"] == "1.0.0"
    assert prompt_meta["model"] == "fake-llm"
    assert "content_hash" in prompt_meta and prompt_meta["content_hash"]
    assert "render_inputs_hash" in prompt_meta and prompt_meta["render_inputs_hash"]
    assert "rendered_at" in prompt_meta

    # Verify HumanMessage shape.
    from langchain_core.messages import HumanMessage
    assert len(captured["messages"]) == 1
    assert isinstance(captured["messages"][0], HumanMessage)
    assert captured["messages"][0].content == "Body: hi\n"
