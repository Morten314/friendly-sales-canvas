"""v2 /user-documents endpoint tests."""
from unittest.mock import MagicMock


def test_v2_user_documents_envelope_shape(client, mock_mongo):
    """v2 returns {items, total, limit, offset}, not the v1 wrapper."""
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = [
        {"file_id": "f1", "file_key": "k1", "file_name": "doc1.pdf",
         "status": "completed", "uploaded_at": "2026-01-01", "data_source_type": "file"}
    ]
    mock_mongo["File_Processing"]["file_status"].find.return_value = fake_cursor
    mock_mongo["File_Processing"]["file_status"].count_documents.return_value = 1

    response = client.get("/v2/user-documents?org_id=org_1")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"items", "total", "limit", "offset"}
    assert body["limit"] == 50
    assert body["offset"] == 0
    assert body["total"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["file_id"] == "f1"


def test_v2_user_documents_limit_offset_passthrough(client, mock_mongo):
    """limit/offset query params reach the Mongo cursor."""
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = []
    mock_mongo["File_Processing"]["file_status"].find.return_value = fake_cursor
    mock_mongo["File_Processing"]["file_status"].count_documents.return_value = 0

    response = client.get("/v2/user-documents?org_id=org_1&limit=10&offset=20")
    assert response.status_code == 200
    fake_cursor.sort.return_value.skip.assert_called_with(20)
    fake_cursor.sort.return_value.skip.return_value.limit.assert_called_with(10)


def test_v2_user_documents_limit_above_cap_rejected(client):
    """limit > 500 returns 422 via Query(..., le=500)."""
    response = client.get("/v2/user-documents?org_id=org_1&limit=501")
    assert response.status_code == 422


def test_v2_user_documents_total_independent_of_limit(client, mock_mongo):
    """total reflects DB count, not items length."""
    fake_cursor = MagicMock()
    fake_cursor.sort.return_value.skip.return_value.limit.return_value = [
        {"file_id": "f1", "file_key": "k1", "file_name": "doc1.pdf",
         "status": "completed", "uploaded_at": "2026-01-01", "data_source_type": "file"},
        {"file_id": "f2", "file_key": "k2", "file_name": "doc2.pdf",
         "status": "completed", "uploaded_at": "2026-01-02", "data_source_type": "file"},
    ]
    mock_mongo["File_Processing"]["file_status"].find.return_value = fake_cursor
    mock_mongo["File_Processing"]["file_status"].count_documents.return_value = 423

    body = client.get("/v2/user-documents?org_id=org_1&limit=2").json()
    assert len(body["items"]) == 2
    assert body["total"] == 423
