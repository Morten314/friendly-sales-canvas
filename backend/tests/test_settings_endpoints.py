"""Tests for the admin app-settings endpoints — GET/PUT /admin/settings (spec 47).

The router-level require_admin gate (401 missing / 403 non-allowlisted) is shared
with the other /admin routes and unit-tested in test_admin.py; here we override it
to exercise the handlers.
"""
from contextlib import contextmanager
from unittest.mock import MagicMock

import pytest


@contextmanager
def _override(provider, instance):
    from app.main import app
    app.dependency_overrides[provider] = lambda: instance
    try:
        yield
    finally:
        app.dependency_overrides.pop(provider, None)


def _mongo_with_settings(doc):
    settings_col = MagicMock()
    settings_col.find_one.return_value = doc
    db = MagicMock()
    db.__getitem__.return_value = settings_col
    mongo = MagicMock()
    mongo.__getitem__.return_value = db
    return mongo, settings_col


@pytest.fixture(autouse=True)
def _allow_admin():
    from app.main import app
    from app.core.auth import require_admin

    app.dependency_overrides[require_admin] = lambda: {"email": "gaurav@brewra.com"}
    yield
    app.dependency_overrides.pop(require_admin, None)


def test_get_settings_returns_default_when_unset(client):
    from app.core.dependencies import get_mongo
    mongo, _ = _mongo_with_settings(None)
    with _override(get_mongo, mongo):
        resp = client.get("/admin/settings")
    assert resp.status_code == 200
    assert resp.json() == {"lead_fetch_limit": 500}


def test_get_settings_returns_stored_value(client):
    from app.core.dependencies import get_mongo
    mongo, _ = _mongo_with_settings({"_id": "settings", "lead_fetch_limit": 250})
    with _override(get_mongo, mongo):
        resp = client.get("/admin/settings")
    assert resp.status_code == 200
    assert resp.json() == {"lead_fetch_limit": 250}


def test_put_settings_upserts_and_returns(client):
    from app.core.dependencies import get_mongo
    mongo, col = _mongo_with_settings(None)
    with _override(get_mongo, mongo):
        resp = client.put("/admin/settings", json={"lead_fetch_limit": 300})
    assert resp.status_code == 200
    assert resp.json() == {"lead_fetch_limit": 300}
    col.update_one.assert_called_once_with(
        {"_id": "settings"}, {"$set": {"lead_fetch_limit": 300}}, upsert=True
    )


@pytest.mark.parametrize("bad", [0, 501, -5])
def test_put_settings_rejects_out_of_range(client, bad):
    from app.core.dependencies import get_mongo
    mongo, col = _mongo_with_settings(None)
    with _override(get_mongo, mongo):
        resp = client.put("/admin/settings", json={"lead_fetch_limit": bad})
    assert resp.status_code == 422
    col.update_one.assert_not_called()
