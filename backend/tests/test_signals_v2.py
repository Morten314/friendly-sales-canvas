"""v2 /fetch-signals endpoint tests."""
from unittest.mock import MagicMock


def test_v2_fetch_signals_envelope_shape(client, mock_mongo):
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = [
        {"signal_id": "s1", "user_id": "user_1", "timestamp": "2026-01-01"}
    ]
    mock_mongo["Signals"]["signals"].find.return_value = fake_cursor
    mock_mongo["Signals"]["signals"].count_documents.return_value = 1

    response = client.get("/v2/fetch-signals?user_id=user_1")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"items", "total", "limit", "offset"}
    assert body["limit"] == 10   # v2 default for fetch-signals is 10, not 50
    assert body["offset"] == 0
    assert body["total"] == 1


def test_v2_fetch_signals_limit_offset_passthrough(client, mock_mongo):
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = []
    mock_mongo["Signals"]["signals"].find.return_value = fake_cursor
    mock_mongo["Signals"]["signals"].count_documents.return_value = 0

    response = client.get("/v2/fetch-signals?user_id=user_1&limit=5&offset=15")
    assert response.status_code == 200
    fake_cursor.sort.return_value.skip.assert_called_with(15)
    fake_cursor.sort.return_value.skip.return_value.limit.assert_called_with(5)


def test_v2_fetch_signals_limit_above_cap_rejected(client):
    response = client.get("/v2/fetch-signals?user_id=user_1&limit=501")
    assert response.status_code == 422


def test_v2_fetch_signals_total_independent_of_limit(client, mock_mongo):
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = [
        {"signal_id": "s1", "user_id": "user_1"},
        {"signal_id": "s2", "user_id": "user_1"},
    ]
    mock_mongo["Signals"]["signals"].find.return_value = fake_cursor
    mock_mongo["Signals"]["signals"].count_documents.return_value = 42

    body = client.get("/v2/fetch-signals?user_id=user_1&limit=2").json()
    assert len(body["items"]) == 2
    assert body["total"] == 42
