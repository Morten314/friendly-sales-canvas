"""Characterization tests for Signals endpoints.

Endpoints covered:
  GET  /fetch-signals             — list signals from Mongo
  POST /generate-signals-batch    — generate 4 signals via LLM
  POST /signal_action             — accept / reject a signal
  POST /signal_Ask                — ask AI about signals

Mongo is supplied via the `_override_mongo` helper (`app.dependency_overrides[get_mongo]`).
"""
import json
from contextlib import contextmanager
from unittest.mock import MagicMock, patch, call
import pytest

from tests.fixtures import load_captured
from tests.helpers import scrub_dynamic
from tests.identities import (
    TEST_USER_ID, TEST_ORG_ID, TEST_SIGNAL_ID_1, TEST_SIGNAL_ID_2
)


@contextmanager
def _override_mongo(mongo_instance):
    """Substitute the Mongo client via `app.dependency_overrides[get_mongo]`."""
    from app.main import app
    from app.core.dependencies import get_mongo
    app.dependency_overrides[get_mongo] = lambda: mongo_instance
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_mongo, None)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_signal(signal_id: str = TEST_SIGNAL_ID_1) -> dict:
    """Signal document as returned by MongoDB (includes _id for update/delete ops)."""
    return {
        "_id": f"mongo_{signal_id}",
        "signal_id": signal_id,
        "id": signal_id,
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "headline": "Competitor raises Series B",
        "summary": "TechCorp raised $50M...",
        "agent": "scout",
        "timestamp": "2026-05-08T10:00:00",
    }


def _make_mc_for_signals(signals: list, find_one_result=None):
    """Return a MongoClient mock wired for the Signals db."""
    coll = MagicMock()
    # find(...).sort(...).limit(...) chain
    cursor = MagicMock()
    cursor.__iter__ = MagicMock(return_value=iter([dict(s) for s in signals]))
    coll.find.return_value.sort.return_value.skip.return_value.limit.return_value = cursor
    coll.count_documents.return_value = len(signals)
    coll.find_one.return_value = find_one_result
    coll.update_one.return_value = MagicMock(modified_count=1)
    coll.delete_one.return_value = MagicMock(deleted_count=1)
    coll.insert_one.return_value = MagicMock(inserted_id="new_id")

    db = MagicMock()
    db.__getitem__.return_value = coll

    mc = MagicMock()
    mc.__getitem__.return_value = db
    return mc, coll


def _base_market_request() -> dict:
    return {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "component_name": "signals",
        "data": {"industry": "SaaS", "company": "TestCo"},
        "refresh": True,
    }


# ---------------------------------------------------------------------------
# GET /fetch-signals returns list
# ---------------------------------------------------------------------------

def test_get_signals_returns_list(client):
    """GET /fetch-signals?user_id=... returns signals list from Mongo."""
    sig = _make_signal()
    mc, coll = _make_mc_for_signals([sig])

    with _override_mongo(mc):
        response = client.get(f"/fetch-signals?user_id={TEST_USER_ID}")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["count"] == 1
    assert isinstance(body["signals"], list)
    assert body["signals"][0]["signal_id"] == TEST_SIGNAL_ID_1
    assert response.headers.get("Deprecation") == "true"
    assert 'rel="successor-version"' in response.headers.get("Link", "")
    assert "/api/v2/fetch-signals" in response.headers["Link"]


# ---------------------------------------------------------------------------
# GET /fetch-signals empty when no docs
# ---------------------------------------------------------------------------

def test_get_signals_empty_when_no_docs(client):
    """GET /fetch-signals with empty Mongo → empty list."""
    mc, _ = _make_mc_for_signals([])

    with _override_mongo(mc):
        response = client.get(f"/fetch-signals?user_id={TEST_USER_ID}")

    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 0
    assert body["signals"] == []


# ---------------------------------------------------------------------------
# POST /generate-signals-batch calls search functions
# ---------------------------------------------------------------------------

def test_post_generate_signals_batch_calls_llm(client):
    """POST /generate-signals-batch calls search_signals 4 times (2 scout + 2 profiler)."""
    mc, coll = _make_mc_for_signals([])
    # signal_track find_one returns no existing headlines
    mc.__getitem__.return_value.__getitem__.return_value.find_one.return_value = None

    with _override_mongo(mc), \
         patch("app.services.signals.search_signals", return_value=dict(load_captured("search_signals_scout_groq"))) as mock_search, \
         patch("app.services.signals._fetch_pinecone_supporting_context", return_value=[]):
        response = client.post("/generate-signals-batch", json=_base_market_request())

    assert response.status_code == 200
    # Called 4 times total: 2 scout + 2 profiler
    assert mock_search.call_count == 4


# ---------------------------------------------------------------------------
# POST /generate-signals-batch returns signals list
# ---------------------------------------------------------------------------

def test_post_generate_signals_batch_returns_signals(client):
    """POST /generate-signals-batch → response has data list with signals."""
    mc, coll = _make_mc_for_signals([])

    with _override_mongo(mc), \
         patch("app.services.signals.search_signals", return_value=dict(load_captured("search_signals_scout_groq"))), \
         patch("app.services.signals._fetch_pinecone_supporting_context", return_value=[]):
        response = client.post("/generate-signals-batch", json=_base_market_request())

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert "data" in body
    assert isinstance(body["data"], list)
    assert len(body["data"]) == 4  # 2 scout + 2 profiler


# ---------------------------------------------------------------------------
# POST /signal_action accept → updates Mongo
# ---------------------------------------------------------------------------

def test_post_signal_action_accept(client):
    """POST /signal_action accept → collection.update_one called, status=success."""
    sig = _make_signal()
    mc, coll = _make_mc_for_signals([], find_one_result=sig)

    payload = {
        "org_id": TEST_ORG_ID,
        "signal_id": TEST_SIGNAL_ID_1,
        "action": "accept",
    }

    with _override_mongo(mc):
        response = client.post("/signal_action", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["action"] == "accept"
    coll.update_one.assert_called_once()


# ---------------------------------------------------------------------------
# POST /signal_action dismiss (reject) → deletes from Mongo
# ---------------------------------------------------------------------------

def test_post_signal_action_dismiss(client):
    """POST /signal_action reject → collection.delete_one called."""
    sig = _make_signal()
    mc, coll = _make_mc_for_signals([], find_one_result=sig)

    payload = {
        "org_id": TEST_ORG_ID,
        "signal_id": TEST_SIGNAL_ID_1,
        "action": "reject",
    }

    with _override_mongo(mc):
        response = client.post("/signal_action", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["action"] == "reject"
    coll.delete_one.assert_called_once()


# ---------------------------------------------------------------------------
# POST /signal_Ask returns answer
# ---------------------------------------------------------------------------

def test_post_signal_ask_returns_answer(client, mock_neo4j, mock_llm_chain):
    """POST /signal_Ask calls agent_chain.invoke and returns answer."""
    # Neo4j: CompanyProfile exists
    cp_node = MagicMock()
    cp_node.items.return_value = [("industry", "SaaS"), ("company", "TestCo")]
    record = MagicMock()
    record.__getitem__ = MagicMock(return_value=cp_node)
    mock_neo4j["session"].run.return_value.single.return_value = record

    # Mongo for customer profile: no profile (graceful skip)
    mc = MagicMock()
    db = MagicMock()
    coll = MagicMock()
    coll.find_one.return_value = None
    db.__getitem__.return_value = coll
    mc.__getitem__.return_value = db

    # LLM chain returns answer
    mock_llm_chain.invoke.return_value = {"output": "This is the AI answer."}

    payload = {
        "org_id": TEST_ORG_ID,
        "user_id": TEST_USER_ID,
        "question": "What signals should I watch for expansion?",
        "history": [],
    }

    # signal_ask gets agent_chain via Depends(get_agent_chain).
    # Override the dependency to inject our chain_mock.
    chain_mock = MagicMock()
    chain_mock.invoke.return_value = {"output": "This is the AI answer."}
    from app.main import app
    from app.core.dependencies import get_agent_chain
    app.dependency_overrides[get_agent_chain] = lambda: chain_mock

    try:
        with _override_mongo(mc):
            response = client.post("/signal_Ask", json=payload)
    finally:
        app.dependency_overrides.pop(get_agent_chain, None)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert "answer" in body
    assert body["answer"] == "This is the AI answer."
    chain_mock.invoke.assert_called_once()


# ---------------------------------------------------------------------------
# POST /signal_action with missing signal → 404
# ---------------------------------------------------------------------------

def test_post_signal_action_invalid_signal_id(client):
    """POST /signal_action with unknown signal_id → 404."""
    mc, coll = _make_mc_for_signals([], find_one_result=None)

    payload = {
        "org_id": TEST_ORG_ID,
        "signal_id": "nonexistent-signal-id",
        "action": "accept",
    }

    with _override_mongo(mc):
        response = client.post("/signal_action", json=payload)

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_post_signal_action_invalid_action_value(client):
    """POST /signal_action with action other than accept/reject → 422.

    SignalActionRequest's action is `Literal["accept", "reject"]`. FastAPI's
    pydantic validation rejects anything else with 422 before the handler
    runs (so no Mongo mock needed). Lock this in — a refactor that loosens
    the type to `str` would silently change behavior to "no validation".
    """
    payload = {
        "org_id": TEST_ORG_ID,
        "signal_id": TEST_SIGNAL_ID_1,
        "action": "delete",  # not in the literal set
    }

    response = client.post("/signal_action", json=payload)
    assert response.status_code == 422


def test_post_signal_action_missing_org_id(client):
    """POST /signal_action without org_id → 422 (pydantic field required)."""
    payload = {
        "signal_id": TEST_SIGNAL_ID_1,
        "action": "accept",
    }
    response = client.post("/signal_action", json=payload)
    assert response.status_code == 422
