# backend/tests/unit/test_org_auth.py
"""Unit tests for app/services/org_auth.py.

Covers:
  list_orgs              — happy path, missing users doc, missing user mapping
  create_org             — new doc, existing doc with org_name
  connect_user_to_org    — new doc, existing doc
  list_registrations     — happy path
  create_registration    — happy path
"""
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from app.core.exceptions import OrgNotFoundError, UsersDocumentNotFoundError
from app.models.org_auth import RegistrationRequest
from app.services.org_auth import (
    connect_user_to_org,
    create_org,
    create_registration,
    list_orgs,
    list_registrations,
)
from tests.identities import TEST_ORG_ID, TEST_USER_ID


# ---------------------------------------------------------------------------
# list_orgs
# ---------------------------------------------------------------------------

def test_list_orgs_happy_path(mock_mongo_client):
    users_coll = MagicMock()
    orgs_coll = MagicMock()
    users_coll.find_one.return_value = {
        "_id": "users",
        "user_mappings": {TEST_USER_ID: TEST_ORG_ID},
    }
    orgs_coll.find_one.return_value = {
        "_id": "orgs",
        "org_names": {TEST_ORG_ID: "Acme Logistics"},
    }
    mock_mongo_client["Org_Management"].__getitem__.side_effect = lambda k: (
        users_coll if k == "users" else orgs_coll
    )

    result = list_orgs(mock_mongo_client, TEST_USER_ID)

    assert result["status"] == "success"
    assert result["org_id"] == TEST_ORG_ID
    assert result["org_name"] == "Acme Logistics"


def test_list_orgs_raises_users_document_not_found(mock_mongo_client):
    users_coll = MagicMock()
    users_coll.find_one.return_value = None
    mock_mongo_client["Org_Management"].__getitem__.return_value = users_coll

    with pytest.raises(UsersDocumentNotFoundError, match="Users document not found"):
        list_orgs(mock_mongo_client, TEST_USER_ID)


def test_list_orgs_raises_org_not_found_for_unknown_user(mock_mongo_client):
    users_coll = MagicMock()
    orgs_coll = MagicMock()
    users_coll.find_one.return_value = {"_id": "users", "user_mappings": {}}
    mock_mongo_client["Org_Management"].__getitem__.side_effect = lambda k: (
        users_coll if k == "users" else orgs_coll
    )

    with pytest.raises(OrgNotFoundError, match="No org_id found for user_id"):
        list_orgs(mock_mongo_client, TEST_USER_ID)


# ---------------------------------------------------------------------------
# create_org
# ---------------------------------------------------------------------------

def test_create_org_creates_new_document_when_none_exists(mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Org_Management"].__getitem__.return_value = coll

    result = create_org(mock_mongo_client, {"org_name": "New Co"})

    assert result["status"] == "success"
    assert "org_id" in result
    assert result["org_name"] == "New Co"
    coll.insert_one.assert_called_once()
    inserted = coll.insert_one.call_args.args[0]
    assert inserted["org_names"][result["org_id"]] == "New Co"


def test_create_org_appends_to_existing_document(mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = {
        "_id": "orgs",
        "org_list": ["existing-org"],
        "org_names": {"existing-org": "Existing Co"},
    }
    mock_mongo_client["Org_Management"].__getitem__.return_value = coll

    result = create_org(mock_mongo_client, {"org_name": "New Co"})

    assert result["status"] == "success"
    coll.update_one.assert_called_once()
    update_doc = coll.update_one.call_args.args[1]["$set"]
    assert result["org_id"] in update_doc["org_list"]
    assert update_doc["org_names"][result["org_id"]] == "New Co"


def test_create_org_handles_missing_org_name(mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Org_Management"].__getitem__.return_value = coll

    result = create_org(mock_mongo_client, {})

    assert result["status"] == "success"
    assert "org_id" in result
    assert "org_name" not in result


# ---------------------------------------------------------------------------
# connect_user_to_org
# ---------------------------------------------------------------------------

def test_connect_user_to_org_creates_new_document(mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client["Org_Management"].__getitem__.return_value = coll

    result = connect_user_to_org(mock_mongo_client, TEST_USER_ID, TEST_ORG_ID)

    assert result["status"] == "success"
    assert result["user_id"] == TEST_USER_ID
    assert result["org_id"] == TEST_ORG_ID
    coll.insert_one.assert_called_once()


def test_connect_user_to_org_updates_existing_document(mock_mongo_client):
    coll = MagicMock()
    coll.find_one.return_value = {
        "_id": "users",
        "user_mappings": {"other_user": "other_org"},
    }
    mock_mongo_client["Org_Management"].__getitem__.return_value = coll

    result = connect_user_to_org(mock_mongo_client, TEST_USER_ID, TEST_ORG_ID)

    assert result["status"] == "success"
    coll.update_one.assert_called_once()
    update_doc = coll.update_one.call_args.args[1]["$set"]
    assert update_doc["user_mappings"][TEST_USER_ID] == TEST_ORG_ID
    assert update_doc["user_mappings"]["other_user"] == "other_org"  # preserved


# ---------------------------------------------------------------------------
# list_registrations + create_registration
# ---------------------------------------------------------------------------

def test_list_registrations_returns_sorted_results(mock_mongo_client):
    coll = MagicMock()
    coll.count_documents.return_value = 2
    coll.find.return_value.sort.return_value.skip.return_value.limit.return_value = [
        {
            "_id": "reg2",
            "name": "Jane",
            "email": "jane@example.com",
            "timestamp": datetime(2026, 5, 10, tzinfo=timezone.utc),
        },
        {
            "_id": "reg1",
            "name": "John",
            "email": "john@example.com",
            "timestamp": datetime(2026, 5, 9, tzinfo=timezone.utc),
        },
    ]
    mock_mongo_client["Registration_DB"].__getitem__.return_value = coll

    result, total = list_registrations(mock_mongo_client)

    assert len(result) == 2
    assert total == 2
    assert result[0].name == "Jane"
    assert result[1].name == "John"


def test_create_registration_inserts_and_returns_response(mock_mongo_client):
    coll = MagicMock()
    coll.insert_one.return_value.inserted_id = "new_reg_id"
    mock_mongo_client["Registration_DB"].__getitem__.return_value = coll

    req = RegistrationRequest(name="Alice", email="alice@example.com")
    result = create_registration(mock_mongo_client, req)

    assert result.id == "new_reg_id"
    assert result.name == "Alice"
    assert result.email == "alice@example.com"
    assert result.timestamp is not None
    coll.insert_one.assert_called_once()
