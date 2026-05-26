# backend/tests/unit/test_graph_chat.py
"""Unit tests for app/services/graph_chat/prospect_pipeline.py::score_prospect.

score_prospect uses a manual two-render recipe (Plan 13 Task 13, audit-discovered
P-024): a static SystemMessage from score_prospect_system and a HumanMessage from
score_prospect_user. Returns (score, prompt_meta) — prompt_meta is sourced from
the user render (canonical invocation surface; render_inputs_hash carries
cypher_query, the variable half of the call).
"""
from unittest.mock import MagicMock

from app.services.graph_chat.prospect_pipeline import score_prospect


class _FakeAIResponse:
    """Mimics an AIMessage — str() yields a repr that includes content='…',
    matching what `extract_number`'s `r"'([^']+)'"` regex consumes in
    production (LangChain `AIMessage.__repr__` formats as `content='…'`).
    """

    def __init__(self, content: str) -> None:
        self.content = content

    def __str__(self) -> str:
        return f"content='{self.content}'"


def test_score_prospect_returns_score_and_prompt_meta():
    """Default happy path — fake LLM returns a single number wrapped in the
    AIMessage str-repr shape that extract_number's regex consumes. Confirms
    the two-message dispatch and the (score, prompt_meta) tuple return.
    """
    fake_llm = MagicMock()
    fake_llm.invoke.return_value = _FakeAIResponse("7")

    score, prompt_meta = score_prospect(
        fake_llm,
        "CREATE (p:Prospect {Name: 'Jane', Company: 'Acme'})",
    )

    assert score == "7"
    # invoke was called once with a 2-message list (SystemMessage, HumanMessage)
    fake_llm.invoke.assert_called_once()
    messages = fake_llm.invoke.call_args.args[0]
    assert len(messages) == 2
    # SystemMessage.content carries the static instruction body
    assert "evaluate his answers and score the prospect" in messages[0].content
    # HumanMessage.content carries the cypher query + the trailer
    assert "Cypher Query:" in messages[1].content
    assert "Jane" in messages[1].content
    assert "Only give me the number" in messages[1].content

    # prompt_meta carries the canonical observability fields from the user render
    assert prompt_meta["name"] == "score_prospect_user"
    assert prompt_meta["version"] == "1.0.0"
    assert prompt_meta["model"] == "llama-3.3-70b-versatile"
    assert "content_hash" in prompt_meta
    assert "render_inputs_hash" in prompt_meta
    assert "rendered_at" in prompt_meta


def test_score_prospect_returns_none_score_when_response_has_no_number():
    """extract_number falls back to None when no quoted-number pattern matches.
    prompt_meta is still emitted regardless of LLM response shape."""
    fake_llm = MagicMock()

    class _NoQuoteResponse:
        content = "no number here at all"

        def __str__(self) -> str:
            return self.content  # no single-quoted token → regex misses → None

    fake_llm.invoke.return_value = _NoQuoteResponse()

    score, prompt_meta = score_prospect(fake_llm, "CREATE (p:Prospect)")

    assert score is None
    assert prompt_meta["name"] == "score_prospect_user"
