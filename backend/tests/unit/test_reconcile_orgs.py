"""Unit tests for org reconciliation --report/--apply logic (spec 46 WS3,
Tasks 8-9).

Pure unit tests against build_report/apply_report and the per-store repoint
functions — no live Mongo/Neo4j/Pinecone clients involved, only hand-rolled
fakes. _scan_data_orgs / load_inputs are exercised live on Render (sandbox
cannot reach prod DBs — see spec 46 constraints).
"""
from types import SimpleNamespace
from unittest.mock import patch

from app.services.org_auth.reconcile import build_report

VALID = "b75ce29e-344c-4e6c-964e-5ac236d0b49a"


# ---------------------------------------------------------------------------
# Shared fakes for the --apply tests below. Kept simple/non-stateful (fixed
# return values, call recording) for tests that only check call shape; the
# idempotency test below builds its own small stateful fakes because it needs
# real filter-matching behavior across two apply_report() calls.
# ---------------------------------------------------------------------------


class FakeColl:
    """Non-stateful Mongo collection stand-in: records calls, returns a fixed
    modified_count. Good enough for tests that only assert filter/update shape."""

    def __init__(self, modified_count=1):
        self.calls = []
        self._modified_count = modified_count

    def update_many(self, flt, upd):
        self.calls.append((flt, upd))
        return type("R", (), {"modified_count": self._modified_count})()


class FakeDB(dict):
    def __missing__(self, key):
        self[key] = FakeColl()
        return self[key]


class FakeMongo(dict):
    def __missing__(self, key):
        self[key] = FakeDB()
        return self[key]


class _UsersColl:
    """Minimal find_one-only stand-in for the Org_Management.users doc."""

    def __init__(self, user_mappings):
        self._doc = {"user_mappings": user_mappings}

    def find_one(self, *_a, **_kw):
        return self._doc


def test_flags_noncanonical_data_for_migration():
    r = build_report(
        user_mappings={"A5Bfx": VALID},
        org_list=[VALID],
        data_orgs_by_user={"A5Bfx": {VALID: 396, "A5Bfx": 197, "brewra": 3}},
    )
    assert r.migrations["A5Bfx"] == {"A5Bfx": 197, "brewra": 3}  # canonical VALID excluded
    assert not r.ambiguous


def test_flags_user_whose_mapping_is_noncanonical_as_ambiguous():
    r = build_report(
        user_mappings={"u2": "u2"},            # mapping itself is a uid, not a UUID
        org_list=[VALID],
        data_orgs_by_user={"u2": {"u2": 10}},
    )
    assert ("u2", ) == tuple(a[0] for a in r.ambiguous)  # surfaced, not auto-migrated
    assert "u2" not in r.migrations


def test_clean_user_yields_no_migration():
    r = build_report({"u3": VALID}, [VALID], {"u3": {VALID: 5}})
    assert "u3" not in r.migrations


# ---------------------------------------------------------------------------
# Task 9: per-store repoint functions
# ---------------------------------------------------------------------------


def test_repoint_neo4j_issues_setter_cypher_scoped_to_user_and_org():
    calls = []

    class FakeSession:
        def run(self, q, **p):
            calls.append((q, p))
            return type("R", (), {"single": lambda s: {"n": 3}})()

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    class FakeDriver:
        def session(self):
            return FakeSession()

    from app.services.org_auth.reconcile import repoint_neo4j

    n = repoint_neo4j(FakeDriver(), "A5Bfx", "brewra", "b75ce29e")
    assert n == 3
    q, p = calls[0]
    assert "SET" in q and "org_id" in q
    assert p == {"uid": "A5Bfx", "from_org": "brewra", "to_org": "b75ce29e"}


def test_repoint_mongo_updates_all_matching_docs():
    from app.services.org_auth.reconcile import (
        repoint_mongo,
        _MONGO_ORG_COLLECTIONS,
        _MONGO_ORG_ONLY_COLLECTIONS,
    )

    mongo = FakeMongo()
    total = repoint_mongo(mongo, "A5Bfx", "brewra", VALID)

    # one modified doc recorded per user-keyed collection
    assert total == len(_MONGO_ORG_COLLECTIONS)
    for dbname, coll in _MONGO_ORG_COLLECTIONS:
        flt, upd = mongo[dbname][coll].calls[0]
        assert flt == {"user_id": "A5Bfx", "org_id": "brewra"}
        assert upd == {"$set": {"org_id": VALID}}

    # org-only collections have a different filter shape (no user_id field
    # exists on their docs) -- repoint_mongo must never touch them, or it
    # would silently write a filter that matches nothing there forever.
    for dbname, coll in _MONGO_ORG_ONLY_COLLECTIONS:
        assert mongo[dbname][coll].calls == []


def test_repoint_mongo_org_only_updates_org_scoped_docs():
    from app.services.org_auth.reconcile import (
        repoint_mongo_org_only,
        _MONGO_ORG_COLLECTIONS,
        _MONGO_ORG_ONLY_COLLECTIONS,
    )

    mongo = FakeMongo()
    total = repoint_mongo_org_only(mongo, "brewra", VALID)

    assert total == len(_MONGO_ORG_ONLY_COLLECTIONS)
    for dbname, coll in _MONGO_ORG_ONLY_COLLECTIONS:
        flt, upd = mongo[dbname][coll].calls[0]
        assert flt == {"org_id": "brewra"}  # no user_id -- these docs never carry one
        assert upd == {"$set": {"org_id": VALID}}

    # the reverse leak: org-only repoint must not touch the user-keyed set
    for dbname, coll in _MONGO_ORG_COLLECTIONS:
        assert mongo[dbname][coll].calls == []


def test_iter_vector_ids_pages_through_namespace():
    from app.services.org_auth.reconcile import _iter_vector_ids

    class FakeIndexList:
        def __init__(self):
            self.calls = []

        def list(self, namespace, limit):
            self.calls.append((namespace, limit))
            ids = ["v1", "v2", "v3", "v4", "v5"]
            for i in range(0, len(ids), limit):
                yield ids[i : i + limit]

    idx = FakeIndexList()
    pages = list(_iter_vector_ids(idx, "brewra", page_size=2))

    assert pages == [["v1", "v2"], ["v3", "v4"], ["v5"]]
    assert idx.calls == [("brewra", 2)]


def test_repoint_pinecone_moves_vectors_and_deletes_source():
    from app.services.org_auth.reconcile import repoint_pinecone

    class FakeVector:
        def __init__(self, id):
            self.id = id

    class FakeFetchResp:
        def __init__(self, vectors):
            self.vectors = vectors

    class FakeIndex:
        def __init__(self, namespaces):
            self.namespaces = namespaces
            self.delete_calls = []

        def list(self, namespace, limit=100):
            ids = list(self.namespaces.get(namespace, {}).keys())
            for i in range(0, len(ids), limit):
                yield ids[i : i + limit]

        def fetch(self, ids, namespace):
            ns = self.namespaces.get(namespace, {})
            return FakeFetchResp({i: ns[i] for i in ids if i in ns})

        def upsert(self, vectors, namespace):
            ns = self.namespaces.setdefault(namespace, {})
            for v in vectors:
                ns[v.id] = v

        def delete(self, delete_all, namespace):
            self.delete_calls.append((delete_all, namespace))
            self.namespaces[namespace] = {}

    index = FakeIndex({"brewra": {"v1": FakeVector("v1"), "v2": FakeVector("v2")}})

    moved = repoint_pinecone(index, "brewra", VALID)

    assert moved == 2
    assert set(index.namespaces[VALID].keys()) == {"v1", "v2"}
    assert index.namespaces["brewra"] == {}
    assert index.delete_calls == [(True, "brewra")]

    # idempotent: re-running against the now-empty source namespace moves
    # nothing and does not issue a redundant delete
    moved_again = repoint_pinecone(index, "brewra", VALID)
    assert moved_again == 0
    assert index.delete_calls == [(True, "brewra")]  # unchanged -- no 2nd delete


# ---------------------------------------------------------------------------
# Task 9: apply_report orchestration + cross-user/ambiguity guards
# ---------------------------------------------------------------------------


def test_apply_report_auto_repoints_unclaimed_noncanonical_org():
    from app.services.org_auth.reconcile import (
        apply_report,
        ReconcileReport,
        _PINECONE_INDEX_NAME,
    )

    assert _PINECONE_INDEX_NAME == "brewra-documents"  # matches app/services/_retrieval.py

    report = ReconcileReport(migrations={"A5Bfx": {"stray-org": 4}})
    mongo = FakeMongo()
    mongo["Org_Management"]["users"] = _UsersColl({"A5Bfx": VALID})

    index_calls = []
    clients = SimpleNamespace(
        driver=object(),
        client=mongo,
        pc=SimpleNamespace(Index=lambda name: index_calls.append(name) or "the-index"),
    )

    with patch(
        "app.services.org_auth.reconcile.repoint_neo4j", return_value=1
    ) as m_neo, patch(
        "app.services.org_auth.reconcile.repoint_mongo", return_value=2
    ) as m_mongo, patch(
        "app.services.org_auth.reconcile.repoint_mongo_org_only", return_value=3
    ) as m_mongo_only, patch(
        "app.services.org_auth.reconcile.repoint_pinecone", return_value=4
    ) as m_pc:
        apply_report(report, clients)

    m_neo.assert_called_once_with(clients.driver, "A5Bfx", "stray-org", VALID)
    m_mongo.assert_called_once_with(mongo, "A5Bfx", "stray-org", VALID)
    m_mongo_only.assert_called_once_with(mongo, "stray-org", VALID)
    m_pc.assert_called_once_with("the-index", "stray-org", VALID)
    assert index_calls == ["brewra-documents"]


def test_apply_defers_org_only_and_pinecone_for_shared_canonical_namespace():
    from app.services.org_auth.reconcile import apply_report, ReconcileReport

    # org_A is user A's own canonical org; user B happens to have stray data
    # sitting in org_A. Auto-repointing org_A -> org_B at the org level would
    # corrupt user A's canonical data.
    report = ReconcileReport(migrations={"userB": {"org_A": 5}})
    mongo = FakeMongo()
    mongo["Org_Management"]["users"] = _UsersColl({"userA": "org_A", "userB": "org_B"})
    clients = SimpleNamespace(
        driver=object(), client=mongo, pc=SimpleNamespace(Index=lambda name: "the-index")
    )

    with patch(
        "app.services.org_auth.reconcile.repoint_neo4j", return_value=1
    ) as m_neo, patch(
        "app.services.org_auth.reconcile.repoint_mongo", return_value=2
    ) as m_mongo, patch(
        "app.services.org_auth.reconcile.repoint_mongo_org_only"
    ) as m_mongo_only, patch(
        "app.services.org_auth.reconcile.repoint_pinecone"
    ) as m_pc:
        apply_report(report, clients)

    # user-scoped stores are always safe -- they only ever touch userB's own rows
    m_neo.assert_called_once_with(clients.driver, "userB", "org_A", "org_B")
    m_mongo.assert_called_once_with(mongo, "userB", "org_A", "org_B")
    # org-scoped stores are deferred: org_A is userA's canonical org
    m_mongo_only.assert_not_called()
    m_pc.assert_not_called()


def test_apply_defers_org_only_and_pinecone_for_ambiguous_multi_user_stray():
    from app.services.org_auth.reconcile import apply_report, ReconcileReport

    # "stray-org" is nobody's canonical org, but BOTH userA and userB list it
    # as a stray -- an org-scoped repoint can't tell whose data it actually is.
    report = ReconcileReport(
        migrations={"userA": {"stray-org": 2}, "userB": {"stray-org": 3}}
    )
    mongo = FakeMongo()
    mongo["Org_Management"]["users"] = _UsersColl({"userA": "org_A", "userB": "org_B"})
    clients = SimpleNamespace(
        driver=object(), client=mongo, pc=SimpleNamespace(Index=lambda name: "the-index")
    )

    with patch(
        "app.services.org_auth.reconcile.repoint_neo4j", return_value=1
    ), patch(
        "app.services.org_auth.reconcile.repoint_mongo", return_value=1
    ), patch(
        "app.services.org_auth.reconcile.repoint_mongo_org_only"
    ) as m_mongo_only, patch(
        "app.services.org_auth.reconcile.repoint_pinecone"
    ) as m_pc:
        apply_report(report, clients)

    m_mongo_only.assert_not_called()
    m_pc.assert_not_called()


def test_apply_is_idempotent_second_run_moves_zero(capsys):
    from app.services.org_auth.reconcile import (
        apply_report,
        ReconcileReport,
        _MONGO_ORG_COLLECTIONS,
        _MONGO_ORG_ONLY_COLLECTIONS,
    )

    user_keyed_db, user_keyed_coll = _MONGO_ORG_COLLECTIONS[0]
    org_only_db, org_only_coll = _MONGO_ORG_ONLY_COLLECTIONS[0]

    class StatefulColl:
        """Real filter-matching update_many over an in-memory doc list, so a
        second apply_report() run genuinely sees 'nothing left to move'."""

        def __init__(self, docs=None, find_one_result=None):
            self.docs = docs if docs is not None else []
            self.find_one_result = find_one_result

        def update_many(self, flt, upd):
            n = 0
            for d in self.docs:
                if all(d.get(k) == v for k, v in flt.items()):
                    d.update(upd["$set"])
                    n += 1
            return type("R", (), {"modified_count": n})()

        def find_one(self, *_a, **_kw):
            return self.find_one_result

    class StatefulDB(dict):
        def __missing__(self, key):
            self[key] = StatefulColl()
            return self[key]

    class StatefulMongo(dict):
        def __missing__(self, key):
            self[key] = StatefulDB()
            return self[key]

    mongo = StatefulMongo()
    mongo["Org_Management"]["users"] = StatefulColl(
        find_one_result={"user_mappings": {"A5Bfx": VALID}}
    )
    mongo[user_keyed_db][user_keyed_coll] = StatefulColl(
        docs=[{"user_id": "A5Bfx", "org_id": "brewra"}]
    )
    mongo[org_only_db][org_only_coll] = StatefulColl(docs=[{"org_id": "brewra"}])

    class StatefulNeoSession:
        def __init__(self, nodes):
            self.nodes = nodes

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def run(self, cypher, **p):
            matched = [
                n
                for n in self.nodes
                if n.get("user_id") == p["uid"] and n.get("org_id") == p["from_org"]
            ]
            for n in matched:
                n["org_id"] = p["to_org"]
            n = len(matched)
            return type("R", (), {"single": lambda s: {"n": n}})()

    class StatefulNeoDriver:
        def __init__(self, nodes):
            self.nodes = nodes

        def session(self):
            return StatefulNeoSession(self.nodes)

    driver = StatefulNeoDriver([{"user_id": "A5Bfx", "org_id": "brewra"}])

    class FakeVector:
        def __init__(self, id):
            self.id = id

    class StatefulPineconeIndex:
        def __init__(self, namespaces):
            self.namespaces = namespaces

        def list(self, namespace, limit=100):
            ids = list(self.namespaces.get(namespace, {}).keys())
            for i in range(0, len(ids), limit):
                yield ids[i : i + limit]

        def fetch(self, ids, namespace):
            ns = self.namespaces.get(namespace, {})
            return type("R", (), {"vectors": {i: ns[i] for i in ids if i in ns}})()

        def upsert(self, vectors, namespace):
            ns = self.namespaces.setdefault(namespace, {})
            for v in vectors:
                ns[v.id] = v

        def delete(self, delete_all, namespace):
            self.namespaces[namespace] = {}

    index = StatefulPineconeIndex({"brewra": {"v1": FakeVector("v1")}})
    clients = SimpleNamespace(
        driver=driver, client=mongo, pc=SimpleNamespace(Index=lambda name: index)
    )
    report = ReconcileReport(migrations={"A5Bfx": {"brewra": 1}})

    apply_report(report, clients)
    first_out = capsys.readouterr().out
    assert "neo4j=1 mongo=1 mongo_org_only=1 pinecone=1" in first_out
    assert "DEFER" not in first_out

    apply_report(report, clients)  # re-run against already-migrated state
    second_out = capsys.readouterr().out
    assert "neo4j=0 mongo=0 mongo_org_only=0 pinecone=0" in second_out
    assert "DEFER" not in second_out
