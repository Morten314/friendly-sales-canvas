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
    """Mock Neo4j driver used in api.py and services.py.

    Returns a dict with `driver` and `session` so tests can assert on
    .session().run.call_args_list.
    """
    mock_driver = MagicMock()
    mock_session = MagicMock()
    mock_driver.session.return_value.__enter__.return_value = mock_session
    mock_driver.session.return_value.__exit__.return_value = False
    mocker.patch("api.driver", mock_driver)
    mocker.patch("services.driver", mock_driver)
    return {"driver": mock_driver, "session": mock_session}


@pytest.fixture
def mock_mongo(mocker):
    """Mock MongoDB client. Returns the MagicMock so tests can assert on
    e.g. mock_mongo.Scout_Agent.signals.update_one.called.
    """
    mongo = MagicMock()
    mocker.patch("api.client", mongo)
    mocker.patch("services.client", mongo)
    return mongo


@pytest.fixture
def mock_llm_chain(mocker):
    """Mock the LangChain agent_chain (Together Qwen + Tavily).

    Patches both the bound reference in services.py and the original in
    llm_config.py (the latter covers deferred imports like
    `from llm_config import agent_chain` inside api.py functions).
    """
    mock_chain = MagicMock()
    mocker.patch("services.agent_chain", mock_chain)
    mocker.patch("llm_config.agent_chain", mock_chain)
    return mock_chain


@pytest.fixture
def mock_llm_config(mocker):
    """Mock the rest of llm_config exports (chain, chain2, llm, llm2, etc.).

    api.py:41 imports `chain, chain2, llm2` (used by /text_graph, /voice_graph,
    /test-llm). services.py:17 imports `llm_transformer, graph, llm, llm2`.
    Plus deferred imports inside functions resolve from llm_config.* at call
    time, so we patch all three namespaces (api.*, services.*, llm_config.*).

    Without this fixture, any test that hits an endpoint using these symbols
    would call a real LLM. agent_chain is handled separately by mock_llm_chain.
    """
    mocks = {}
    for name in ("chain", "chain2", "llm", "llm2", "llm_transformer", "graph"):
        mocks[name] = MagicMock(name=f"llm_config.{name}")
        mocker.patch(f"llm_config.{name}", mocks[name])

    # api.py module-level bound references (line 41).
    for name in ("chain", "chain2", "llm2"):
        mocker.patch(f"api.{name}", mocks[name])
    # api.py also imports `graph` from database (line 40), but llm_config.graph
    # and database.graph are the same Neo4jGraph object — patch the api.graph
    # bound reference too so /text_graph and /voice_graph don't reach Neo4j.
    mocker.patch("api.graph", mocks["graph"])

    # services.py module-level bound references (line 17).
    for name in ("llm_transformer", "graph", "llm", "llm2"):
        mocker.patch(f"services.{name}", mocks[name])

    return mocks


@pytest.fixture
def mock_s3(mocker):
    s3 = MagicMock()
    mocker.patch("api.s3_client", s3)
    return s3


@pytest.fixture
def mock_pinecone(mocker):
    """Mock Pinecone. api.py:4163 binds `pc = Pinecone(...)`; api.py:123 also
    instantiates Pinecone() inline inside a function — tests that exercise
    that codepath should additionally `mocker.patch("api.Pinecone", ...)`.
    """
    pc = MagicMock()
    pc.Index.return_value.query.return_value = {"matches": []}
    mocker.patch("api.pc", pc)
    return pc


@pytest.fixture
def client(mock_neo4j, mock_mongo, mock_llm_chain, mock_llm_config,
           mock_s3, mock_pinecone):
    """All-mocks-applied TestClient. Use this in 95% of tests."""
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app) as c:
        yield c
