"""Pytest fixtures for service-function unit tests.

These tests bypass FastAPI / TestClient entirely. They call service functions
directly and mock at the same source-level layer the integration tests do:
`app.core.clients.driver`, `app.core.clients.client`, and per-module LLM
helper imports.

Note on `app.main` import:
The parent `tests/conftest.py` imports `app.main` eagerly (so integration
tests' router fixtures are wired before any mocker.patch lands). pytest
discovers parent conftest files first, so unit tests inherit that import.
This file itself does NOT import `app.main` and unit tests should not
request router-dependent fixtures — but the import happens at collection
time regardless of which subdirectory the test lives in.
"""
import os
import sys
from unittest.mock import MagicMock

import pytest

# Ensure backend/ is importable as a flat package (matches root tests/conftest.py)
_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_MONOREPO_ROOT = os.path.abspath(os.path.join(_BACKEND_DIR, ".."))
for _p in (_BACKEND_DIR, _MONOREPO_ROOT):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# Set dummy env vars and skip DB init before any app.* import.
os.environ.setdefault("PINECONE_API_KEY", "test-pinecone-key")
os.environ.setdefault("AWS_ACCESS_KEY", "test-aws-key")
os.environ.setdefault("AWS_SECRET_KEY", "test-aws-secret")
os.environ.setdefault("BREWRA_SKIP_DB_INIT", "1")


@pytest.fixture
def mock_session(mocker):
    """Returns the Neo4j *session* (not the driver) so tests can configure
    `session.run.return_value.single.return_value = ...` directly. The driver
    itself is patched onto `app.core.clients.driver` as a side effect.
    """
    session = MagicMock()
    driver = MagicMock()
    driver.session.return_value.__enter__ = MagicMock(return_value=session)
    driver.session.return_value.__exit__ = MagicMock(return_value=False)
    mocker.patch("app.core.clients.driver", driver)
    return session


@pytest.fixture
def mock_mongo_client(mocker):
    """Lightweight MongoDB client mock. Source-patches `app.core.clients.client`.

    Tests configure per-collection MagicMocks via:
        mock_mongo_client["Profiler"]["ICP_config"].find_one.return_value = ...
    """
    client = MagicMock()
    mocker.patch("app.core.clients.client", client)
    return client
