"""Org reconciliation logic (spec 46 WS3). Testable; the CLI in
backend/scripts/reconcile_orgs.py drives it against live clients on Render.

`--report` (this task) is read-only: it classifies every user's
non-canonical org data and renders a migration plan, writing nothing.
`--apply` (Task 9) performs the actual re-point and is intentionally not
implemented here — see `backend/scripts/reconcile_orgs.py` for the lazy
import that keeps `--report` runnable ahead of that.

_MONGO_ORG_COLLECTIONS audit (Task 8): built by grepping app/services for
every `mongo[...][...]` access and confirming which collections carry BOTH
`user_id` AND `org_id` on their documents — because _scan_data_orgs groups
by (user_id, org_id) and Task 9's repoint_mongo will filter on
{"user_id": ..., "org_id": from_org}. Two collections (Company_Profile,
Connector_Credentials) are genuinely org_id-only (no user_id field is ever
written) — they are kept in the list per the audit mandate but flagged
below; a per-user repoint filter will silently miss them until Task 9
revisits the filter shape. Two other org-keyed stores (Signals.signal_track,
Signals.signal_lead_map) key by a composite `_id` string instead of
separate user_id/org_id fields, so the generic (user_id, org_id) shape
can't recover them at all -- they are deliberately excluded (see
docs/reviews or task-8-report.md for the full rationale: both are
disposable derived caches, not primary data).
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

# The exact org_id-keyed Mongo collections — the SINGLE source of truth shared by
# --report scanning and --apply re-pointing so they cannot drift (finding #5).
# See the module docstring + task-8-report.md for the file:line audit trail.
_MONGO_ORG_COLLECTIONS: list[tuple[str, str]] = [
    ("Scout_Agent", "Market_Intelligence"),
    ("Signals", "signals"),
    # NOTE: org_id-only, no user_id — repoint filter needs review in Task 9
    ("Profiler", "Company_Profile"),
    ("Profiler", LEAD_STREAM_FILES_COLLECTION),
    ("File_Processing", "file_status"),
    # NOTE: org_id-only, no user_id — repoint filter needs review in Task 9
    ("Profiler", CREDENTIALS_COLLECTION),
    ("Profiler", ENRICH_RUNS_COLLECTION),
    ("Profiler", DISCOVERY_RUNS_COLLECTION),
    ("Profiler", "Lead_Market_Scores"),
    ("Profiler", "Lead_Market_Score_Runs"),
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
