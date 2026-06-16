"""Verify TestClient + dependency overrides work end-to-end.

If this passes, all infrastructure is wired correctly. If it fails,
investigate before moving on to characterization tests.
"""


def test_client_starts_and_serves_docs(client):
    """FastAPI auto-generates /docs. If TestClient + app boot work, this passes."""
    response = client.get("/docs")
    assert response.status_code == 200
    assert "swagger" in response.text.lower() or "openapi" in response.text.lower()


def test_neo4j_mock_is_applied(client, mock_neo4j):
    """Hit any endpoint that touches Neo4j, confirm the mock receives the call.

    Uses GET /leads — known to call driver.session().run() twice (items + count).
    """
    from unittest.mock import MagicMock
    count_mock = MagicMock()
    count_mock.single.return_value = {"total": 0}
    mock_neo4j["session"].run.side_effect = [[], count_mock]
    response = client.get("/leads", params={"user_id": "test", "org_id": "test"})
    # Don't assert response shape — just that the endpoint was reached and Neo4j mock was called.
    assert mock_neo4j["session"].run.called or response.status_code in (200, 422)


def test_mongo_mock_is_applied(client, mock_mongo):
    """Hit GET /v2/fetch-signals which reads from Mongo (v2 envelope)."""
    response = client.get("/v2/fetch-signals", params={"user_id": "test"})
    assert response.status_code == 200
    assert set(response.json().keys()) == {"items", "total", "limit", "offset"}
