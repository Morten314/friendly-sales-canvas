"""Characterization tests for Lead CRUD + batch upload endpoints.

Endpoints:
  GET  /leads                   — list leads from Neo4j
  POST /leads                   — create lead in Neo4j
  PUT  /leads/{lead_id}         — update lead in Neo4j
  DELETE /leads/{lead_id}       — delete lead from Neo4j
  POST /leads/batch-upload      — CSV batch upload
  GET  /leads/by-file           — leads filtered by file_id

GET /leads and GET /leads/by-file use the module-level driver
(app.core.clients.driver). POST/PUT/DELETE /leads use the same driver.
POST /leads/batch-upload accesses Mongo via app.core.clients.client — patch
that symbol to inject the mock.
"""
import io
from contextlib import contextmanager
from unittest.mock import MagicMock, patch
import pytest

from tests.helpers import scrub_dynamic
from tests.identities import (
    TEST_USER_ID, TEST_ORG_ID, TEST_LEAD_ID_1, TEST_LEAD_ID_2, TEST_FILE_ID
)


@contextmanager
def _override_mongo(mongo_instance):
    """Phase F: leads router reads Mongo via Depends(get_mongo)."""
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

def _make_neo4j_lead(lead_id: str = TEST_LEAD_ID_1) -> dict:
    return {
        "lead_id": lead_id,
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "company_name": "ACME Corp",
        "lead_name": "Alice Smith",
        "stage": "Initial Outreach",
        "created_at": "2026-05-08T10:00:00",
    }


def _make_neo4j_record(lead_data: dict):
    """Wrap a lead dict into a Neo4j record mock."""
    node = MagicMock()
    node.items.return_value = list(lead_data.items())
    record = MagicMock()
    record.__getitem__ = MagicMock(return_value=node)
    return record


def _setup_neo4j_results(mock_neo4j, leads: list):
    """Wire Neo4j session.run to return an iterable of records."""
    records = [_make_neo4j_record(l) for l in leads]
    mock_neo4j["session"].run.return_value.__iter__ = MagicMock(return_value=iter(records))
    mock_neo4j["session"].run.return_value.single.return_value = records[0] if records else None


def _csv_upload_file(content: str = "company_name,lead_name\nACME,Alice\nBeta,Bob") -> io.BytesIO:
    return io.BytesIO(content.encode("utf-8"))


def _make_profiler_mc():
    """MongoClient mock for the batch-upload endpoint's Mongo access."""
    lead_stream_coll = MagicMock()
    lead_stream_coll.create_index.return_value = None
    lead_stream_coll.insert_one.return_value = MagicMock(inserted_id="test")
    lead_stream_coll.update_one.return_value = MagicMock(modified_count=1)

    profiler_db = MagicMock()
    profiler_db.__getitem__.return_value = lead_stream_coll

    mc = MagicMock()
    mc.__getitem__.return_value = profiler_db
    return mc


# ---------------------------------------------------------------------------
# Task 16-1: GET /leads returns list
# ---------------------------------------------------------------------------

def test_get_leads_returns_list(client, mock_neo4j):
    """GET /leads?org_id=... returns Neo4j results as a list."""
    leads = [_make_neo4j_lead(TEST_LEAD_ID_1), _make_neo4j_lead(TEST_LEAD_ID_2)]
    _setup_neo4j_results(mock_neo4j, leads)

    response = client.get(f"/leads?org_id={TEST_ORG_ID}")

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) == 2
    assert body[0]["lead_id"] == TEST_LEAD_ID_1


# ---------------------------------------------------------------------------
# Task 16-2: GET /leads empty when none
# ---------------------------------------------------------------------------

def test_get_leads_empty_when_none(client, mock_neo4j):
    """GET /leads with empty Neo4j result → empty list."""
    mock_neo4j["session"].run.return_value.__iter__ = MagicMock(return_value=iter([]))

    response = client.get(f"/leads?org_id={TEST_ORG_ID}")

    assert response.status_code == 200
    assert response.json() == []


# ---------------------------------------------------------------------------
# Task 16-3: POST /leads creates in Neo4j
# ---------------------------------------------------------------------------

def test_post_lead_creates_in_neo4j(client, mock_neo4j):
    """POST /leads calls Neo4j session.execute_write with lead data."""
    payload = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "data": {"company_name": "NewCo", "lead_name": "Bob Jones"},
    }

    response = client.post("/leads", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert "lead_id" in body
    mock_neo4j["session"].execute_write.assert_called_once()


# ---------------------------------------------------------------------------
# Task 16-4: POST /leads missing required fields → 422
# ---------------------------------------------------------------------------

def test_post_lead_missing_required_fields(client):
    """POST /leads without user_id → 422 Unprocessable Entity."""
    # LeadCreateRequest requires user_id, org_id, data
    payload = {"data": {"company_name": "NoUser"}}
    response = client.post("/leads", json=payload)
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Task 16-5: DELETE /leads/{lead_id} removes from Neo4j
# ---------------------------------------------------------------------------

def test_delete_lead_removes_from_neo4j(client, mock_neo4j):
    """DELETE /leads/{lead_id} calls Neo4j session.run (verify + delete)."""
    # First run (verify) returns the lead; second run (delete) is fire-and-forget
    lead = _make_neo4j_lead(TEST_LEAD_ID_1)
    record = _make_neo4j_record(lead)
    mock_neo4j["session"].run.return_value.single.return_value = record

    response = client.delete(
        f"/leads/{TEST_LEAD_ID_1}?user_id={TEST_USER_ID}&org_id={TEST_ORG_ID}"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["lead_id"] == TEST_LEAD_ID_1
    assert mock_neo4j["session"].run.call_count >= 1


# ---------------------------------------------------------------------------
# Task 16-6: DELETE /leads/{lead_id} 404 when not found
# ---------------------------------------------------------------------------

def test_delete_lead_404_when_not_found(client, mock_neo4j):
    """DELETE /leads/{lead_id} when lead not found → 404."""
    mock_neo4j["session"].run.return_value.single.return_value = None

    response = client.delete(
        f"/leads/nonexistent-lead?user_id={TEST_USER_ID}&org_id={TEST_ORG_ID}"
    )

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Task 16-7: PUT /leads/{lead_id} updates Neo4j
# ---------------------------------------------------------------------------

def test_put_lead_updates_neo4j(client, mock_neo4j):
    """PUT /leads/{lead_id} calls Neo4j with updated fields."""
    lead = _make_neo4j_lead(TEST_LEAD_ID_1)
    record = _make_neo4j_record(lead)
    mock_neo4j["session"].run.return_value.single.return_value = record

    payload = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "data": {"stage": "Discovery", "company_name": "ACME Updated"},
    }

    response = client.put(f"/leads/{TEST_LEAD_ID_1}", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["lead_id"] == TEST_LEAD_ID_1


# ---------------------------------------------------------------------------
# Task 16-8: POST /leads/batch-upload parses CSV file
# ---------------------------------------------------------------------------

def test_post_upload_csv_parses_file(client, mock_neo4j):
    """POST /leads/batch-upload with valid CSV → returns file_id and created_count."""
    csv_content = "company_name,lead_name\nACME,Alice\nBeta Corp,Bob\n"
    mc = _make_profiler_mc()

    with _override_mongo(mc):
        response = client.post(
            "/leads/batch-upload",
            data={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
            files={"file": ("leads.csv", _csv_upload_file(csv_content), "text/csv")},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert "file_id" in body
    assert body["total_rows"] == 2
    assert body["created_count"] == 2


# ---------------------------------------------------------------------------
# Task 16-9: POST /leads/batch-upload invalid format → 400
# ---------------------------------------------------------------------------

def test_post_upload_csv_invalid_format(client):
    """POST /leads/batch-upload with .txt file → 400."""
    response = client.post(
        "/leads/batch-upload",
        data={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
        files={"file": ("leads.txt", io.BytesIO(b"some text"), "text/plain")},
    )

    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Task 16-10: GET /leads/by-file returns filtered list
# ---------------------------------------------------------------------------

def test_get_leads_by_file_returns_filtered_list(client, mock_neo4j):
    """GET /leads/by-file?org_id=...&file_id=... returns leads for that file."""
    lead = {**_make_neo4j_lead(TEST_LEAD_ID_1), "file_id": TEST_FILE_ID}
    _setup_neo4j_results(mock_neo4j, [lead])

    response = client.get(f"/leads/by-file?org_id={TEST_ORG_ID}&file_id={TEST_FILE_ID}")

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) == 1
    assert body[0]["lead_id"] == TEST_LEAD_ID_1


# ---------------------------------------------------------------------------
# Task 16-11: GET /leads/by-file empty when no match
# ---------------------------------------------------------------------------

def test_get_leads_by_file_empty_when_no_match(client, mock_neo4j):
    """GET /leads/by-file with no matching leads → empty list."""
    mock_neo4j["session"].run.return_value.__iter__ = MagicMock(return_value=iter([]))

    response = client.get(f"/leads/by-file?org_id={TEST_ORG_ID}&file_id=no-such-file")

    assert response.status_code == 200
    assert response.json() == []


# ---------------------------------------------------------------------------
# Task 16-12: GET /leads requires org_id → 422
# ---------------------------------------------------------------------------

def test_get_leads_requires_org_id(client):
    """GET /leads without org_id → 422 (Query parameter required)."""
    response = client.get("/leads")
    assert response.status_code == 422
