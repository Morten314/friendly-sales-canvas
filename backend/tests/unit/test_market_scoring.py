# backend/tests/unit/test_market_scoring.py
"""Unit tests for app/services/market_scoring.py.

Covers all router-facing service functions, the BrewraError catch path in
`_run_market_scoring_for_org`, and the degrade-on-error behavior of
`get_market_scores_status`.
"""
from unittest.mock import MagicMock

import pytest

from app.core.exceptions import (
    BrewraError,
    MarketScoreNotFoundError,
    MarketScoringRunNotFoundError,
)
from app.models.market_scoring import LeadMarketScoresRequest
from app.services.market_scoring import (
    _run_market_scoring_for_org,
    get_company_profile_for_org,
    get_lead_market_score_descriptions,
    get_market_scores_status,
    trigger_or_get_market_scores,
)
from app.services.market_scoring.orchestrator import (
    get_market_reports_for_org,
    score_single_lead_against_market,
)
from tests.identities import TEST_LEAD_ID_1, TEST_ORG_ID, TEST_USER_ID


# ---------------------------------------------------------------------------
# Fake LLM + factory autouse fixture for score_lead prompt
#
# call_with_prompt("score_lead", ...) resolves the LLM via the factory using
# the front-matter `model:` field (Qwen/Qwen3-235B-A22B-Instruct-2507-tput).
# We register a fake builder for this model so the prompt-driven path works
# in tests without hitting a real provider. Snapshot/restore matches the
# isolated_llm_factory pattern used elsewhere.
# ---------------------------------------------------------------------------


class _FakeResponse:
    def __init__(self, content: str) -> None:
        self.content = content


class _FakeLLM:
    """Default fake LLM that returns a valid scoring JSON payload."""

    def __init__(self) -> None:
        import json as _json
        self._default_content = _json.dumps({
            "component_scores": {
                "market size & opportunity": 70,
                "industry trends report": 75,
                "competitor landscape": 65,
                "regulatory & compliance highlights": 80,
                "market entry & growth strategy": 72,
            },
            "component_descriptions": {
                "market size & opportunity": "Strong fit",
                "industry trends report": "Growing",
                "competitor landscape": "Few rivals",
                "regulatory & compliance highlights": "Compliant",
                "market entry & growth strategy": "Direct entry",
            },
        })
        self.invocations = []

    def invoke(self, messages):
        self.invocations.append(messages)
        return _FakeResponse(self._default_content)


_FAKE_LLM = _FakeLLM()


@pytest.fixture(autouse=True)
def _fake_qwen_in_factory():
    """Register a fake Qwen LLM in the factory for this test module.

    Snapshots/restores factory + cache state so other test modules' LLM
    registrations (production Qwen/Groq from build_llm_config) survive.
    """
    from app.services import _llm_helpers
    factory_snapshot = dict(_llm_helpers._LLM_FACTORY)
    cache_snapshot = dict(_llm_helpers._LLM_CACHE)
    _llm_helpers._LLM_CACHE.clear()
    _llm_helpers._LLM_FACTORY["Qwen/Qwen3-235B-A22B-Instruct-2507-tput"] = lambda: _FAKE_LLM
    yield
    _llm_helpers._LLM_FACTORY.clear()
    _llm_helpers._LLM_FACTORY.update(factory_snapshot)
    _llm_helpers._LLM_CACHE.clear()
    _llm_helpers._LLM_CACHE.update(cache_snapshot)


# ---------------------------------------------------------------------------
# get_market_scores_status
# ---------------------------------------------------------------------------

def test_get_market_scores_status_returns_status(mocker, mock_mongo_client):
    """get_market_scores_status(user_id, org_id, run_id, recent_items_limit) — 4 args."""
    score_coll = MagicMock()
    run_coll = MagicMock()
    run_coll.find_one.return_value = {
        "run_id": "r1", "user_id": TEST_USER_ID, "org_id": TEST_ORG_ID,
        "status": "completed", "started_at": "2026-05-08T10:00:00Z",
        "completed_at": "2026-05-08T10:05:00Z",
    }
    # score_coll.count_documents returns 0 by default from MagicMock (falsy int ok)
    score_coll.count_documents.return_value = 2
    score_coll.find.return_value.sort.return_value.limit.return_value = []
    mocker.patch(
        "app.services.market_scoring.persistence._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )
    mocker.patch(
        "app.services.market_scoring.orchestrator.get_leads_for_org",
        return_value=([{"lead_id": "L1"}, {"lead_id": "L2"}], 2),
    )

    result = get_market_scores_status(MagicMock(), mock_mongo_client, TEST_USER_ID, TEST_ORG_ID, None, 10)

    assert result.get("processing_status") == "completed" or result.get("status") == "completed"
    assert result.get("total_leads", 0) >= 0


def test_get_market_scores_status_degrades_when_leads_fetch_fails(
    mocker, mock_mongo_client,
):
    """C2 fix: a Neo4j hiccup in get_leads_for_org should not make the
    status endpoint fatal. total_leads degrades to 0 instead."""
    score_coll = MagicMock()
    run_coll = MagicMock()
    run_coll.find_one.return_value = {
        "run_id": "r1", "user_id": TEST_USER_ID, "org_id": TEST_ORG_ID,
        "status": "completed",
    }
    score_coll.count_documents.return_value = 0
    score_coll.find.return_value.sort.return_value.limit.return_value = []
    mocker.patch(
        "app.services.market_scoring.persistence._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )
    mocker.patch(
        "app.services.market_scoring.orchestrator.get_leads_for_org",
        side_effect=RuntimeError("Neo4j down"),
    )

    # Should not raise — the call site wraps get_leads_for_org in try/except
    result = get_market_scores_status(MagicMock(), mock_mongo_client, TEST_USER_ID, TEST_ORG_ID, None, 10)

    assert result.get("total_leads", 0) == 0  # degraded, not fatal


def test_get_market_scores_status_raises_when_no_run_found(
    mocker, mock_mongo_client,
):
    score_coll = MagicMock()
    run_coll = MagicMock()
    run_coll.find_one.return_value = None
    mocker.patch(
        "app.services.market_scoring.persistence._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )

    with pytest.raises(MarketScoringRunNotFoundError):
        get_market_scores_status(MagicMock(), mock_mongo_client, TEST_USER_ID, TEST_ORG_ID, None, 10)


# ---------------------------------------------------------------------------
# trigger_or_get_market_scores — takes (LeadMarketScoresRequest, BackgroundTasks)
# ---------------------------------------------------------------------------

def test_trigger_or_get_market_scores_returns_existing_when_present(
    mocker, mock_mongo_client,
):
    score_coll = MagicMock()
    run_coll = MagicMock()
    run_coll.find_one.return_value = {
        "run_id": "r1", "status": "completed",
    }
    # _get_latest_market_score_rows calls: list(score_coll.find(...).sort("updated_at", -1))
    # Configure the full chain so iteration works.
    score_doc = {
        "lead_id": TEST_LEAD_ID_1,
        "org_id": TEST_ORG_ID,
        "market_total_score": 75,
        "updated_at": "2026-05-08T10:05:00Z",
        "scoring_status": "completed",
        "company_name": "Acme",
        "lead_name": "Jane Doe",
    }
    score_coll.find.return_value.sort.return_value.skip.return_value.limit.return_value = iter([score_doc])
    score_coll.count_documents.return_value = 1
    mocker.patch(
        "app.services.market_scoring.persistence._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )
    bg_tasks = MagicMock()

    request = LeadMarketScoresRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, refresh=False,
    )
    result = trigger_or_get_market_scores(MagicMock(), mock_mongo_client, MagicMock(), request, bg_tasks)

    assert isinstance(result, dict)
    assert "org_id" in result and "processing_status" in result


# ---------------------------------------------------------------------------
# get_lead_market_score_descriptions
# ---------------------------------------------------------------------------

def test_get_lead_market_score_descriptions_raises_when_missing(
    mocker, mock_mongo_client,
):
    score_coll = MagicMock()
    run_coll = MagicMock()
    score_coll.find_one.return_value = None
    mocker.patch(
        "app.services.market_scoring.persistence._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )

    with pytest.raises(MarketScoreNotFoundError):
        get_lead_market_score_descriptions(mock_mongo_client, TEST_LEAD_ID_1, TEST_USER_ID, TEST_ORG_ID)


def test_get_lead_market_score_descriptions_happy_path(
    mocker, mock_mongo_client,
):
    score_coll = MagicMock()
    run_coll = MagicMock()
    score_coll.find_one.return_value = {
        "lead_id": TEST_LEAD_ID_1, "org_id": TEST_ORG_ID,
        "market_total_score": 85,
        "component_descriptions": {
            "market size & opportunity": "Strong match",
            "industry trends report": "Growing sector",
            "competitor landscape": "Low competition",
            "regulatory & compliance highlights": "Compliant",
            "market entry & growth strategy": "Good fit",
        },
    }
    mocker.patch(
        "app.services.market_scoring.persistence._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )

    result = get_lead_market_score_descriptions(mock_mongo_client, TEST_LEAD_ID_1, TEST_USER_ID, TEST_ORG_ID)

    assert "descriptions" in result
    assert result.get("lead_id") == TEST_LEAD_ID_1


# ---------------------------------------------------------------------------
# get_company_profile_for_org / get_market_reports_for_org
# ---------------------------------------------------------------------------

def test_get_company_profile_for_org_returns_neo4j_profile(mock_session):
    # record.values() returns a list; [0] is the node dict
    record = MagicMock()
    record.values.return_value = [{"name": "Acme", "industry": "Logistics"}]
    mock_session.run.return_value.single.return_value = record

    result = get_company_profile_for_org(mock_session._driver, org_id=TEST_ORG_ID)

    assert result["name"] == "Acme"


def test_get_company_profile_for_org_returns_empty_when_missing(mock_session):
    mock_session.run.return_value.single.return_value = None

    result = get_company_profile_for_org(mock_session._driver, org_id=TEST_ORG_ID)

    assert result == {}


def test_get_market_reports_for_org_returns_dict(mock_mongo_client):
    """get_market_reports_for_org returns Dict[str, Dict] keyed by component name.

    It calls collection.find_one() per component (5 components). We configure
    the mock to return a doc for the first component and None for the rest.
    """
    coll = MagicMock()
    # Return a document for the first call, None for subsequent calls
    coll.find_one.side_effect = [
        {"component_name": "market size & opportunity", "data": {"tam": "$1B"}},
        None,
        None,
        None,
        None,
    ]
    db_mock = MagicMock()
    db_mock.__getitem__.return_value = coll
    mock_mongo_client.__getitem__.return_value = db_mock

    result = get_market_reports_for_org(mock_mongo_client, user_id=TEST_USER_ID, org_id=TEST_ORG_ID)

    assert isinstance(result, dict)
    assert "market size & opportunity" in result


# ---------------------------------------------------------------------------
# score_single_lead_against_market
# ---------------------------------------------------------------------------

def test_score_single_lead_against_market_returns_score(mocker):
    """score_single_lead_against_market resolves the LLM from the prompt
    front-matter via the factory (see _fake_qwen_in_factory autouse fixture).
    Returns (scoring_payload, prompt_meta) tuple. llm2 arg is ignored in v1.
    """
    lead = {"lead_id": TEST_LEAD_ID_1, "company_name": "Acme"}
    company_profile = {"industry": "Logistics"}
    market_reports = {"market size & opportunity": {"tam": "$1B"}}

    # llm2 is passed for backward-compat but ignored — the factory's _FAKE_LLM is used.
    result, prompt_meta = score_single_lead_against_market(
        MagicMock(),
        lead=lead,
        company_profile=company_profile,
        market_reports=market_reports,
    )

    assert "market_total_score" in result
    assert "component_scores" in result
    # prompt_meta should carry registry observability fields
    assert prompt_meta["name"] == "score_lead"
    assert prompt_meta["model"] == "Qwen/Qwen3-235B-A22B-Instruct-2507-tput"


# ---------------------------------------------------------------------------
# _run_market_scoring_for_org — BrewraError catch
# ---------------------------------------------------------------------------

def test_run_market_scoring_for_org_marks_failed_on_brewra_error(
    mocker, mock_mongo_client,
):
    """When an inner step raises BrewraError, the background task catches
    it, updates the run-doc status to 'failed', and does NOT bubble."""
    score_coll = MagicMock()
    run_coll = MagicMock()
    mocker.patch(
        "app.services.market_scoring.persistence._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )
    mocker.patch(
        "app.services.market_scoring.orchestrator.get_leads_for_org",
        side_effect=BrewraError("storage hiccup"),
    )

    # Should not raise
    _run_market_scoring_for_org(
        MagicMock(), mock_mongo_client, MagicMock(),
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, run_id="r1",
    )

    # The run-doc status must flip to "failed"
    update_calls = run_coll.update_one.call_args_list
    failed_updates = [
        c for c in update_calls
        if c.args[1].get("$set", {}).get("status") == "failed"
    ]
    assert len(failed_updates) >= 1, "Expected >=1 'status: failed' update"


def test_run_market_scoring_for_org_marks_completed_on_success(
    mocker, mock_mongo_client,
):
    score_coll = MagicMock()
    run_coll = MagicMock()
    mocker.patch(
        "app.services.market_scoring.persistence._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )
    mocker.patch(
        "app.services.market_scoring.scoring.get_leads_for_org",
        return_value=([{"lead_id": "L1"}], 1),
    )
    mocker.patch(
        "app.services.market_scoring.persistence.get_company_profile_for_org",
        return_value={"industry": "SaaS"},
    )
    # Must return all 5 components or the function returns early with "failed".
    all_five_reports = {
        "market size & opportunity": {"tam": "$1B"},
        "industry trends report": {"trend": "AI"},
        "competitor landscape": {"top_rival": "None"},
        "regulatory & compliance highlights": {"risk": "Low"},
        "market entry & growth strategy": {"strategy": "Direct"},
    }
    mocker.patch(
        "app.services.market_scoring.orchestrator.get_market_reports_for_org",
        return_value=all_five_reports,
    )
    mocker.patch(
        "app.services.market_scoring.orchestrator.score_single_lead_against_market",
        return_value=(
            {
                "component_scores": {},
                "component_descriptions": {},
                "market_total_score": 85,
            },
            {"name": "score_lead", "version": "1.0.0"},
        ),
    )
    mocker.patch(
        "app.services.market_scoring.orchestrator._persist_market_score_for_lead",
    )

    _run_market_scoring_for_org(
        MagicMock(), mock_mongo_client, MagicMock(),
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, run_id="r1",
    )

    update_calls = run_coll.update_one.call_args_list
    completed_updates = [
        c for c in update_calls
        if c.args[1].get("$set", {}).get("status") == "completed"
    ]
    assert len(completed_updates) >= 1


# ---------------------------------------------------------------------------
# _get_latest_market_score_rows — pagination params + tuple return
# ---------------------------------------------------------------------------

from unittest.mock import patch  # noqa: E402 (import after guards above)

from app.services.market_scoring import _get_latest_market_score_rows  # noqa: E402


def test_get_latest_market_score_rows_returns_items_and_total():
    """_get_latest_market_score_rows returns (items, total) with paginated query."""
    fake_docs = [
        {"lead_id": "L1", "org_id": "org_1", "updated_at": "2026-01-01",
         "company_name": "C1", "lead_name": "Lead1"},
        {"lead_id": "L2", "org_id": "org_1", "updated_at": "2026-01-02",
         "company_name": "C2", "lead_name": "Lead2"},
    ]
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = iter(fake_docs)
    score_coll = MagicMock()
    score_coll.find.return_value = fake_cursor
    score_coll.count_documents.return_value = 42

    with patch(
        "app.services.market_scoring.persistence._get_market_score_collections",
        return_value=(score_coll, MagicMock()),
    ):
        rows, total = _get_latest_market_score_rows(
            driver=MagicMock(), mongo=MagicMock(), org_id="org_1",
        )
    assert len(rows) == 2
    assert total == 42


def test_get_latest_market_score_rows_default_limit_is_500():
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = iter([])
    score_coll = MagicMock()
    score_coll.find.return_value = fake_cursor
    score_coll.count_documents.return_value = 0

    with patch(
        "app.services.market_scoring.persistence._get_market_score_collections",
        return_value=(score_coll, MagicMock()),
    ):
        _get_latest_market_score_rows(driver=MagicMock(), mongo=MagicMock(), org_id="org_1")
    fake_cursor.sort.return_value.skip.assert_called_with(0)
    fake_cursor.sort.return_value.skip.return_value.limit.assert_called_with(500)
