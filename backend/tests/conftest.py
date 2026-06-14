"""Shared pytest fixtures for backend characterization tests.

External deps (Neo4j, Mongo, Pinecone, S3, LLM chains) are injected via
FastAPI `Depends()` providers; fixtures register `app.dependency_overrides`
entries so each test can substitute a mock.
"""
import sys
import os
import pytest
from unittest.mock import MagicMock

# ---------------------------------------------------------------------------
# sys.path: ensure backend/ is importable as a flat package (for internal
# imports like `from config import ...`) AND as `backend.*` (for mocker.patch).
# ---------------------------------------------------------------------------
_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_MONOREPO_ROOT = os.path.abspath(os.path.join(_BACKEND_DIR, ".."))
for _p in (_BACKEND_DIR, _MONOREPO_ROOT):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# ---------------------------------------------------------------------------
# Set dummy env vars for keys that have no hardcoded fallback in config.py.
# Must happen before config.py is imported (which happens when backend.* loads).
# ---------------------------------------------------------------------------
os.environ.setdefault("PINECONE_API_KEY", "test-pinecone-key")
os.environ.setdefault("AWS_ACCESS_KEY", "test-aws-key")
os.environ.setdefault("AWS_SECRET_KEY", "test-aws-secret")
# Tells database.py to skip eager Neo4j/Mongo init at import time so mocks below
# can land before any real network I/O is attempted.
os.environ.setdefault("BREWRA_SKIP_DB_INIT", "1")

# ---------------------------------------------------------------------------
# Pre-stub heavy / network-connecting modules so they never attempt real I/O
# during import of database.py, llm_config.py, services.py, or api.py.
# These stubs must be inserted BEFORE any import of backend.* modules.
# ---------------------------------------------------------------------------
def _make_stub(name):
    """Return a MagicMock registered under the given dotted name and all parents."""
    parts = name.split(".")
    for i in range(1, len(parts) + 1):
        key = ".".join(parts[:i])
        if key not in sys.modules:
            sys.modules[key] = MagicMock(name=key)
    return sys.modules[name]


_HEAVY_MODULES = [
    # speech recognition (services.py: import speech_recognition as sr)
    # Only stub if not already installed as a real package.
    "speech_recognition",
]

for _mod in _HEAVY_MODULES:
    _make_stub(_mod)

# neo4j is a real installed package — do not stub it.
# database.py wraps the connection attempt in try/except, so failed
# connectivity at import time is non-fatal.

# ---------------------------------------------------------------------------
# Eagerly import `app.main` at conftest load time so routers are fully wired
# before any fixture-level mocker.patch runs. Without this, the first patch
# triggers a standalone router import whose `from app.main import logger`
# re-enters app.main mid-load, leaving sibling routers partially loaded when
# `app.include_router(...)` runs against them.
# ---------------------------------------------------------------------------
from app.main import app as _app  # noqa: F401, E402

# ---------------------------------------------------------------------------
# Initialize the prompt registry at conftest load. Production wires this in
# `app.main.lifespan`, but lifespan only runs in async contexts; sync unit
# tests that call `prompts.render()` directly would otherwise hit
# `RuntimeError("init_registry not called")`. Idempotent (silent replacement
# is the v1 contract per spec §3.3) — test_prompts_loader.py / test_prompts_golden.py
# may re-init against their own roots.
# ---------------------------------------------------------------------------
from pathlib import Path  # noqa: E402

from app.core.prompts import init_registry as _init_prompt_registry  # noqa: E402

_init_prompt_registry(root=Path(_BACKEND_DIR) / "prompts")


def _install_override(app, provider, mock):
    """Install an override and return a cleanup callable. Routes read clients
    from `app.state.clients.*` via `Depends()`; tests substitute via
    `app.dependency_overrides`."""
    app.dependency_overrides[provider] = lambda: mock
    return lambda: app.dependency_overrides.pop(provider, None)


@pytest.fixture
def mock_neo4j():
    """Mock Neo4j driver — injected via app.dependency_overrides[get_neo4j_driver]."""
    from app.main import app
    from app.core.dependencies import get_neo4j_driver

    mock_driver = MagicMock()
    mock_session = MagicMock()
    mock_driver.session.return_value.__enter__.return_value = mock_session
    mock_driver.session.return_value.__exit__.return_value = False
    cleanup = _install_override(app, get_neo4j_driver, mock_driver)
    yield {"driver": mock_driver, "session": mock_session}
    cleanup()


@pytest.fixture
def mock_mongo():
    """Mock MongoDB client — injected via app.dependency_overrides[get_mongo]."""
    from app.main import app
    from app.core.dependencies import get_mongo

    mongo = MagicMock()
    cleanup = _install_override(app, get_mongo, mongo)
    yield mongo
    cleanup()


@pytest.fixture
def mock_llm_chain():
    from app.main import app
    from app.core.dependencies import get_agent_chain

    mock_chain = MagicMock()
    cleanup = _install_override(app, get_agent_chain, mock_chain)
    yield mock_chain
    cleanup()


@pytest.fixture
def mock_llm_config():
    """Composite LLM/graph override for converted routes."""
    from app.main import app
    from app.core.dependencies import (
        get_chain, get_chain2, get_llm2, get_llm_transformer,
        get_neo4j_graph,
    )

    provider_by_name = {
        "chain": get_chain,
        "chain2": get_chain2,
        "llm2": get_llm2,
        "llm_transformer": get_llm_transformer,
    }
    mocks = {}
    cleanups = []
    for name, provider in provider_by_name.items():
        mocks[name] = MagicMock(name=f"llm.{name}")
        cleanups.append(_install_override(app, provider, mocks[name]))
    mocks["graph"] = MagicMock(name="graph")
    cleanups.append(_install_override(app, get_neo4j_graph, mocks["graph"]))
    yield mocks
    for c in cleanups:
        c()


@pytest.fixture
def mock_s3():
    from app.main import app
    from app.core.dependencies import get_s3 as _get_s3

    s3 = MagicMock()
    cleanup = _install_override(app, _get_s3, s3)
    yield s3
    cleanup()


@pytest.fixture
def mock_pinecone():
    """Mock Pinecone client — injected via app.dependency_overrides[get_pinecone]."""
    from app.main import app
    from app.core.dependencies import get_pinecone

    pc = MagicMock()
    pc.Index.return_value.query.return_value = {"matches": []}
    cleanup = _install_override(app, get_pinecone, pc)
    yield pc
    cleanup()


@pytest.fixture
def client(mock_neo4j, mock_mongo, mock_llm_chain, mock_llm_config,
           mock_s3, mock_pinecone):
    """All-mocks-applied TestClient. Use this in 95% of tests."""
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True, scope="session")
def _verify_no_dependency_override_leak():
    """Session-end safety check: a test fixture forgot to pop its override.

    A leak pollutes later tests — they'd inherit the override and pass/fail
    for the wrong reasons. This catches that without exercising any
    production code path.
    """
    from app.main import app
    yield
    assert app.dependency_overrides == {}, (
        f"Test session leaked overrides: {list(app.dependency_overrides.keys())}"
    )
