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
repoint_mongo_org_only (manual use only as of the final-review fix — see
below). Two other org-keyed stores
(Signals.signal_track, Signals.signal_lead_map) key by a composite `_id`
string instead of separate user_id/org_id fields, so the generic
(user_id, org_id) shape can't recover them at all -- they are deliberately
excluded (see docs/reviews or task-8-report.md for the full rationale: both
are disposable derived caches, not primary data).

Final-review fix (task-9-report.md "Final-review fix" section): the
org-scoped stores (Pinecone namespaces + the two org-only Mongo collections)
carry NO user_id, so they are not user-attributable at all -- the
"single-claimant" proxy `--apply` used to auto-move them under is unsound
(a user whose *only* footprint under an org is org-scoped data never
registers as a claimant of anything, so nothing would catch a wrongful
auto-move of someone else's org-scoped data). `--apply` now ALWAYS defers
org-scoped stores to a manual operator step; `--report` gained a read-only
`_scan_org_scoped` pass so operators can see what's sitting there
(Pinecone vector counts via `describe_index_stats()`, org-only Mongo counts
via aggregate) before doing that manual reconciliation.
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
# shape as a Pinecone namespace (org-only, no user granularity). Repointed
# (manually only — see apply_report's always-defer rationale) by
# repoint_mongo_org_only; surfaced in --report by _scan_org_scoped.
_MONGO_ORG_ONLY_COLLECTIONS: list[tuple[str, str]] = [
    ("Profiler", "Company_Profile"),
    ("Profiler", CREDENTIALS_COLLECTION),
]

# Pinecone index name — hardcoded the same way as the rest of the codebase
# (see app/services/_retrieval.py and app/services/data_sources/persistence.py).
# Defined up top because both the read-only --report scan (_scan_org_scoped)
# and --apply's repoint_pinecone need it.
_PINECONE_INDEX_NAME = "brewra-documents"


def _is_uuid(v: str) -> bool:
    try:
        uuid.UUID(str(v)); return True
    except (ValueError, AttributeError, TypeError):
        return False


@dataclass
class ReconcileReport:
    migrations: dict[str, dict[str, int]] = field(default_factory=dict)  # user -> {from_org: count}
    ambiguous: list[tuple[str, str]] = field(default_factory=list)       # (user_id, reason)
    # non-canonical org_id -> {store_label: count}, for the org-scoped stores
    # (Pinecone namespaces + org-only Mongo) that carry no user_id and so
    # can never be auto-migrated by --apply (see apply_report). Empty by
    # default so callers that don't pass org-scoped data (existing pure
    # build_report tests, hand-built ReconcileReport() in apply tests) still
    # work unchanged.
    org_scoped: dict[str, dict[str, int]] = field(default_factory=dict)

    def render(self) -> str:
        lines = ["== Org reconciliation report =="]
        for user, froms in self.migrations.items():
            for org, n in froms.items():
                lines.append(f"  MIGRATE user={user}  {org} -> canonical  ({n} records)")
        for user, reason in self.ambiguous:
            lines.append(f"  AMBIGUOUS user={user}: {reason}")
        if not self.migrations and not self.ambiguous:
            lines.append("  (nothing to reconcile)")
        if self.org_scoped:
            lines.append("")
            lines.append("== ORG-SCOPED (manual reconciliation required) ==")
            for org, counts in self.org_scoped.items():
                counts_str = ", ".join(f"{label}={n}" for label, n in sorted(counts.items()))
                lines.append(f"  org={org}: {counts_str}")
        return "\n".join(lines)


def build_report(user_mappings, org_list, data_orgs_by_user, org_scoped=None) -> ReconcileReport:
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

    # Org-scoped visibility (read-only): surface every NON-canonical org_id
    # that has any org-scoped data, so an operator can see what --apply will
    # always defer. "Canonical" here means "is SOME user's canonical org" --
    # the same set apply_report used to gate auto-move on.
    canonical_orgs = set(user_mappings.values())
    for org, counts in (org_scoped or {}).items():
        if org in canonical_orgs:
            continue
        nonzero = {label: n for label, n in counts.items() if n > 0}
        if nonzero:
            report.org_scoped[org] = nonzero
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


def _scan_org_scoped(mongo, pinecone_client) -> dict[str, dict[str, int]]:
    """Read-only: per org_id, counts for the stores that carry NO user_id
    (Pinecone namespaces + the two org-only Mongo collections). Namespaces
    ARE org_ids. Used only by --report -- --apply can never safely
    auto-migrate these (see apply_report's always-defer rationale)."""
    out: dict[str, dict[str, int]] = {}

    # Pinecone: describe_index_stats() is read-only and returns, per the
    # installed pinecone-client (6.0.0) shape:
    #   {'namespaces': {'<ns>': {'vector_count': N}, ...}, ...}
    # as an OpenAPI model that supports both attribute (.namespaces,
    # .vector_count) and dict-style ([...]/.get) access -- fall back between
    # the two so this doesn't break across client versions/fakes.
    stats = pinecone_client.Index(_PINECONE_INDEX_NAME).describe_index_stats()
    namespaces = getattr(stats, "namespaces", None)
    if namespaces is None and hasattr(stats, "get"):
        namespaces = stats.get("namespaces")
    for org, summary in (namespaces or {}).items():
        count = getattr(summary, "vector_count", None)
        if count is None and hasattr(summary, "get"):
            count = summary.get("vector_count")
        out.setdefault(org, {})["pinecone"] = int(count or 0)

    # Org-only Mongo collections: grouped count per org_id (read-only), same
    # aggregate style as _scan_data_orgs.
    for dbname, coll in _MONGO_ORG_ONLY_COLLECTIONS:
        label = f"{dbname}.{coll}"
        for doc in mongo[dbname][coll].aggregate([
            {"$match": {"org_id": {"$exists": True}}},
            {"$group": {"_id": "$org_id", "c": {"$sum": 1}}},
        ]):
            org = doc["_id"]
            if org is None:
                continue
            out.setdefault(org, {})[label] = out.get(org, {}).get(label, 0) + int(doc["c"])

    return out


def load_inputs(mongo, neo4j_driver, pinecone_client):
    """Read user_mappings, org_list, per-user data-org counts, and org-scoped
    (no-user_id) counts. Read-only."""
    db = mongo["Org_Management"]
    user_mappings = (db["users"].find_one({"_id": "users"}) or {}).get("user_mappings", {})
    org_list = (db["orgs"].find_one({"_id": "orgs"}) or {}).get("org_list", [])
    data_orgs_by_user = _scan_data_orgs(mongo, neo4j_driver, user_mappings)
    org_scoped = _scan_org_scoped(mongo, pinecone_client)
    return user_mappings, org_list, data_orgs_by_user, org_scoped


# ---------------------------------------------------------------------------
# --apply (Task 9, revised by the final-review fix): per-store re-point +
# orchestration.
#
# Neo4j and the user-keyed Mongo collections are re-pointed per (user_id,
# from_org) — the filter always includes user_id, so a repoint can only ever
# touch the calling user's own rows regardless of who else has data sitting
# under from_org. Idempotent: re-running matches nothing once every row's
# org_id already equals to_org. apply_report runs these unconditionally.
#
# Pinecone namespaces and the two org-only Mongo collections have NO user_id
# to filter on, so an org-scoped repoint moves *everything* under from_org.
# Task 9 originally auto-performed this when from_org looked like "this one
# migrating user's stray data" (nobody's canonical org, claimed by exactly
# one user). The final-review fix REMOVED that auto-move: the single-claimant
# check is unsound for stores with no user_id, because a user whose *only*
# footprint under from_org is org-scoped (e.g. a Company_Profile write with
# no matching Neo4j node) never registers as a "claimant" of anything, so the
# check can't rule out silently sweeping up someone else's org-scoped data.
# apply_report now ALWAYS defers these two stores to a manual operator step;
# repoint_pinecone/repoint_mongo_org_only stay defined below for that manual
# use (their docstrings still describe the safety precondition a human/script
# operator must establish before calling them directly).
# ---------------------------------------------------------------------------


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
    `.pc` is accepted for interface parity with `ClientBundle` but is not
    used here: org-scoped stores are never auto-repointed (see below).
    """
    mongo = clients.client
    driver = clients.driver

    users_doc = mongo["Org_Management"]["users"].find_one({"_id": "users"}) or {}
    user_mappings = users_doc.get("user_mappings", {})

    for user_id, strays in report.migrations.items():
        canonical = user_mappings.get(user_id)
        if not canonical:
            continue
        for from_org in list(strays):
            # User-scoped stores (Neo4j + the 8 user-keyed Mongo collections)
            # always carry user_id, so a repoint filtered on
            # {user_id, org_id: from_org} can only ever touch the calling
            # user's own rows — safe regardless of who else has data sitting
            # under from_org. Run unconditionally.
            n4 = repoint_neo4j(driver, user_id, from_org, canonical)
            nm = repoint_mongo(mongo, user_id, from_org, canonical)

            # Org-scoped stores (Pinecone namespaces, Company_Profile,
            # Connector_Credentials) carry NO user_id — there is no field to
            # attribute them to a single user, ever. The "single migrating
            # claimant" heuristic this function used to gate an auto-move on
            # is unsound for that reason: a user whose *only* data under
            # from_org is org-scoped (e.g. a Company_Profile saved from
            # Settings, with no corresponding Neo4j node or user-keyed Mongo
            # row) never shows up as a claimant of anything, so the heuristic
            # cannot detect — and therefore cannot rule out — another user's
            # org-scoped data also sitting under the same from_org. There is
            # no safe automated proxy for "this org-scoped data belongs to
            # this user." ALWAYS defer to a manual operator step instead
            # (see repoint_pinecone/repoint_mongo_org_only, kept below for
            # that manual/scripted use — never called from here).
            counts = report.org_scoped.get(from_org, {})
            counts_str = ", ".join(f"{label}={n}" for label, n in sorted(counts.items()))
            if not counts_str:
                counts_str = "no org-scoped counts from last --report scan"
            print(
                f"DEFER org-scoped user={user_id} from={from_org}: {counts_str} "
                "— reconcile Pinecone + org-only Mongo manually (no user_id to attribute)"
            )

            print(f"APPLIED user={user_id} {from_org}->{canonical}: neo4j={n4} mongo={nm}")
