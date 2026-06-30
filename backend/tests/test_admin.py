"""Tests for the internal ops-console endpoints (spec 44)."""
import asyncio
from contextlib import contextmanager
from unittest.mock import MagicMock

import pytest

from app.core.exceptions import AuthenticationError, AuthorizationError


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


@pytest.fixture(autouse=True)
def _allow_admin():
    """Endpoint tests target an allowlisted operator — override the Firebase
    verify dependency so they exercise the handler, not the auth gate. The
    verification/allowlist logic itself is unit-tested in test_require_admin_*."""
    from app.main import app
    from app.core.auth import require_admin

    app.dependency_overrides[require_admin] = lambda: {"email": "gaurav@brewra.com"}
    yield
    app.dependency_overrides.pop(require_admin, None)


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
    assert sorted(by_id["o2"]["user_ids"]) == ["u3"]


def test_admin_orgs_empty_when_no_orgs_doc(client):
    from app.core.dependencies import get_mongo
    mongo = _mongo_with_org_docs(None, None)
    with _override(get_mongo, mongo):
        resp = client.get("/admin/orgs")
    assert resp.status_code == 200
    assert resp.json() == []


def test_admin_health_aggregates_all_probes(client):
    from app.core.dependencies import (
        get_mongo, get_neo4j_driver, get_pinecone, get_llm2,
    )
    from app.main import app

    mongo = MagicMock()
    mongo.admin.command.return_value = {"ok": 1.0}
    driver = MagicMock()
    driver.verify_connectivity.return_value = None
    pc = MagicMock()
    pc.list_indexes.return_value = []
    llm2 = MagicMock()
    llm2.invoke.return_value = MagicMock(content='{"test": "hello"}')

    app.dependency_overrides[get_mongo] = lambda: mongo
    app.dependency_overrides[get_neo4j_driver] = lambda: driver
    app.dependency_overrides[get_pinecone] = lambda: pc
    app.dependency_overrides[get_llm2] = lambda: llm2
    try:
        resp = client.get("/admin/health")
    finally:
        for p in (get_mongo, get_neo4j_driver, get_pinecone, get_llm2):
            app.dependency_overrides.pop(p, None)

    assert resp.status_code == 200
    probes = {p["name"]: p for p in resp.json()["probes"]}
    assert set(probes) == {"mongo", "neo4j", "pinecone", "llm"}
    assert probes["mongo"]["status"] == "ok"


def test_admin_health_one_dep_down_does_not_500(client):
    from app.core.dependencies import (
        get_mongo, get_neo4j_driver, get_pinecone, get_llm2,
    )
    from app.main import app

    mongo = MagicMock()
    mongo.admin.command.side_effect = RuntimeError("mongo unreachable")
    driver = MagicMock()
    pc = MagicMock()
    pc.list_indexes.return_value = []
    llm2 = MagicMock()
    llm2.invoke.return_value = MagicMock(content="{}")

    app.dependency_overrides[get_mongo] = lambda: mongo
    app.dependency_overrides[get_neo4j_driver] = lambda: driver
    app.dependency_overrides[get_pinecone] = lambda: pc
    app.dependency_overrides[get_llm2] = lambda: llm2
    try:
        resp = client.get("/admin/health")
    finally:
        for p in (get_mongo, get_neo4j_driver, get_pinecone, get_llm2):
            app.dependency_overrides.pop(p, None)

    assert resp.status_code == 200
    probes = {p["name"]: p for p in resp.json()["probes"]}
    assert probes["mongo"]["status"] == "error"
    assert "unreachable" in (probes["mongo"]["detail"] or "")


def test_run_probe_times_out_at_its_own_budget():
    """A probe that exceeds its passed timeout reports 'timeout' (naming the
    budget) rather than blocking — the per-probe budget is honored."""
    import time
    from app.routers.admin import _run_probe

    def slow(_arg):
        time.sleep(0.3)
        return {"name": "slow", "status": "ok"}

    result = asyncio.run(_run_probe("slow", 0.02, slow, object()))
    assert result["status"] == "timeout"
    assert "0.02" in result["detail"]


def test_admin_health_gives_llm_a_longer_timeout_than_connectivity(client, monkeypatch):
    """The LLM probe (a real generation) gets a strictly larger budget than the
    three connectivity pings, which share one budget."""
    import app.routers.admin as admin_router

    captured = {}

    async def _spy(name, timeout, fn, *args):
        captured[name] = timeout
        return {"name": name, "status": "ok"}

    monkeypatch.setattr(admin_router, "_run_probe", _spy)
    resp = client.get("/admin/health")

    assert resp.status_code == 200
    assert captured["mongo"] == captured["neo4j"] == captured["pinecone"]
    assert captured["llm"] > captured["mongo"]


def test_require_admin_allows_allowlisted_email(monkeypatch):
    import app.core.auth as auth_mod

    monkeypatch.setattr(
        auth_mod, "verify_firebase_id_token", lambda _t: {"email": "Gaurav@Brewra.com"}
    )
    claims = auth_mod.require_admin("Bearer faketoken")
    assert claims["email"].lower() == "gaurav@brewra.com"


def test_require_admin_rejects_non_allowlisted_email(monkeypatch):
    import app.core.auth as auth_mod

    monkeypatch.setattr(
        auth_mod, "verify_firebase_id_token", lambda _t: {"email": "stranger@example.com"}
    )
    with pytest.raises(AuthorizationError):
        auth_mod.require_admin("Bearer faketoken")


def test_require_admin_rejects_missing_bearer():
    from app.core.auth import require_admin

    with pytest.raises(AuthenticationError):
        require_admin("")


def test_admin_allowlist_contains_all_operators():
    from app.core.auth import ADMIN_EMAILS

    assert {
        "gaurav@brewra.com",
        "shilpa@brewra.com",
        "ishani@brewra.com",
        "mortenevensen@brewra.com",
        "sunnyghosh@brewra.com",
    } <= ADMIN_EMAILS
