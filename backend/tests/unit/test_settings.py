"""Unit tests for the global admin-editable app settings (spec 47).

Covers the AppSettings model bounds, the settings store (read/update with a
safe fallback to defaults), and the signal-generation lead-fetch helper.
"""
import asyncio
from types import SimpleNamespace
from unittest.mock import MagicMock, call

import pytest
from pydantic import ValidationError


# --------------------------------------------------------------------------- #
# Mongo mock shaped like the Org_Management single-doc store.
# --------------------------------------------------------------------------- #
def _mongo_with_settings(doc):
    """mongo["Org_Management"]["settings"].find_one(...) -> doc. Returns
    (mongo, settings_collection_mock) so tests can assert writes."""
    settings_col = MagicMock()
    settings_col.find_one.return_value = doc
    db = MagicMock()
    db.__getitem__.return_value = settings_col  # db["settings"]
    mongo = MagicMock()
    mongo.__getitem__.return_value = db  # mongo["Org_Management"]
    return mongo, settings_col


# --------------------------------------------------------------------------- #
# AppSettings model
# --------------------------------------------------------------------------- #
def test_app_settings_default_is_500():
    from app.models.settings import AppSettings

    assert AppSettings().lead_fetch_limit == 500


def test_app_settings_rejects_zero():
    from app.models.settings import AppSettings

    with pytest.raises(ValidationError):
        AppSettings(lead_fetch_limit=0)


def test_app_settings_rejects_above_ceiling():
    from app.models.settings import AppSettings

    with pytest.raises(ValidationError):
        AppSettings(lead_fetch_limit=501)


# --------------------------------------------------------------------------- #
# Settings store — get_app_settings / update_app_settings
# --------------------------------------------------------------------------- #
def test_get_app_settings_defaults_when_doc_missing():
    from app.services.settings import get_app_settings

    mongo, _ = _mongo_with_settings(None)
    assert get_app_settings(mongo).lead_fetch_limit == 500


def test_get_app_settings_returns_stored_value():
    from app.services.settings import get_app_settings

    mongo, _ = _mongo_with_settings({"_id": "settings", "lead_fetch_limit": 250})
    assert get_app_settings(mongo).lead_fetch_limit == 250


def test_get_app_settings_defaults_on_read_error():
    """A settings-store failure must never break signal work — fall back."""
    from app.services.settings import get_app_settings

    mongo, col = _mongo_with_settings(None)
    col.find_one.side_effect = RuntimeError("mongo down")
    assert get_app_settings(mongo).lead_fetch_limit == 500


def test_get_app_settings_defaults_on_malformed_stored_value():
    from app.services.settings import get_app_settings

    mongo, _ = _mongo_with_settings({"_id": "settings", "lead_fetch_limit": 99999})
    assert get_app_settings(mongo).lead_fetch_limit == 500


def test_update_app_settings_upserts_and_returns():
    from app.models.settings import AppSettings
    from app.services.settings import update_app_settings

    mongo, col = _mongo_with_settings(None)
    result = update_app_settings(mongo, AppSettings(lead_fetch_limit=300))

    assert result.lead_fetch_limit == 300
    col.update_one.assert_called_once_with(
        {"_id": "settings"},
        {"$set": {"lead_fetch_limit": 300, "signal_lead_map_lead_limit": 100,
                  "signal_lead_map_batch_size": 15}},
        upsert=True,
    )


# --------------------------------------------------------------------------- #
# Signal-generation lead-fetch helper
# --------------------------------------------------------------------------- #
def test_fetch_org_leads_uses_admin_limit(monkeypatch):
    import app.services.signals.lead_fetch as lead_fetch
    from app.models.settings import AppSettings

    monkeypatch.setattr(lead_fetch, "get_app_settings", lambda _m: AppSettings(lead_fetch_limit=250))
    get_leads = MagicMock(return_value=([{"lead_id": "l1"}], 1))
    monkeypatch.setattr(lead_fetch, "get_leads_for_org", get_leads)

    driver, mongo = object(), object()
    out = lead_fetch.fetch_org_leads_for_signals(driver, mongo, "o1")

    assert out == [{"lead_id": "l1"}]
    get_leads.assert_called_once_with(driver, org_id="o1", limit=250, offset=0)


def test_fetch_org_leads_returns_empty_on_error(monkeypatch):
    import app.services.signals.lead_fetch as lead_fetch
    from app.models.settings import AppSettings

    monkeypatch.setattr(lead_fetch, "get_app_settings", lambda _m: AppSettings())
    monkeypatch.setattr(
        lead_fetch, "get_leads_for_org", MagicMock(side_effect=RuntimeError("neo4j down"))
    )

    out = lead_fetch.fetch_org_leads_for_signals(object(), object(), "o1")
    assert out == []


# --------------------------------------------------------------------------- #
# Matched-leads map wiring — lead_map fetches at min(map lead limit, admin limit)
# --------------------------------------------------------------------------- #
def test_lead_map_fetches_leads_at_map_limit(monkeypatch):
    """lead_map uses its own signal_lead_map_lead_limit, bounded by the admin
    lead_fetch_limit — i.e. min(map limit, admin limit) — so tuning the map's
    coverage never touches signal-generation grounding (TD-015)."""
    import app.services.signals.lead_map as lead_map
    from app.models.settings import AppSettings

    async def _fake_fetch_signals(*_a, **_k):
        return ([{"signal_id": "s1", "headline": "h"}], 1)

    monkeypatch.setattr(lead_map.persistence, "fetch_signals", _fake_fetch_signals)
    monkeypatch.setattr(
        lead_map,
        "get_app_settings",
        lambda _m: AppSettings(lead_fetch_limit=250, signal_lead_map_lead_limit=100),
    )
    get_leads = MagicMock(return_value=([], 0))  # empty -> early return, no Claude call
    monkeypatch.setattr(lead_map.leads_persistence, "get_leads_for_org", get_leads)

    driver, mongo = object(), object()
    request = SimpleNamespace(user_id="u1", org_id="o1", refresh=True)
    asyncio.run(lead_map.build_signal_lead_map_claude(driver, mongo, request))

    assert get_leads.call_args == call(driver, "o1", 100, 0)  # min(100, 250)
