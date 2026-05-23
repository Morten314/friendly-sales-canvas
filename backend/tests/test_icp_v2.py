"""v2 /icp endpoint tests."""
from unittest.mock import MagicMock, patch


def test_v2_icp_envelope_shape(client):
    """v2 returns {items, total, limit, offset}, not the v1 wrapper."""
    fake_result = {"suggestedICPs": [{"id": "icp_1", "name": "ICP 1"}]}
    with patch("app.routers.v2.icp.list_icps", return_value=([{"id": "icp_1", "name": "ICP 1"}], 1)):
        response = client.get("/v2/icp?user_id=user_1")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"items", "total", "limit", "offset"}
    assert body["limit"] == 50
    assert body["offset"] == 0
    assert body["total"] == 1


def test_v2_icp_limit_offset_passthrough(client):
    """limit/offset query params reach the service."""
    with patch("app.routers.v2.icp.list_icps", return_value=([], 0)) as mock_svc:
        response = client.get("/v2/icp?user_id=user_1&limit=10&offset=5")
    assert response.status_code == 200
    call_kwargs = mock_svc.call_args.kwargs
    assert call_kwargs["limit"] == 10
    assert call_kwargs["offset"] == 5


def test_v2_icp_limit_above_cap_rejected(client):
    response = client.get("/v2/icp?user_id=user_1&limit=501")
    assert response.status_code == 422


def test_v2_icp_total_independent_of_items(client):
    """total reflects full ICP set, not items length."""
    with patch("app.routers.v2.icp.list_icps", return_value=([{"id": "a"}, {"id": "b"}], 7)):
        body = client.get("/v2/icp?user_id=user_1&limit=2").json()
    assert len(body["items"]) == 2
    assert body["total"] == 7
