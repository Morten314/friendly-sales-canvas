"""Credential store against a fake Mongo (dict-backed collection)."""
import pytest

from app.core.exceptions import ConnectorNotConnectedError
from app.services.connectors import credentials
from tests.identities import TEST_ORG_ID


class FakeCollection:
    def __init__(self):
        self.docs = []
        self.indexes = []

    def create_index(self, keys, **kwargs):
        self.indexes.append((keys, kwargs))

    def update_one(self, flt, update, upsert=False):
        for d in self.docs:
            if all(d.get(k) == v for k, v in flt.items()):
                d.update(update.get("$set", {}))
                # $setOnInsert is ignored on existing docs (real MongoDB behaviour)
                return
        if upsert:
            doc = dict(flt)
            doc.update(update.get("$set", {}))
            doc.update(update.get("$setOnInsert", {}))
            self.docs.append(doc)

    def find_one(self, flt):
        for d in self.docs:
            if all(d.get(k) == v for k, v in flt.items()):
                return dict(d)
        return None

    def delete_one(self, flt):
        before = len(self.docs)
        self.docs = [d for d in self.docs if not all(d.get(k) == v for k, v in flt.items())]

        class _R:
            deleted_count = before - len(self.docs)
        return _R()


class _Proxy:
    """Profiler[<coll>] -> FakeCollection (stable per name)."""
    def __init__(self, store):
        self._store = store

    def __getitem__(self, coll_name):
        return self._store.setdefault(coll_name, FakeCollection())


class FakeMongo:
    def __init__(self):
        self._store = {}

    def __getitem__(self, _db_name):
        return _Proxy(self._store)


def test_save_then_get():
    m = FakeMongo()
    credentials.save_credentials(m, TEST_ORG_ID, "apollo", "secret-key")
    doc = credentials.get_credentials(m, TEST_ORG_ID, "apollo")
    assert doc["api_key"] == "secret-key"
    assert doc["status"] == "connected"
    assert doc["connected_at"]


def test_get_api_key_raises_when_missing():
    m = FakeMongo()
    with pytest.raises(ConnectorNotConnectedError):
        credentials.get_api_key(m, TEST_ORG_ID, "apollo")


def test_get_api_key_returns_stored():
    m = FakeMongo()
    credentials.save_credentials(m, TEST_ORG_ID, "apollo", "k2")
    assert credentials.get_api_key(m, TEST_ORG_ID, "apollo") == "k2"


def test_delete_credentials():
    m = FakeMongo()
    credentials.save_credentials(m, TEST_ORG_ID, "apollo", "k3")
    assert credentials.delete_credentials(m, TEST_ORG_ID, "apollo") is True
    assert credentials.get_credentials(m, TEST_ORG_ID, "apollo") is None


def test_set_status():
    m = FakeMongo()
    credentials.save_credentials(m, TEST_ORG_ID, "apollo", "k4")
    credentials.set_status(m, TEST_ORG_ID, "apollo", "error")
    assert credentials.get_credentials(m, TEST_ORG_ID, "apollo")["status"] == "error"


def test_ensure_indexes_idempotent():
    m = FakeMongo()
    credentials._ensure_connectors_indexes(m)  # should not raise
    credentials._ensure_connectors_indexes(m)


def test_set_low_credit(fake_mongo):
    credentials.save_credentials(fake_mongo, "org1", "apollo", "k")
    credentials.set_low_credit(fake_mongo, "org1", "apollo", True)
    assert credentials.get_credentials(fake_mongo, "org1", "apollo")["low_credit"] is True


def test_save_credentials_update_returns_original_connected_at(monkeypatch):
    """Second save (update) must return the PERSISTED connected_at, not the new now."""
    times = iter(["2020-01-01T00:00:00+00:00", "2030-06-15T12:00:00+00:00"])
    monkeypatch.setattr(credentials, "_now", lambda: next(times))

    m = FakeMongo()
    first = credentials.save_credentials(m, TEST_ORG_ID, "apollo", "k1")
    second = credentials.save_credentials(m, TEST_ORG_ID, "apollo", "k1-updated")

    assert first["connected_at"] == "2020-01-01T00:00:00+00:00"
    # The second save is an UPDATE — connected_at must equal the original insert time
    assert second["connected_at"] == "2020-01-01T00:00:00+00:00"
    assert second["connected_at"] != "2030-06-15T12:00:00+00:00"
