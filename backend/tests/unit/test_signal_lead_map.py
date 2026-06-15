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


# ---------------------------------------------------------------------------
# Task-10: build_signal_lead_map_claude orchestration tests
# ---------------------------------------------------------------------------
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.signals import SignalLeadMapRequest


def _fake_cache_mongo(initial=None):
    store = dict(initial or {})
    coll = MagicMock()
    coll.find_one.side_effect = lambda flt: store.get(flt["_id"])
    coll.update_one.side_effect = lambda flt, upd, upsert=False: store.update(
        {flt["_id"]: {"_id": flt["_id"], **upd["$set"]}}
    )
    mongo = MagicMock()
    mongo.__getitem__.return_value.__getitem__.return_value = coll
    return mongo, store


def _run(signals, leads, claude_return, *, mongo=None, refresh=False):
    from app.services.signals import lead_map
    mongo = mongo or _fake_cache_mongo()[0]
    driver = MagicMock()
    req = SignalLeadMapRequest(user_id="u1", org_id="o1", refresh=refresh)
    with patch("app.services.signals.persistence.fetch_signals",
               new=AsyncMock(return_value=(signals, len(signals)))), \
         patch("app.services.leads.persistence.get_leads_for_org",
               return_value=(leads, len(leads))), \
         patch("app.services.signals.persistence._get_signal_ask_customer_profile",
               return_value={"icps": []}), \
         patch("app.services._llm_helpers._claude_messages_text") as claude:
        if isinstance(claude_return, Exception):
            claude.side_effect = claude_return
        else:
            claude.return_value = claude_return
        result = asyncio.run(lead_map.build_signal_lead_map_claude(driver, mongo, req))
        return result, claude


def test_build_map_empty_signals_short_circuits():
    result, claude = _run([], [{"lead_id": "l1"}], "")
    assert result["data"]["mapping"] == []
    claude.assert_not_called()


def test_build_map_empty_leads_short_circuits():
    result, claude = _run([{"signal_id": "s1"}], [], "")
    assert result["data"]["mapping"] == []
    claude.assert_not_called()


def test_build_map_cache_miss_computes_and_writes():
    signals = [{"signal_id": "s1", "headline": "Hiring surge"}]
    leads = [{"lead_id": "l1", "company_name": "Acme"}]
    claude_json = (
        '{"mapping":[{"signal_id":"s1","leads":'
        '[{"lead_id":"l1","company":"Acme","relevance":"high","why":"match"}]}]}'
    )
    mongo, store = _fake_cache_mongo()
    result, claude = _run(signals, leads, claude_json, mongo=mongo)
    entry = result["data"]["mapping"][0]
    assert result["data"]["cached"] is False
    assert entry["signal_id"] == "s1"
    assert entry["headline"] == "Hiring surge"          # echoed from fetched signals
    assert entry["leads"][0]["lead_id"] == "l1"
    assert entry["leads"][0]["relevance"] == "high"
    assert "o1:u1" in store                              # cache written
    claude.assert_called_once()


def test_build_map_cache_hit_skips_claude():
    from app.services.signals import lead_map
    signals = [{"signal_id": "s1", "headline": "h"}]
    leads = [{"lead_id": "l1"}]
    fp = lead_map._compute_fingerprint(["s1"], ["l1"])
    mongo, _ = _fake_cache_mongo({
        "o1:u1": {"_id": "o1:u1", "fingerprint": fp, "generated_at": "t0",
                  "mapping": [{"signal_id": "s1", "headline": "cached", "leads": []}]}
    })
    result, claude = _run(signals, leads, "SHOULD-NOT-RUN", mongo=mongo)
    assert result["data"]["cached"] is True
    assert result["data"]["mapping"][0]["headline"] == "cached"
    claude.assert_not_called()


def test_build_map_refresh_forces_recompute():
    from app.services.signals import lead_map
    signals = [{"signal_id": "s1", "headline": "h"}]
    leads = [{"lead_id": "l1"}]
    fp = lead_map._compute_fingerprint(["s1"], ["l1"])
    mongo, _ = _fake_cache_mongo({
        "o1:u1": {"_id": "o1:u1", "fingerprint": fp, "generated_at": "t0",
                  "mapping": [{"signal_id": "s1", "headline": "cached", "leads": []}]}
    })
    fresh = '{"mapping":[{"signal_id":"s1","leads":[]}]}'
    result, claude = _run(signals, leads, fresh, mongo=mongo, refresh=True)
    assert result["data"]["cached"] is False
    claude.assert_called_once()


def test_build_map_drops_invented_ids():
    signals = [{"signal_id": "s1"}]
    leads = [{"lead_id": "l1"}]
    claude_json = (
        '{"mapping":[{"signal_id":"sX","leads":[]},'
        '{"signal_id":"s1","leads":[{"lead_id":"lX","relevance":"high","why":"x"},'
        '{"lead_id":"l1","relevance":"low","why":"y"}]}]}'
    )
    result, _ = _run(signals, leads, claude_json)
    mapping = result["data"]["mapping"]
    assert [e["signal_id"] for e in mapping] == ["s1"]          # sX dropped
    assert [l["lead_id"] for l in mapping[0]["leads"]] == ["l1"]  # lX dropped


def test_build_map_tolerates_truncated_json():
    signals = [{"signal_id": "s1"}, {"signal_id": "s2"}]
    leads = [{"lead_id": "l1"}, {"lead_id": "l2"}]
    truncated = (
        '{"mapping":[{"signal_id":"s1","leads":'
        '[{"lead_id":"l1","company":"A","relevance":"high","why":"x"}]},'
        '{"signal_id":"s2","leads":[{"lead_id":"l2","compa'  # cut off mid-token
    )
    result, _ = _run(signals, leads, truncated)
    assert [e["signal_id"] for e in result["data"]["mapping"]] == ["s1"]  # valid prefix kept


def test_build_map_degrades_to_empty_on_claude_failure():
    result, _ = _run([{"signal_id": "s1"}], [{"lead_id": "l1"}], RuntimeError("boom"))
    assert result["status"] == "success"
    assert result["data"]["mapping"] == []
