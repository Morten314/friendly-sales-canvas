"""Shared pytest fixtures for backend characterization tests.

External deps (Neo4j, Mongo, Pinecone, S3, LLM, Tavily) are source-patched
at `app.core.clients.*` and `app.core.llm_config.*`. After Phase B Task 5,
all inline MongoClient constructions in routers have been replaced with
`app.core.clients.client`, so all Mongo mocking happens via
`app.core.clients.client`. (The Profiler databases live on the same cluster.)
This convention is documented in specs/2026-05-12-backend-modularization-design.md §6.
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


@pytest.fixture
def mock_neo4j(mocker):
    """Mock Neo4j driver — single source-patch at app.core.clients.driver."""
    mock_driver = MagicMock()
    mock_session = MagicMock()
    mock_driver.session.return_value.__enter__.return_value = mock_session
    mock_driver.session.return_value.__exit__.return_value = False
    mocker.patch("app.core.clients.driver", mock_driver)
    return {"driver": mock_driver, "session": mock_session}


@pytest.fixture
def mock_mongo(mocker):
    """Mock MongoDB client. Source-patches `app.core.clients.client` so
    all router and service code that imports `client` from `app.core.clients`
    uses the mock.

    Phase B Task 5: per-router MongoClient patches removed. All 26 inline
    MongoClient constructions have been replaced with imports from
    app.core.clients. A single patch of `app.core.clients.client` is
    sufficient — the Profiler databases live on the same cluster.
    """
    mongo = MagicMock()
    mocker.patch("app.core.clients.client", mongo)
    return mongo


@pytest.fixture
def mock_llm_chain(mocker):
    mock_chain = MagicMock()
    mocker.patch("app.core.llm_config.agent_chain", mock_chain)
    return mock_chain


@pytest.fixture
def mock_llm_config(mocker):
    """Source-patch all llm_config globals + the shared `graph` Neo4jGraph.

    Note: after Task 2, llm_config no longer holds its own `graph` attribute —
    it accesses `clients.graph` directly. So `graph` is only patched on
    `app.core.clients`. The other names (chain, chain2, llm, llm2,
    llm_transformer) remain module-level attrs of app.core.llm_config.
    """
    mocks = {}
    for name in ("chain", "chain2", "llm", "llm2", "llm_transformer"):
        mocks[name] = MagicMock(name=f"llm_config.{name}")
        mocker.patch(f"app.core.llm_config.{name}", mocks[name])
    # graph lives only on app.core.clients now (llm_config uses clients.graph).
    mocks["graph"] = MagicMock(name="clients.graph")
    mocker.patch("app.core.clients.graph", mocks["graph"])
    return mocks


@pytest.fixture
def mock_s3(mocker):
    s3 = MagicMock()
    mocker.patch("app.core.clients.s3_client", s3)
    return s3


@pytest.fixture
def mock_pinecone(mocker):
    """Source-patch the clients.pc singleton. The inline Pinecone constructor
    in api.py is gone (replaced with clients.pc.Index in Task 2)."""
    pc = MagicMock()
    pc.Index.return_value.query.return_value = {"matches": []}
    mocker.patch("app.core.clients.pc", pc)
    return pc


@pytest.fixture
def client(mock_neo4j, mock_mongo, mock_llm_chain, mock_llm_config,
           mock_s3, mock_pinecone):
    """All-mocks-applied TestClient. Use this in 95% of tests."""
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# Phase F: dependency_overrides-based fixtures
#
# These coexist with the source-patch fixtures above. Tests for services
# already converted to dependency injection (commits 4-15) use `_via_override`
# variants; tests for un-converted services keep using the source-patch
# fixtures. Commit 17 deletes the source-patch fixtures entirely.
#
# Each fixture pops its override in a `finally` block so a test failure
# doesn't leave a stale override in place — the session-scope autouse leak
# detector below catches any that escape anyway.
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_neo4j_via_override():
    """Neo4j driver mock injected via app.dependency_overrides[get_neo4j_driver]."""
    from app.main import app
    from app.core.dependencies import get_neo4j_driver

    mock_session = MagicMock()
    mock_driver = MagicMock()
    mock_driver.session.return_value.__enter__.return_value = mock_session
    mock_driver.session.return_value.__exit__.return_value = False

    app.dependency_overrides[get_neo4j_driver] = lambda: mock_driver
    try:
        yield {"driver": mock_driver, "session": mock_session}
    finally:
        app.dependency_overrides.pop(get_neo4j_driver, None)


@pytest.fixture
def mock_mongo_via_override():
    from app.main import app
    from app.core.dependencies import get_mongo

    mock = MagicMock()
    app.dependency_overrides[get_mongo] = lambda: mock
    try:
        yield mock
    finally:
        app.dependency_overrides.pop(get_mongo, None)


@pytest.fixture
def mock_s3_via_override():
    from app.main import app
    from app.core.dependencies import get_s3

    mock = MagicMock()
    app.dependency_overrides[get_s3] = lambda: mock
    try:
        yield mock
    finally:
        app.dependency_overrides.pop(get_s3, None)


@pytest.fixture
def mock_pinecone_via_override():
    from app.main import app
    from app.core.dependencies import get_pinecone

    mock = MagicMock()
    mock.Index.return_value.query.return_value = {"matches": []}
    app.dependency_overrides[get_pinecone] = lambda: mock
    try:
        yield mock
    finally:
        app.dependency_overrides.pop(get_pinecone, None)


@pytest.fixture
def mock_neo4j_graph_via_override():
    from app.main import app
    from app.core.dependencies import get_neo4j_graph

    mock = MagicMock()
    app.dependency_overrides[get_neo4j_graph] = lambda: mock
    try:
        yield mock
    finally:
        app.dependency_overrides.pop(get_neo4j_graph, None)


@pytest.fixture
def mock_llm_via_override():
    """Composite override for all 7 LLM providers. Mirrors mock_llm_config in
    structure but flows through app.dependency_overrides instead of source-patches."""
    from app.main import app
    from app.core.dependencies import (
        get_llm, get_llm2, get_llm_transformer,
        get_memory, get_agent_chain, get_chain, get_chain2,
    )

    mocks = {name: MagicMock(name=f"llm.{name}") for name in (
        "llm", "llm2", "llm_transformer", "memory", "agent_chain", "chain", "chain2",
    )}
    app.dependency_overrides[get_llm] = lambda: mocks["llm"]
    app.dependency_overrides[get_llm2] = lambda: mocks["llm2"]
    app.dependency_overrides[get_llm_transformer] = lambda: mocks["llm_transformer"]
    app.dependency_overrides[get_memory] = lambda: mocks["memory"]
    app.dependency_overrides[get_agent_chain] = lambda: mocks["agent_chain"]
    app.dependency_overrides[get_chain] = lambda: mocks["chain"]
    app.dependency_overrides[get_chain2] = lambda: mocks["chain2"]
    try:
        yield mocks
    finally:
        for provider in (get_llm, get_llm2, get_llm_transformer, get_memory,
                         get_agent_chain, get_chain, get_chain2):
            app.dependency_overrides.pop(provider, None)


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
