"""Shared pytest fixtures for backend characterization tests.

External deps (Neo4j, Mongo, Pinecone, S3, LLM, Tavily) are mocked at the
module path where they're used (backend.api / backend.services), not where
they're defined. This is robust against import-order variations.
"""
import pytest
from unittest.mock import MagicMock


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
    mocker.patch("backend.api.neo4j_driver", mock_driver, create=True)
    mocker.patch("backend.services.neo4j_driver", mock_driver, create=True)
    return {"driver": mock_driver, "session": mock_session}


@pytest.fixture
def mock_mongo(mocker):
    """Mock MongoDB client. Returns the MagicMock so tests can assert on
    e.g. mock_mongo.return_value.Scout_Agent.signals.update_one.called.
    """
    mongo = MagicMock()
    mocker.patch("backend.api.mongo_client", mongo, create=True)
    mocker.patch("backend.services.mongo_client", mongo, create=True)
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
