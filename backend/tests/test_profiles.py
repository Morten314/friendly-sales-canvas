"""Characterization tests for profile endpoints.

Endpoints:
  POST /profile/{profile_type}
  GET  /profile/{profile_type}

Key implementation notes:
- Both endpoints use module-level `driver` (patched by conftest mock_neo4j).
- GET /profile/company additionally reads from the Mongo singleton client
  (app.core.clients.client), patched here via patch("app.core.clients.client").
- GET uses session.run(...).single() — mock must support .single().
"""
from unittest.mock import MagicMock, patch

from tests.helpers import scrub_dynamic
from tests.identities import TEST_USER_ID, TEST_ORG_ID
from tests.fixtures.profiles import (
    org_profile,
    user_profile,
    scout_profile,
    profiler_profile,
    agent_name_payload,
)


# ---------------------------------------------------------------------------
# POST /profile/{profile_type}
# ---------------------------------------------------------------------------

def test_post_profile_org_writes_to_neo4j(client, mock_neo4j):
    """POST org profile deletes existing then upserts via execute_write."""
    payload = {**org_profile(), "user_id": TEST_USER_ID, "profile_type": "company"}

    response = client.post("/profile/company", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert "message" in data or "profile_type" in str(data).lower()
    cypher_calls = [c.args[0] for c in mock_neo4j["session"].run.call_args_list]
    assert any("DELETE" in q.upper() or "MATCH" in q.upper() for q in cypher_calls)


def test_post_profile_user_writes_to_neo4j(client, mock_neo4j):
    """POST user profile stores user-scoped settings."""
    payload = {**user_profile(), "profile_type": "user"}

    response = client.post("/profile/user", json=payload)

    assert response.status_code == 200
    cypher_calls = [c.args[0] for c in mock_neo4j["session"].run.call_args_list]
    assert any("DELETE" in q.upper() or "MATCH" in q.upper() for q in cypher_calls)


def test_post_profile_scout_writes_to_neo4j(client, mock_neo4j):
    """POST scout profile stores scout-scoped settings."""
    payload = {**scout_profile(), "profile_type": "scout"}

    response = client.post("/profile/scout", json=payload)

    assert response.status_code == 200


def test_post_profile_profiler_writes_to_neo4j(client, mock_neo4j):
    """POST profiler profile stores profiler-scoped settings."""
    payload = {**profiler_profile(), "profile_type": "profiler"}

    response = client.post("/profile/profiler", json=payload)

    assert response.status_code == 200


def test_post_profile_agent_name_writes_to_neo4j(client, mock_neo4j):
    """POST agent_name profile stores custom agent name."""
    payload = {**agent_name_payload(name="My Custom Scout"), "profile_type": "agent_name"}

    response = client.post("/profile/agent_name", json=payload)

    assert response.status_code == 200
    assert mock_neo4j["session"].run.called


def test_post_profile_company_requires_org_id(client, mock_neo4j):
    """POST company profile without org_id returns 400."""
    payload = {"user_id": TEST_USER_ID, "name": "Test Org"}

    response = client.post("/profile/company", json=payload)

    assert response.status_code == 400


def test_post_profile_user_requires_user_id(client, mock_neo4j):
    """POST non-company profile without user_id returns 400."""
    payload = {"org_id": TEST_ORG_ID, "name": "no user"}

    response = client.post("/profile/user", json=payload)

    assert response.status_code == 400


# ---------------------------------------------------------------------------
# GET /profile/{profile_type}
# ---------------------------------------------------------------------------

def test_get_profile_user_returns_user_settings(client, mock_neo4j, snapshot):
    """GET user profile returns Neo4j node data."""
    mock_record = MagicMock()
    mock_record.values.return_value = [user_profile()]
    mock_neo4j["session"].run.return_value.single.return_value = mock_record

    response = client.get(
        "/profile/user",
        params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
    )

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_get_profile_scout_returns_scout_settings(client, mock_neo4j, snapshot):
    """GET scout profile returns scout node data."""
    mock_record = MagicMock()
    mock_record.values.return_value = [scout_profile()]
    mock_neo4j["session"].run.return_value.single.return_value = mock_record

    response = client.get(
        "/profile/scout",
        params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
    )

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_get_profile_profiler_returns_profiler_settings(client, mock_neo4j, snapshot):
    """GET profiler profile returns profiler node data."""
    mock_record = MagicMock()
    mock_record.values.return_value = [profiler_profile()]
    mock_neo4j["session"].run.return_value.single.return_value = mock_record

    response = client.get(
        "/profile/profiler",
        params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
    )

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_get_profile_user_404_when_not_found(client, mock_neo4j):
    """GET non-existent profile returns 404."""
    mock_neo4j["session"].run.return_value.single.return_value = None

    response = client.get(
        "/profile/user",
        params={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
    )

    assert response.status_code == 404


def test_get_profile_user_requires_user_id(client, mock_neo4j):
    """GET non-company profile without user_id returns 400."""
    response = client.get("/profile/user", params={"org_id": TEST_ORG_ID})

    assert response.status_code == 400


def test_get_profile_company_requires_org_id(client, mock_neo4j):
    """GET company profile without org_id returns 400."""
    response = client.get("/profile/company", params={"user_id": TEST_USER_ID})

    assert response.status_code == 400


def test_get_profile_company_returns_profile_with_icps(client, mock_neo4j, snapshot):
    """GET company profile includes ICPs from local Mongo call."""
    mock_record = MagicMock()
    mock_record.values.return_value = [org_profile()]
    mock_neo4j["session"].run.return_value.single.return_value = mock_record

    mongo_doc = {
        "profile_type": "company",
        "org_id": TEST_ORG_ID,
        "customer_profiles": {"icps": []},
    }
    mock_mongo_client = MagicMock()
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value.find_one.return_value = mongo_doc

    from app.main import app
    from app.core.dependencies import get_mongo
    app.dependency_overrides[get_mongo] = lambda: mock_mongo_client
    try:
        response = client.get(
            "/profile/company",
            params={"org_id": TEST_ORG_ID},
        )
    finally:
        app.dependency_overrides.pop(get_mongo, None)

    assert response.status_code == 200
    data = response.json()
    assert "customer_profiles" in data
    body_scrubbed = scrub_dynamic(data)
    assert body_scrubbed == snapshot
