"""Orchestrator service functions + task bodies with fakes for every sibling seam."""
import pytest

from app.core.exceptions import ConnectorCredentialsInvalidError, ConnectorNotConnectedError
from app.services.connectors import orchestrator
from app.models.connectors import (
    ApolloConnectRequest,
    ApolloEnrichRequest,
    ApolloImportRequest,
)
from tests.identities import TEST_ORG_ID, TEST_USER_ID, TEST_LEAD_ID_1, TEST_LEAD_ID_2


class FakeConnector:
    instances = []

    def __init__(self, api_key, **kw):
        self.api_key = api_key
        self.validated = False
        FakeConnector.instances.append(self)

    def validate_credentials(self):
        if self.api_key == "bad":
            raise ConnectorCredentialsInvalidError("nope")
        self.validated = True

    def list_collections(self):
        return [{"id": "L1", "name": "List One"}]

    def fetch_contacts(self, list_id=None):
        # validate-on-use: a bad key surfaces on the first call (generator body)
        if self.api_key == "bad":
            raise ConnectorCredentialsInvalidError("bad")
        yield [{"id": "c1", "email": "a@x.com"}, {"id": "c2", "email": "b@x.com"}]

    def bulk_match(self, entries, *, reveal_personal_emails, reveal_phone_number):
        # echo a match per entry that has an email; otherwise no match
        return [{"id": "m" + str(i), "email": e.get("email")} if e.get("email") else None
                for i, e in enumerate(entries)]


@pytest.fixture(autouse=True)
def _reset():
    FakeConnector.instances = []
    yield


@pytest.fixture
def patched(monkeypatch):
    """Patch the ApolloConnector seam the orchestrator reaches through."""
    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", FakeConnector)
    yield


class _FakeBT:
    def __init__(self):
        self.tasks = []

    def add_task(self, fn, *args, **kwargs):
        self.tasks.append((fn, args, kwargs))


# ─── connection ───

def test_connect_validates_and_saves(monkeypatch, patched):
    saved = {}
    monkeypatch.setattr(orchestrator.credentials, "save_credentials",
                        lambda m, o, p, k, **kw: saved.update({"org": o, "key": k}) or {"status": "connected"})
    out = orchestrator.connect_apollo(object(), ApolloConnectRequest(org_id=TEST_ORG_ID, user_id=TEST_USER_ID, api_key="good"))
    assert out["connected"] is True
    assert saved["key"] == "good"


def test_connect_bad_key_raises_and_does_not_save(monkeypatch, patched):
    calls = []
    monkeypatch.setattr(orchestrator.credentials, "save_credentials", lambda *a, **k: calls.append(1))
    with pytest.raises(ConnectorCredentialsInvalidError):
        orchestrator.connect_apollo(object(), ApolloConnectRequest(org_id=TEST_ORG_ID, user_id=TEST_USER_ID, api_key="bad"))
    assert calls == []


def test_status_disconnected(monkeypatch):
    monkeypatch.setattr(orchestrator.credentials, "get_credentials", lambda m, o, p: None)
    out = orchestrator.get_apollo_status(object(), TEST_ORG_ID)
    assert out == {"connected": False, "status": "disconnected", "connected_at": None}


def test_lists_requires_connection(monkeypatch, patched):
    monkeypatch.setattr(orchestrator.credentials, "get_api_key",
                        lambda m, o, p="apollo": (_ for _ in ()).throw(ConnectorNotConnectedError("x")))
    with pytest.raises(ConnectorNotConnectedError):
        orchestrator.list_apollo_lists(object(), TEST_ORG_ID)


def test_lists_returns_collections(monkeypatch, patched):
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "good")
    out = orchestrator.list_apollo_lists(object(), TEST_ORG_ID)
    assert out == {"lists": [{"id": "L1", "name": "List One"}]}


# ─── import scheduling ───

def test_start_import_requires_connection(monkeypatch):
    monkeypatch.setattr(orchestrator.credentials, "get_api_key",
                        lambda m, o, p="apollo": (_ for _ in ()).throw(ConnectorNotConnectedError("x")))
    bt = _FakeBT()
    with pytest.raises(ConnectorNotConnectedError):
        orchestrator.start_apollo_import(object(), object(),
                                         ApolloImportRequest(org_id=TEST_ORG_ID, user_id=TEST_USER_ID), bt)


def test_start_import_mints_batch_and_schedules(monkeypatch):
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "good")
    monkeypatch.setattr(orchestrator.runs, "create_import_batch", lambda m, o, u, name: "file-xyz")
    bt = _FakeBT()
    out = orchestrator.start_apollo_import(object(), object(),
                                           ApolloImportRequest(org_id=TEST_ORG_ID, user_id=TEST_USER_ID, label="My Batch"), bt)
    assert out == {"file_id": "file-xyz", "status": "queued"}
    assert bt.tasks and bt.tasks[0][0] is orchestrator._run_import


# ─── enrich scheduling ───

def test_start_enrich_creates_run_and_schedules(monkeypatch):
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "good")
    monkeypatch.setattr(orchestrator.runs, "fail_stale_enrich_runs", lambda m, o: None)
    monkeypatch.setattr(orchestrator.runs, "create_enrich_run", lambda m, o, u, total: "run-1")
    bt = _FakeBT()
    out = orchestrator.start_apollo_enrich(object(), object(),
                                           ApolloEnrichRequest(org_id=TEST_ORG_ID, user_id=TEST_USER_ID, lead_ids=[TEST_LEAD_ID_1, TEST_LEAD_ID_2]), bt)
    assert out == {"run_id": "run-1", "status": "queued"}
    assert bt.tasks[0][0] is orchestrator._run_enrich


# ─── task body: import ───

def test_run_import_happy_path(monkeypatch, patched):
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "good")
    progress = {}
    monkeypatch.setattr(orchestrator.runs, "update_import_progress", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.runs, "update_import_filename", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.runs, "complete_import_batch",
                        lambda m, fid, **k: progress.update(k))
    monkeypatch.setattr(orchestrator.ingestion, "upsert_imported_leads",
                        lambda *a, **k: {"created": 2, "matched": 0, "errors": []})

    orchestrator._run_import(object(), object(), TEST_ORG_ID, TEST_USER_ID, "file-1", list_id="L1", label="My Batch")
    assert progress["created_count"] == 2
    assert progress["total_rows"] == 2
    assert progress["capped"] is False


def test_run_import_bad_key_fails_batch(monkeypatch, patched):
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "bad")
    monkeypatch.setattr(orchestrator.credentials, "set_status", lambda *a, **k: None)
    failed = {}
    monkeypatch.setattr(orchestrator.runs, "fail_import_batch", lambda m, fid, msg: failed.update({"msg": msg}))
    # label given + no list_id -> first connector call is fetch_contacts, which raises on "bad"
    orchestrator._run_import(object(), object(), TEST_ORG_ID, TEST_USER_ID, "file-1", list_id=None, label="X")
    assert "msg" in failed


# ─── task body: enrich ───

def test_run_enrich_happy_path(monkeypatch, patched):
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "good")
    monkeypatch.setattr(orchestrator.runs, "mark_enrich_processing", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.runs, "update_enrich_progress", lambda *a, **k: None)
    completed = {}
    monkeypatch.setattr(orchestrator.runs, "complete_enrich_run", lambda m, rid, **k: completed.update(k))
    monkeypatch.setattr(orchestrator.ingestion, "get_leads_by_ids",
                        lambda d, o, ids: [{"lead_id": TEST_LEAD_ID_1, "email": "a@x.com", "first_name": "A"}])
    monkeypatch.setattr(orchestrator.ingestion, "enrich_fill_leads",
                        lambda *a, **k: {"updated": 1, "errors": []})

    orchestrator._run_enrich(object(), object(), TEST_ORG_ID, TEST_USER_ID, "run-1",
                             [TEST_LEAD_ID_1], reveal_personal_emails=True, reveal_phone_number=False)
    assert completed["updated"] == 1
    assert completed["status"] == "completed"


def test_run_enrich_count_mismatch_skips_chunk_no_miswrite(monkeypatch, patched):
    # bulk_match returning fewer results than inputs must NOT positional-zip (review F2).
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "good")
    monkeypatch.setattr(orchestrator.runs, "mark_enrich_processing", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.runs, "update_enrich_progress", lambda *a, **k: None)
    completed = {}
    monkeypatch.setattr(orchestrator.runs, "complete_enrich_run", lambda m, rid, **k: completed.update(k))
    monkeypatch.setattr(orchestrator.ingestion, "get_leads_by_ids",
                        lambda d, o, ids: [{"lead_id": "L1", "email": "a@x.com"}, {"lead_id": "L2", "email": "b@x.com"}])
    wrote = []
    monkeypatch.setattr(orchestrator.ingestion, "enrich_fill_leads",
                        lambda *a, **k: wrote.append(a) or {"updated": 0, "errors": []})

    class _MismatchConnector(FakeConnector):
        def bulk_match(self, entries, *, reveal_personal_emails, reveal_phone_number):
            return [{"id": "only-one"}]  # 1 result for 2 inputs

    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", _MismatchConnector)

    orchestrator._run_enrich(object(), object(), TEST_ORG_ID, TEST_USER_ID, "run-1",
                             ["L1", "L2"], reveal_personal_emails=True, reveal_phone_number=False)
    assert completed["unmatched"] == 2
    assert completed["updated"] == 0
    assert wrote == []  # never attempted a write
