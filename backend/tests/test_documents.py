"""Characterization tests for document upload and data source endpoints.

Endpoints:
  POST /upload-document     — upload file to S3, store status in Mongo
  GET  /document-status/{file_key:path}  — get processing status
  GET  /user-documents      — list all docs/URLs for an org

S3 is patched by the `mock_s3` fixture (app.core.database.s3_client).
MongoDB is per-request MongoClient — patch "app.routers.documents.MongoClient".
"""
import io
from unittest.mock import MagicMock, patch
import pytest

from tests.helpers import scrub_dynamic
from tests.identities import (
    TEST_USER_ID, TEST_ORG_ID, TEST_FILE_KEY, TEST_FILE_ID
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_doc_mc(find_one_result=None, find_results=None):
    """MongoClient mock for File_Processing.file_status collection."""
    coll = MagicMock()
    coll.find_one.return_value = find_one_result
    cursor = MagicMock()
    cursor.__iter__ = MagicMock(return_value=iter(find_results or []))
    coll.find.return_value.sort.return_value = cursor
    coll.insert_one.return_value = MagicMock(inserted_id="ins_id")
    coll.update_one.return_value = MagicMock(modified_count=1)

    db = MagicMock()
    db.__getitem__.return_value = coll

    mc = MagicMock()
    mc.__getitem__.return_value = db
    return mc, coll


def _pdf_upload():
    return ("test_doc.pdf", io.BytesIO(b"%PDF-1.4 test content"), "application/pdf")


# ---------------------------------------------------------------------------
# Task 18-1: POST /upload-document stores in S3
# ---------------------------------------------------------------------------

def test_post_document_upload_stores_in_s3(client, mock_s3):
    """POST /upload-document → s3_client.put_object called."""
    mc, _ = _make_doc_mc()

    with patch("app.routers.documents.MongoClient", return_value=mc):
        response = client.post(
            "/upload-document",
            data={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
            files={"file": _pdf_upload()},
        )

    assert response.status_code == 200
    mock_s3.put_object.assert_called_once()
    call_kwargs = mock_s3.put_object.call_args.kwargs
    assert call_kwargs["Bucket"] is not None
    # File key is prefixed with org_id
    assert TEST_ORG_ID in call_kwargs["Key"]


# ---------------------------------------------------------------------------
# Task 18-2: POST /upload-document returns file_id
# ---------------------------------------------------------------------------

def test_post_document_upload_returns_file_id(client, mock_s3):
    """POST /upload-document response includes file_id and file_key."""
    mc, _ = _make_doc_mc()

    with patch("app.routers.documents.MongoClient", return_value=mc):
        response = client.post(
            "/upload-document",
            data={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
            files={"file": _pdf_upload()},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert "file_id" in body
    assert "file_key" in body
    assert body["file_name"] == "test_doc.pdf"


# ---------------------------------------------------------------------------
# Task 18-3: GET /user-documents returns uploaded docs
# ---------------------------------------------------------------------------

def test_get_document_list_returns_uploaded_docs(client):
    """GET /user-documents?org_id=... returns file list from Mongo."""
    doc = {
        "file_id": TEST_FILE_ID,
        "file_key": TEST_FILE_KEY,
        "file_name": "test.pdf",
        "status": "completed",
        "uploaded_at": "2026-05-08T10:00:00",
        "org_id": TEST_ORG_ID,
        "data_source_type": "file",
    }
    mc, _ = _make_doc_mc(find_results=[doc])

    with patch("app.routers.documents.MongoClient", return_value=mc):
        response = client.get(f"/user-documents?org_id={TEST_ORG_ID}")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["count"] == 1
    assert isinstance(body["files"], list)
    assert body["files"][0]["file_id"] == TEST_FILE_ID


# ---------------------------------------------------------------------------
# Task 18-4: GET /document-status/{file_key} returns status
# ---------------------------------------------------------------------------

def test_get_document_status_returns_status(client):
    """GET /document-status/{file_key} returns doc with status field."""
    status_doc = {
        "file_key": TEST_FILE_KEY,
        "file_id": TEST_FILE_ID,
        "status": "completed",
        "file_name": "test.pdf",
        "org_id": TEST_ORG_ID,
    }
    mc, _ = _make_doc_mc(find_one_result=status_doc)

    with patch("app.routers.documents.MongoClient", return_value=mc):
        response = client.get(f"/document-status/{TEST_FILE_KEY}")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert "data" in body
    assert body["data"]["status"] == "completed"


# ---------------------------------------------------------------------------
# Task 18-5: POST /upload-document with no file and no url → 400
# ---------------------------------------------------------------------------

def test_post_document_upload_no_file_or_url(client, mock_s3):
    """POST /upload-document without file or url → 400 validation error."""
    response = client.post(
        "/upload-document",
        data={"user_id": TEST_USER_ID, "org_id": TEST_ORG_ID},
        # No file, no url
    )

    # API returns 400 via JSONResponse when neither file nor url provided
    assert response.status_code == 400
    body = response.json()
    assert body["status"] == "error"


def test_get_document_status_unknown_file_key(client):
    """GET /document-status/<key> for an unknown key → 404.

    The endpoint creates its own per-request MongoClient, so we patch
    app.routers.documents.MongoClient to return an empty file_status collection.
    Locks the 404-on-missing behavior — a refactor that returns 200 with
    `status: not_found` would break FE polling logic that distinguishes
    "still processing" (200) from "never existed" (404).
    """
    coll = MagicMock()
    coll.find_one.return_value = None
    db = MagicMock()
    db.__getitem__.return_value = coll
    mc = MagicMock()
    mc.__getitem__.return_value = db

    with patch("app.routers.documents.MongoClient", return_value=mc):
        response = client.get("/document-status/test_org_abc/nonexistent.pdf")

    assert response.status_code == 404
