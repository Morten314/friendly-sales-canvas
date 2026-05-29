"""get_stream_status surfaces the apollo import fields (source/matched_count/capped)."""
from app.services.leads import get_stream_status
from app.models.leads import StreamFileEntry
from tests.identities import TEST_ORG_ID

class FakeCursor(list):
    def sort(self, *a, **k):
        return self

class FakeColl:
    def __init__(self, docs):
        self._docs = docs

    def find(self, flt):
        return FakeCursor(self._docs)

class FakeMongo:
    def __init__(self, docs):
        self._docs = docs

    def __getitem__(self, _db):
        return {"Lead_Stream_Files": FakeColl(self._docs)}

def test_stream_status_includes_apollo_fields():
    docs = [{
        "file_id": "f1", "filename": "My Apollo Batch", "uploaded_at": "t",
        "last_processed_at": "t2", "total_rows": 10, "created_count": 7,
        "error_count": 0, "processing_status": "completed",
        "source": "apollo", "matched_count": 3, "capped": False,
    }]
    out = get_stream_status(FakeMongo(docs), TEST_ORG_ID)
    entry = out["files"][0]
    assert entry["source"] == "apollo"
    assert entry["matched_count"] == 3
    assert entry["capped"] is False

def test_stream_file_entry_defaults_for_csv():
    # A CSV doc with none of the new fields validates with defaults.
    entry = StreamFileEntry(file_id="f2")
    assert entry.source is None
    assert entry.matched_count == 0
    assert entry.capped is False
