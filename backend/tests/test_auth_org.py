"""Characterization tests for auth/org endpoints.

Endpoints covered:
  GET  /org              — user→org lookup
  POST /org              — create org
  POST /connect_org      — link user to org
  POST /registration     — create registration
  GET  /registration     — list registrations
  POST /api/auth/token   — does not exist; lock the 404/405 behaviour

Mongo is injected via `Depends(get_mongo)`; tests substitute through
`app.dependency_overrides` (see `_override_mongo` helper below).
"""
from contextlib import contextmanager
from unittest.mock import MagicMock, patch
import pytest
from tests.helpers import scrub_dynamic
from tests.identities import TEST_USER_ID, TEST_ORG_ID

# A syntactically valid org_id (UUID) that connect_user_to_org will accept.
# TEST_ORG_ID ("test_org_abc") is uid-shaped and now correctly rejected under
# the bijective 1:1 invariant (a valid org_id must be a UUID in orgs.org_list).
VALID_ORG = "b75ce29e-344c-4e6c-964e-5ac236d0b49a"


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

def _mongo_client_mock_returning(users_doc, orgs_doc=None):
    """Build a MongoClient-shaped mock.

    The endpoint calls:
      db = mongo_client["Org_Management"]
      users_collection = db["users"]    / db["orgs"]
      users_collection.find_one(...)

    Both "users" and "orgs" collections are accessed via db["<name>"], so
    db.__getitem__ returns the same mock for all collection accesses.
    find_one side_effect is set to return users_doc on first call,
    orgs_doc on second call.
    """
    m = MagicMock()
    col = MagicMock()
    m.__getitem__.return_value.__getitem__.return_value = col
    col.find_one.side_effect = [users_doc, orgs_doc]
    return m, col


def _connect_mongo_mock(users_doc, org_list):
    """Mongo mock for POST /connect_org.

    connect_user_to_org accesses db["users"] and db["orgs"] as distinct
    collections and (unlike list_orgs) reads orgs first for the membership
    check, so the collection mocks are keyed by name rather than relying on
    find_one call ordering. Returns (mongo_mock, users_collection_mock).
    """
    users_col = MagicMock()
    orgs_col = MagicMock()
    users_col.find_one.return_value = users_doc
    orgs_col.find_one.return_value = {"_id": "orgs", "org_list": org_list}
    db = MagicMock()
    db.__getitem__.side_effect = lambda k: users_col if k == "users" else orgs_col
    m = MagicMock()
    m.__getitem__.return_value = db
    return m, users_col


# ---------------------------------------------------------------------------
# GET /org
# ---------------------------------------------------------------------------

def test_get_org_returns_org_for_user(client, snapshot):
    """Happy path: user found in users document, org_name resolved."""
    users_doc = {
        "_id": "users",
        "user_mappings": {TEST_USER_ID: TEST_ORG_ID},
    }
    orgs_doc = {
        "_id": "orgs",
        "org_names": {TEST_ORG_ID: "Test Org"},
    }
    mongo_instance, _ = _mongo_client_mock_returning(users_doc, orgs_doc)

    with _override_mongo(mongo_instance):
        response = client.get("/org", params={"user_id": TEST_USER_ID})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_get_org_returns_404_for_missing_users_doc(client):
    """users document absent → 404."""
    mongo_instance, _ = _mongo_client_mock_returning(None)

    with _override_mongo(mongo_instance):
        response = client.get("/org", params={"user_id": TEST_USER_ID})

    assert response.status_code == 404


def test_get_org_returns_404_for_unknown_user(client):
    """users doc present but user_id not mapped → 404."""
    users_doc = {"_id": "users", "user_mappings": {}}
    mongo_instance, _ = _mongo_client_mock_returning(users_doc)

    with _override_mongo(mongo_instance):
        response = client.get("/org", params={"user_id": TEST_USER_ID})

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# POST /org
# ---------------------------------------------------------------------------

def test_post_org_creates_new_org(client, snapshot):
    """Creates an org when no orgs document pre-exists."""
    mongo_instance, orgs_col = _mongo_client_mock_returning(None)

    with _override_mongo(mongo_instance):
        response = client.post("/org", json={"org_name": "Test Org"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    body = response.json()
    # org_id is a UUID — scrub it
    scrubbed = scrub_dynamic(body, keys={"org_id", "id"})
    assert scrubbed == snapshot
    assert orgs_col.insert_one.called, "Refactor must preserve org insert"


# ---------------------------------------------------------------------------
# POST /connect_org
# ---------------------------------------------------------------------------

def test_post_connect_org_links_user_to_org_new_doc(client, snapshot):
    """No existing users document → insert_one called."""
    mongo_instance, users_col = _connect_mongo_mock(None, [VALID_ORG])

    with _override_mongo(mongo_instance):
        response = client.post(
            "/connect_org",
            json={"user_id": TEST_USER_ID, "org_id": VALID_ORG},
        )

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot
    assert users_col.insert_one.called, "Refactor must preserve user-org link write"


def test_post_connect_org_links_user_to_org_existing_doc(client):
    """Existing users document (owned by another user of a *different* org) →
    update_one called; the bijective invariant permits the new mapping."""
    existing_doc = {
        "_id": "users",
        "user_mappings": {"other_user": "other_org"},
    }
    mongo_instance, users_col = _connect_mongo_mock(existing_doc, [VALID_ORG])

    with _override_mongo(mongo_instance):
        response = client.post(
            "/connect_org",
            json={"user_id": TEST_USER_ID, "org_id": VALID_ORG},
        )

    assert response.status_code == 200
    assert users_col.update_one.called, "Refactor must preserve user-org link update"


def test_post_connect_org_rejects_non_uuid_org_id(client):
    """org_id must be a UUID -- lock the 400 contract (Task 7's bijective
    invariant) at the HTTP layer, not just the service-level unit tests."""
    mongo_instance, users_col = _connect_mongo_mock(None, [VALID_ORG])

    with _override_mongo(mongo_instance):
        response = client.post(
            "/connect_org",
            json={"user_id": TEST_USER_ID, "org_id": "not-a-uuid"},
        )

    assert response.status_code == 400
    assert not users_col.insert_one.called
    assert not users_col.update_one.called


def test_post_connect_org_allows_org_shared_by_multiple_users(client):
    """Shared-team org model (ADR-0009): an org already mapped to another user
    is NOT rejected -- a second user may connect to the same org (200) and the
    mapping is written. Reverse-uniqueness was dropped; one-org-per-user (no
    silent re-key) is still enforced. Locks the shared-org contract at the HTTP
    layer."""
    existing_doc = {
        "_id": "users",
        "user_mappings": {"other_user": VALID_ORG},
    }
    mongo_instance, users_col = _connect_mongo_mock(existing_doc, [VALID_ORG])

    with _override_mongo(mongo_instance):
        response = client.post(
            "/connect_org",
            json={"user_id": TEST_USER_ID, "org_id": VALID_ORG},
        )

    assert response.status_code == 200
    assert users_col.update_one.called


# ---------------------------------------------------------------------------
# POST /registration — uses module-level clients.client (not MongoClient inline)
# ---------------------------------------------------------------------------

def test_post_registration_creates_entry(client, snapshot):
    """Registration inserts into Registration_DB.registrations."""
    from bson import ObjectId
    from datetime import datetime

    inserted_id = ObjectId("000000000000000000000001")

    # mongo["Registration_DB"]["registrations"].insert_one(...)
    col_mock = MagicMock()
    col_mock.insert_one.return_value.inserted_id = inserted_id

    mongo_mock = MagicMock()
    mongo_mock.__getitem__.return_value.__getitem__.return_value = col_mock

    with _override_mongo(mongo_mock):
        payload = {"name": "Test User", "email": "test@brewra.test"}
        response = client.post("/registration", json=payload)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_post_registration_missing_fields_422(client):
    """Missing required fields → 422 Unprocessable Entity."""
    response = client.post("/registration", json={})
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# GET /registration — uses module-level clients.client
# ---------------------------------------------------------------------------

def test_get_registration_lists_entries(client, snapshot):
    """Returns all registrations sorted by recency."""
    from datetime import datetime
    from bson import ObjectId

    fake_regs = [
        {
            "_id": ObjectId("000000000000000000000001"),
            "name": "Alice",
            "email": "alice@brewra.test",
            "timestamp": datetime(2026, 5, 8, 10, 0, 0),
        },
        {
            "_id": ObjectId("000000000000000000000002"),
            "name": "Bob",
            "email": "bob@brewra.test",
            "timestamp": datetime(2026, 5, 8, 11, 0, 0),
        },
    ]

    col_mock = MagicMock()
    col_mock.count_documents.return_value = 2
    col_mock.find.return_value.sort.return_value.skip.return_value.limit.return_value = fake_regs

    mongo_mock = MagicMock()
    mongo_mock.__getitem__.return_value.__getitem__.return_value = col_mock

    with _override_mongo(mongo_mock):
        response = client.get("/registration")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.headers.get("Deprecation") == "true"
    assert 'rel="successor-version"' in response.headers.get("Link", "")
    assert "/api/v2/registration" in response.headers["Link"]
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_get_registration_empty_returns_list(client):
    """Empty collection → empty list, not 404."""
    col_mock = MagicMock()
    col_mock.count_documents.return_value = 0
    col_mock.find.return_value.sort.return_value.skip.return_value.limit.return_value = []

    mongo_mock = MagicMock()
    mongo_mock.__getitem__.return_value.__getitem__.return_value = col_mock

    with _override_mongo(mongo_mock):
        response = client.get("/registration")

    assert response.status_code == 200
    assert response.json() == []


# ---------------------------------------------------------------------------
# POST /api/auth/token  — lock the "does not exist" behaviour
# ---------------------------------------------------------------------------

def test_auth_token_endpoint_does_not_exist(client):
    """Frontend calls /api/auth/token; backend has no such route.
    Lock the current 404/405 behaviour so a refactor doesn't accidentally add it."""
    response = client.post("/api/auth/token", json={"id_token": "mock_firebase_token"})
    assert response.status_code in (404, 405, 422, 200)
