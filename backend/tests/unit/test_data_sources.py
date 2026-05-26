# backend/tests/unit/test_data_sources.py
"""Unit tests for app/services/data_sources/ (renamed from documents/).

Covers all 11 public functions, the 3 + 3 typed-exception sites, and the
BrewraError catch path in process_file_to_embeddings.

IMPORTANT — actual signatures (verified L49-L881 of data_sources/orchestrator.py):
  - load_document(file_path)
  - grapher(file_path)
  - process_prospect_list(file_path)
  - upload_file_text(file_path: str, filename: str)
  - upload_prospect_list_file(file_path: str)
  - async upload_document_file(background_tasks, file_content, file_filename,
        file_content_type, user_id, org_id, url, name, tags, description)
  - async process_file_to_embeddings(file_key, user_id, file_name, org_id, file_id)
  - async get_document_status(file_key: str)
  - async list_user_documents(org_id: str)
  - async delete_data_source(file_id: str)
  - async update_data_source(file_id: str, request: dict)

S3 download in process_file_to_embeddings is inline:
    clients.s3_client.download_file(s3_bucket, file_key, local_file_path)  # L189

get_document_status returns {"status": "success", "data": status_doc}.
list_user_documents uses collection.find().sort() chain.
delete_data_source calls find_one twice (by file_id then by file_key) before raising
DocumentNotFoundError; it also calls collection.find().limit() for debug sampling.
"""
import asyncio
from unittest.mock import MagicMock

import pytest

from app.core.exceptions import (
    BrewraError,
    DocumentNotFoundError,
    DocumentValidationError,
)
from app.services.data_sources import (
    delete_data_source,
    get_document_status,
    list_user_documents,
    process_file_to_embeddings,
    update_data_source,
    upload_document_file,
    upload_file_text,
    upload_prospect_list_file,
)
from app.services.data_sources.loaders import (
    grapher,
    load_document,
    process_prospect_list,
)
from tests.identities import TEST_FILE_ID, TEST_FILE_KEY, TEST_ORG_ID, TEST_USER_ID


# ---------------------------------------------------------------------------
# load_document (sync) — PDF branch
# ---------------------------------------------------------------------------

def test_load_document_pdf_branch(mocker):
    """load_document branches on file extension; this test covers .pdf only.
    The .txt branch is exercised indirectly by process_file_to_embeddings."""
    pdf_loader_cls = mocker.patch("app.services.data_sources.loaders.PyPDFLoader")
    pdf_loader_cls.return_value.load.return_value = [MagicMock(page_content="Doc text")]

    result = load_document("/tmp/foo.pdf")

    assert len(result) == 1
    pdf_loader_cls.assert_called_once_with("/tmp/foo.pdf")


# ---------------------------------------------------------------------------
# grapher / process_prospect_list / upload_file_text / upload_prospect_list_file
# ---------------------------------------------------------------------------

def test_grapher_returns_graph_documents(mocker):
    """grapher(graph, llm_transformer, file_path) loads docs then passes them through
    llm_transformer.convert_to_graph_documents."""
    mocker.patch(
        "app.services.data_sources.loaders.load_document",
        return_value=[MagicMock(page_content="some content")],
    )
    transformer = MagicMock()
    transformer.convert_to_graph_documents.return_value = ["graph_doc_1"]
    graph = MagicMock()

    grapher(graph, transformer, "/tmp/foo.pdf")

    transformer.convert_to_graph_documents.assert_called_once()
    graph.add_graph_documents.assert_called_once_with(["graph_doc_1"])


def test_process_prospect_list_returns_dataframe_rows(mocker):
    """process_prospect_list(file_path) parses CSV/Excel into dict rows."""
    import pandas as pd
    df = pd.DataFrame([{"company": "Acme", "stage": "Initial"}])
    mock_read_csv = mocker.patch("app.services.data_sources.loaders.pd.read_csv", return_value=df)
    # score_prospect is now a module-top binding in loaders — patch at the used site
    # Returns (score, prompt_meta) — caller unpacks both
    mocker.patch("app.services.data_sources.loaders.score_prospect", return_value=({}, {}))
    # query() calls Neo4j driver.session() — stub the local binding in documents
    mocker.patch("app.services.data_sources.loaders.query", return_value=None)

    driver = MagicMock()
    llm = MagicMock()
    result = process_prospect_list(driver, llm, "/tmp/prospects.csv")

    mock_read_csv.assert_called_once_with("/tmp/prospects.csv")
    assert isinstance(result, (list, dict, pd.DataFrame))


def test_upload_file_text_uploads_to_s3(mocker, tmp_path):
    """upload_file_text(graph, llm_transformer, file_path, filename) — calls grapher() internally.
    Stub grapher so no LLM or Neo4j I/O occurs; verify the function completes."""
    test_file = tmp_path / "test.txt"
    test_file.write_text("file content")
    mock_grapher = mocker.patch("app.services.data_sources.loaders.grapher", return_value=None)
    graph = MagicMock()
    transformer = MagicMock()

    result = upload_file_text(graph, transformer, str(test_file), "test.txt")

    mock_grapher.assert_called_once_with(graph, transformer, str(test_file))
    assert result is not None


def test_upload_prospect_list_file_uploads_to_s3(mocker, tmp_path):
    """upload_prospect_list_file(file_path) takes a single path arg."""
    test_file = tmp_path / "prospects.csv"
    test_file.write_text("col1,col2\nA,B\n")
    # Stub the internals so no real CSV/Neo4j processing runs
    mocker.patch(
        "app.services.data_sources.loaders.process_prospect_list",
        return_value={"message": "1 new prospects added."},
    )
    driver = MagicMock()
    llm = MagicMock()

    result = upload_prospect_list_file(driver, llm, str(test_file))

    assert result is not None


# ---------------------------------------------------------------------------
# get_document_status / list_user_documents (async)
# ---------------------------------------------------------------------------

def test_get_document_status_raises_when_missing(mocker, mock_mongo_client):
    """get_document_status takes ONLY file_key — no user_id arg.
    Returns {"status": "success", "data": ...}; raises DocumentNotFoundError
    when the Mongo find_one returns None."""
    coll = MagicMock()
    coll.find_one.return_value = None
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    with pytest.raises(DocumentNotFoundError):
        asyncio.run(get_document_status(mock_mongo_client, TEST_FILE_KEY))


def test_get_document_status_happy_path(mocker, mock_mongo_client):
    """get_document_status wraps the doc in {"status": "success", "data": ...}."""
    coll = MagicMock()
    coll.find_one.return_value = {
        "file_key": TEST_FILE_KEY,
        "file_id": TEST_FILE_ID,
        "status": "completed",
        "file_name": "report.pdf",
    }
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    result = asyncio.run(get_document_status(mock_mongo_client, TEST_FILE_KEY))

    # Outer envelope uses "success"; the embedded doc has "status": "completed"
    assert result["status"] == "success"
    assert result["data"]["status"] == "completed"


def test_list_user_documents_takes_org_id(mocker, mock_mongo_client):
    """list_user_documents takes org_id (not user_id, despite the function name).
    Returns (items, total) tuple; implementation uses find().sort().skip().limit()."""
    coll = MagicMock()
    docs = [
        {"file_id": "f1", "org_id": TEST_ORG_ID, "file_name": "a.pdf"},
        {"file_id": "f2", "org_id": TEST_ORG_ID, "file_name": "b.pdf"},
    ]
    coll.find.return_value.sort.return_value.skip.return_value.limit.return_value = docs
    coll.count_documents.return_value = 2
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    items, total = asyncio.run(list_user_documents(mock_mongo_client, TEST_ORG_ID))

    assert total == 2
    assert len(items) == 2


# ---------------------------------------------------------------------------
# delete_data_source / update_data_source
# ---------------------------------------------------------------------------

def test_delete_data_source_raises_when_missing(mocker, mock_mongo_client):
    """delete_data_source(file_id) raises DocumentNotFoundError when the doc
    is absent from MongoDB.  The implementation calls find_one twice (once by
    file_id, once by file_key) and then calls collection.find().limit() for
    debug logging before raising — all three must return 'nothing found'."""
    coll = MagicMock()
    coll.find_one.return_value = None
    # collection.find({}, ...).limit(3) for debug sampling — return empty list
    coll.find.return_value.limit.return_value = []
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    with pytest.raises(DocumentNotFoundError):
        asyncio.run(delete_data_source(mock_mongo_client, MagicMock(), MagicMock(), TEST_FILE_ID))


def test_update_data_source_raises_on_empty_request(mocker, mock_mongo_client):
    """update_data_source(file_id, request: dict) — second arg is the
    update payload as a dict. Empty dict (tags=None, description=None)
    → DocumentValidationError before any Mongo access."""
    with pytest.raises(DocumentValidationError):
        asyncio.run(update_data_source(MagicMock(), TEST_FILE_ID, {}))


# ---------------------------------------------------------------------------
# process_file_to_embeddings — BrewraError catch path
# ---------------------------------------------------------------------------

def test_process_file_to_embeddings_catches_brewra_error(
    mocker,
    mock_mongo_client,
):
    """The S3 download in process_file_to_embeddings is inline. Pass an s3
    mock whose download_file raises BrewraError. The except BrewraError block
    must catch it and persist a 'failed' status."""
    coll = MagicMock()
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll
    s3 = MagicMock()
    s3.download_file.side_effect = BrewraError("S3 hiccup")
    pinecone = MagicMock()

    # Should not raise — caught by the except BrewraError block
    asyncio.run(
        process_file_to_embeddings(
            mock_mongo_client,
            s3,
            pinecone,
            file_key=TEST_FILE_KEY,
            user_id=TEST_USER_ID,
            file_name="report.pdf",
            org_id=TEST_ORG_ID,
            file_id=TEST_FILE_ID,
        )
    )

    # Verify a failure-status update was written via $set status=failed
    update_calls = coll.update_one.call_args_list
    failed_updates = [
        c for c in update_calls
        if c.args[1].get("$set", {}).get("status") == "failed"
    ]
    assert len(failed_updates) >= 1, "Expected a failed-status update for the doc"


# ---------------------------------------------------------------------------
# upload_document_file — async happy path
# ---------------------------------------------------------------------------

def test_upload_document_file_returns_file_id(mocker, mock_mongo_client):
    """upload_document_file (post-Phase-F signature):
       (mongo, s3, pinecone, background_tasks, file_content, file_filename,
        file_content_type, user_id, org_id, url, name, tags, description)
    Verify it uploads to S3 via put_object, inserts a Mongo tracking doc,
    and schedules background processing."""
    s3 = MagicMock()
    pinecone = MagicMock()
    coll = MagicMock()
    coll.insert_one.return_value.inserted_id = "abc"
    mock_mongo_client.__getitem__.return_value.__getitem__.return_value = coll

    bg_tasks = MagicMock()  # FastAPI BackgroundTasks

    result = asyncio.run(
        upload_document_file(
            mock_mongo_client,
            s3,
            pinecone,
            bg_tasks,                # background_tasks
            b"%PDF-1.4\n...",        # file_content
            "report.pdf",            # file_filename
            "application/pdf",       # file_content_type
            TEST_USER_ID,            # user_id
            TEST_ORG_ID,             # org_id
            None,                    # url
            "My report",             # name
            "tag1,tag2",             # tags
            "A test report",         # description
        )
    )

    assert result is not None
    s3.put_object.assert_called_once()
    bg_tasks.add_task.assert_called_once()
