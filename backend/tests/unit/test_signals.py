# backend/tests/unit/test_signals.py
"""Unit tests for app/services/signals.py.

Covers all 8 public functions, the 4 typed-exception leaves, and the
3 `ServiceError` raise sites in `signal_ask` / `signal_ask_claude`.
"""
import asyncio
import json
from unittest.mock import MagicMock

import pytest

from app.core.exceptions import (
    ServiceError,
    SignalActionValidationError,
    SignalNotFoundError,
    UnsupportedComponentError,
)
from app.models.signals import SignalActionRequest, SignalAskRequest
from app.models.market_research import MarketRequest
from app.services.signals import (
    fetch_signals,
    generate_signals_batch,
    generate_signals_batch_claude,
    record_signal_action,
    run_signals_research,
    search_signals,
    signal_ask,
    signal_ask_claude,
)
from tests.fixtures import load_captured, load_seed
from tests.identities import (
    TEST_ORG_ID,
    TEST_SIGNAL_ID_1,
    TEST_USER_ID,
)


# ---------------------------------------------------------------------------
# search_signals (sync) — uses captured fixtures
# ---------------------------------------------------------------------------

def test_search_signals_scout_groq_uses_captured(mocker):
    captured = load_captured("search_signals_scout_groq")
    # _signals_agent_output calls llm_config.agent_chain.invoke({"input": prompt})
    # and accesses raw_response["output"] — return a JSON-parseable string.
    chain_mock = MagicMock()
    chain_mock.invoke.return_value = {"output": json.dumps(captured)}

    pre_data = json.dumps(load_seed("company_profile"))
    result = search_signals(chain_mock, pre_data, persona="scout", llm_backend="default")

    assert result is not None
    chain_mock.invoke.assert_called_once()


def test_search_signals_profiler_claude_uses_captured(mocker):
    """After Phase I commit 2/11, signals/llm.py is a thin wrapper that delegates
    to _research_agent_output in _llm_helpers. Both _claude_messages_text and
    _tavily_context_and_urls are resolved from _llm_helpers' module __dict__ at
    call time, so the patches target _llm_helpers (where lookups now happen)."""
    captured = load_captured("search_signals_profiler_claude")
    mocker.patch(
        "app.services._llm_helpers._claude_messages_text",
        return_value=json.dumps(captured),
    )
    mocker.patch(
        "app.services._llm_helpers._tavily_context_and_urls",
        return_value=("web context", []),
    )

    pre_data = json.dumps(load_seed("company_profile"))
    result = search_signals(MagicMock(), pre_data, persona="profiler", llm_backend="claude")

    assert result is not None


# ---------------------------------------------------------------------------
# run_signals_research — UnsupportedComponentError dispatch
# ---------------------------------------------------------------------------

def test_run_signals_research_raises_on_unknown_persona(
    mocker, mock_session, mock_mongo_client,
):
    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="bogus persona", data={}, refresh=True,
    )
    with pytest.raises(UnsupportedComponentError):
        asyncio.run(run_signals_research(mock_session._driver, mock_mongo_client, MagicMock(), MagicMock(), request))


# ---------------------------------------------------------------------------
# generate_signals_batch / generate_signals_batch_claude
# ---------------------------------------------------------------------------

def test_generate_signals_batch_happy_path(
    mocker, mock_session, mock_mongo_client,
):
    """generate_signals_batch dispatches to _generate_signals_batch_impl
    with llm_backend='default'."""
    captured = load_captured("search_signals_scout_groq")
    mocker.patch(
        "app.services.signals.orchestrator._generate_signals_batch_impl",
        return_value={"status": "success", "data": captured},
    )

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="signals", data={}, refresh=True,
    )
    result = asyncio.run(generate_signals_batch(mock_session._driver, mock_mongo_client, MagicMock(), MagicMock(), request))

    assert result["status"] == "success"


def test_generate_signals_batch_claude_happy_path(
    mocker, mock_session, mock_mongo_client,
):
    """generate_signals_batch_claude dispatches with llm_backend='claude'."""
    captured = load_captured("search_signals_scout_claude")
    mocker.patch(
        "app.services.signals.orchestrator._generate_signals_batch_impl",
        return_value={"status": "success", "data": captured},
    )

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="signals", data={}, refresh=True,
    )
    result = asyncio.run(generate_signals_batch_claude(mock_session._driver, mock_mongo_client, MagicMock(), MagicMock(), request))

    assert result["status"] == "success"


# ---------------------------------------------------------------------------
# fetch_signals (async)
# ---------------------------------------------------------------------------

def test_fetch_signals_returns_empty_when_no_docs(mocker, mock_mongo_client):
    coll = MagicMock()
    coll.find.return_value.sort.return_value.skip.return_value.limit.return_value = []
    coll.count_documents.return_value = 0
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    items, total = asyncio.run(fetch_signals(mock_mongo_client, TEST_USER_ID))

    assert items == []
    assert total == 0


def test_fetch_signals_returns_docs(mocker, mock_mongo_client):
    coll = MagicMock()
    coll.find.return_value.sort.return_value.skip.return_value.limit.return_value = [
        {"signal_id": TEST_SIGNAL_ID_1, "user_id": TEST_USER_ID, "headline": "X"},
    ]
    coll.count_documents.return_value = 1
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    items, total = asyncio.run(fetch_signals(mock_mongo_client, TEST_USER_ID, limit=10))

    assert len(items) == 1
    assert total == 1


# ---------------------------------------------------------------------------
# record_signal_action — SignalActionValidationError + SignalNotFoundError
# ---------------------------------------------------------------------------

def test_record_signal_action_raises_on_invalid_action(
    mocker, mock_mongo_client,
):
    """SignalActionValidationError is raised in the else branch — after find_one.
    Use model_construct() to bypass Pydantic's Literal["accept", "reject"] guard."""
    coll = MagicMock()
    # find_one must return a doc so execution reaches the if/elif/else dispatch
    coll.find_one.return_value = {
        "signal_id": TEST_SIGNAL_ID_1, "user_id": TEST_USER_ID, "_id": "oid1",
    }
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    request = SignalActionRequest.model_construct(
        org_id=TEST_ORG_ID, signal_id=TEST_SIGNAL_ID_1, action="bogus",
    )
    with pytest.raises(SignalActionValidationError):
        asyncio.run(record_signal_action(mock_mongo_client, request))


def test_record_signal_action_raises_when_signal_missing(
    mocker, mock_mongo_client,
):
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    request = SignalActionRequest(
        org_id=TEST_ORG_ID, signal_id=TEST_SIGNAL_ID_1, action="accept",
    )
    with pytest.raises(SignalNotFoundError):
        asyncio.run(record_signal_action(mock_mongo_client, request))


def test_record_signal_action_accept_happy_path(mocker, mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = {
        "signal_id": TEST_SIGNAL_ID_1, "user_id": TEST_USER_ID, "_id": "oid1",
    }
    coll.update_one.return_value.modified_count = 1
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    request = SignalActionRequest(
        org_id=TEST_ORG_ID, signal_id=TEST_SIGNAL_ID_1, action="accept",
    )
    result = asyncio.run(record_signal_action(mock_mongo_client, request))

    assert result["status"] == "success"
    assert result["action"] == "accept"


def test_record_signal_action_reject_raises_service_error_on_delete_race(
    mocker, mock_mongo_client,
):
    """ServiceError site: reject action attempts delete; if delete fails
    (race condition where doc disappeared after the find_one), surface
    ServiceError instead of generic 500."""
    coll = MagicMock()
    coll.find_one.return_value = {
        "signal_id": TEST_SIGNAL_ID_1, "user_id": TEST_USER_ID, "_id": "oid1",
    }
    coll.delete_one.return_value.deleted_count = 0  # race: gone already
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    request = SignalActionRequest(
        org_id=TEST_ORG_ID, signal_id=TEST_SIGNAL_ID_1, action="reject",
    )
    with pytest.raises(ServiceError, match="Failed to delete signal"):
        asyncio.run(record_signal_action(mock_mongo_client, request))


# ---------------------------------------------------------------------------
# signal_ask / signal_ask_claude — captured fixtures + ServiceError paths
# ---------------------------------------------------------------------------

def test_signal_ask_groq_uses_captured(mocker, mock_session, mock_mongo_client):
    """signal_ask calls asyncio.to_thread(llm_config.agent_chain.invoke, ...).
    The session mock prevents Neo4j I/O; chain mock returns {"output": answer}.
    mock_session.run().single() must return None to avoid json.dumps on a MagicMock
    company_profile. The Profiler/Company_Profile find_one must return None too."""
    captured = load_captured("signal_ask_groq")
    chain_mock = MagicMock()
    # signal_ask uses raw_response.get("output", "") from the chain result
    chain_mock.invoke.return_value = {"output": str(captured)}
    mocker.patch(
        "app.services.signals.orchestrator._fetch_pinecone_supporting_context",
        return_value=[],
    )

    # Neo4j: no company profile (avoid json.dumps on MagicMock)
    mock_session.run.return_value.single.return_value = None
    # MongoDB: no customer profile doc (avoid json.dumps on MagicMock)
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value.find_one.return_value = None

    request = SignalAskRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        question="What's the latest signal?",
    )
    result = asyncio.run(signal_ask(mock_session._driver, mock_mongo_client, chain_mock, request))

    assert result is not None
    assert "answer" in result


def test_signal_ask_claude_raises_service_error_when_api_key_missing(
    mocker, mock_mongo_client,
):
    """ServiceError site: ANTHROPIC_API_KEY guard."""
    mocker.patch("app.services.signals.orchestrator.CLAUDE_API_KEY", "")

    request = SignalAskRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, question="Q",
    )
    with pytest.raises(ServiceError, match="ANTHROPIC_API_KEY"):
        asyncio.run(signal_ask_claude(MagicMock(), mock_mongo_client, request))


def test_signal_ask_claude_raises_service_error_when_claude_call_fails(
    mocker, mock_session, mock_mongo_client,
):
    """ServiceError site: Claude API HTTP error (status >= 400) → ServiceError."""
    mocker.patch("app.services.signals.orchestrator.CLAUDE_API_KEY", "valid-key")
    mocker.patch(
        "app.services.signals.orchestrator._fetch_pinecone_supporting_context",
        return_value=[],
    )
    mocker.patch(
        "app.services.signals.orchestrator._reserve_claude_signal_budget",
        return_value={"run_id": "test-run-id"},
    )
    mocker.patch("app.services.signals.orchestrator._estimate_token_count", return_value=100)
    mocker.patch("app.services.signals.orchestrator._finalize_claude_signal_budget", return_value={})

    # requests.post is called via asyncio.to_thread — patch the module-level binding
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.text = "Internal Server Error"
    mocker.patch("app.services.signals.orchestrator.requests.post", return_value=mock_response)

    # No Neo4j company profile; no MongoDB customer profile (avoid MagicMock json.dumps)
    mock_session.run.return_value.single.return_value = None
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value.find_one.return_value = None

    request = SignalAskRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, question="Q",
    )
    with pytest.raises(ServiceError):
        asyncio.run(signal_ask_claude(mock_session._driver, mock_mongo_client, request))


def test_signal_ask_claude_happy_path_uses_captured(
    mocker, mock_session, mock_mongo_client,
):
    captured = load_captured("signal_ask_claude")
    answer_text = captured.get("output", captured.get("answer", str(captured)))

    # No Neo4j company profile; no MongoDB customer profile (avoid MagicMock json.dumps)
    mock_session.run.return_value.single.return_value = None
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value.find_one.return_value = None


    mocker.patch("app.services.signals.orchestrator.CLAUDE_API_KEY", "valid-key")
    mocker.patch(
        "app.services.signals.orchestrator._fetch_pinecone_supporting_context",
        return_value=[],
    )
    mocker.patch(
        "app.services.signals.orchestrator._reserve_claude_signal_budget",
        return_value={"run_id": "test-run-id"},
    )
    mocker.patch("app.services.signals.orchestrator._estimate_token_count", return_value=100)
    mocker.patch(
        "app.services.signals.orchestrator._finalize_claude_signal_budget",
        return_value={
            "window_tokens_5m": 100,
            "run_count_5m": 1,
            "run_count_total": 1,
        },
    )

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "content": [{"type": "text", "text": answer_text}]
    }
    mocker.patch("app.services.signals.orchestrator.requests.post", return_value=mock_response)

    request = SignalAskRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, question="Q",
    )
    result = asyncio.run(signal_ask_claude(mock_session._driver, mock_mongo_client, request))

    assert result is not None
    assert result.get("status") == "success"
