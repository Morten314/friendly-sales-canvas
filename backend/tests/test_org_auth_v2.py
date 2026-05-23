"""v2 /registration endpoint tests."""
from unittest.mock import MagicMock


def test_v2_registration_envelope_shape(client, mock_mongo):
    fake_doc = {
        "_id": "abc123",
        "name": "Alice",
        "email": "alice@example.com",
        "timestamp": "2026-01-01T00:00:00",
    }
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = [fake_doc]
    mock_mongo["Registration_DB"]["registrations"].find.return_value = fake_cursor
    mock_mongo["Registration_DB"]["registrations"].count_documents.return_value = 1

    response = client.get("/v2/registration")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"items", "total", "limit", "offset"}
    assert body["limit"] == 50
    assert body["offset"] == 0
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Alice"


def test_v2_registration_limit_offset_passthrough(client, mock_mongo):
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = []
    mock_mongo["Registration_DB"]["registrations"].find.return_value = fake_cursor
    mock_mongo["Registration_DB"]["registrations"].count_documents.return_value = 0

    response = client.get("/v2/registration?limit=10&offset=20")
    assert response.status_code == 200
    fake_cursor.sort.return_value.skip.assert_called_with(20)
    fake_cursor.sort.return_value.skip.return_value.limit.assert_called_with(10)


def test_v2_registration_limit_above_cap_rejected(client):
    response = client.get("/v2/registration?limit=501")
    assert response.status_code == 422


def test_v2_registration_total_independent_of_limit(client, mock_mongo):
    fake_docs = [
        {"_id": "1", "name": "A", "email": "a@x.com", "timestamp": "2026-01-01T00:00:00"},
        {"_id": "2", "name": "B", "email": "b@x.com", "timestamp": "2026-01-02T00:00:00"},
    ]
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = fake_docs
    mock_mongo["Registration_DB"]["registrations"].find.return_value = fake_cursor
    mock_mongo["Registration_DB"]["registrations"].count_documents.return_value = 87

    body = client.get("/v2/registration?limit=2").json()
    assert len(body["items"]) == 2
    assert body["total"] == 87
