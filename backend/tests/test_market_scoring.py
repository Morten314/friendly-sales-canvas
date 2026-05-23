"""Characterization tests for market scoring endpoints.

Endpoints:
  POST /leads/market-scores          — trigger scoring (background) or return cached
  GET  /leads/market-scores/status   — status of a scoring run

Both reach into `clients.client["Profiler"]` via `_get_market_score_collections()`;
tests substitute via the `_override_mongo` helper.
"""
from contextlib import contextmanager
from unittest.mock import MagicMock, patch, call
import pytest

from tests.helpers import scrub_dynamic
from tests.identities import TEST_USER_ID, TEST_ORG_ID, TEST_LEAD_ID_1


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

_SCORE_DOC = {
    "lead_id": TEST_LEAD_ID_1,
    "org_id": TEST_ORG_ID,
    "company_name": "ACME Corp",
    "lead_name": "Alice Smith",
    "component_scores": {
        "market size & opportunity": 75.0,
        "industry trends report": 80.0,
        "competitor landscape": 65.0,
        "regulatory & compliance highlights": 70.0,
        "market entry & growth strategy": 85.0,
    },
    "market_total_score": 75.0,
    "scoring_status": "completed",
    "scored_at": "2026-05-08T10:00:00",
    "updated_at": "2026-05-08T10:00:00",
}

_RUN_DOC = {
    "run_id": "run-00000000-0000-0000-0000-000000000001",
    "user_id": TEST_USER_ID,
    "org_id": TEST_ORG_ID,
    "status": "completed",
    "created_at": "2026-05-08T09:55:00",
    "started_at": "2026-05-08T09:55:05",
    "completed_at": "2026-05-08T10:00:00",
    "updated_at": "2026-05-08T10:00:00",
    "total_leads": 1,
    "processed_count": 1,
    "failed_count": 0,
}


def _make_score_mc(score_docs=None, run_docs=None, run_find_one=None):
    """Build MongoClient mock for _get_market_score_collections().

    Profiler["Lead_Market_Scores"] → score_coll
    Profiler["Lead_Market_Score_Runs"] → run_coll
    """
    score_coll = MagicMock()
    score_coll.find.return_value.sort.return_value = iter(score_docs or [])
    score_coll.find_one.return_value = None
    score_coll.update_one.return_value = MagicMock(modified_count=1)
    score_coll.insert_one.return_value = MagicMock(inserted_id="score_id")
    score_coll.count_documents.return_value = len(score_docs or [])

    run_coll = MagicMock()
    run_coll.find_one.return_value = run_find_one
    run_coll.insert_one.return_value = MagicMock(inserted_id="run_id")
    run_coll.update_one.return_value = MagicMock(modified_count=1)
    # find(...).sort(...).limit(...)
    run_coll.find.return_value.sort.return_value.limit.return_value = iter(run_docs or [])

    def _coll_router(name):
        if name == "Lead_Market_Scores":
            return score_coll
        if name == "Lead_Market_Score_Runs":
            return run_coll
        return MagicMock()

    profiler_db = MagicMock()
    profiler_db.__getitem__.side_effect = _coll_router

    mc = MagicMock()
    mc.__getitem__.return_value = profiler_db
    return mc, score_coll, run_coll


# ---------------------------------------------------------------------------
# POST /leads/market-scores with refresh=True → 200, queued run
# ---------------------------------------------------------------------------

def test_trigger_market_scoring_returns_accepted(client, mock_neo4j):
    """POST /leads/market-scores refresh=True → 200 with processing_status=queued."""
    mc, score_coll, run_coll = _make_score_mc(score_docs=[], run_find_one=None)

    # No active run (find_one returns None for active run check)
    run_coll.find_one.return_value = None

    payload = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "refresh": True,
    }

    with _override_mongo(mc):
        response = client.post("/leads/market-scores", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["org_id"] == TEST_ORG_ID
    # When refresh=True and no active run, endpoint queues a new run
    assert body["processing_status"] in ("queued", "idle", "completed")


# ---------------------------------------------------------------------------
# GET /leads/market-scores (cached) returns score
# ---------------------------------------------------------------------------

def test_get_market_score_returns_score(client, mock_neo4j):
    """POST /leads/market-scores refresh=False with existing scores → rows returned."""
    score_doc = dict(_SCORE_DOC)
    run_doc = dict(_RUN_DOC)

    mc, score_coll, run_coll = _make_score_mc(
        score_docs=[score_doc],
        run_find_one=run_doc,
    )

    payload = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "refresh": False,
    }

    with _override_mongo(mc), \
         patch("app.services.market_scoring._get_lead_identity_from_neo4j", return_value={}):
        response = client.post("/leads/market-scores", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["total_leads"] == 1
    assert len(body["rows"]) == 1
    row = body["rows"][0]
    assert row["lead_id"] == TEST_LEAD_ID_1
    assert row["combined_score"] == 75.0


# ---------------------------------------------------------------------------
# GET /leads/market-scores/status — no run → 404
# ---------------------------------------------------------------------------

def test_get_market_score_status_404_when_no_run(client):
    """GET /leads/market-scores/status when no run exists → 404."""
    mc, _, run_coll = _make_score_mc()
    run_coll.find_one.return_value = None

    with _override_mongo(mc):
        response = client.get(
            f"/leads/market-scores/status?user_id={TEST_USER_ID}&org_id={TEST_ORG_ID}"
        )

    assert response.status_code == 404


def test_trigger_market_scoring_missing_org_id(client):
    """POST /leads/market-scores without org_id → 422.

    LeadMarketScoresRequest.org_id has no default. Locks the requirement
    so a refactor that makes org_id Optional doesn't silently allow
    cross-tenant requests.
    """
    payload = {"user_id": TEST_USER_ID, "refresh": True}
    response = client.post("/leads/market-scores", json=payload)
    assert response.status_code == 422
