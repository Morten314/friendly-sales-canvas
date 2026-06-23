"""Unit tests for app/services/signals/artefact.py."""
import asyncio
import json

import pytest

from app.core.exceptions import ServiceError
from app.models.signals import MatchedLead, RecommendationArtefactRequest
from app.services.signals.artefact import (
    _parse_recommendation_artefact_response,
    generate_recommendation_artefact_claude,
)

_FIELDS = (
    "what_to_do",
    "strategy",
    "how_to_communicate",
    "communication_channel",
    "communication_template",
)


class _FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code
        self.text = json.dumps(payload)

    def json(self):
        return self._payload


def _claude_text(text):
    """Mimic Anthropic /v1/messages: a content list with one text block."""
    return _FakeResponse({"content": [{"type": "text", "text": text}]})


def _req():
    return RecommendationArtefactRequest(
        signal_headline="Hiring surge",
        signal_description="ICP context.",
        signal_sources=["src-a"],
        matched_leads=[MatchedLead(company="Acme", relevance="high", why="ICP match")],
        recommendation="Reach out now",
        recommendation_answer="Because timing.",
        user_id="u1",
        org_id="org1",
    )


# ---- parser (pure) ----

def test_parse_extracts_all_five_fields():
    out = _parse_recommendation_artefact_response(
        json.dumps(
            {
                "what_to_do": "step 1",
                "strategy": "the play",
                "how_to_communicate": "warm email",
                "communication_channel": "email",
                "communication_template": "Hi [First Name]",
            }
        )
    )
    assert out["what_to_do"] == "step 1"
    assert out["communication_channel"] == "email"
    assert out["communication_template"] == "Hi [First Name]"
    assert out["strategy"] == "the play"
    assert out["how_to_communicate"] == "warm email"


def test_parse_strips_markdown_fence():
    text = "```json\n{\"strategy\": \"x\"}\n```"
    assert _parse_recommendation_artefact_response(text)["strategy"] == "x"


def test_parse_degrades_to_empty_on_malformed_json():
    out = _parse_recommendation_artefact_response("not json at all")
    assert out == {k: "" for k in _FIELDS}


def test_parse_degrades_on_partial_and_non_string_values():
    out = _parse_recommendation_artefact_response(json.dumps({"strategy": 123}))
    assert out["strategy"] == "123"  # coerced
    assert out["what_to_do"] == ""   # missing -> ""


def test_parse_empty_input_returns_all_empty():
    assert _parse_recommendation_artefact_response("") == {k: "" for k in _FIELDS}


# ---- service (through, with Claude mocked) ----

def test_service_returns_parsed_fields(mocker):
    mocker.patch("app.services.signals.artefact.CLAUDE_API_KEY", "valid-key")
    mocker.patch("app.services.signals.artefact._estimate_token_count", return_value=10)
    mocker.patch(
        "app.services.signals.artefact._reserve_claude_signal_budget",
        return_value={"run_id": "rid"},
    )
    fin = mocker.patch(
        "app.services.signals.artefact._finalize_claude_signal_budget",
        return_value={"window_tokens_5m": 10, "run_count_5m": 1, "run_count_total": 1},
    )
    captured = {}

    def _post(*args, **kwargs):
        captured["prompt"] = kwargs["json"]["messages"][0]["content"]
        return _claude_text(json.dumps({"what_to_do": "do x", "communication_channel": "linkedin"}))

    mocker.patch("app.services.signals.artefact.requests.post", side_effect=_post)

    result = asyncio.run(generate_recommendation_artefact_claude(_req()))

    assert result["status"] == "success"
    assert result["what_to_do"] == "do x"
    assert result["communication_channel"] == "linkedin"
    assert result["strategy"] == ""  # missing -> degraded
    # the rendered prompt carries the signal + a matched lead
    assert "Hiring surge" in captured["prompt"]
    assert "Acme" in captured["prompt"]
    fin.assert_called_once()  # budget finalized exactly once on the happy path


def test_service_degrades_on_malformed_llm_output(mocker):
    mocker.patch("app.services.signals.artefact.CLAUDE_API_KEY", "valid-key")
    mocker.patch("app.services.signals.artefact._estimate_token_count", return_value=10)
    mocker.patch(
        "app.services.signals.artefact._reserve_claude_signal_budget",
        return_value={"run_id": "rid"},
    )
    fin = mocker.patch(
        "app.services.signals.artefact._finalize_claude_signal_budget",
        return_value={"window_tokens_5m": 10, "run_count_5m": 1, "run_count_total": 1},
    )
    mocker.patch(
        "app.services.signals.artefact.requests.post",
        return_value=_claude_text("the model rambled without JSON"),
    )
    result = asyncio.run(generate_recommendation_artefact_claude(_req()))
    assert result["status"] == "success"
    assert all(result[k] == "" for k in _FIELDS)  # never throws; all empty
    fin.assert_called_once()


def test_service_raises_without_api_key(mocker):
    mocker.patch("app.services.signals.artefact.CLAUDE_API_KEY", "")
    with pytest.raises(ServiceError):
        asyncio.run(generate_recommendation_artefact_claude(_req()))
