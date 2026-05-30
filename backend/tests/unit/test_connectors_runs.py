"""Import-batch + enrich run-doc lifecycle against a fake Mongo collection."""
import pytest

from app.core.exceptions import ConnectorEnrichRunNotFoundError
from app.services.connectors import runs
from tests.identities import TEST_ORG_ID, TEST_USER_ID


class FakeCollection:
    def __init__(self):
        self.docs = []

    def insert_one(self, doc):
        self.docs.append(dict(doc))

    def update_one(self, flt, update, upsert=False):
        for d in self.docs:
            if all(d.get(k) == v for k, v in flt.items()):
                d.update(update.get("$set", {}))
                return
        if upsert:
            doc = dict(flt)
            doc.update(update.get("$set", {}))
            self.docs.append(doc)

    def find_one(self, flt, sort=None):
        def _match(d):
            for k, v in flt.items():
                if isinstance(v, dict) and "$in" in v:
                    if d.get(k) not in v["$in"]:
                        return False
                elif d.get(k) != v:
                    return False
            return True

        matches = [d for d in self.docs if _match(d)]
        if sort:
            key, direction = sort[0]
            matches.sort(key=lambda d: d.get(key) or "", reverse=(direction < 0))
        return dict(matches[0]) if matches else None


class _Proxy:
    def __init__(self, store):
        self._store = store

    def __getitem__(self, coll_name):
        return self._store.setdefault(coll_name, FakeCollection())


class FakeMongo:
    def __init__(self):
        self._store = {}

    def __getitem__(self, _db_name):
        return _Proxy(self._store)


def test_import_batch_create_then_complete():
    m = FakeMongo()
    file_id = runs.create_import_batch(m, TEST_ORG_ID, TEST_USER_ID, "My Apollo Batch")
    assert file_id
    coll = m["Profiler"]["Lead_Stream_Files"]
    doc = coll.find_one({"file_id": file_id})
    assert doc["processing_status"] == "processing"
    assert doc["source"] == "apollo"
    assert doc["filename"] == "My Apollo Batch"

    runs.complete_import_batch(
        m, file_id, total_rows=10, created_count=7, matched_count=3, error_count=0, capped=False
    )
    doc = coll.find_one({"file_id": file_id})
    assert doc["processing_status"] == "completed"
    assert doc["created_count"] == 7
    assert doc["matched_count"] == 3
    assert doc["capped"] is False


def test_import_batch_fail():
    m = FakeMongo()
    file_id = runs.create_import_batch(m, TEST_ORG_ID, TEST_USER_ID, "X")
    runs.fail_import_batch(m, file_id, "bad key")
    doc = m["Profiler"]["Lead_Stream_Files"].find_one({"file_id": file_id})
    assert doc["processing_status"] == "failed"
    assert "bad key" in doc["message"]


def test_enrich_run_create_process_complete():
    m = FakeMongo()
    run_id = runs.create_enrich_run(m, TEST_ORG_ID, TEST_USER_ID, total=5)
    assert run_id
    # new run doc includes skipped=0
    coll = m["Profiler"]["Connector_Enrich_Runs"]
    raw = coll.find_one({"run_id": run_id})
    assert raw["skipped"] == 0

    runs.mark_enrich_processing(m, run_id)
    runs.update_enrich_progress(m, run_id, processed=3, updated=2, unmatched=1, failed=0, errors=[], skipped=0)
    runs.complete_enrich_run(m, run_id, processed=4, updated=4, unmatched=0, failed=0, errors=[], skipped=1)
    doc = runs.get_enrich_run(m, TEST_ORG_ID, run_id)
    assert doc["status"] == "completed"
    assert doc["processed"] == 4
    assert doc["updated"] == 4
    assert doc["skipped"] == 1
    # progress_percent numerator is processed + skipped = 4 + 1 = 5 == total → 100%
    assert doc["progress_percent"] == 100.0


def test_get_enrich_run_missing_raises():
    m = FakeMongo()
    with pytest.raises(ConnectorEnrichRunNotFoundError):
        runs.get_enrich_run(m, TEST_ORG_ID, "nope")


def test_stale_queued_run_detection():
    assert runs._is_stale_run(
        {"status": "queued", "started_at": None, "created_at": "2000-01-01T00:00:00+00:00", "updated_at": None}
    ) is True
    # queued run with a fresh updated_at is NOT stale
    from datetime import datetime, timezone
    fresh = datetime.now(timezone.utc).isoformat()
    assert runs._is_stale_run(
        {"status": "queued", "started_at": None, "updated_at": fresh, "created_at": "2000-01-01T00:00:00+00:00"}
    ) is False


def test_stale_processing_run_detected():
    # processing run with an ancient updated_at (and started_at) is stale
    assert runs._is_stale_run(
        {
            "status": "processing",
            "started_at": "2000-01-01T00:00:00+00:00",
            "updated_at": "2000-01-01T00:01:00+00:00",
        }
    ) is True
    # processing run with a fresh updated_at is NOT stale (live run advancing its timestamp)
    from datetime import datetime, timezone
    fresh = datetime.now(timezone.utc).isoformat()
    assert runs._is_stale_run(
        {
            "status": "processing",
            "started_at": "2000-01-01T00:00:00+00:00",
            "updated_at": fresh,
        }
    ) is False


def test_stale_run_ignores_terminal_statuses():
    # completed and failed runs are never considered stale
    assert runs._is_stale_run({"status": "completed", "updated_at": "2000-01-01T00:00:00+00:00"}) is False
    assert runs._is_stale_run({"status": "failed", "updated_at": "2000-01-01T00:00:00+00:00"}) is False


def test_fail_stale_enrich_runs_sets_updated_at():
    """fail_stale_enrich_runs must route through _update_run so updated_at is auto-stamped."""
    m = FakeMongo()
    run_id = runs.create_enrich_run(m, TEST_ORG_ID, TEST_USER_ID, total=3)
    # Force the run's updated_at to an ancient timestamp so _is_stale_run triggers.
    coll = m["Profiler"]["Connector_Enrich_Runs"]
    doc = coll.find_one({"run_id": run_id})
    doc["updated_at"] = "2000-01-01T00:00:00+00:00"
    doc["created_at"] = "2000-01-01T00:00:00+00:00"
    # Patch it back directly.
    for d in coll.docs:
        if d.get("run_id") == run_id:
            d["updated_at"] = "2000-01-01T00:00:00+00:00"
            d["created_at"] = "2000-01-01T00:00:00+00:00"

    runs.fail_stale_enrich_runs(m, TEST_ORG_ID)

    after = coll.find_one({"run_id": run_id})
    assert after["status"] == "failed"
    assert after.get("finished_at") is not None, "finished_at must be set"
    # _update_run always stamps updated_at; verify it's no longer the ancient value
    assert after.get("updated_at") != "2000-01-01T00:00:00+00:00", (
        "updated_at must be refreshed by _update_run"
    )
    assert any("stale" in e.lower() or "auto-failed" in e.lower()
               for e in after.get("errors", [])), "errors must mention stale/auto-failed"
