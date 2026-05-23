# backend/tests/unit/test_market_scoring.py
"""Unit tests for app/services/market_scoring.py.

Covers all router-facing service functions, the BrewraError catch path in
_run_market_scoring_for_org (Phase D Task 15 gap), and the C2 degrade-on-error
behavior of get_market_scores_status.
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
    get_market_reports_for_org,
    get_market_scores_status,
    score_single_lead_against_market,
    trigger_or_get_market_scores,
)
from tests.identities import TEST_LEAD_ID_1, TEST_ORG_ID, TEST_USER_ID


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
        "app.services.market_scoring._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )
    mocker.patch(
        "app.services.market_scoring.get_leads_for_org",
        return_value=[{"lead_id": "L1"}, {"lead_id": "L2"}],
    )

    result = get_market_scores_status(TEST_USER_ID, TEST_ORG_ID, None, 10)

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
        "app.services.market_scoring._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )
    mocker.patch(
        "app.services.market_scoring.get_leads_for_org",
        side_effect=RuntimeError("Neo4j down"),
    )

    # Should not raise — the call site wraps get_leads_for_org in try/except
    result = get_market_scores_status(TEST_USER_ID, TEST_ORG_ID, None, 10)

    assert result.get("total_leads", 0) == 0  # degraded, not fatal


def test_get_market_scores_status_raises_when_no_run_found(
    mocker, mock_mongo_client,
):
    score_coll = MagicMock()
    run_coll = MagicMock()
    run_coll.find_one.return_value = None
    mocker.patch(
        "app.services.market_scoring._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )

    with pytest.raises(MarketScoringRunNotFoundError):
        get_market_scores_status(TEST_USER_ID, TEST_ORG_ID, None, 10)


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
    score_coll.find.return_value.sort.return_value = [score_doc]
    mocker.patch(
        "app.services.market_scoring._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )
    bg_tasks = MagicMock()

    request = LeadMarketScoresRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, refresh=False,
    )
    result = trigger_or_get_market_scores(request, bg_tasks)

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
        "app.services.market_scoring._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )

    with pytest.raises(MarketScoreNotFoundError):
        get_lead_market_score_descriptions(TEST_LEAD_ID_1, TEST_USER_ID, TEST_ORG_ID)


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
        "app.services.market_scoring._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )

    result = get_lead_market_score_descriptions(TEST_LEAD_ID_1, TEST_USER_ID, TEST_ORG_ID)

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

    result = get_company_profile_for_org(org_id=TEST_ORG_ID)

    assert result["name"] == "Acme"


def test_get_company_profile_for_org_returns_empty_when_missing(mock_session):
    mock_session.run.return_value.single.return_value = None

    result = get_company_profile_for_org(org_id=TEST_ORG_ID)

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

    result = get_market_reports_for_org(user_id=TEST_USER_ID, org_id=TEST_ORG_ID)

    assert isinstance(result, dict)
    assert "market size & opportunity" in result


# ---------------------------------------------------------------------------
# score_single_lead_against_market
# ---------------------------------------------------------------------------

def test_score_single_lead_against_market_returns_score(mocker):
    """score_single_lead_against_market uses llm_config.llm2.invoke; mock the LLM."""
    import json as _json
    fake_response_content = _json.dumps({
        "component_scores": {
            "market size & opportunity": 75,
            "industry trends report": 80,
            "competitor landscape": 70,
            "regulatory & compliance highlights": 85,
            "market entry & growth strategy": 72,
        },
        "component_descriptions": {
            "market size & opportunity": "Large TAM",
            "industry trends report": "Growing",
            "competitor landscape": "Few rivals",
            "regulatory & compliance highlights": "Compliant",
            "market entry & growth strategy": "Good beachhead",
        },
    })
    fake_response = MagicMock()
    fake_response.content = fake_response_content

    llm2_mock = MagicMock()
    llm2_mock.invoke.return_value = fake_response

    lead = {"lead_id": TEST_LEAD_ID_1, "company_name": "Acme"}
    company_profile = {"industry": "Logistics"}
    market_reports = {"market size & opportunity": {"tam": "$1B"}}

    result = score_single_lead_against_market(llm2_mock, lead=lead, company_profile=company_profile, market_reports=market_reports)

    assert "market_total_score" in result
    assert "component_scores" in result


# ---------------------------------------------------------------------------
# _run_market_scoring_for_org — BrewraError catch (Phase D Task 15 gap)
# ---------------------------------------------------------------------------

def test_run_market_scoring_for_org_marks_failed_on_brewra_error(
    mocker, mock_mongo_client,
):
    """When an inner step raises BrewraError, the background task catches
    it, updates the run-doc status to 'failed', and does NOT bubble."""
    score_coll = MagicMock()
    run_coll = MagicMock()
    mocker.patch(
        "app.services.market_scoring._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )
    mocker.patch(
        "app.services.market_scoring.get_leads_for_org",
        side_effect=BrewraError("storage hiccup"),
    )

    # Should not raise
    _run_market_scoring_for_org(
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
        "app.services.market_scoring._get_market_score_collections",
        return_value=(score_coll, run_coll),
    )
    mocker.patch(
        "app.services.market_scoring.get_leads_for_org",
        return_value=[{"lead_id": "L1"}],
    )
    mocker.patch(
        "app.services.market_scoring.get_company_profile_for_org",
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
        "app.services.market_scoring.get_market_reports_for_org",
        return_value=all_five_reports,
    )
    mocker.patch(
        "app.services.market_scoring.score_single_lead_against_market",
        return_value={
            "component_scores": {},
            "component_descriptions": {},
            "market_total_score": 85,
        },
    )
    mocker.patch(
        "app.services.market_scoring._persist_market_score_for_lead",
    )

    _run_market_scoring_for_org(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, run_id="r1",
    )

    update_calls = run_coll.update_one.call_args_list
    completed_updates = [
        c for c in update_calls
        if c.args[1].get("$set", {}).get("status") == "completed"
    ]
    assert len(completed_updates) >= 1
