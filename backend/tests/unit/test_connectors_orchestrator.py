"""Orchestrator service functions + task bodies with fakes for every sibling seam."""
import pytest

from app.core.exceptions import (
    ApolloCreditsExhaustedError,
    ConnectorCredentialsInvalidError,
    ConnectorNotConnectedError,
)
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
    assert completed.get("skipped", 0) == 0


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


# ─── C1 regression ───

def test_run_import_label_lookup_network_error_does_not_fail_batch(monkeypatch, patched):
    """A non-BrewraError (e.g. network blip) during cosmetic list-name lookup must NOT fail the batch."""
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "good")

    class _NetworkErrorConnector(FakeConnector):
        def list_collections(self):
            raise RuntimeError("boom")  # simulates a transient network error, not a BrewraError

    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", _NetworkErrorConnector)

    monkeypatch.setattr(orchestrator.runs, "update_import_progress", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.runs, "update_import_filename", lambda *a, **k: None)

    fail_calls = []
    monkeypatch.setattr(orchestrator.runs, "fail_import_batch",
                        lambda m, fid, msg: fail_calls.append(msg))

    completed = {}
    monkeypatch.setattr(orchestrator.runs, "complete_import_batch",
                        lambda m, fid, **k: completed.update(k))

    upsert_calls = []
    monkeypatch.setattr(orchestrator.ingestion, "upsert_imported_leads",
                        lambda *a, **k: upsert_calls.append(1) or {"created": 2, "matched": 0, "errors": []})

    # list_id set + no label → label-resolution branch runs (and blows up with RuntimeError)
    orchestrator._run_import(object(), object(), TEST_ORG_ID, TEST_USER_ID, "file-1", list_id="L1", label=None)

    assert fail_calls == [], f"fail_import_batch should NOT have been called, but got: {fail_calls}"
    assert completed, "complete_import_batch should have been called"
    assert completed.get("created_count") == 2
    assert upsert_calls, "ingestion.upsert_imported_leads should have been called"


# ─── I2: credits → partial ───

def test_run_enrich_credits_exhausted_marks_partial(monkeypatch, patched):
    """ApolloCreditsExhaustedError during bulk_match should mark the run partial, not failed."""
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "good")
    monkeypatch.setattr(orchestrator.runs, "mark_enrich_processing", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.runs, "update_enrich_progress", lambda *a, **k: None)

    completed = {}
    monkeypatch.setattr(orchestrator.runs, "complete_enrich_run",
                        lambda m, rid, **k: completed.update(k))

    fail_calls = []
    monkeypatch.setattr(orchestrator.runs, "fail_enrich_run",
                        lambda m, rid, msg: fail_calls.append(msg))

    monkeypatch.setattr(orchestrator.ingestion, "get_leads_by_ids",
                        lambda d, o, ids: [{"lead_id": TEST_LEAD_ID_1, "email": "a@x.com"}])

    class _CreditsConnector(FakeConnector):
        def bulk_match(self, entries, *, reveal_personal_emails, reveal_phone_number):
            raise ApolloCreditsExhaustedError("no credits")

    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", _CreditsConnector)

    orchestrator._run_enrich(object(), object(), TEST_ORG_ID, TEST_USER_ID, "run-1",
                             [TEST_LEAD_ID_1], reveal_personal_emails=True, reveal_phone_number=False)

    assert fail_calls == [], f"fail_enrich_run should NOT have been called, got: {fail_calls}"
    assert completed.get("status") == "partial"


# ─── I4: import cap ───

def test_run_import_cap_stops_and_marks_capped(monkeypatch, patched):
    """When IMPORT_RECORD_CAP is hit, batch completes with capped=True and cap message."""
    monkeypatch.setattr(orchestrator, "IMPORT_RECORD_CAP", 3)
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "good")

    class _ManyPagesConnector(FakeConnector):
        def fetch_contacts(self, list_id=None):
            # Yield 3 pages of 2 records each → 6 total, cap is 3
            for _ in range(3):
                yield [{"id": "c1", "email": "a@x.com"}, {"id": "c2", "email": "b@x.com"}]

    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", _ManyPagesConnector)
    monkeypatch.setattr(orchestrator.runs, "update_import_progress", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.runs, "update_import_filename", lambda *a, **k: None)

    completed = {}
    monkeypatch.setattr(orchestrator.runs, "complete_import_batch",
                        lambda m, fid, **k: completed.update(k))
    monkeypatch.setattr(orchestrator.ingestion, "upsert_imported_leads",
                        lambda *a, **k: {"created": len(k.get("records", [])) if "records" in k else 2, "matched": 0, "errors": []})

    orchestrator._run_import(object(), object(), TEST_ORG_ID, TEST_USER_ID, "file-1", list_id=None, label="X")

    assert completed.get("capped") is True
    assert completed.get("total_rows", 0) <= 3
    message = completed.get("message") or ""
    assert "cap" in message.lower() or "3" in message


# ─── I3: enrich bad-key → failed + credentials error status ───

def test_run_enrich_bad_key_fails_run_and_sets_status(monkeypatch, patched):
    """ConnectorCredentialsInvalidError during enrich should fail the run and set cred status=error."""
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "good")

    class _BadKeyConnector(FakeConnector):
        def bulk_match(self, entries, *, reveal_personal_emails, reveal_phone_number):
            raise ConnectorCredentialsInvalidError("bad key")

    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", _BadKeyConnector)

    monkeypatch.setattr(orchestrator.runs, "mark_enrich_processing", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.runs, "update_enrich_progress", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.ingestion, "get_leads_by_ids",
                        lambda d, o, ids: [{"lead_id": TEST_LEAD_ID_1, "email": "a@x.com"}])

    status_calls = []
    monkeypatch.setattr(orchestrator.credentials, "set_status",
                        lambda m, o, p, s: status_calls.append(s))

    failed = {}
    monkeypatch.setattr(orchestrator.runs, "fail_enrich_run",
                        lambda m, rid, msg: failed.update({"msg": msg}))

    completed_calls = []
    monkeypatch.setattr(orchestrator.runs, "complete_enrich_run",
                        lambda *a, **k: completed_calls.append(k))

    orchestrator._run_enrich(object(), object(), TEST_ORG_ID, TEST_USER_ID, "run-1",
                             [TEST_LEAD_ID_1], reveal_personal_emails=True, reveal_phone_number=False)

    assert "msg" in failed, "fail_enrich_run should have been called"
    assert "error" in status_calls, "credentials.set_status should have been called with 'error'"
    assert completed_calls == [], "complete_enrich_run should NOT have been called"


# ─── F2: skipped counter for missing leads ───

def test_run_enrich_counts_missing_leads_as_skipped(monkeypatch, patched):
    """Leads in lead_ids not returned by get_leads_by_ids are counted as skipped,
    not silently dropped, and complete_enrich_run is called with skipped=1."""
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "good")
    monkeypatch.setattr(orchestrator.runs, "mark_enrich_processing", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.runs, "update_enrich_progress", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.ingestion, "enrich_fill_leads",
                        lambda *a, **k: {"updated": 1, "errors": []})

    # Request 2 ids but only 1 is returned (the other was deleted / foreign)
    monkeypatch.setattr(orchestrator.ingestion, "get_leads_by_ids",
                        lambda d, o, ids: [{"lead_id": TEST_LEAD_ID_1, "email": "a@x.com"}])

    completed = {}
    monkeypatch.setattr(orchestrator.runs, "complete_enrich_run", lambda m, rid, **k: completed.update(k))

    orchestrator._run_enrich(
        object(), object(), TEST_ORG_ID, TEST_USER_ID, "run-1",
        [TEST_LEAD_ID_1, TEST_LEAD_ID_2],
        reveal_personal_emails=True, reveal_phone_number=False,
    )

    assert completed.get("skipped") == 1, f"expected skipped=1, got {completed.get('skipped')}"
    assert completed.get("processed", 0) + completed.get("skipped", 0) == 2, (
        "processed + skipped must equal total (2)"
    )
    # errors list should mention the missing lead id
    all_errors = completed.get("errors", [])
    assert any(TEST_LEAD_ID_2 in e for e in all_errors), (
        f"Expected 'not found' error for {TEST_LEAD_ID_2}, got: {all_errors}"
    )


# ─── F3: empty match-entry leads not sent to bulk_match ───

def test_run_enrich_skips_empty_match_entry(monkeypatch, patched):
    """A lead with no apollo_contact_id / email / name / company produces an empty
    match entry — it must NOT be sent to bulk_match (no credit burned) and must be
    counted as unmatched, not as a successful match."""
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "good")
    monkeypatch.setattr(orchestrator.runs, "mark_enrich_processing", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.runs, "update_enrich_progress", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.ingestion, "enrich_fill_leads",
                        lambda *a, **k: {"updated": 1, "errors": []})

    # Two leads: one with no identifiers (empty entry), one normal
    EMPTY_LEAD_ID = "lead-empty"
    NORMAL_LEAD_ID = TEST_LEAD_ID_1
    monkeypatch.setattr(orchestrator.ingestion, "get_leads_by_ids",
                        lambda d, o, ids: [
                            {"lead_id": EMPTY_LEAD_ID},  # no email/name/company/apollo_contact_id
                            {"lead_id": NORMAL_LEAD_ID, "email": "a@x.com"},
                        ])

    received_entries = []

    class _RecordingConnector(FakeConnector):
        def bulk_match(self, entries, *, reveal_personal_emails, reveal_phone_number):
            received_entries.extend(entries)
            return [{"id": "m0", "email": "a@x.com"}]

    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", _RecordingConnector)

    completed = {}
    monkeypatch.setattr(orchestrator.runs, "complete_enrich_run", lambda m, rid, **k: completed.update(k))

    orchestrator._run_enrich(
        object(), object(), TEST_ORG_ID, TEST_USER_ID, "run-1",
        [EMPTY_LEAD_ID, NORMAL_LEAD_ID],
        reveal_personal_emails=True, reveal_phone_number=False,
    )

    # The empty-entry lead must NOT appear in entries sent to bulk_match
    assert all("email" in e or "id" in e for e in received_entries), (
        f"Empty entry was sent to bulk_match: {received_entries}"
    )
    assert len(received_entries) == 1, (
        f"Only 1 entry (the normal lead) should reach bulk_match, got {len(received_entries)}"
    )

    # The empty-entry lead is counted as unmatched (not as a successful update)
    assert completed.get("unmatched", 0) >= 1, (
        f"Expected unmatched >= 1 for empty-entry lead, got {completed.get('unmatched')}"
    )
    assert completed.get("updated", 0) == 1, (
        f"Normal lead should still be updated, got updated={completed.get('updated')}"
    )
