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
    runs.mark_enrich_processing(m, run_id)
    runs.update_enrich_progress(m, run_id, processed=3, updated=2, unmatched=1, failed=0, errors=[])
    runs.complete_enrich_run(m, run_id, processed=5, updated=4, unmatched=1, failed=0, errors=[])
    doc = runs.get_enrich_run(m, TEST_ORG_ID, run_id)
    assert doc["status"] == "completed"
    assert doc["processed"] == 5
    assert doc["updated"] == 4
    assert doc["unmatched"] == 1
    assert doc["progress_percent"] == 100.0


def test_get_enrich_run_missing_raises():
    m = FakeMongo()
    with pytest.raises(ConnectorEnrichRunNotFoundError):
        runs.get_enrich_run(m, TEST_ORG_ID, "nope")


def test_stale_queued_run_detection():
    assert runs._is_stale_queued_run(
        {"status": "queued", "started_at": None, "created_at": "2000-01-01T00:00:00+00:00", "updated_at": None}
    ) is True
    assert runs._is_stale_queued_run({"status": "processing"}) is False
