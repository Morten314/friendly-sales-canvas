"""Lifespan index-ensure smoke tests.

Patch targets MUST reference `app.main._ensure_*` (not `app.services.<module>._ensure_*`).
`app/main.py` does `from app.services.<module> import _ensure_*`, creating a new binding
in `app.main`'s namespace. The lifespan function calls *that* binding, not the source-module
binding. Patching `app.services.leads._ensure_leads_indexes` would rebind the source name
but leave `app.main`'s reference pointing at the original function, so the test would
silently pass against unchanged behavior. Do not "fix" the patch target to the more
natural-looking `app.services.leads._ensure_leads_indexes`.
"""
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.main import app


def test_lifespan_calls_all_ensure_index_helpers(monkeypatch):
    called = []
    monkeypatch.setattr(
        "app.main._ensure_leads_indexes",
        lambda mongo: called.append("leads"),
    )
    monkeypatch.setattr(
        "app.main._ensure_icp_indexes",
        lambda mongo: called.append("icp"),
    )
    monkeypatch.setattr(
        "app.main._ensure_market_scoring_indexes",
        lambda mongo: called.append("market_scoring"),
    )
    # build_clients() returns client=None when BREWRA_SKIP_DB_INIT=1.
    # Patch build_clients so the lifespan guard `if client is not None` passes.
    fake_bundle = MagicMock()
    fake_bundle.graph = None
    fake_bundle.client = MagicMock(name="mongo_client")
    monkeypatch.setattr("app.main.build_clients", lambda: fake_bundle)
    with TestClient(app):
        pass
    assert "leads" in called
    assert "icp" in called
    assert "market_scoring" in called


def test_lifespan_calls_ensure_icp_indexes(monkeypatch):
    """Sanity that the icp index-ensure helper is the renamed _ensure_icp_indexes,
    not the old _ensure_icp_id_registry_indexes."""
    import app.main as main_module

    assert hasattr(main_module, "_ensure_icp_indexes")
    assert not hasattr(main_module, "_ensure_icp_id_registry_indexes")


def test_lifespan_initializes_prompts_registry(monkeypatch):
    """app.state.prompts is set by lifespan; same singleton as module-level _registry."""
    fake_bundle = MagicMock()
    fake_bundle.graph = None
    fake_bundle.client = MagicMock(name="mongo_client")
    monkeypatch.setattr("app.main.build_clients", lambda: fake_bundle)
    monkeypatch.setattr("app.main._ensure_leads_indexes", lambda mongo: None)
    monkeypatch.setattr("app.main._ensure_icp_indexes", lambda mongo: None)
    monkeypatch.setattr("app.main._ensure_market_scoring_indexes", lambda mongo: None)

    with TestClient(app):
        from app.core import prompts as prompts_mod
        assert app.state.prompts is not None
        assert app.state.prompts is prompts_mod._registry
