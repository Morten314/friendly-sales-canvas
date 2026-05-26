"""Pytest fixtures for service-function unit tests.

Unit tests bypass FastAPI / TestClient entirely. They call service functions
directly with positional client/LLM mocks (no dependency injection).

Note on `app.main` import:
The parent `tests/conftest.py` imports `app.main` eagerly so integration
tests' router fixtures are wired before any `mocker.patch` lands. pytest
discovers parent conftest files first, so unit tests inherit that import —
they should not request router-dependent fixtures, but the import happens
at collection time regardless of which subdirectory the test lives in.
"""
import os
import sys
from pathlib import Path
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


# ---------------------------------------------------------------------------
# Re-init the production prompt registry between unit tests. test_prompts_loader.py
# runs init_registry(root=tmp_path) and doesn't restore — without this fixture,
# unit tests that follow it (e.g., test_signals.py call sites that hit
# prompts.render) render against the wrong registry. Silent replacement is the
# v1 contract per spec §3.3 "Double-call behavior".
# ---------------------------------------------------------------------------
_PROMPTS_ROOT = Path(_BACKEND_DIR) / "prompts"


@pytest.fixture(autouse=True)
def _reinit_production_prompt_registry():
    from app.core.prompts import init_registry
    init_registry(root=_PROMPTS_ROOT)
    yield


@pytest.fixture
def mock_session():
    """Returns a Neo4j session mock; `session._driver` exposes the wrapping
    driver mock so services can be called via `service_fn(mock_session._driver, ...)`.
    The session mock is configured to return on `driver.session().__enter__()`.
    """
    session = MagicMock()
    driver = MagicMock()
    driver.session.return_value.__enter__ = MagicMock(return_value=session)
    driver.session.return_value.__exit__ = MagicMock(return_value=False)
    session._driver = driver
    return session


@pytest.fixture
def mock_mongo_client():
    """Lightweight MongoDB client mock. Pass positionally to services:
    `service_fn(mock_mongo_client, ...)`.
    """
    return MagicMock()
