# backend/tests/unit/test_leads.py
"""Unit tests for app/services/leads.py.

Covers all 8 public functions, the LeadNotFoundError and LeadCSVValidationError
typed-exception sites, and the post-Task-14 error-propagation behavior.
"""
from unittest.mock import MagicMock

import pytest

from app.core.exceptions import LeadCSVValidationError, LeadNotFoundError
from app.models.leads import LeadCreateRequest, LeadUpdateRequest
from app.services.leads import (
    batch_upload_leads,
    create_lead,
    delete_lead,
    delete_leads_by_file,
    get_leads_for_org,
    get_stream_status,
    list_leads_by_file,
    update_lead,
)
from tests.identities import TEST_FILE_ID, TEST_LEAD_ID_1, TEST_ORG_ID, TEST_USER_ID


# ---------------------------------------------------------------------------
# get_leads_for_org
# ---------------------------------------------------------------------------

def test_get_leads_for_org_returns_list(mock_session):
    record = MagicMock()
    node = MagicMock()
    node.items.return_value = [("lead_id", "L1"), ("name", "Acme")]
    record.__getitem__.return_value = node
    count_mock = MagicMock()
    count_mock.single.return_value = {"total": 1}
    mock_session.run.side_effect = [iter([record]), count_mock]

    result, total = get_leads_for_org(mock_session._driver, org_id=TEST_ORG_ID)

    assert len(result) == 1
    assert result[0]["lead_id"] == "L1"
    assert total == 1


def test_get_leads_for_org_applies_limit_and_order(mock_session):
    count_mock = MagicMock()
    count_mock.single.return_value = {"total": 0}
    mock_session.run.side_effect = [iter([]), count_mock]

    get_leads_for_org(mock_session._driver, org_id=TEST_ORG_ID, limit=5, offset=2)

    query = mock_session.run.call_args_list[0].args[0]
    assert "LIMIT $limit" in query
    assert "ORDER BY l.created_at DESC" in query
    assert mock_session.run.call_args_list[0].kwargs["limit"] == 5
    assert mock_session.run.call_args_list[0].kwargs["offset"] == 2


def test_get_leads_for_org_propagates_neo4j_error(mock_session):
    """Post-Task-14: get_leads_for_org no longer has raise_on_error;
    storage errors propagate to the caller. Callers (e.g.
    _run_market_scoring_for_org) wrap with except BrewraError."""
    mock_session.run.side_effect = RuntimeError("Neo4j connection refused")

    with pytest.raises(RuntimeError, match="connection refused"):
        get_leads_for_org(mock_session._driver, org_id=TEST_ORG_ID, limit=10)


# ---------------------------------------------------------------------------
# create_lead
# ---------------------------------------------------------------------------

def test_create_lead_happy_path(mock_session):
    request = LeadCreateRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        data={"company_name": "Acme Co", "stage": "Initial Outreach"},
    )
    result = create_lead(mock_session._driver, request)

    assert result["status"] == "success"
    assert "lead_id" in result
    mock_session.execute_write.assert_called_once()


def test_create_lead_sets_default_stage_when_missing(mock_session):
    request = LeadCreateRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        data={"company_name": "Acme Co"},
    )
    create_lead(mock_session._driver, request)
    # The execute_write call gets the data dict as its 4th positional arg
    call_data = mock_session.execute_write.call_args.args[4]
    assert call_data["stage"] == "Initial Outreach"


# ---------------------------------------------------------------------------
# update_lead
# ---------------------------------------------------------------------------

def test_update_lead_raises_when_lead_missing(mock_session):
    mock_session.run.return_value.single.return_value = None

    request = LeadUpdateRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, data={"stage": "Qualified"},
    )
    with pytest.raises(LeadNotFoundError, match="Lead not found"):
        update_lead(mock_session._driver, TEST_LEAD_ID_1, request)


def test_update_lead_happy_path(mock_session):
    mock_session.run.return_value.single.return_value = MagicMock()  # exists

    request = LeadUpdateRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, data={"stage": "Qualified"},
    )
    result = update_lead(mock_session._driver, TEST_LEAD_ID_1, request)

    assert result["status"] == "success"
    mock_session.execute_write.assert_called_once()


# ---------------------------------------------------------------------------
# delete_lead
# ---------------------------------------------------------------------------

def test_delete_lead_raises_when_lead_missing(mock_session):
    mock_session.run.return_value.single.return_value = None

    with pytest.raises(LeadNotFoundError):
        delete_lead(mock_session._driver, TEST_LEAD_ID_1, TEST_USER_ID, TEST_ORG_ID)


def test_delete_lead_happy_path(mock_session):
    mock_session.run.return_value.single.return_value = MagicMock()

    result = delete_lead(mock_session._driver, TEST_LEAD_ID_1, TEST_USER_ID, TEST_ORG_ID)

    assert result["status"] == "success"


# ---------------------------------------------------------------------------
# batch_upload_leads
# ---------------------------------------------------------------------------

def test_batch_upload_leads_raises_on_empty_csv(
    mock_session, mock_mongo_client,
):
    coll = MagicMock()
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    empty_csv = b"col1,col2\n"  # header only

    with pytest.raises(LeadCSVValidationError, match="CSV file is empty"):
        batch_upload_leads(mock_session._driver, mock_mongo_client, empty_csv, "empty.csv", TEST_USER_ID, TEST_ORG_ID)


def test_batch_upload_leads_raises_on_corrupt_binary(
    mock_session, mock_mongo_client,
):
    coll = MagicMock()
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    # Null bytes: latin-1 decodes them but pandas produces a zero-row DataFrame
    # (no newlines → no rows), which hits the "CSV file is empty" validation
    # branch.  The intent: any non-CSV binary payload raises LeadCSVValidationError.
    bad_bytes = b"\x00" * 50

    with pytest.raises(LeadCSVValidationError):
        batch_upload_leads(mock_session._driver, mock_mongo_client, bad_bytes, "bad.csv", TEST_USER_ID, TEST_ORG_ID)


def test_batch_upload_leads_happy_path(mock_session, mock_mongo_client):
    coll = MagicMock()
    mock_mongo_client["Profiler"].__getitem__.return_value = coll
    csv_bytes = b"company_name,stage\nAcme,Initial\nBeta Corp,Qualified\n"

    result = batch_upload_leads(mock_session._driver, mock_mongo_client, csv_bytes, "leads.csv", TEST_USER_ID, TEST_ORG_ID)

    assert result["status"] == "success"
    assert result["created_count"] == 2
    assert result["error_count"] == 0


# ---------------------------------------------------------------------------
# list_leads_by_file / get_stream_status / delete_leads_by_file
# ---------------------------------------------------------------------------

def test_list_leads_by_file_returns_records(mock_session):
    record = MagicMock()
    node = MagicMock()
    node.items.return_value = [("lead_id", "L1"), ("file_id", TEST_FILE_ID)]
    record.__getitem__.return_value = node
    count_mock = MagicMock()
    count_mock.single.return_value = {"total": 1}
    mock_session.run.side_effect = [iter([record]), count_mock]

    result, total = list_leads_by_file(mock_session._driver, TEST_ORG_ID, TEST_FILE_ID)

    assert len(result) == 1
    assert result[0]["file_id"] == TEST_FILE_ID
    assert total == 1


def test_get_stream_status_returns_files_list(mock_mongo_client):
    coll = MagicMock()
    coll.find.return_value.sort.return_value = [
        {
            "file_id": TEST_FILE_ID, "filename": "leads.csv",
            "uploaded_at": "2026-05-08T10:00:00Z",
            "total_rows": 100, "created_count": 95, "error_count": 5,
            "processing_status": "completed",
        },
    ]
    mock_mongo_client["Profiler"].__getitem__.return_value = coll

    result = get_stream_status(mock_mongo_client, TEST_ORG_ID)

    assert len(result["files"]) == 1
    assert result["files"][0]["file_id"] == TEST_FILE_ID


def test_delete_leads_by_file_raises_when_no_leads_match(
    mock_session, mock_mongo_client,
):
    count_record = MagicMock()
    count_record.__getitem__.return_value = 0
    mock_session.run.return_value.single.return_value = count_record

    with pytest.raises(LeadNotFoundError, match="No leads found"):
        delete_leads_by_file(mock_session._driver, mock_mongo_client, TEST_FILE_ID, TEST_USER_ID, TEST_ORG_ID)


def test_delete_leads_by_file_happy_path(mock_session, mock_mongo_client):
    count_record = MagicMock()
    count_record.__getitem__.return_value = 3
    mock_session.run.return_value.single.return_value = count_record
    coll = MagicMock()
    mock_mongo_client["Profiler"].__getitem__.return_value = coll

    result = delete_leads_by_file(mock_session._driver, mock_mongo_client, TEST_FILE_ID, TEST_USER_ID, TEST_ORG_ID)

    assert result["status"] == "success"
    assert result["deleted_count"] == 3


# ---------------------------------------------------------------------------
# get_leads_for_org — new paginated signature (Task 7)
# ---------------------------------------------------------------------------

def test_get_leads_for_org_returns_items_and_total():
    session = MagicMock()
    driver = MagicMock()
    driver.session.return_value.__enter__.return_value = session
    session.run.side_effect = [
        [{"l": {"name": "Lead A"}}, {"l": {"name": "Lead B"}}],
        MagicMock(single=lambda: {"total": 7}),
    ]
    items, total = get_leads_for_org(driver, "org_1", limit=10, offset=0)
    assert len(items) == 2
    assert total == 7


def test_get_leads_for_org_default_limit_is_500():
    session = MagicMock()
    driver = MagicMock()
    driver.session.return_value.__enter__.return_value = session
    session.run.side_effect = [[], MagicMock(single=lambda: {"total": 0})]
    get_leads_for_org(driver, "org_1")
    first_call_kwargs = session.run.call_args_list[0].kwargs
    assert first_call_kwargs["limit"] == 500
    assert first_call_kwargs["offset"] == 0


# ---------------------------------------------------------------------------
# create_lead — source field stamping (Phase 36 Task 1)
# ---------------------------------------------------------------------------

def test_create_lead_stamps_source_manual_when_absent(mock_session):
    request = LeadCreateRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID, data={"company_name": "Acme Co"}
    )
    create_lead(mock_session._driver, request)
    # execute_write(upsert_node, "Lead", "lead_id", lead_id, lead_data) → args[4] is lead_data
    call_data = mock_session.execute_write.call_args.args[4]
    assert call_data["source"] == "manual"


def test_create_lead_respects_explicit_source(mock_session):
    request = LeadCreateRequest(
        user_id=TEST_USER_ID, org_id=TEST_ORG_ID,
        data={"company_name": "Acme Co", "source": "apollo"},
    )
    create_lead(mock_session._driver, request)
    call_data = mock_session.execute_write.call_args.args[4]
    assert call_data["source"] == "apollo"
