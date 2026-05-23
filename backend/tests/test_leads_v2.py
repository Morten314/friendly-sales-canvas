"""v2 /leads + /leads/by-file endpoint tests."""
from unittest.mock import MagicMock


def test_v2_leads_envelope_shape(client, mock_neo4j):
    mock_neo4j["session"].run.side_effect = [
        [{"l": {"name": "X"}}],
        MagicMock(single=lambda: {"total": 1}),
    ]
    response = client.get("/v2/leads?org_id=org_1")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"items", "total", "limit", "offset"}
    assert body["limit"] == 50
    assert body["offset"] == 0
    assert body["total"] == 1


def test_v2_leads_limit_offset_passthrough(client, mock_neo4j):
    mock_neo4j["session"].run.side_effect = [
        [],
        MagicMock(single=lambda: {"total": 0}),
    ]
    response = client.get("/v2/leads?org_id=org_1&limit=10&offset=20")
    call_kwargs = mock_neo4j["session"].run.call_args_list[0].kwargs
    assert call_kwargs["limit"] == 10
    assert call_kwargs["offset"] == 20


def test_v2_leads_limit_above_cap_rejected(client):
    response = client.get("/v2/leads?org_id=org_1&limit=501")
    assert response.status_code == 422


def test_v2_leads_total_independent_of_limit(client, mock_neo4j):
    mock_neo4j["session"].run.side_effect = [
        [{"l": {"name": "X"}}, {"l": {"name": "Y"}}],
        MagicMock(single=lambda: {"total": 423}),
    ]
    body = client.get("/v2/leads?org_id=org_1&limit=2").json()
    assert len(body["items"]) == 2
    assert body["total"] == 423


def test_v2_leads_by_file_envelope_shape(client, mock_neo4j):
    mock_neo4j["session"].run.side_effect = [
        [{"l": {"name": "X"}}],
        MagicMock(single=lambda: {"total": 1}),
    ]
    response = client.get("/v2/leads/by-file?org_id=org_1&file_id=f1")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"items", "total", "limit", "offset"}


def test_v2_leads_by_file_limit_offset_passthrough(client, mock_neo4j):
    mock_neo4j["session"].run.side_effect = [
        [],
        MagicMock(single=lambda: {"total": 0}),
    ]
    response = client.get("/v2/leads/by-file?org_id=org_1&file_id=f1&limit=5&offset=10")
    call_kwargs = mock_neo4j["session"].run.call_args_list[0].kwargs
    assert call_kwargs["limit"] == 5
    assert call_kwargs["offset"] == 10


def test_v2_leads_by_file_limit_above_cap_rejected(client):
    response = client.get("/v2/leads/by-file?org_id=org_1&file_id=f1&limit=501")
    assert response.status_code == 422


def test_v2_leads_by_file_total_independent_of_limit(client, mock_neo4j):
    mock_neo4j["session"].run.side_effect = [
        [{"l": {"name": "X"}}],
        MagicMock(single=lambda: {"total": 99}),
    ]
    body = client.get("/v2/leads/by-file?org_id=org_1&file_id=f1&limit=1").json()
    assert len(body["items"]) == 1
    assert body["total"] == 99
