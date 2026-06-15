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


def test_compute_fingerprint_is_order_independent():
    from app.services.signals.lead_map import _compute_fingerprint
    assert _compute_fingerprint(["s1", "s2"], ["l1", "l2"]) == _compute_fingerprint(
        ["s2", "s1"], ["l2", "l1"]
    )


def test_compute_fingerprint_changes_with_set():
    from app.services.signals.lead_map import _compute_fingerprint
    assert _compute_fingerprint(["s1"], ["l1"]) != _compute_fingerprint(["s1", "s2"], ["l1"])


def test_signal_and_lead_id_extraction():
    from app.services.signals.lead_map import _signal_ids, _lead_ids
    assert _signal_ids([{"signal_id": "s1"}, {"id": "s2"}, {"headline": "x"}]) == ["s1", "s2"]
    assert _lead_ids([{"lead_id": "l1"}, {"company": "x"}]) == ["l1"]


def test_save_and_get_cached_lead_map_roundtrip():
    from unittest.mock import MagicMock
    from app.services.signals import lead_map
    store = {}
    coll = MagicMock()
    coll.find_one.side_effect = lambda flt: store.get(flt["_id"])
    coll.update_one.side_effect = lambda flt, upd, upsert=False: store.update(
        {flt["_id"]: {"_id": flt["_id"], **upd["$set"]}}
    )
    mongo = MagicMock()
    mongo.__getitem__.return_value.__getitem__.return_value = coll

    lead_map._save_lead_map(mongo, "o1", "u1", [{"signal_id": "s1", "leads": []}], "fp", "t0")
    doc = lead_map._get_cached_lead_map(mongo, "o1", "u1")
    assert doc["fingerprint"] == "fp"
    assert doc["mapping"] == [{"signal_id": "s1", "leads": []}]
