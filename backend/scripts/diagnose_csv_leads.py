"""Read-only live diagnostic: where do CSV-uploaded leads actually land?

Investigates the bug "CSV-uploaded leads don't appear in Find Matched Leads
(Signals) or the Lead Stream (Scout/Profiler)" by reading — never writing —
the three stores that decide the outcome:

  1. Neo4j :Lead nodes  ....... what BOTH surfaces read (get_leads_for_org, org-scoped)
  2. Mongo Profiler.Lead_Stream_Files ..... the CORRECT lead path (POST /leads/batch-upload)
  3. Mongo File_Processing.file_status .... the DATA-SOURCE path (POST /upload-document =
                                            S3 + Pinecone embeddings, which never creates leads)

Run it from a Render shell (or anywhere the app + DB creds are available):

    python backend/scripts/diagnose_csv_leads.py      # from repo root
    python scripts/diagnose_csv_leads.py              # from the backend/ dir

It performs only MATCH...count and find() reads. No writes, no deletes.
"""

import os
import sys
import urllib.parse

# Make `import app.core.config` work regardless of the current working dir:
# scripts/ lives under backend/, and backend/ contains the `app` package.
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
except Exception as e:  # pragma: no cover - fallback for detached execution
    print("Could not import app.core.config (%s) - falling back to env vars." % e)
    neo4j_uri = os.getenv("NEO4J_URI")
    neo4j_username = os.getenv("NEO4J_USERNAME", "neo4j")
    neo4j_password = os.getenv("NEO4J_PASSWORD")
    mu = urllib.parse.quote_plus(os.getenv("MONGO_USERNAME", ""))
    mp = urllib.parse.quote_plus(os.getenv("MONGO_PASSWORD", ""))
    mongo_uri = "mongodb+srv://%s:%s@brewra-db.d3hvuf8.mongodb.net/" % (mu, mp)

from neo4j import GraphDatabase
from pymongo import MongoClient


def main() -> None:
    print("\n" + "=" * 70)
    print("NEO4J - :Lead nodes by (org_id, source)  [what both surfaces read]")
    print("=" * 70)
    drv = GraphDatabase.driver(neo4j_uri, auth=(neo4j_username, neo4j_password))
    with drv.session() as s:
        rows = list(
            s.run(
                "MATCH (l:Lead) RETURN l.org_id AS org_id, "
                "coalesce(l.source,'<none>') AS source, count(*) AS n ORDER BY n DESC"
            )
        )
        if not rows:
            print("  (NO :Lead nodes exist at all)")
        for r in rows:
            print(
                "  org_id=%-36s  source=%-14s  count=%s"
                % (str(r["org_id"])[:36], str(r["source"])[:14], r["n"])
            )

        print("-" * 70)
        print("NEO4J - total :Lead per org_id  [>100 => signal-lead-map truncates]")
        for r in s.run(
            "MATCH (l:Lead) RETURN l.org_id AS org_id, count(*) AS total ORDER BY total DESC"
        ):
            flag = (
                "   <== >100, Find-Matched-Leads drops the oldest"
                if r["total"] > 100
                else ""
            )
            print("  org_id=%-36s  total=%s%s" % (str(r["org_id"])[:36], r["total"], flag))

        print("-" * 70)
        print("NEO4J - CSV leads by file_id  [correlate with Lead_Stream_Files below]")
        for r in s.run(
            "MATCH (l:Lead) WHERE l.source='csv' RETURN l.org_id AS org_id, "
            "l.file_id AS file_id, count(*) AS n ORDER BY n DESC LIMIT 50"
        ):
            print(
                "  org_id=%-36s  file_id=%-38s  count=%s"
                % (str(r["org_id"])[:36], str(r["file_id"])[:38], r["n"])
            )
    drv.close()

    m = MongoClient(mongo_uri)
    print("\n" + "=" * 70)
    print("MONGO Profiler.Lead_Stream_Files  [CORRECT lead path: /leads/batch-upload]")
    print("=" * 70)
    docs = list(
        m["Profiler"]["Lead_Stream_Files"].find().sort([("uploaded_at", -1)]).limit(50)
    )
    if not docs:
        print("  (empty - no CSV was ever uploaded via the Lead Stream widget)")
    for d in docs:
        print("  ", {k: v for k, v in d.items() if k != "_id"})

    print("\n" + "=" * 70)
    print(
        "MONGO File_Processing.file_status  "
        "[DATA-SOURCE path: /upload-document = embeddings, NOT leads]"
    )
    print("=" * 70)
    docs = list(
        m["File_Processing"]["file_status"].find().sort([("uploaded_at", -1)]).limit(50)
    )
    if not docs:
        print("  (empty)")
    for d in docs:
        slim = {
            k: v
            for k, v in d.items()
            if k
            in (
                "file_key",
                "file_name",
                "filename",
                "org_id",
                "user_id",
                "status",
                "embedding_supported",
                "uploaded_at",
            )
        }
        print("  ", slim)
    m.close()
    print("\nDONE (read-only).")


if __name__ == "__main__":
    main()
