"""Tests for the internal ops-console endpoints (spec 44)."""
from contextlib import contextmanager
from unittest.mock import MagicMock


@contextmanager
def _override(provider, instance):
    from app.main import app
    app.dependency_overrides[provider] = lambda: instance
    try:
        yield
    finally:
        app.dependency_overrides.pop(provider, None)


def _mongo_with_org_docs(orgs_doc, users_doc):
    """MongoClient-shaped mock where db['orgs'] / db['users'] each return a
    collection mock with the right find_one result."""
    orgs_col = MagicMock()
    orgs_col.find_one.return_value = orgs_doc
    users_col = MagicMock()
    users_col.find_one.return_value = users_doc
    db = MagicMock()
    db.__getitem__.side_effect = lambda name: {"orgs": orgs_col, "users": users_col}[name]
    mongo = MagicMock()
    mongo.__getitem__.return_value = db  # mongo["Org_Management"] -> db
    return mongo


def test_admin_orgs_returns_orgs_with_user_counts(client):
    from app.core.dependencies import get_mongo
    orgs_doc = {"_id": "orgs", "org_list": ["o1", "o2"], "org_names": {"o1": "Acme"}}
    users_doc = {"_id": "users", "user_mappings": {"u1": "o1", "u2": "o1", "u3": "o2"}}
    mongo = _mongo_with_org_docs(orgs_doc, users_doc)

    with _override(get_mongo, mongo):
        resp = client.get("/admin/orgs")

    assert resp.status_code == 200
    body = resp.json()
    by_id = {o["org_id"]: o for o in body}
    assert by_id["o1"]["org_name"] == "Acme"
    assert by_id["o1"]["user_count"] == 2
    assert sorted(by_id["o1"]["user_ids"]) == ["u1", "u2"]
    assert by_id["o2"]["org_name"] is None
    assert by_id["o2"]["user_count"] == 1


def test_admin_orgs_empty_when_no_orgs_doc(client):
    from app.core.dependencies import get_mongo
    mongo = _mongo_with_org_docs(None, None)
    with _override(get_mongo, mongo):
        resp = client.get("/admin/orgs")
    assert resp.status_code == 200
    assert resp.json() == []
