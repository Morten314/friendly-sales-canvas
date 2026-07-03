"""Org reconciliation CLI (spec 46 WS3). Run on Render:
  python backend/scripts/reconcile_orgs.py            # --report (default, read-only)
  python backend/scripts/reconcile_orgs.py --apply    # destructive (Task 9)

`apply_report` is imported lazily inside the --apply branch so `--report`
stays a light, dependency-minimal read path (no accidental import-time
coupling to the write path) — not because the symbol doesn't exist.
"""
import argparse

from app.core.clients import build_clients
from app.services.org_auth.reconcile import build_report, load_inputs


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="perform writes (default: report only)")
    args = ap.parse_args()

    clients = build_clients()
    # ClientBundle field names (app/core/clients.py): `.client` is the Mongo
    # client, `.driver` is the Neo4j driver — NOT `.mongo` / `.neo4j`.
    user_mappings, org_list, data = load_inputs(clients.client, clients.driver)
    report = build_report(user_mappings, org_list, data)
    print(report.render())

    if args.apply:
        from app.services.org_auth.reconcile import apply_report
        apply_report(report, clients)
    else:
        print("\n(dry-run; re-run with --apply to migrate)")


if __name__ == "__main__":
    main()
