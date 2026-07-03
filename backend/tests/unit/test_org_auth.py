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

from app.core.exceptions import (
    ConflictError,
    OrgNotFoundError,
    UsersDocumentNotFoundError,
    ValidationError,
)
from app.models.org_auth import RegistrationRequest
from app.services.org_auth import (
    connect_user_to_org,
    create_org,
    create_registration,
    list_orgs,
    list_registrations,
)
from tests.identities import TEST_ORG_ID, TEST_USER_ID

# A syntactically valid org_id (UUID) present in the org_list. The shared
# TEST_ORG_ID ("test_org_abc") is intentionally NOT used for connect tests:
# under the bijective 1:1 invariant a valid org_id must be a UUID in
# Org_Management.orgs.org_list, and TEST_ORG_ID is uid-shaped/malformed.
VALID_ORG = "b75ce29e-344c-4e6c-964e-5ac236d0b49a"


def _mongo_with(users_map, org_list):
    """Return a fake mongo whose Org_Management.users/.orgs docs reflect args.

    Mirrors the in-memory fake-mongo double (`_FakeMongoClient`) defined in
    tests/unit/conftest.py so that ``find_one({"_id": "users"})`` returns
    ``{"user_mappings": users_map}``, ``find_one({"_id": "orgs"})`` returns
    ``{"org_list": org_list}``, and ``update_one``/``insert_one`` mutate the
    in-memory store like the real service code expects.
    """
    from tests.unit.conftest import _FakeMongoClient

    mongo = _FakeMongoClient()
    db = mongo["Org_Management"]
    db["users"].insert_one({"_id": "users", "user_mappings": dict(users_map)})
    db["orgs"].insert_one({"_id": "orgs", "org_list": list(org_list)})
    return mongo


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
    users_coll = MagicMock()
    orgs_coll = MagicMock()
    users_coll.find_one.return_value = None
    orgs_coll.find_one.return_value = {"_id": "orgs", "org_list": [VALID_ORG]}
    mock_mongo_client["Org_Management"].__getitem__.side_effect = lambda k: (
        users_coll if k == "users" else orgs_coll
    )

    result = connect_user_to_org(mock_mongo_client, TEST_USER_ID, VALID_ORG)

    assert result["status"] == "success"
    assert result["user_id"] == TEST_USER_ID
    assert result["org_id"] == VALID_ORG
    users_coll.insert_one.assert_called_once()


def test_connect_user_to_org_updates_existing_document(mock_mongo_client):
    users_coll = MagicMock()
    orgs_coll = MagicMock()
    users_coll.find_one.return_value = {
        "_id": "users",
        "user_mappings": {"other_user": "other_org"},
    }
    orgs_coll.find_one.return_value = {"_id": "orgs", "org_list": [VALID_ORG]}
    mock_mongo_client["Org_Management"].__getitem__.side_effect = lambda k: (
        users_coll if k == "users" else orgs_coll
    )

    result = connect_user_to_org(mock_mongo_client, TEST_USER_ID, VALID_ORG)

    assert result["status"] == "success"
    users_coll.update_one.assert_called_once()
    update_doc = users_coll.update_one.call_args.args[1]["$set"]
    assert update_doc["user_mappings"][TEST_USER_ID] == VALID_ORG
    assert update_doc["user_mappings"]["other_user"] == "other_org"  # preserved


# ---------------------------------------------------------------------------
# connect_user_to_org — WS4 bijective 1:1 invariant
# ---------------------------------------------------------------------------

def test_connect_new_user_to_valid_org_succeeds():
    mongo = _mongo_with({}, [VALID_ORG])
    out = connect_user_to_org(mongo, "newuid", VALID_ORG)
    assert out["org_id"] == VALID_ORG


def test_connect_rejects_non_uuid_org():
    mongo = _mongo_with({}, [VALID_ORG])
    with pytest.raises(ValidationError):
        connect_user_to_org(mongo, "newuid", "A5BfxUidAsOrg")


def test_connect_rejects_org_not_in_org_list():
    mongo = _mongo_with({}, [VALID_ORG])
    with pytest.raises(ValidationError):
        connect_user_to_org(mongo, "newuid", "11111111-1111-1111-1111-111111111111")


def test_connect_rejects_org_owned_by_another_user():
    mongo = _mongo_with({"other": VALID_ORG}, [VALID_ORG])
    with pytest.raises(ConflictError):
        connect_user_to_org(mongo, "newuid", VALID_ORG)


def test_connect_rejects_silent_rekey_without_migrate():
    other = "22222222-2222-2222-2222-222222222222"
    mongo = _mongo_with({"u1": VALID_ORG}, [VALID_ORG, other])
    with pytest.raises(ConflictError):
        connect_user_to_org(mongo, "u1", other)  # already mapped elsewhere


def test_connect_allows_rekey_with_migrate():
    other = "22222222-2222-2222-2222-222222222222"
    mongo = _mongo_with({"u1": VALID_ORG}, [VALID_ORG, other])
    out = connect_user_to_org(mongo, "u1", other, migrate=True)
    assert out["org_id"] == other


def test_connect_idempotent_same_mapping():
    mongo = _mongo_with({"u1": VALID_ORG}, [VALID_ORG])
    out = connect_user_to_org(mongo, "u1", VALID_ORG)  # unchanged
    assert out["org_id"] == VALID_ORG


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
