"""Unit tests for SignalLeadMapRequest model and signals_lead_map prompt."""


def test_signal_lead_map_request_defaults_refresh_false():
    from app.models.signals import SignalLeadMapRequest
    req = SignalLeadMapRequest(user_id="u1", org_id="o1")
    assert req.refresh is False


def test_signals_lead_map_prompt_renders():
    # unit conftest autouse fixture has already called init_registry()
    from app.core import prompts
    rendered = prompts.render(
        "signals_lead_map",
        signals_json="[]",
        leads_json="[]",
        context_json="{}",
    )
    assert rendered.body
    assert "relevance" in rendered.body.lower()
