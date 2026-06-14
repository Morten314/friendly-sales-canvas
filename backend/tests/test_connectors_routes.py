"""Route-level tests for the new Apollo discovery/warmup/export endpoints.

Monkeypatching strategy:
  - warmup route: patch warmup_service module attribute (the router imports
    `from app.services.connectors import warmup as warmup_service` and calls
    `warmup_service.get_warmup_status` — so patch is on the module).
  - discover/status/export routes: patch on the `app.services.connectors`
    package namespace (the router calls `connectors_service.X` where
    `connectors_service = app.services.connectors`; __init__.py re-exports
    these names, so patching the package attribute intercepts the call).
"""
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import get_llm2, get_mongo, get_neo4j_driver
from app.main import app


def test_warmup_route(monkeypatch):
    import app.services.connectors.warmup as warmup_mod

    monkeypatch.setattr(
        warmup_mod,
        "get_warmup_status",
        lambda m, o, u: {
            "icp_configured": True,
            "signals_generated": False,
            "scout_completed": True,
            "profiler_analyzed": True,
            "ready_count": 3,
            "unlocked": False,
            "missing": [{"step": "signals_generated", "label": "S", "deep_link_hint": "signals"}],
        },
    )
    app.dependency_overrides[get_mongo] = lambda: object()
    try:
        client = TestClient(app)
        resp = client.get("/connectors/apollo/warmup", params={"org_id": "o", "user_id": "u"})
        assert resp.status_code == 200
        assert resp.json()["ready_count"] == 3
    finally:
        app.dependency_overrides.pop(get_mongo, None)


def test_discover_status_route(monkeypatch):
    import app.services.connectors as connectors_mod

    monkeypatch.setattr(
        connectors_mod,
        "get_apollo_discovery_status",
        lambda m, o, r: {
            "run_id": "r1",
            "org_id": o,
            "status": "completed",
            "mode": "keep",
            "counts": {
                "searched": 10, "qualified": 5, "selected": 5, "revealed": 5,
                "verified": 3, "unverified": 2, "created": 4, "matched": 1,
                "skipped_duplicates": 0, "errors": [],
            },
            "credits_consumed": 5,
            "icp_fingerprint": None,
            "started_at": None,
            "finished_at": None,
            "message": None,
        },
    )
    app.dependency_overrides[get_mongo] = lambda: MagicMock()
    try:
        client = TestClient(app)
        resp = client.get("/connectors/apollo/discover/status", params={"org_id": "o"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"
    finally:
        app.dependency_overrides.pop(get_mongo, None)


def test_export_route_csv(monkeypatch):
    import app.services.connectors as connectors_mod

    captured = {}

    def _stub_export(driver, org_id, *, fmt="json"):
        captured["fmt"] = fmt
        return "name,email\nA,a@x.com\n", "text/csv"

    monkeypatch.setattr(connectors_mod, "export_discovery_leads", _stub_export)
    app.dependency_overrides[get_neo4j_driver] = lambda: object()
    try:
        client = TestClient(app)
        resp = client.get(
            "/connectors/apollo/leads/export",
            params={"org_id": "o", "format": "csv"},
        )
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/csv")
        assert "A,a@x.com" in resp.text
        assert captured["fmt"] == "csv"
    finally:
        app.dependency_overrides.pop(get_neo4j_driver, None)


def test_discover_route_queues(monkeypatch):
    import app.services.connectors as connectors_mod

    monkeypatch.setattr(
        connectors_mod,
        "start_apollo_discover",
        lambda driver, mongo, req, bt, llm=None: {"run_id": "run-abc", "status": "queued"},
    )
    app.dependency_overrides[get_mongo] = lambda: MagicMock()
    app.dependency_overrides[get_neo4j_driver] = lambda: MagicMock()
    app.dependency_overrides[get_llm2] = lambda: MagicMock()
    try:
        client = TestClient(app)
        resp = client.post(
            "/connectors/apollo/discover",
            json={"org_id": "o", "user_id": "u", "mode": "keep"},
        )
        assert resp.status_code == 200
        assert resp.json()["run_id"] == "run-abc"
    finally:
        app.dependency_overrides.pop(get_mongo, None)
        app.dependency_overrides.pop(get_neo4j_driver, None)
        app.dependency_overrides.pop(get_llm2, None)
