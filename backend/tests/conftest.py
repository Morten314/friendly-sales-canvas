"""Shared pytest fixtures for backend characterization tests.

External deps (Neo4j, Mongo, Pinecone, S3, LLM, Tavily) are mocked at the
module path where they're used (backend.api / backend.services), not where
they're defined. This is robust against import-order variations.
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


@pytest.fixture
def mock_neo4j(mocker):
    """Mock Neo4j driver — single source-patch at app.core.database.driver."""
    mock_driver = MagicMock()
    mock_session = MagicMock()
    mock_driver.session.return_value.__enter__.return_value = mock_session
    mock_driver.session.return_value.__exit__.return_value = False
    mocker.patch("app.core.database.driver", mock_driver)
    return {"driver": mock_driver, "session": mock_session}


@pytest.fixture
def mock_mongo(mocker):
    """Mock MongoDB client. Source-patches `app.core.database.client` so
    `database.client[...]` lookups in api.py / services.py return the mock.

    Also patches `MongoClient` in each module where endpoint handlers construct
    fresh `MongoClient(mongo_uri)` instances inline — those bypass the
    module-level `client` symbol and would otherwise open real connections.
    The inline-constructor pattern survives phase A (replacement is out of
    scope per spec §2.2); these patches are the temporary bridge.
    """
    mongo = MagicMock()
    mock_constructor = MagicMock(return_value=mongo)
    mocker.patch("app.core.database.client", mongo)
    mocker.patch("api.MongoClient", mock_constructor)
    # Phase-A routers that inline-construct MongoClient (extracted from api.py):
    for mod in (
        "app.routers.org_auth",
        "app.routers.profiles",
        "app.routers.documents",
        "app.routers.icp",
        "app.routers.signals",
    ):
        mocker.patch(f"{mod}.MongoClient", mock_constructor)
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
    it accesses `database.graph` directly. So `graph` is only patched on
    `app.core.database`. The other names (chain, chain2, llm, llm2,
    llm_transformer) remain module-level attrs of app.core.llm_config.
    """
    mocks = {}
    for name in ("chain", "chain2", "llm", "llm2", "llm_transformer"):
        mocks[name] = MagicMock(name=f"llm_config.{name}")
        mocker.patch(f"app.core.llm_config.{name}", mocks[name])
    # graph lives only on app.core.database now (llm_config uses database.graph).
    mocks["graph"] = MagicMock(name="database.graph")
    mocker.patch("app.core.database.graph", mocks["graph"])
    return mocks


@pytest.fixture
def mock_s3(mocker):
    s3 = MagicMock()
    mocker.patch("app.core.database.s3_client", s3)
    return s3


@pytest.fixture
def mock_pinecone(mocker):
    """Source-patch the database.pc singleton. The inline Pinecone constructor
    in api.py is gone (replaced with database.pc.Index in Task 2)."""
    pc = MagicMock()
    pc.Index.return_value.query.return_value = {"matches": []}
    mocker.patch("app.core.database.pc", pc)
    return pc


@pytest.fixture
def client(mock_neo4j, mock_mongo, mock_llm_chain, mock_llm_config,
           mock_s3, mock_pinecone):
    """All-mocks-applied TestClient. Use this in 95% of tests."""
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app) as c:
        yield c
