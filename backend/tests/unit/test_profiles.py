# backend/tests/unit/test_profiles.py
"""Unit tests for app/services/profiles.py.

Covers:
  upsert_profile             — company profile (org_id required), user profile, missing user_id
  get_profile                — company profile via Neo4j+Mongo, user profile, missing org_id
  cleanup_company_profiles   — zero, one, multiple duplicates
  edit_profile_field         — modification, comment, invalid edit_type
"""
from unittest.mock import MagicMock

import pytest

from app.core.exceptions import (
    CompanyProfileNotFoundError,
    ProfileNotFoundError,
    ProfileValidationError,
)
from app.models.profiles import EditRequest
from app.services.profiles import (
    cleanup_company_profiles,
    edit_profile_field,
    get_profile,
    upsert_profile,
)
from tests.identities import TEST_ORG_ID, TEST_USER_ID


# ---------------------------------------------------------------------------
# upsert_profile
# ---------------------------------------------------------------------------

def test_upsert_profile_company_requires_org_id(mock_session):
    with pytest.raises(ProfileValidationError, match="org_id is required for company"):
        upsert_profile("company", {"name": "Acme"})


def test_upsert_profile_user_requires_user_id(mock_session):
    with pytest.raises(ProfileValidationError, match="user_id is required"):
        upsert_profile("user", {"name": "Alice"})


def test_upsert_profile_company_happy_path(mock_session):
    payload = {"org_id": TEST_ORG_ID, "name": "Acme", "industry": "SaaS"}
    result = upsert_profile("company", payload)

    assert result == {"message": "company profile processed successfully"}
    # Verify the DELETE for the existing org-scoped CompanyProfile ran first
    delete_call = mock_session.run.call_args_list[0]
    assert "DELETE" in delete_call.args[0]
    assert delete_call.kwargs == {"org_id": TEST_ORG_ID}


# ---------------------------------------------------------------------------
# get_profile
# ---------------------------------------------------------------------------

def test_get_profile_company_requires_org_id(mock_session):
    with pytest.raises(ProfileValidationError, match="org_id is required for company"):
        get_profile("company", user_id=None, org_id=None)


def test_get_profile_user_raises_profile_not_found(mock_session):
    mock_session.run.return_value.single.return_value = None

    with pytest.raises(ProfileNotFoundError, match="No user profile found"):
        get_profile("user", user_id=TEST_USER_ID, org_id=None)


def test_get_profile_company_raises_when_missing(mock_session, mock_mongo_client):
    mock_session.run.return_value.single.return_value = None

    with pytest.raises(CompanyProfileNotFoundError, match="No company profile found"):
        get_profile("company", user_id=None, org_id=TEST_ORG_ID)


# ---------------------------------------------------------------------------
# cleanup_company_profiles
# ---------------------------------------------------------------------------

def test_cleanup_returns_no_profiles_found_when_empty(mock_session):
    # list() is called on the return value of session.run(); configure __iter__
    mock_session.run.return_value.__iter__ = lambda self: iter([])

    result = cleanup_company_profiles()

    assert result["deleted"] == 0
    assert result["remaining"] == 0


def test_cleanup_returns_no_op_when_only_one_profile(mock_session):
    rec = MagicMock()
    rec.__getitem__.side_effect = lambda k: 42 if k == "node_id" else MagicMock()
    mock_session.run.return_value.__iter__ = lambda self: iter([rec])

    result = cleanup_company_profiles()

    assert result["deleted"] == 0
    assert result["remaining"] == 1


def test_cleanup_deletes_duplicates(mock_session):
    rec1, rec2, rec3 = MagicMock(), MagicMock(), MagicMock()
    rec1.__getitem__.side_effect = lambda k: 1 if k == "node_id" else MagicMock()
    rec2.__getitem__.side_effect = lambda k: 2 if k == "node_id" else MagicMock()
    rec3.__getitem__.side_effect = lambda k: 3 if k == "node_id" else MagicMock()
    # First call returns the list of profiles; second returns the delete count.
    first_run = MagicMock()
    first_run.__iter__ = lambda self: iter([rec1, rec2, rec3])
    delete_result = MagicMock()
    delete_result.single.return_value = {"deleted": 2}
    mock_session.run.side_effect = [first_run, delete_result]

    result = cleanup_company_profiles()

    assert result["deleted"] == 2
    assert result["remaining"] == 1


# ---------------------------------------------------------------------------
# edit_profile_field
# ---------------------------------------------------------------------------

def test_edit_profile_modification_inserts_into_mongo(mock_mongo_client):
    coll = MagicMock()
    coll.insert_one.return_value.inserted_id = "abc123"
    mock_mongo_client["Scout_Agent"].__getitem__.return_value = coll

    req = EditRequest(
        user_id=TEST_USER_ID,
        edit_type="modification",
        original_json={},
        modified_json={"name": "Acme v2"},
    )
    result = edit_profile_field(req)

    assert result["status"] == "success"
    assert result["inserted_id"] == "abc123"
    inserted = coll.insert_one.call_args.args[0]
    assert inserted["user_id"] == TEST_USER_ID
    assert inserted["name"] == "Acme v2"


def test_edit_profile_comment_returns_coming_soon(mock_mongo_client):
    req = EditRequest(user_id=TEST_USER_ID, edit_type="comment", original_json={}, modified_json={})
    result = edit_profile_field(req)
    assert result == {"status": "feature coming soon"}


def test_edit_profile_invalid_type_returns_error(mock_mongo_client):
    req = EditRequest(user_id=TEST_USER_ID, edit_type="bogus", original_json={}, modified_json={})
    result = edit_profile_field(req)
    assert "Invalid edit_type" in result["error"]
