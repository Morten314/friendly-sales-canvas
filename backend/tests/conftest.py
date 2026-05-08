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
    mocker.patch("backend.api.driver", mock_driver, create=True)
    mocker.patch("backend.services.driver", mock_driver, create=True)
    return {"driver": mock_driver, "session": mock_session}


@pytest.fixture
def mock_mongo(mocker):
    """Mock MongoDB client. Returns the MagicMock so tests can assert on
    e.g. mock_mongo.return_value.Scout_Agent.signals.update_one.called.
    """
    mongo = MagicMock()
    mocker.patch("backend.api.client", mongo, create=True)
    mocker.patch("backend.services.client", mongo, create=True)
    return mongo


@pytest.fixture
def mock_llm_chain(mocker):
    """Mock the LangChain agent_chain (Together Qwen + Tavily).

    Tests configure .run.return_value with canned JSON strings.
    """
    mock_chain = MagicMock()
    mocker.patch("backend.services.agent_chain", mock_chain, create=True)
    return mock_chain


@pytest.fixture
def mock_groq_chat(mocker):
    """Mock the Groq llama-3.3-70b chat used in chat endpoints."""
    mock_chat = MagicMock()
    mocker.patch("backend.services.groq_chat", mock_chat, create=True)
    return mock_chat


@pytest.fixture
def mock_s3(mocker):
    s3 = MagicMock()
    mocker.patch("backend.api.s3_client", s3, create=True)
    return s3


@pytest.fixture
def mock_pinecone(mocker):
    index = MagicMock()
    index.query.return_value = {"matches": []}
    mocker.patch("backend.api.pinecone_index", index, create=True)
    return index


@pytest.fixture
def mock_tavily(mocker):
    """Tavily is usually wrapped inside agent_chain. Provided for direct callers."""
    tavily = MagicMock()
    mocker.patch("backend.services.tavily_search", tavily, create=True)
    return tavily


@pytest.fixture
def client(mock_neo4j, mock_mongo, mock_llm_chain, mock_groq_chat,
           mock_s3, mock_pinecone, mock_tavily):
    """All-mocks-applied TestClient. Use this in 95% of tests."""
    from fastapi.testclient import TestClient
    from backend.main import app
    with TestClient(app) as c:
        yield c
