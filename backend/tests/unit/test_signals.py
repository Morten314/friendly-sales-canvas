# backend/tests/unit/test_signals.py
"""Unit tests for app/services/signals.py.

Covers all 8 public functions, the 4 typed-exception leaves, and the
3 `ServiceError` raise sites in `signal_ask` / `signal_ask_claude`.
"""
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock

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

SUPPORTING_DOC_ROWS = [
    {
        "query": "scout signal opportunities",
        "id": "doc-chunk-1",
        "score": 0.91,
        "content": "ACME Corp announced 30% revenue growth and DACH expansion in Q3.",
        "metadata": {
            "source": "acme_q3.pdf",
            "text": "ACME Corp announced 30% revenue growth and DACH expansion in Q3.",
            "page": 2,
        },
    },
]


# ---------------------------------------------------------------------------
# search_signals (sync) — uses captured fixtures
# ---------------------------------------------------------------------------

def test_search_signals_scout_qwen_uses_captured(mocker):
    captured = load_captured("search_signals_scout_qwen")
    # _signals_agent_output calls llm_config.agent_chain.invoke({"input": prompt})
    # and accesses raw_response["output"] — return a JSON-parseable string.
    chain_mock = MagicMock()
    chain_mock.invoke.return_value = {"output": json.dumps(captured)}

    pre_data = json.dumps(load_seed("company_profile"))
    result = search_signals(chain_mock, pre_data, persona="scout", llm_backend="qwen")

    assert result is not None
    chain_mock.invoke.assert_called_once()
    # Post-Task-9: search_signals attaches prompt_meta to the result for the
    # caller to persist into Mongo. Assert the migrated prompt drives the call.
    assert result["prompt_meta"]["name"] == "signals_scout_search"
    assert result["prompt_meta"]["version"] == "1.1.0"


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
    # Post-Task-9: profiler persona uses signals_profiler_search; same prompt_meta contract.
    assert result["prompt_meta"]["name"] == "signals_profiler_search"
    assert result["prompt_meta"]["version"] == "1.1.0"


# ---------------------------------------------------------------------------
# run_signals_research — supporting_documents threading (Task 2)
# ---------------------------------------------------------------------------

def test_run_signals_research_scout_labels_supporting_documents(
    mocker, mock_session, mock_mongo_client,
):
    """Scout signals prompt carries a distinct, labeled SUPPORTING DOCUMENTS
    section with the retrieved content, and the pinecone scaffolding keys no
    longer leak into the company-profile JSON blob (D1)."""
    captured = load_captured("search_signals_scout_qwen")
    chain_mock = MagicMock()
    chain_mock.invoke.return_value = {"output": json.dumps(captured)}
    mocker.patch(
        "app.services.signals.search._fetch_pinecone_supporting_context",
        return_value=SUPPORTING_DOC_ROWS,
    )
    mocker.patch("app.services.signals.search.fetch_org_leads_for_signals", return_value=[])
    mocker.patch("app.services.signals.persistence._get_existing_headlines", return_value=[])
    mocker.patch("app.services.signals.persistence._get_user_icp_config", return_value=None)
    mocker.patch("app.services.signals.persistence._save_signal_and_track_headline", return_value=None)

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="scout", data={"industry": "SaaS", "region": "DACH"}, refresh=True,
    )
    result = asyncio.run(
        run_signals_research(mock_session._driver, mock_mongo_client, MagicMock(), chain_mock, request)
    )

    assert result["status"] == "success"
    prompt = chain_mock.invoke.call_args[0][0]["input"]
    assert "SUPPORTING DOCUMENTS" in prompt
    assert "ACME Corp announced 30% revenue growth" in prompt
    assert "pinecone_supporting_context" not in prompt
    assert "pinecone_context_queries" not in prompt


def test_run_signals_research_profiler_includes_supporting_documents(
    mocker, mock_session, mock_mongo_client,
):
    """D3 regression: the profiler signals branch (which previously rebuilt
    context_json from only {company_profile, icp_data} and dropped the docs)
    now includes the retrieved documents."""
    captured = load_captured("search_signals_profiler_qwen")
    chain_mock = MagicMock()
    chain_mock.invoke.return_value = {"output": json.dumps(captured)}
    mocker.patch(
        "app.services.signals.search._fetch_pinecone_supporting_context",
        return_value=SUPPORTING_DOC_ROWS,
    )
    mocker.patch("app.services.signals.search.fetch_org_leads_for_signals", return_value=[])
    mocker.patch("app.services.signals.persistence._get_existing_headlines", return_value=[])
    mocker.patch("app.services.signals.persistence._get_user_icp_config", return_value=None)
    mocker.patch("app.services.signals.persistence._save_signal_and_track_headline", return_value=None)

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="profiler", data={"industry": "SaaS"}, refresh=True,
    )
    result = asyncio.run(
        run_signals_research(mock_session._driver, mock_mongo_client, MagicMock(), chain_mock, request)
    )

    assert result["status"] == "success"
    prompt = chain_mock.invoke.call_args[0][0]["input"]
    assert "SUPPORTING DOCUMENTS" in prompt
    assert "ACME Corp announced 30% revenue growth" in prompt
    assert "pinecone_supporting_context" not in prompt
    assert "pinecone_context_queries" not in prompt


def test_run_signals_research_scout_omits_section_when_no_docs(
    mocker, mock_session, mock_mongo_client,
):
    """AC1 / spec empty-retrieval case: with no retrieved docs the
    {% if supporting_documents %} guard omits the section entirely — no empty
    'SUPPORTING DOCUMENTS' header in the rendered prompt."""
    captured = load_captured("search_signals_scout_qwen")
    chain_mock = MagicMock()
    chain_mock.invoke.return_value = {"output": json.dumps(captured)}
    mocker.patch(
        "app.services.signals.search._fetch_pinecone_supporting_context",
        return_value=[],
    )
    mocker.patch("app.services.signals.search.fetch_org_leads_for_signals", return_value=[])
    mocker.patch("app.services.signals.persistence._get_existing_headlines", return_value=[])
    mocker.patch("app.services.signals.persistence._get_user_icp_config", return_value=None)
    mocker.patch("app.services.signals.persistence._save_signal_and_track_headline", return_value=None)

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="scout", data={"industry": "SaaS"}, refresh=True,
    )
    result = asyncio.run(
        run_signals_research(mock_session._driver, mock_mongo_client, MagicMock(), chain_mock, request)
    )

    assert result["status"] == "success"
    prompt = chain_mock.invoke.call_args[0][0]["input"]
    assert "SUPPORTING DOCUMENTS" not in prompt


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
    with llm_backend='qwen'."""
    captured = load_captured("search_signals_scout_qwen")
    mocker.patch(
        "app.services.signals.batch._generate_signals_batch_impl",
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
        "app.services.signals.batch._generate_signals_batch_impl",
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

def test_signal_ask_qwen_uses_captured(mocker, mock_session, mock_mongo_client):
    """signal_ask calls asyncio.to_thread(llm_config.agent_chain.invoke, ...).
    The session mock prevents Neo4j I/O; chain mock returns {"output": answer}.
    mock_session.run().single() must return None to avoid json.dumps on a MagicMock
    company_profile. The Profiler/Company_Profile find_one must return None too."""
    captured = load_captured("signal_ask_qwen")
    chain_mock = MagicMock()
    # signal_ask uses raw_response.get("output", "") from the chain result
    chain_mock.invoke.return_value = {"output": str(captured)}
    mocker.patch(
        "app.services.signals.ask._fetch_pinecone_supporting_context",
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
    result = asyncio.run(signal_ask(mock_session._driver, mock_mongo_client, MagicMock(), chain_mock, request))

    assert result is not None
    assert "answer" in result
    # Post-Task-9: signal_ask threads prompt_meta into the response.
    assert result["prompt_meta"]["name"] == "signals_signal_ask_qwen"
    assert result["prompt_meta"]["model"] == "Qwen/Qwen3-235B-A22B-Instruct-2507-tput"


def test_signal_ask_claude_raises_service_error_when_api_key_missing(
    mocker, mock_mongo_client,
):
    """ServiceError site: ANTHROPIC_API_KEY guard."""
    mocker.patch("app.services.signals.ask.CLAUDE_API_KEY", "")

    request = SignalAskRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, question="Q",
    )
    with pytest.raises(ServiceError, match="ANTHROPIC_API_KEY"):
        asyncio.run(signal_ask_claude(MagicMock(), mock_mongo_client, MagicMock(), request))


def test_signal_ask_claude_raises_service_error_when_claude_call_fails(
    mocker, mock_session, mock_mongo_client,
):
    """ServiceError site: Claude API HTTP error (status >= 400) → ServiceError."""
    mocker.patch("app.services.signals.ask.CLAUDE_API_KEY", "valid-key")
    mocker.patch(
        "app.services.signals.ask._fetch_pinecone_supporting_context",
        return_value=[],
    )
    mocker.patch(
        "app.services.signals.ask._reserve_claude_signal_budget",
        return_value={"run_id": "test-run-id"},
    )
    mocker.patch("app.services.signals.ask._estimate_token_count", return_value=100)
    mocker.patch("app.services.signals.ask._finalize_claude_signal_budget", return_value={})

    # requests.post is called via asyncio.to_thread — patch the module-level binding
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.text = "Internal Server Error"
    mocker.patch("app.services.signals.ask.requests.post", return_value=mock_response)

    # No Neo4j company profile; no MongoDB customer profile (avoid MagicMock json.dumps)
    mock_session.run.return_value.single.return_value = None
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value.find_one.return_value = None

    request = SignalAskRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, question="Q",
    )
    with pytest.raises(ServiceError):
        asyncio.run(signal_ask_claude(mock_session._driver, mock_mongo_client, MagicMock(), request))


def test_signal_ask_claude_happy_path_uses_captured(
    mocker, mock_session, mock_mongo_client,
):
    captured = load_captured("signal_ask_claude")
    answer_text = captured.get("output", captured.get("answer", str(captured)))

    # No Neo4j company profile; no MongoDB customer profile (avoid MagicMock json.dumps)
    mock_session.run.return_value.single.return_value = None
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value.find_one.return_value = None


    mocker.patch("app.services.signals.ask.CLAUDE_API_KEY", "valid-key")
    mocker.patch(
        "app.services.signals.ask._fetch_pinecone_supporting_context",
        return_value=[],
    )
    mocker.patch(
        "app.services.signals.ask._reserve_claude_signal_budget",
        return_value={"run_id": "test-run-id"},
    )
    mocker.patch("app.services.signals.ask._estimate_token_count", return_value=100)
    mocker.patch(
        "app.services.signals.ask._finalize_claude_signal_budget",
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
    mocker.patch("app.services.signals.ask.requests.post", return_value=mock_response)

    request = SignalAskRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, question="Q",
    )
    result = asyncio.run(signal_ask_claude(mock_session._driver, mock_mongo_client, MagicMock(), request))

    assert result is not None
    assert result.get("status") == "success"
    # Post-Task-9: signal_ask_claude also threads prompt_meta; model field is
    # observability-only ("claude-sonnet") since custom dispatch doesn't use the factory.
    assert result["prompt_meta"]["name"] == "signals_signal_ask_claude"
    assert result["prompt_meta"]["model"] == "claude-sonnet"


# ---------------------------------------------------------------------------
# _generate_one_signal — per-signal resilience (Issue 1: Claude batch 500)
#
# The batch path used to call search_signals once per signal and re-raise on
# the first failure, so any single transient Claude/Tavily/JSON error aborted
# the whole batch with an HTTP 500 — even though the Profiler/ICP path and the
# single-signal research path retry. _generate_one_signal now retries the LLM
# call and returns None (skipped) on exhaustion instead of raising, so one bad
# signal cannot 500 the batch. It is side-effect-free (no persist, no pre_data
# mutation) so the four signals run concurrently under asyncio.gather.
# ---------------------------------------------------------------------------

def test_generate_one_signal_returns_none_after_exhausting_retries(
    mocker, mock_mongo_client,
):
    """A signal whose LLM call fails every retry returns None (skipped) rather
    than raising — so one bad signal cannot abort the whole batch."""
    from app.services.signals.batch import _generate_one_signal

    mocker.patch(
        "app.services.signals.search.search_signals",
        side_effect=RuntimeError("Claude API failed (500)"),
    )
    mocker.patch("app.services.signals.batch.asyncio.sleep", new=AsyncMock())

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="signals", data={}, refresh=True,
    )
    result = asyncio.run(_generate_one_signal(
        "scout", {"existing_headlines": []},
        agent_chain=MagicMock(), llm_backend="claude",
        request=request, batch_id="batch_test",
    ))

    assert result is None


def test_generate_one_signal_retries_then_succeeds(
    mocker, mock_mongo_client,
):
    """A transient failure on the first attempt is retried and recovered, so the
    signal is still produced (no data loss, no 500), with metadata attached."""
    from app.services.signals.batch import _generate_one_signal

    captured = load_captured("search_signals_scout_claude")
    mocker.patch(
        "app.services.signals.search.search_signals",
        side_effect=[RuntimeError("transient"), dict(captured)],
    )
    mocker.patch("app.services.signals.batch.asyncio.sleep", new=AsyncMock())

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        component_name="signals", data={}, refresh=True,
    )
    result = asyncio.run(_generate_one_signal(
        "scout", {"existing_headlines": []},
        agent_chain=MagicMock(), llm_backend="claude",
        request=request, batch_id="batch_test",
    ))

    assert result is not None
    assert result["agent"] == "scout"
    assert result["signal_id"]  # metadata attached


def test_generate_signals_batch_claude_all_failed_returns_empty_success(
    mocker, mock_session, mock_mongo_client,
):
    """Issue 1 contract: when EVERY signal exhausts its retries, the batch must
    NOT 500 — it returns a success envelope with an empty data list (graceful
    degradation). Failures are logged, not surfaced in the body; structured
    failure reporting (failed_count/partial status) is intentionally deferred
    (see synthesis round 1)."""
    mocker.patch("app.services.signals.persistence._get_existing_headlines", return_value=[])
    mocker.patch("app.services.signals.persistence._get_user_icp_config", return_value=None)
    mocker.patch("app.services.signals.batch._fetch_pinecone_supporting_context", return_value=[])
    mocker.patch(
        "app.services.signals.search.search_signals",
        side_effect=RuntimeError("Claude API failed (500)"),
    )
    mocker.patch("app.services.signals.batch.asyncio.sleep", new=AsyncMock())

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=None,
        component_name="signals", data={"industry": "SaaS"}, refresh=True,
    )
    result = asyncio.run(generate_signals_batch_claude(
        mock_session._driver, mock_mongo_client, MagicMock(), MagicMock(), request,
    ))

    assert result["status"] == "success"
    assert result["data"] == []


def test_generate_signals_batch_claude_runs_calls_concurrently(
    mocker, mock_session, mock_mongo_client,
):
    """Issue 1 (latency): the 4 signal generations must run CONCURRENTLY, not
    sequentially — that keeps total wall-time near a single call (~30s) instead
    of ~4x (~120s), under the upstream proxy timeout. Assert search_signals
    calls overlap (observed max concurrency > 1)."""
    import threading
    import time as _time

    base = dict(load_captured("search_signals_scout_claude"))
    state = {"running": 0, "max": 0, "n": 0}
    lock = threading.Lock()

    def fake_search(agent_chain, pre_data, persona, llm_backend):
        with lock:
            state["running"] += 1
            state["max"] = max(state["max"], state["running"])
            state["n"] += 1
            n = state["n"]
        _time.sleep(0.3)  # hold the slot so concurrent calls overlap
        with lock:
            state["running"] -= 1
        s = dict(base)
        s["headline"] = f"{persona}-headline-{n}"  # unique -> no dedup collapse
        return s

    mocker.patch("app.services.signals.search.search_signals", side_effect=fake_search)
    mocker.patch("app.services.signals.persistence._get_existing_headlines", return_value=[])
    mocker.patch("app.services.signals.persistence._get_user_icp_config", return_value=None)
    mocker.patch("app.services.signals.persistence._save_signal_and_track_headline", return_value=None)
    mocker.patch("app.services.signals.batch._fetch_pinecone_supporting_context", return_value=[])

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=None,
        component_name="signals", data={"industry": "SaaS"}, refresh=True,
    )
    result = asyncio.run(generate_signals_batch_claude(
        mock_session._driver, mock_mongo_client, MagicMock(), MagicMock(), request,
    ))

    assert result["status"] == "success"
    assert len(result["data"]) == 4
    assert state["max"] >= 2  # calls overlapped — not strictly sequential


def test_generate_signals_batch_claude_dedupes_identical_headlines(
    mocker, mock_session, mock_mongo_client,
):
    """Concurrency removes the per-iteration headline-feedback dedup, so the
    batch de-duplicates identical headlines after gathering. 2 scout + 2 profiler
    with persona-identical headlines collapse to one signal each."""
    base = dict(load_captured("search_signals_scout_claude"))

    def fake_search(agent_chain, pre_data, persona, llm_backend):
        s = dict(base)
        s["headline"] = f"{persona.upper()}_HEADLINE"
        return s

    mocker.patch("app.services.signals.search.search_signals", side_effect=fake_search)
    mocker.patch("app.services.signals.persistence._get_existing_headlines", return_value=[])
    mocker.patch("app.services.signals.persistence._get_user_icp_config", return_value=None)
    mocker.patch("app.services.signals.persistence._save_signal_and_track_headline", return_value=None)
    mocker.patch("app.services.signals.batch._fetch_pinecone_supporting_context", return_value=[])

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=None,
        component_name="signals", data={"industry": "SaaS"}, refresh=True,
    )
    result = asyncio.run(generate_signals_batch_claude(
        mock_session._driver, mock_mongo_client, MagicMock(), MagicMock(), request,
    ))

    assert result["status"] == "success"
    assert len(result["data"]) == 2  # 2 scout collapse to 1, 2 profiler to 1
    assert sorted({s["headline"] for s in result["data"]}) == ["PROFILER_HEADLINE", "SCOUT_HEADLINE"]


def test_generate_signals_batch_claude_strips_mongo_objectid_from_response(
    mocker, mock_session, mock_mongo_client,
):
    """Regression (Issue 1, the actual prod 500): pymongo's insert_one mutates
    the passed dict in place, injecting a bson ObjectId ``_id``. That same dict
    object goes into the response ``data``, so FastAPI's serialize_response then
    raises ``PydanticSerializationError`` ("Unable to serialize unknown type:
    ObjectId") and 500s the whole batch AFTER the signals were already persisted.

    The batch must strip ``_id`` AFTER persistence so the response stays
    JSON-serializable. run_signals_research already pops ``_id`` post-persist
    (search.py); the concurrency refactor moved the batch's pop to before the
    insert and dropped the post-persist pop, reintroducing the ObjectId.

    The other batch tests patch _save_signal_and_track_headline with a no-op, so
    they never reproduce the insert_one mutation — this test simulates it.
    """
    from bson import ObjectId

    from app.models.signals import GenerateSignalsBatchResponse

    base = dict(load_captured("search_signals_scout_claude"))

    def fake_search(agent_chain, pre_data, persona, llm_backend):
        s = dict(base)
        s["headline"] = f"{persona}-unique-headline"  # 1 scout + 1 profiler survive
        return s

    def fake_persist(mongo, signals_result, track_key):
        # Mirror pymongo: insert_one assigns _id onto the passed dict in place.
        signals_result["_id"] = ObjectId()
        return None

    mocker.patch("app.services.signals.search.search_signals", side_effect=fake_search)
    mocker.patch("app.services.signals.persistence._get_existing_headlines", return_value=[])
    mocker.patch("app.services.signals.persistence._get_user_icp_config", return_value=None)
    mocker.patch(
        "app.services.signals.persistence._save_signal_and_track_headline",
        side_effect=fake_persist,
    )
    mocker.patch("app.services.signals.batch._fetch_pinecone_supporting_context", return_value=[])

    request = MarketRequest(
        user_id=TEST_USER_ID, org_id=None,
        component_name="signals", data={"industry": "SaaS"}, refresh=True,
    )
    result = asyncio.run(generate_signals_batch_claude(
        mock_session._driver, mock_mongo_client, MagicMock(), MagicMock(), request,
    ))

    assert result["status"] == "success"
    assert result["data"], "expected persisted signals in the response"
    # No bson ObjectId leaks into the response payload...
    assert all("_id" not in s for s in result["data"])
    # ...and the typed response serializes to JSON (exactly what FastAPI does in
    # serialize_response) without raising PydanticSerializationError.
    GenerateSignalsBatchResponse(**result).model_dump_json()


# ---------------------------------------------------------------------------
# signal_ask / signal_ask_claude — context enrichment (Issue 2: old signals
# only used company profile, not customer profile or data sources)
#
# The ask path never consulted Pinecone (uploaded data sources) and dropped the
# customer profile whenever the org-scoped Company_Profile read returned None
# (e.g. when only suggested ICPs exist in ICP_config). These tests pin the new
# behavior: data-source context is injected, and the customer profile falls
# back to the user-scoped ICP_config.
# ---------------------------------------------------------------------------

def _fake_claude_post(captured_payload):
    """A requests.post double that records the request body and returns 200."""
    def _post(url, headers=None, json=None, timeout=None):
        captured_payload["json"] = json
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = {"content": [{"type": "text", "text": "ok"}]}
        return resp
    return _post


def test_signal_ask_claude_includes_data_source_context(
    mocker, mock_session, mock_mongo_client,
):
    """signal_ask_claude must ground answers on uploaded data sources (Pinecone),
    injecting retrieved document content into the Claude prompt."""
    mocker.patch("app.services.signals.ask.CLAUDE_API_KEY", "valid-key")
    mocker.patch("app.services.signals.ask._reserve_claude_signal_budget", return_value={"run_id": "rid"})
    mocker.patch("app.services.signals.ask._estimate_token_count", return_value=10)
    mocker.patch(
        "app.services.signals.ask._finalize_claude_signal_budget",
        return_value={"window_tokens_5m": 10, "run_count_5m": 1, "run_count_total": 1},
    )
    mocker.patch(
        "app.services.signals.ask._fetch_pinecone_supporting_context",
        return_value=[{"content": "DATA_SOURCE_SENTINEL_42", "score": 0.9}],
    )

    # No company / customer profile (avoid json.dumps on a MagicMock).
    mock_session.run.return_value.single.return_value = None
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value.find_one.return_value = None

    captured_payload: dict = {}
    mocker.patch("app.services.signals.ask.requests.post", side_effect=_fake_claude_post(captured_payload))

    request = SignalAskRequest(user_id=TEST_USER_ID, org_id=TEST_ORG_ID, question="What changed?")
    result = asyncio.run(signal_ask_claude(mock_session._driver, mock_mongo_client, MagicMock(), request))

    assert result["status"] == "success"
    prompt = captured_payload["json"]["messages"][0]["content"]
    assert "DATA_SOURCE_SENTINEL_42" in prompt


def test_signal_ask_qwen_includes_data_source_context(
    mocker, mock_session, mock_mongo_client,
):
    """signal_ask (Qwen) must also inject uploaded data-source context into the
    prompt it hands to the agent chain (parity with the Claude path)."""
    mocker.patch(
        "app.services.signals.ask._fetch_pinecone_supporting_context",
        return_value=[{"content": "DATA_SOURCE_SENTINEL_QWEN", "score": 0.8}],
    )
    mock_session.run.return_value.single.return_value = None
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value.find_one.return_value = None

    chain_mock = MagicMock()
    chain_mock.invoke.return_value = {"output": "answer"}

    request = SignalAskRequest(user_id=TEST_USER_ID, org_id=TEST_ORG_ID, question="What changed?")
    result = asyncio.run(signal_ask(mock_session._driver, mock_mongo_client, MagicMock(), chain_mock, request))

    assert result["status"] == "success"
    chain_mock.invoke.assert_called_once()
    prompt = chain_mock.invoke.call_args[0][0]["input"]
    assert "DATA_SOURCE_SENTINEL_QWEN" in prompt


def test_signal_ask_qwen_uses_aligned_supporting_docs_label(
    mocker, mock_session, mock_mongo_client,
):
    """signal_ask labels uploaded docs with the shared 'SUPPORTING DOCUMENTS'
    wording (aligned to the Jinja partial), not the old bespoke
    'DATA SOURCES (uploaded documents):' label."""
    mocker.patch(
        "app.services.signals.ask._fetch_pinecone_supporting_context",
        return_value=[{"content": "DATA_SOURCE_SENTINEL_ALIGN", "score": 0.8}],
    )
    mock_session.run.return_value.single.return_value = None
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value.find_one.return_value = None

    chain_mock = MagicMock()
    chain_mock.invoke.return_value = {"output": "answer"}

    request = SignalAskRequest(user_id=TEST_USER_ID, org_id=TEST_ORG_ID, question="What changed?")
    result = asyncio.run(signal_ask(mock_session._driver, mock_mongo_client, MagicMock(), chain_mock, request))

    assert result["status"] == "success"
    prompt = chain_mock.invoke.call_args[0][0]["input"]
    assert "SUPPORTING DOCUMENTS" in prompt
    assert "DATA SOURCES (uploaded documents)" not in prompt
    assert "DATA_SOURCE_SENTINEL_ALIGN" in prompt


def test_signal_ask_claude_uses_aligned_supporting_docs_label(
    mocker, mock_session, mock_mongo_client,
):
    """signal_ask_claude (the path the FE actually calls) also labels uploaded
    docs with the aligned 'SUPPORTING DOCUMENTS' wording via the shared helper."""
    mocker.patch("app.services.signals.ask.CLAUDE_API_KEY", "valid-key")
    mocker.patch("app.services.signals.ask._reserve_claude_signal_budget", return_value={"run_id": "rid"})
    mocker.patch("app.services.signals.ask._estimate_token_count", return_value=10)
    mocker.patch(
        "app.services.signals.ask._finalize_claude_signal_budget",
        return_value={"window_tokens_5m": 10, "run_count_5m": 1, "run_count_total": 1},
    )
    mocker.patch(
        "app.services.signals.ask._fetch_pinecone_supporting_context",
        return_value=[{"content": "DATA_SOURCE_SENTINEL_CLAUDE", "score": 0.8}],
    )
    mock_session.run.return_value.single.return_value = None
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value.find_one.return_value = None

    captured_payload: dict = {}
    mocker.patch("app.services.signals.ask.requests.post", side_effect=_fake_claude_post(captured_payload))

    request = SignalAskRequest(user_id=TEST_USER_ID, org_id=TEST_ORG_ID, question="What changed?")
    result = asyncio.run(signal_ask_claude(mock_session._driver, mock_mongo_client, MagicMock(), request))

    assert result["status"] == "success"
    prompt = captured_payload["json"]["messages"][0]["content"]
    assert "SUPPORTING DOCUMENTS" in prompt
    assert "DATA SOURCES (uploaded documents)" not in prompt
    assert "DATA_SOURCE_SENTINEL_CLAUDE" in prompt


def test_supporting_docs_label_matches_partial():
    """Goal-4 drift guard: ask.py's _SUPPORTING_DOCS_LABEL must stay
    byte-identical to the Jinja partial's label line (the two are the only
    copies of the wording — a future edit to either would silently diverge)."""
    from pathlib import Path
    from app.services.signals.ask import _SUPPORTING_DOCS_LABEL

    partial = (
        Path(__file__).resolve().parents[2]
        / "prompts" / "_shared" / "supporting_documents_section.md.j2"
    )
    lines = partial.read_text(encoding="utf-8").splitlines()
    label_line = lines[lines.index("{% if supporting_documents %}") + 1]
    assert label_line == _SUPPORTING_DOCS_LABEL


def test_signal_ask_claude_falls_back_to_user_icp_config(
    mocker, mock_session,
):
    """When the org-scoped customer profile has no saved ICPs, signal_ask_claude
    falls back to the user-scoped ICP_config so the customer profile (ICPs)
    still informs the answer."""
    mocker.patch("app.services.signals.ask.CLAUDE_API_KEY", "valid-key")
    mocker.patch("app.services.signals.ask._reserve_claude_signal_budget", return_value={"run_id": "rid"})
    mocker.patch("app.services.signals.ask._estimate_token_count", return_value=10)
    mocker.patch(
        "app.services.signals.ask._finalize_claude_signal_budget",
        return_value={"window_tokens_5m": 10, "run_count_5m": 1, "run_count_total": 1},
    )
    mocker.patch("app.services.signals.ask._fetch_pinecone_supporting_context", return_value=[])

    mock_session.run.return_value.single.return_value = None  # no company profile

    # Differentiate collections: Company_Profile has no saved customer profile,
    # but ICP_config carries the user's (suggested) ICPs.
    company_profile_coll = MagicMock()
    company_profile_coll.find_one.return_value = None
    icp_config_coll = MagicMock()
    icp_config_coll.find_one.return_value = {
        "user_id": TEST_USER_ID,
        "icps": {"suggestedICPs": [{"id": "1", "industry": "ICP_SENTINEL_SAAS"}]},
    }
    profiler_db = MagicMock()
    profiler_db.__getitem__.side_effect = lambda name: (
        icp_config_coll if name == "ICP_config" else company_profile_coll
    )
    mongo = MagicMock()
    mongo.__getitem__.side_effect = lambda name: profiler_db if name == "Profiler" else MagicMock()

    captured_payload: dict = {}
    mocker.patch("app.services.signals.ask.requests.post", side_effect=_fake_claude_post(captured_payload))

    request = SignalAskRequest(user_id=TEST_USER_ID, org_id=TEST_ORG_ID, question="Q")
    result = asyncio.run(signal_ask_claude(mock_session._driver, mongo, MagicMock(), request))

    assert result["status"] == "success"
    prompt = captured_payload["json"]["messages"][0]["content"]
    assert "ICP_SENTINEL_SAAS" in prompt
