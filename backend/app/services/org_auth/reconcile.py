"""Org reconciliation logic (spec 46 WS3). Testable; the CLI in
backend/scripts/reconcile_orgs.py drives it against live clients on Render.

`--report` (Task 8) is read-only: it classifies every user's non-canonical
org data and renders a migration plan, writing nothing.
`--apply` (this task) performs the actual re-point (`apply_report` +
`repoint_neo4j`/`repoint_mongo`/`repoint_mongo_org_only`/`repoint_pinecone`).

_MONGO_ORG_COLLECTIONS audit (Task 8): built by grepping app/services for
every `mongo[...][...]` access and confirming which collections carry BOTH
`user_id` AND `org_id` on their documents — because _scan_data_orgs groups
by (user_id, org_id) and repoint_mongo filters on
{"user_id": ..., "org_id": from_org}. Two collections (Company_Profile,
Connector_Credentials) are genuinely org_id-only (no user_id field is ever
written); a per-user filter would silently match nothing for them, so
Task 9 split them out into _MONGO_ORG_ONLY_COLLECTIONS, re-pointed by
repoint_mongo_org_only under the same org-scoped safety rule as Pinecone
namespaces (see apply_report). Two other org-keyed stores
(Signals.signal_track, Signals.signal_lead_map) key by a composite `_id`
string instead of separate user_id/org_id fields, so the generic
(user_id, org_id) shape can't recover them at all -- they are deliberately
excluded (see docs/reviews or task-8-report.md for the full rationale: both
are disposable derived caches, not primary data).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from app.services.connectors.credentials import CREDENTIALS_COLLECTION
from app.services.connectors.runs import (
    DISCOVERY_RUNS_COLLECTION,
    ENRICH_RUNS_COLLECTION,
    LEAD_STREAM_FILES_COLLECTION,
)

# The user-keyed org_id collections — carry BOTH user_id and org_id, so a
# per-user repoint filter ({"user_id": ..., "org_id": from_org}) is always
# safe (it can only ever touch the calling user's own rows). The SINGLE
# source of truth shared by --report scanning and --apply re-pointing so
# they cannot drift (finding #5). See the module docstring + task-8-report.md
# for the file:line audit trail.
_MONGO_ORG_COLLECTIONS: list[tuple[str, str]] = [
    ("Scout_Agent", "Market_Intelligence"),
    ("Signals", "signals"),
    ("Profiler", LEAD_STREAM_FILES_COLLECTION),
    ("File_Processing", "file_status"),
    ("Profiler", ENRICH_RUNS_COLLECTION),
    ("Profiler", DISCOVERY_RUNS_COLLECTION),
    ("Profiler", "Lead_Market_Scores"),
    ("Profiler", "Lead_Market_Score_Runs"),
]

# Org-partitioned collections with NO user_id field on their documents — same
# shape as a Pinecone namespace (org-only, no user granularity). Repointed by
# repoint_mongo_org_only under the same cross-user safety rule apply_report
# applies to Pinecone: only safe when from_org is nobody's canonical org and
# is claimed by exactly one migrating user (see apply_report).
_MONGO_ORG_ONLY_COLLECTIONS: list[tuple[str, str]] = [
    ("Profiler", "Company_Profile"),
    ("Profiler", CREDENTIALS_COLLECTION),
]


def _is_uuid(v: str) -> bool:
    try:
        uuid.UUID(str(v)); return True
    except (ValueError, AttributeError, TypeError):
        return False


@dataclass
class ReconcileReport:
    migrations: dict[str, dict[str, int]] = field(default_factory=dict)  # user -> {from_org: count}
    ambiguous: list[tuple[str, str]] = field(default_factory=list)       # (user_id, reason)

    def render(self) -> str:
        lines = ["== Org reconciliation report =="]
        for user, froms in self.migrations.items():
            for org, n in froms.items():
                lines.append(f"  MIGRATE user={user}  {org} -> canonical  ({n} records)")
        for user, reason in self.ambiguous:
            lines.append(f"  AMBIGUOUS user={user}: {reason}")
        if not self.migrations and not self.ambiguous:
            lines.append("  (nothing to reconcile)")
        return "\n".join(lines)


def build_report(user_mappings, org_list, data_orgs_by_user) -> ReconcileReport:
    report = ReconcileReport()
    for user_id, canonical in user_mappings.items():
        # a user whose own mapping is non-canonical is decided by a human, not auto-migrated
        if not _is_uuid(canonical) or canonical not in org_list:
            report.ambiguous.append((user_id, f"mapping points to non-canonical org {canonical!r}"))
            continue
        strays = {
            org: count
            for org, count in data_orgs_by_user.get(user_id, {}).items()
            if org != canonical and count > 0
        }
        if strays:
            report.migrations[user_id] = strays
    return report


def _scan_data_orgs(mongo, neo4j_driver, user_mappings) -> dict[str, dict[str, int]]:
    """Read-only: per user, count records under each distinct org_id across stores."""
    out: dict[str, dict[str, int]] = {u: {} for u in user_mappings}
    # Neo4j: nodes carrying user_id + org_id (Lead/Company/Contact/…)
    with neo4j_driver.session() as s:
        for rec in s.run(
            "MATCH (n) WHERE n.user_id IS NOT NULL AND n.org_id IS NOT NULL "
            "RETURN n.user_id AS uid, n.org_id AS org, count(n) AS c"
        ):
            if rec["uid"] in out:
                out[rec["uid"]][rec["org"]] = out[rec["uid"]].get(rec["org"], 0) + int(rec["c"])
    # Mongo: the shared org-keyed collection set
    for dbname, coll in _MONGO_ORG_COLLECTIONS:
        for doc in mongo[dbname][coll].aggregate([
            {"$match": {"user_id": {"$exists": True}, "org_id": {"$exists": True}}},
            {"$group": {"_id": {"u": "$user_id", "o": "$org_id"}, "c": {"$sum": 1}}},
        ]):
            uid, org = doc["_id"]["u"], doc["_id"]["o"]
            if uid in out:
                out[uid][org] = out[uid].get(org, 0) + int(doc["c"])
    return out


def load_inputs(mongo, neo4j_driver):
    """Read user_mappings, org_list, and per-user data-org counts. Read-only."""
    db = mongo["Org_Management"]
    user_mappings = (db["users"].find_one({"_id": "users"}) or {}).get("user_mappings", {})
    org_list = (db["orgs"].find_one({"_id": "orgs"}) or {}).get("org_list", [])
    return user_mappings, org_list, _scan_data_orgs(mongo, neo4j_driver, user_mappings)


# ---------------------------------------------------------------------------
# --apply (Task 9): per-store re-point + orchestration.
#
# Neo4j and the user-keyed Mongo collections are re-pointed per (user_id,
# from_org) — the filter always includes user_id, so a repoint can only ever
# touch the calling user's own rows regardless of who else has data sitting
# under from_org. Idempotent: re-running matches nothing once every row's
# org_id already equals to_org.
#
# Pinecone namespaces and the two org-only Mongo collections have NO user_id
# to filter on — an org-scoped repoint moves *everything* under from_org, so
# apply_report only performs it when from_org is unambiguously "this one
# migrating user's stray data": nobody's canonical org, and claimed as a
# stray by exactly one user. Otherwise it is deferred to a logged manual
# step (see apply_report).
# ---------------------------------------------------------------------------

# Pinecone index name — hardcoded the same way as the rest of the codebase
# (see app/services/_retrieval.py and app/services/data_sources/persistence.py).
_PINECONE_INDEX_NAME = "brewra-documents"


def repoint_neo4j(driver, user_id: str, from_org: str, to_org: str) -> int:
    """User-scoped re-point: only nodes carrying BOTH user_id and from_org move.
    Idempotent — a second run finds no nodes still at from_org."""
    cypher = (
        "MATCH (n) WHERE n.user_id = $uid AND n.org_id = $from_org "
        "SET n.org_id = $to_org RETURN count(n) AS n"
    )
    with driver.session() as s:
        rec = s.run(cypher, uid=user_id, from_org=from_org, to_org=to_org).single()
        return int(rec["n"]) if rec else 0


def repoint_mongo(mongo, user_id: str, from_org: str, to_org: str) -> int:
    """User-scoped re-point across the user-keyed org collections. Safe: the
    filter includes user_id, so this only ever touches the calling user's own
    stray rows, never another user's data under the same from_org."""
    total = 0
    for dbname, coll in _MONGO_ORG_COLLECTIONS:
        res = mongo[dbname][coll].update_many(
            {"user_id": user_id, "org_id": from_org},
            {"$set": {"org_id": to_org}},
        )
        total += res.modified_count
    return total


def repoint_mongo_org_only(mongo, from_org: str, to_org: str) -> int:
    """Org-scoped re-point across the org-only collections (no user_id field
    exists to filter on). Callers MUST have already established that from_org
    is nobody's canonical org and is claimed by exactly one migrating user
    (see apply_report) — otherwise this moves another user's/org's data too."""
    total = 0
    for dbname, coll in _MONGO_ORG_ONLY_COLLECTIONS:
        res = mongo[dbname][coll].update_many(
            {"org_id": from_org},
            {"$set": {"org_id": to_org}},
        )
        total += res.modified_count
    return total


def _iter_vector_ids(index, namespace: str, page_size: int = 100):
    """Page through all vector ids in a Pinecone namespace."""
    yield from index.list(namespace=namespace, limit=page_size)


def repoint_pinecone(index, from_ns: str, to_ns: str) -> int:
    """Org-scoped re-point of an entire Pinecone namespace. Namespaces can't
    be renamed in place, so this copies vectors by id (upsert-by-id is
    idempotent) into to_ns, then deletes the now-empty from_ns. Idempotent:
    once from_ns has been drained, a second run pages through zero ids and
    performs no delete."""
    moved = 0
    for ids in _iter_vector_ids(index, from_ns):
        if not ids:
            continue
        fetched = index.fetch(ids=ids, namespace=from_ns).vectors
        if fetched:
            index.upsert(vectors=list(fetched.values()), namespace=to_ns)
        moved += len(fetched)
    if moved:
        index.delete(delete_all=True, namespace=from_ns)
    return moved


def apply_report(report: ReconcileReport, clients) -> None:
    """Re-point every reviewed user's stray data onto their canonical org.

    `clients` is a `ClientBundle` (app/core/clients.py): `.driver` (Neo4j),
    `.client` (Mongo), `.pc` (Pinecone) — NOT `.neo4j`/`.mongo`/`.pinecone`.
    """
    mongo = clients.client
    driver = clients.driver
    index = clients.pc.Index(_PINECONE_INDEX_NAME)

    users_doc = mongo["Org_Management"]["users"].find_one({"_id": "users"}) or {}
    user_mappings = users_doc.get("user_mappings", {})
    canonical_orgs = set(user_mappings.values())  # every org that is SOME user's canonical org

    # How many distinct migrating users claim each from_org as a stray. An
    # org-scoped repoint (Pinecone / org-only Mongo) is only unambiguous when
    # exactly one user claims from_org — otherwise we can't tell whose data
    # it actually is.
    claimants: dict[str, set[str]] = {}
    for user_id, strays in report.migrations.items():
        for from_org in strays:
            claimants.setdefault(from_org, set()).add(user_id)

    for user_id, strays in report.migrations.items():
        canonical = user_mappings.get(user_id)
        if not canonical:
            continue
        for from_org in list(strays):
            # User-scoped stores: always safe, run unconditionally.
            n4 = repoint_neo4j(driver, user_id, from_org, canonical)
            nm = repoint_mongo(mongo, user_id, from_org, canonical)

            shared = from_org in canonical_orgs
            ambiguous = len(claimants.get(from_org, ())) > 1
            if shared or ambiguous:
                reason = (
                    "shared/canonical namespace"
                    if shared
                    else "ambiguous — claimed by multiple users"
                )
                print(
                    f"DEFER user={user_id} org={from_org}->{canonical}: {reason} "
                    "— org-scoped stores (mongo org-only + pinecone) need manual review"
                )
                nmo, npc = "deferred(manual)", "deferred(manual)"
            else:
                nmo = repoint_mongo_org_only(mongo, from_org, canonical)
                npc = repoint_pinecone(index, from_org, canonical)

            print(
                f"APPLIED user={user_id} {from_org}->{canonical}: "
                f"neo4j={n4} mongo={nm} mongo_org_only={nmo} pinecone={npc}"
            )
