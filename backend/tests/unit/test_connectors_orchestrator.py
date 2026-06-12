"""Orchestrator service functions + task bodies with fakes for every sibling seam."""
import pytest

from app.core.exceptions import (
    ApolloAPIError,
    ApolloCreditsExhaustedError,
    ConnectorCredentialsInvalidError,
    ConnectorNotConnectedError,
    MasterKeyRequiredError,
    ProfileIncompleteError,
)
from app.services.connectors import orchestrator
from app.services.connectors import runs
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

    def search_people(self, filters, *, page=1, per_page=10):
        if self.api_key == "bad":
            raise ConnectorCredentialsInvalidError("nope")
        return {"people": [{"id": "x"}], "pagination": {"page": 1, "total_pages": 1}}

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


def _complete_icp_dict():
    return {"id": "i1", "primary_region": "NA", "industry": ["SaaS"],
            "company_size": ["11-50", "51-200"], "buyer_role": ["VP Sales"], "fit_confidence": "high",
            "created_at": "2026-06-01T00:00:00Z"}


# ─── connection ───

def test_connect_validates_and_saves(monkeypatch, patched, fake_mongo):
    monkeypatch.setattr(orchestrator.warmup, "_icps_for_org", lambda m, o: [_complete_icp_dict()])
    saved = {}
    monkeypatch.setattr(orchestrator.credentials, "save_credentials",
                        lambda m, o, p, k, **kw: saved.update({"org": o, "key": k}) or {"status": "connected"})
    out = orchestrator.connect_apollo(fake_mongo, ApolloConnectRequest(org_id=TEST_ORG_ID, user_id=TEST_USER_ID, api_key="good"))
    assert out["connected"] is True
    assert saved["key"] == "good"


def test_connect_bad_key_raises_and_does_not_save(monkeypatch, patched, fake_mongo):
    monkeypatch.setattr(orchestrator.warmup, "_icps_for_org", lambda m, o: [_complete_icp_dict()])
    calls = []
    monkeypatch.setattr(orchestrator.credentials, "save_credentials", lambda *a, **k: calls.append(1))
    with pytest.raises(ConnectorCredentialsInvalidError):
        orchestrator.connect_apollo(fake_mongo, ApolloConnectRequest(org_id=TEST_ORG_ID, user_id=TEST_USER_ID, api_key="bad"))
    assert calls == []


def test_connect_blocks_when_profile_incomplete(monkeypatch, patched, fake_mongo):
    monkeypatch.setattr(orchestrator.warmup, "_icps_for_org", lambda m, o: [])  # no complete ICP
    with pytest.raises(ProfileIncompleteError):
        orchestrator.connect_apollo(fake_mongo, ApolloConnectRequest(org_id="org1", user_id="u1", api_key="good"))


def test_connect_probe_403_is_master_key_required(monkeypatch, fake_mongo):
    monkeypatch.setattr(orchestrator.warmup, "_icps_for_org", lambda m, o: [_complete_icp_dict()])

    class _Probe:
        def __init__(self, *a, **k): pass
        def search_people(self, *a, **k): raise ApolloAPIError("403 Forbidden")

    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", _Probe)
    with pytest.raises(MasterKeyRequiredError):
        orchestrator.connect_apollo(fake_mongo, ApolloConnectRequest(org_id="org1", user_id="u1", api_key="regular"))


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


# ─── skipped preservation across multi-chunk runs ───

def test_run_enrich_multi_chunk_skipped_preserved(monkeypatch, patched):
    """skipped (from missing leads) must carry through every update_enrich_progress call
    and the final complete_enrich_run across a multi-chunk run.

    Setup: BULK_MATCH_CHUNK leads returned + 1 extra missing lead_id (skipped=1).
    We request BULK_MATCH_CHUNK+1 lead_ids, but get_leads_by_ids returns only
    BULK_MATCH_CHUNK leads, producing 2 chunks and skipped=1.
    """
    chunk_size = orchestrator.apollo_mod.BULK_MATCH_CHUNK

    # Build BULK_MATCH_CHUNK lead records (enough for exactly 2 chunks when apollo
    # processes them, but we need at least chunk_size+1 to force 2 API chunks — so
    # we use chunk_size + 1 returned leads to force 2 iterations).
    base_leads = [
        {"lead_id": f"lead-{i}", "email": f"u{i}@x.com"}
        for i in range(chunk_size + 1)
    ]
    # One extra id that is NOT returned by get_leads_by_ids (the missing/skipped one).
    missing_id = "lead-missing"
    all_requested_ids = [ld["lead_id"] for ld in base_leads] + [missing_id]

    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda m, o, p="apollo": "good")
    monkeypatch.setattr(orchestrator.runs, "mark_enrich_processing", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.ingestion, "get_leads_by_ids",
                        lambda d, o, ids: base_leads)
    monkeypatch.setattr(orchestrator.ingestion, "enrich_fill_leads",
                        lambda *a, **k: {"updated": 1, "errors": []})

    progress_calls = []
    monkeypatch.setattr(orchestrator.runs, "update_enrich_progress",
                        lambda m, rid, **k: progress_calls.append(dict(k)))

    completed = {}
    monkeypatch.setattr(orchestrator.runs, "complete_enrich_run",
                        lambda m, rid, **k: completed.update(k))

    orchestrator._run_enrich(
        object(), object(), TEST_ORG_ID, TEST_USER_ID, "run-multi",
        all_requested_ids,
        reveal_personal_emails=True, reveal_phone_number=False,
    )

    # Must have produced at least 2 update_enrich_progress calls (one per chunk).
    assert len(progress_calls) >= 2, (
        f"Expected >= 2 update_enrich_progress calls for multi-chunk, got {len(progress_calls)}"
    )

    # Every intermediate progress call must carry skipped=1 (not reset to 0).
    for i, call in enumerate(progress_calls):
        assert call.get("skipped") == 1, (
            f"update_enrich_progress call {i} has skipped={call.get('skipped')}, expected 1"
        )

    # Final complete_enrich_run must also carry skipped=1.
    assert completed.get("skipped") == 1, (
        f"complete_enrich_run has skipped={completed.get('skipped')}, expected 1"
    )


# ─── task body: discover ───

class _DiscoFakeConnector:
    def __init__(self, *a, **k): pass
    def search_people(self, filters, *, page=1, per_page=100):
        if page > 1:
            return {"people": [], "pagination": {"page": page, "total_pages": 1}}
        return {"people": [
            {"id": "p1", "has_email": True, "title": "VP Sales",
             "organization": {"industry": "SaaS", "estimated_num_employees": 80}},
            {"id": "p2", "has_email": False, "title": "VP Sales",
             "organization": {"industry": "SaaS", "estimated_num_employees": 80}},  # dropped: no email
        ], "pagination": {"page": 1, "total_pages": 1}}
    def match_person(self, pid, **k):
        return ({"id": pid, "email": f"{pid}@x.com", "email_status": "verified",
                 "organization": {"name": "X", "primary_domain": "x.com"}}, 1)


def test_run_discover_reveals_only_has_email_and_ingests(monkeypatch, fake_mongo):
    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", _DiscoFakeConnector)
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda *a, **k: "key")
    monkeypatch.setattr(orchestrator.ingestion, "get_existing_apollo_contact_ids", lambda *a, **k: set())
    captured = {}
    monkeypatch.setattr(orchestrator.ingestion, "upsert_imported_leads",
                        lambda *a, **k: captured.update(k) or {"created": len(a[3]), "matched": 0, "errors": []})
    rid = runs.create_discovery_run(fake_mongo, "org1", "u1", icp_id="i1",
                                    icp_fingerprint="fp", mode="keep", max_leads=50)
    orchestrator._run_discover(object(), fake_mongo, "org1", "u1", rid, _complete_icp_dict(), "keep", 50)
    doc = runs.get_discovery_run(fake_mongo, "org1", rid)
    assert doc["status"] == "completed"
    assert doc["counts"]["revealed"] == 1          # p2 dropped (has_email False)
    assert doc["credits_consumed"] == 1
    assert captured["apollo_origin"] == "discovery"


def test_run_discover_replace_swaps_with_no_loss(monkeypatch, fake_mongo):
    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", _DiscoFakeConnector)
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda *a, **k: "key")
    monkeypatch.setattr(orchestrator.ingestion, "get_existing_apollo_contact_ids", lambda *a, **k: set())
    monkeypatch.setattr(orchestrator.ingestion, "upsert_imported_leads",
                        lambda *a, **k: {"created": 1, "matched": 0, "errors": []})
    order = []
    monkeypatch.setattr(orchestrator.ingestion, "tag_superseded_discovery_leads",
                        lambda d, o: order.append("tag") or 3)
    monkeypatch.setattr(orchestrator.ingestion, "delete_superseded_discovery_leads",
                        lambda d, o: order.append("delete") or 3)
    rid = runs.create_discovery_run(fake_mongo, "org1", "u1", icp_id="i1",
                                    icp_fingerprint="fp", mode="replace", max_leads=50)
    orchestrator._run_discover(object(), fake_mongo, "org1", "u1", rid, _complete_icp_dict(), "replace", 50)
    assert order == ["tag", "delete"]   # tag before run, delete only after ingest


def test_run_discover_partial_credit_wall_ingests_then_records_counts(monkeypatch, fake_mongo):
    from app.core.exceptions import ApolloCreditsExhaustedError

    class _CreditWall:
        def __init__(self, *a, **k): pass
        def search_people(self, filters, *, page=1, per_page=100):
            if page > 1:
                return {"people": [], "pagination": {"page": page, "total_pages": 1}}
            return {"people": [
                {"id": "p1", "has_email": True, "title": "VP Sales",
                 "organization": {"industry": "SaaS", "estimated_num_employees": 80}},
                {"id": "p2", "has_email": True, "title": "VP Sales",
                 "organization": {"industry": "SaaS", "estimated_num_employees": 80}},
            ], "pagination": {"page": 1, "total_pages": 1}}
        def match_person(self, pid, **k):
            if pid == "p1":
                return ({"id": "p1", "email": "p1@x.com", "email_status": "verified",
                         "organization": {"name": "X", "primary_domain": "x.com"}}, 1)
            raise ApolloCreditsExhaustedError("out of credits")

    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", _CreditWall)
    monkeypatch.setattr(orchestrator.apollo_mod, "_sleep", lambda *a, **k: None)  # no real throttle in tests
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda *a, **k: "key")
    monkeypatch.setattr(orchestrator.ingestion, "get_existing_apollo_contact_ids", lambda *a, **k: set())
    monkeypatch.setattr(orchestrator.ingestion, "upsert_imported_leads",
                        lambda *a, **k: {"created": len(a[3]), "matched": 0, "errors": []})
    low = {}
    monkeypatch.setattr(orchestrator.credentials, "set_low_credit", lambda m, o, p, v: low.update({"v": v}))
    rid = runs.create_discovery_run(fake_mongo, "org1", "u1", icp_id="i1",
                                    icp_fingerprint="fp", mode="keep", max_leads=50)
    orchestrator._run_discover(object(), fake_mongo, "org1", "u1", rid, _complete_icp_dict(), "keep", 50)
    doc = runs.get_discovery_run(fake_mongo, "org1", rid)
    assert doc["status"] == "partial"
    assert doc["counts"]["created"] == 1     # p1 ingested despite the wall
    assert doc["credits_consumed"] == 1
    assert low["v"] is True                  # UC10 flag set


def test_run_discover_replace_partial_restores_on_credit_wall(monkeypatch, fake_mongo):
    from app.core.exceptions import ApolloCreditsExhaustedError

    class _CreditWall:
        def __init__(self, *a, **k): pass
        def search_people(self, filters, *, page=1, per_page=100):
            if page > 1:
                return {"people": [], "pagination": {"page": page, "total_pages": 1}}
            return {"people": [
                {"id": "p1", "has_email": True, "title": "VP Sales",
                 "organization": {"industry": "SaaS", "estimated_num_employees": 80}},
                {"id": "p2", "has_email": True, "title": "VP Sales",
                 "organization": {"industry": "SaaS", "estimated_num_employees": 80}},
            ], "pagination": {"page": 1, "total_pages": 1}}
        def match_person(self, pid, **k):
            if pid == "p1":
                return ({"id": "p1", "email": "p1@x.com", "email_status": "verified",
                         "organization": {"name": "X", "primary_domain": "x.com"}}, 1)
            raise ApolloCreditsExhaustedError("out of credits")

    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", _CreditWall)
    monkeypatch.setattr(orchestrator.apollo_mod, "_sleep", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda *a, **k: "key")
    monkeypatch.setattr(orchestrator.credentials, "set_low_credit", lambda *a, **k: None)
    monkeypatch.setattr(orchestrator.ingestion, "get_existing_apollo_contact_ids", lambda *a, **k: set())
    monkeypatch.setattr(orchestrator.ingestion, "upsert_imported_leads",
                        lambda *a, **k: {"created": 1, "matched": 0, "errors": []})
    calls = []
    monkeypatch.setattr(orchestrator.ingestion, "tag_superseded_discovery_leads", lambda d, o: calls.append("tag") or 3)
    monkeypatch.setattr(orchestrator.ingestion, "clear_superseded_discovery_leads", lambda d, o: calls.append("clear") or 3)
    monkeypatch.setattr(orchestrator.ingestion, "delete_superseded_discovery_leads", lambda d, o: calls.append("delete") or 3)
    rid = runs.create_discovery_run(fake_mongo, "org1", "u1", icp_id="i1",
                                    icp_fingerprint="fp", mode="replace", max_leads=50)
    orchestrator._run_discover(object(), fake_mongo, "org1", "u1", rid, _complete_icp_dict(), "replace", 50)
    doc = runs.get_discovery_run(fake_mongo, "org1", rid)
    assert doc["status"] == "partial"
    assert calls == ["tag", "clear"]   # restored (no-loss), NOT committed via delete
    assert "delete" not in calls


# ─── D1: completed_empty when nothing qualifies ───

def test_run_discover_completed_empty_when_nothing_qualifies(monkeypatch, fake_mongo):
    class _NoEmailConnector:
        def __init__(self, *a, **k): pass
        def search_people(self, filters, *, page=1, per_page=100):
            if page > 1:
                return {"people": [], "pagination": {"page": page, "total_pages": 1}}
            return {"people": [
                {"id": "p1", "has_email": False, "title": "VP Sales",
                 "organization": {"industry": "SaaS", "estimated_num_employees": 80}},
            ], "pagination": {"page": 1, "total_pages": 1}}
        def match_person(self, pid, **k):
            raise AssertionError("match_person must not be called when nothing qualifies")

    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", _NoEmailConnector)
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda *a, **k: "key")
    monkeypatch.setattr(orchestrator.ingestion, "get_existing_apollo_contact_ids", lambda *a, **k: set())
    rid = runs.create_discovery_run(fake_mongo, "org1", "u1", icp_id="i1",
                                    icp_fingerprint="fp", mode="keep", max_leads=50)
    orchestrator._run_discover(object(), fake_mongo, "org1", "u1", rid, _complete_icp_dict(), "keep", 50)
    doc = runs.get_discovery_run(fake_mongo, "org1", rid)
    assert doc["status"] == "completed_empty"
    assert doc["counts"]["revealed"] == 0
    assert doc["counts"]["created"] == 0
    assert doc["credits_consumed"] == 0


# ─── D2: invalid credentials mid-run fails run + sets status error ───

def test_run_discover_invalid_credentials_fails_run(monkeypatch, fake_mongo):
    class _BadKeyConnector:
        def __init__(self, *a, **k): pass
        def search_people(self, *a, **k):
            raise ConnectorCredentialsInvalidError("401 invalid")
        def match_person(self, *a, **k):
            raise AssertionError("should not reach reveal")

    monkeypatch.setattr(orchestrator.apollo_mod, "ApolloConnector", _BadKeyConnector)
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda *a, **k: "key")
    monkeypatch.setattr(orchestrator.ingestion, "get_existing_apollo_contact_ids", lambda *a, **k: set())
    status_calls = {}
    monkeypatch.setattr(orchestrator.credentials, "set_status",
                        lambda m, o, p, s: status_calls.update({"status": s}))
    rid = runs.create_discovery_run(fake_mongo, "org1", "u1", icp_id="i1",
                                    icp_fingerprint="fp", mode="keep", max_leads=50)
    orchestrator._run_discover(object(), fake_mongo, "org1", "u1", rid, _complete_icp_dict(), "keep", 50)
    doc = runs.get_discovery_run(fake_mongo, "org1", rid)
    assert doc["status"] == "failed"
    assert status_calls.get("status") == "error"
