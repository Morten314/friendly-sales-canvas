"""Shared pytest fixtures for backend characterization tests.

External deps (Neo4j, Mongo, Pinecone, S3, LLM, Tavily) are source-patched
at `app.core.clients.*` and `app.core.llm_config.*`. After Phase B Task 5,
all inline MongoClient constructions in routers have been replaced with
`app.core.clients.client` (and `profiler_client`), so all Mongo mocking
happens via `app.core.clients.client` / `app.core.clients.profiler_client`.
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
    app.core.clients. A single patch of `app.core.clients.client` is now
    sufficient for the primary cluster. `profiler_client` is also patched
    since it is the same mock (same cluster alias).
    """
    mongo = MagicMock()
    mocker.patch("app.core.clients.client", mongo)
    # profiler_client is an alias for client on the same cluster.
    mocker.patch("app.core.clients.profiler_client", mongo)
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
