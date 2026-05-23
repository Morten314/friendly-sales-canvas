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
def mock_session():
    """Returns a Neo4j session mock; `session._driver` exposes the wrapping
    driver mock so converted services (which take `driver` as a positional
    arg post-Phase F) can be called via `service_fn(mock_session._driver, ...)`.

    Phase F (commit 17/17): no source-patch — services no longer read
    `app.core.clients.driver` directly. The session mock is configured to
    return on `driver.session().__enter__()`.
    """
    session = MagicMock()
    driver = MagicMock()
    driver.session.return_value.__enter__ = MagicMock(return_value=session)
    driver.session.return_value.__exit__ = MagicMock(return_value=False)
    session._driver = driver
    return session


@pytest.fixture
def mock_mongo_client():
    """Lightweight MongoDB client mock. Pass positionally to converted
    services: `service_fn(mock_mongo_client, ...)`.

    Phase F (commit 17/17): no source-patch — services no longer read
    `app.core.clients.client` directly.
    """
    return MagicMock()
