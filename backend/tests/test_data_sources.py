"""Characterization tests for document upload and data source endpoints.

Endpoints:
  POST /upload-document     — upload file to S3, store status in Mongo
  GET  /document-status/{file_key:path}  — get processing status

S3 is supplied by the `mock_s3` fixture; Mongo via the `_override_mongo`
helper (both flow through `app.dependency_overrides`).
"""
import io
from contextlib import contextmanager
from unittest.mock import MagicMock, patch
import pytest

from tests.helpers import scrub_dynamic
from tests.identities import (
    TEST_USER_ID, TEST_ORG_ID, TEST_FILE_KEY, TEST_FILE_ID
)


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

def _make_doc_mc(find_one_result=None, find_results=None):
    """MongoClient mock for File_Processing.file_status collection.

    Chains find().sort().skip().limit() so the new paginated service signature
    works. count_documents() returns len(find_results) by default.
    """
    coll = MagicMock()
    coll.find_one.return_value = find_one_result
    results = list(find_results or [])
    # Wire the full cursor chain: find().sort().skip().limit() → results list
    coll.find.return_value.sort.return_value.skip.return_value.limit.return_value = results
    coll.count_documents.return_value = len(results)
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
# POST /upload-document stores in S3
# ---------------------------------------------------------------------------

def test_post_document_upload_stores_in_s3(client, mock_s3):
    """POST /upload-document → s3_client.put_object called."""
    mc, _ = _make_doc_mc()

    with _override_mongo(mc):
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
# POST /upload-document returns file_id
# ---------------------------------------------------------------------------

def test_post_document_upload_returns_file_id(client, mock_s3):
    """POST /upload-document response includes file_id and file_key."""
    mc, _ = _make_doc_mc()

    with _override_mongo(mc):
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
# GET /document-status/{file_key} returns status
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

    with _override_mongo(mc):
        response = client.get(f"/document-status/{TEST_FILE_KEY}")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert "data" in body
    assert body["data"]["status"] == "completed"


# ---------------------------------------------------------------------------
# POST /upload-document with no file and no url → 400
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

    with _override_mongo(mc):
        response = client.get("/document-status/test_org_abc/nonexistent.pdf")

    assert response.status_code == 404
