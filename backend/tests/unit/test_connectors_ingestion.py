"""Ingestion partition/dedup + tx behavior against a fake Neo4j driver that
actually runs the transaction function body."""
from app.services.connectors import ingestion
from app.services.connectors.ingestion import (
    _dedupe_import_records,
    get_leads_by_ids,
    get_existing_apollo_contact_ids,
)
from tests.identities import TEST_ORG_ID, TEST_USER_ID


class FakeTx:
    """Records tx.run calls; returns canned 'matched idx' rows keyed off the Cypher
    comment marker, so the test never depends on free-form Cypher text (review F9)."""
    def __init__(self, matched_idxs):
        self.calls = []
        self._matched = set(matched_idxs)

    def run(self, query, **params):
        self.calls.append((query, params))
        rows = params.get("rows", [])
        if "connector:import-update" in query:
            return [{"idx": r["idx"]} for r in rows if r["idx"] in self._matched]
        if "connector:enrich-update" in query:
            # enrich matches by lead_id; the fake treats every target lead as present
            return [{"idx": r["idx"]} for r in rows]
        return []  # import-create returns nothing


class FakeSession:
    def __init__(self, tx):
        self._tx = tx

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute_write(self, fn, *a, **k):
        return fn(self._tx, *a, **k)

    def execute_read(self, fn, *a, **k):
        return fn(self._tx, *a, **k)


class FakeDriver:
    def __init__(self, tx):
        self._tx = tx

    def session(self):
        return FakeSession(self._tx)


def _rec(idx, email_norm=None, apollo_id=None):
    return {
        "name": f"n{idx}", "first_name": None, "last_name": None,
        "email": (email_norm or None), "title": None, "seniority": None,
        "company_name": None, "company_domain": None, "phone": None,
        "linkedin_url": None, "location": None,
        "email_norm": email_norm, "company_domain_norm": None,
        "apollo_contact_id": apollo_id, "apollo_raw": "{}",
    }


def test_dedupe_keeps_first_per_email_then_contact_id():
    recs = [_rec(0, email_norm="a@x.com"), _rec(1, email_norm="a@x.com"), _rec(2, apollo_id="c9")]
    out = _dedupe_import_records(recs)
    assert len(out) == 2
    assert out[0]["email_norm"] == "a@x.com"
    assert out[1]["apollo_contact_id"] == "c9"


def test_dedupe_keeps_records_without_any_key():
    recs = [_rec(0), _rec(1)]  # no email, no apollo id
    out = _dedupe_import_records(recs)
    assert len(out) == 2  # nothing to dedup on -> both kept


def test_import_creates_residue_and_counts_matches():
    # idx 0 matches an existing lead; idx 1 does not -> created.
    tx = FakeTx(matched_idxs={0})
    driver = FakeDriver(tx)
    records = [_rec(0, email_norm="a@x.com"), _rec(1, email_norm="b@x.com")]
    result = ingestion.upsert_imported_leads(
        driver, TEST_ORG_ID, TEST_USER_ID, records, file_id="file-1", source="apollo", chunk_size=500
    )
    assert result["matched"] == 1
    assert result["created"] == 1
    assert result["errors"] == []
    # A CREATE query ran carrying exactly the residue row with a minted lead_id.
    create_calls = [c for c in tx.calls if "connector:import-create" in c[0]]
    assert len(create_calls) == 1
    created_rows = create_calls[0][1]["rows"]
    assert len(created_rows) == 1
    assert created_rows[0]["email_norm"] == "b@x.com"
    assert created_rows[0]["lead_id"]  # minted


def test_import_all_matched_creates_nothing():
    tx = FakeTx(matched_idxs={0, 1})
    driver = FakeDriver(tx)
    records = [_rec(0, email_norm="a@x.com"), _rec(1, email_norm="b@x.com")]
    result = ingestion.upsert_imported_leads(
        driver, TEST_ORG_ID, TEST_USER_ID, records, file_id="file-1"
    )
    assert result["matched"] == 2
    assert result["created"] == 0
    assert [c for c in tx.calls if "connector:import-create" in c[0]] == []


def test_enrich_fill_updates_by_lead_id():
    tx = FakeTx(matched_idxs=set())  # enrich-update returns all rows regardless
    driver = FakeDriver(tx)
    rec = _rec(0, email_norm="a@x.com")
    rec["lead_id"] = "lead-7"
    result = ingestion.enrich_fill_leads(driver, TEST_ORG_ID, [rec], source="apollo")
    assert result["updated"] == 1
    # the enrich query is identified by its marker and matches by lead_id
    enrich_calls = [c for c in tx.calls if "connector:enrich-update" in c[0]]
    assert len(enrich_calls) == 1
    assert enrich_calls[0][1]["rows"][0]["lead_id"] == "lead-7"


def test_get_leads_by_ids_builds_query(monkeypatch):
    """get_leads_by_ids must use execute_read (managed read transaction), not bare session.run."""
    captured = {}

    class _FakeTxR:
        def run(self, q, **p):
            captured["q"] = q
            captured["p"] = p
            return []

    class _Sess:
        def __init__(self):
            self._tx = _FakeTxR()
            self.read_called = False

        def __enter__(self): return self
        def __exit__(self, *a): return False

        def execute_read(self, fn, *a, **k):
            self.read_called = True
            return fn(self._tx, *a, **k)

    _sess_instance = _Sess()

    class _Drv:
        def session(self): return _sess_instance

    # _records_to_dicts is defined in ingestion; patch where used.
    monkeypatch.setattr(ingestion, "_records_to_dicts", lambda r: [])
    get_leads_by_ids(_Drv(), TEST_ORG_ID, ["l1", "l2"])
    assert _sess_instance.read_called, "execute_read must be used (not bare session.run)"
    assert captured["p"]["org_id"] == TEST_ORG_ID
    assert captured["p"]["lead_ids"] == ["l1", "l2"]


def test_dedupe_email_and_contact_id_second_contact_only():
    """A record with BOTH email and apollo_contact_id must register the contact_id in
    seen_contact so a later record with the same contact_id (but no email) is deduped."""
    # rec A: has email E + apollo_contact_id K
    # rec B: has apollo_contact_id K, no email
    # Expected: only rec A survives (rec B deduped as same contact)
    rec_a = _rec(0, email_norm="e@x.com", apollo_id="K")
    rec_b = _rec(1, apollo_id="K")
    out = _dedupe_import_records([rec_a, rec_b])
    assert len(out) == 1, f"expected 1 record after dedup, got {len(out)}"
    assert out[0]["email_norm"] == "e@x.com"


# ---------------------------------------------------------------------------
# Task 5: apollo_origin + discovery_run_id on import-create
# ---------------------------------------------------------------------------

def test_upsert_passes_origin_and_run_id():
    """apollo_origin and discovery_run_id must appear as tx.run params on the
    import-create call so the Cypher can SET them on the created node."""
    # matched_idxs=set() means no update matches -> both records go to create path
    tx = FakeTx(matched_idxs=set())
    driver = FakeDriver(tx)
    recs = [{"apollo_contact_id": "p1", "email": "a@x.com", "email_norm": "a@x.com",
             "company_domain_norm": "x.com", "company_domain": "x.com",
             "company_name": "X", "name": "A", "first_name": None, "last_name": None,
             "title": None, "seniority": None, "phone": None, "linkedin_url": None,
             "location": None, "apollo_raw": "{}"}]
    ingestion.upsert_imported_leads(
        driver, TEST_ORG_ID, TEST_USER_ID, recs,
        file_id="f1", source="apollo",
        apollo_origin="discovery", discovery_run_id="run1",
    )
    create_calls = [c for c in tx.calls if "connector:import-create" in c[0]]
    assert len(create_calls) == 1, "expected exactly one import-create call"
    params = create_calls[0][1]
    assert params["apollo_origin"] == "discovery"
    assert params["discovery_run_id"] == "run1"


def test_upsert_origin_defaults_to_none():
    """When apollo_origin / discovery_run_id are omitted, params default to None
    (not missing) so the Cypher SET coalesce doesn't error."""
    tx = FakeTx(matched_idxs=set())
    driver = FakeDriver(tx)
    recs = [_rec(0, email_norm="a@x.com")]
    ingestion.upsert_imported_leads(
        driver, TEST_ORG_ID, TEST_USER_ID, recs, file_id="f1"
    )
    create_calls = [c for c in tx.calls if "connector:import-create" in c[0]]
    assert len(create_calls) == 1
    params = create_calls[0][1]
    assert params["apollo_origin"] is None
    assert params["discovery_run_id"] is None


# ---------------------------------------------------------------------------
# Task 5: get_existing_apollo_contact_ids — superseded exclusion
# ---------------------------------------------------------------------------

class _FakeRecord:
    """Minimal Neo4j Record stand-in: exposes .data() returning the row dict."""

    def __init__(self, row: dict):
        self._row = row

    def data(self) -> dict:
        return self._row


class _SeedTx:
    """Fake tx for read-only tests: returns seeded lead rows when queried."""

    def __init__(self, leads):
        self._leads = leads  # list of dicts with org_id, apollo_contact_id, superseded

    def run(self, query, **params):
        org = params.get("org_id")
        include_superseded = "coalesce(l.superseded, false) = false" not in query
        result = []
        for l in self._leads:
            if l.get("org_id") != org:
                continue
            if l.get("apollo_contact_id") is None:
                continue
            if not include_superseded and l.get("superseded") is True:
                continue
            result.append(_FakeRecord({"cid": l["apollo_contact_id"]}))
        return result


class _SeedSession:
    def __init__(self, tx):
        self._tx = tx

    def __enter__(self): return self
    def __exit__(self, *a): return False

    def execute_read(self, fn, *a, **k):
        return fn(self._tx, *a, **k)


class _SeedDriver:
    def __init__(self, leads):
        self._tx = _SeedTx(leads)

    def session(self):
        return _SeedSession(self._tx)


def test_existing_apollo_contact_ids_excludes_superseded():
    """include_superseded=False (default) must exclude leads where superseded=True."""
    driver = _SeedDriver([
        {"org_id": TEST_ORG_ID, "apollo_contact_id": "p1", "superseded": None},
        {"org_id": TEST_ORG_ID, "apollo_contact_id": "p2", "superseded": True},
    ])
    ids = get_existing_apollo_contact_ids(driver, TEST_ORG_ID, include_superseded=False)
    assert ids == {"p1"}


def test_existing_apollo_contact_ids_includes_superseded_when_requested():
    """include_superseded=True must return all contact ids regardless of superseded flag."""
    driver = _SeedDriver([
        {"org_id": TEST_ORG_ID, "apollo_contact_id": "p1", "superseded": None},
        {"org_id": TEST_ORG_ID, "apollo_contact_id": "p2", "superseded": True},
    ])
    ids = get_existing_apollo_contact_ids(driver, TEST_ORG_ID, include_superseded=True)
    assert ids == {"p1", "p2"}


def test_existing_apollo_contact_ids_excludes_null_cid():
    """A lead with apollo_contact_id=None must not appear in the returned set
    (the set comprehension filters via `if r.get("cid")`)."""
    driver = _SeedDriver([
        {"org_id": TEST_ORG_ID, "apollo_contact_id": "p1", "superseded": None},
        {"org_id": TEST_ORG_ID, "apollo_contact_id": None, "superseded": None},
    ])
    ids = get_existing_apollo_contact_ids(driver, TEST_ORG_ID)
    assert ids == {"p1"}
