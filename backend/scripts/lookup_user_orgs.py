"""Read-only: resolve a user's email/uid to their org_id(s) and locate their leads.

Diagnoses the "my uploaded CSV leads don't appear" report by revealing org_id
fragmentation — the same user's leads split across a legacy uid-shaped org and a
UUID tenant org, so a session scoped to one can't see leads written under another.

Email lives only in Firebase Auth + Registration_DB (no uid there), so pass the
Firebase UID (from Firebase Console -> Authentication, or her browser localStorage).

Usage (run from repo root or the backend/ dir):

    python backend/scripts/lookup_user_orgs.py                 # dump org landscape only
    python backend/scripts/lookup_user_orgs.py <FIREBASE_UID>  # full per-user resolution
    python backend/scripts/lookup_user_orgs.py <FIREBASE_UID> <email>   # override default email

Reads only (find / MATCH count). No writes, no deletes.
"""

import os
import re
import sys
import urllib.parse

# Make `import app.core.config` work regardless of cwd (scripts/ is under backend/).
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

try:
    from app.core.config import (
        neo4j_uri,
        neo4j_username,
        neo4j_password,
        mongo_uri,
    )
except Exception as e:  # pragma: no cover - detached execution fallback
    print("Could not import app.core.config (%s) - using env vars." % e)
    neo4j_uri = os.getenv("NEO4J_URI")
    neo4j_username = os.getenv("NEO4J_USERNAME", "neo4j")
    neo4j_password = os.getenv("NEO4J_PASSWORD")
    mu = urllib.parse.quote_plus(os.getenv("MONGO_USERNAME", ""))
    mp = urllib.parse.quote_plus(os.getenv("MONGO_PASSWORD", ""))
    mongo_uri = "mongodb+srv://%s:%s@brewra-db.d3hvuf8.mongodb.net/" % (mu, mp)

from neo4j import GraphDatabase
from pymongo import MongoClient

UID = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] not in ("-", "") else None
EMAIL = (sys.argv[2] if len(sys.argv) > 2 else "ishani@brewra.com").lower()


def main() -> None:
    m = MongoClient(mongo_uri)

    print("=" * 70)
    print("REGISTRATION_DB.registrations matching %r" % EMAIL)
    print("=" * 70)
    regs = list(
        m["Registration_DB"]["registrations"].find(
            {"email": {"$regex": re.escape(EMAIL), "$options": "i"}}
        )
    )
    if not regs:
        print("  (no registration row for that email)")
    for r in regs:
        print("  ", {k: str(v) for k, v in r.items() if k != "_id"})

    orgs_doc = m["Org_Management"]["orgs"].find_one({"_id": "orgs"}) or {}
    org_names = orgs_doc.get("org_names", {})
    users_doc = m["Org_Management"]["users"].find_one({"_id": "users"}) or {}
    mappings = users_doc.get("user_mappings", {})

    print("\n" + "=" * 70)
    print("Org_Management.orgs  (org_id -> org_name)")
    print("=" * 70)
    for oid in orgs_doc.get("org_list", []):
        print("  %-40s  %s" % (oid, org_names.get(oid, "(no name)")))

    print("\n" + "=" * 70)
    print("Org_Management.users  (uid -> org_id), %d mapped" % len(mappings))
    print("=" * 70)
    if UID:
        mo = mappings.get(UID)
        print("  >>> provided uid %s -> org_id=%s  (name=%s)" % (UID, mo, org_names.get(mo, "")))
    else:
        for uid, oid in mappings.items():
            print("  %-32s -> %-40s %s" % (uid, oid, org_names.get(oid, "")))

    if UID:
        print("\n" + "=" * 70)
        print("NEO4J :Lead nodes carrying user_id=%s  (orgs her uploads created leads under)" % UID)
        print("=" * 70)
        drv = GraphDatabase.driver(neo4j_uri, auth=(neo4j_username, neo4j_password))
        with drv.session() as s:
            rows = list(
                s.run(
                    "MATCH (l:Lead {user_id:$uid}) RETURN l.org_id AS org_id, "
                    "coalesce(l.source,'<none>') AS source, count(*) AS n ORDER BY n DESC",
                    uid=UID,
                )
            )
            if not rows:
                print("  (no :Lead nodes carry that user_id — leads may predate user_id stamping; "
                      "rely on Lead_Stream_Files below)")
            for r in rows:
                print("  org_id=%-40s source=%-12s count=%s" % (str(r["org_id"]), str(r["source"]), r["n"]))
            mo = mappings.get(UID)
            if mo:
                tot = s.run("MATCH (l:Lead {org_id:$o}) RETURN count(*) AS n", o=mo).single()["n"]
                print("  --- her SESSION org (%s) currently holds %s :Lead nodes total ---" % (mo, tot))
        drv.close()

        print("\nLead_Stream_Files (the /leads/batch-upload path) for uid=%s:" % UID)
        any_lsf = False
        for d in m["Profiler"]["Lead_Stream_Files"].find({"user_id": UID}).sort([("uploaded_at", -1)]):
            any_lsf = True
            print("  ", {k: d.get(k) for k in (
                "filename", "org_id", "processing_status", "total_rows", "created_count", "error_count", "uploaded_at")})
        if not any_lsf:
            print("  (none — she never uploaded via the Lead Stream CSV widget)")

        print("\nFile_Processing.file_status (the /upload-document embeddings path) for uid=%s:" % UID)
        any_fp = False
        for d in m["File_Processing"]["file_status"].find({"user_id": UID}).sort([("uploaded_at", -1)]):
            any_fp = True
            print("  ", {k: d.get(k) for k in (
                "file_name", "org_id", "status", "embedding_supported", "uploaded_at")})
        if not any_fp:
            print("  (none)")

    m.close()
    print("\nDONE (read-only).")


if __name__ == "__main__":
    main()
