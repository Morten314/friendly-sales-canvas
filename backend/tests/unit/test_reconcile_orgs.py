"""Unit tests for org reconciliation --report logic (spec 46 WS3, Task 8).

Pure unit tests against build_report — no Mongo/Neo4j clients involved.
_scan_data_orgs / load_inputs are exercised live on Render (sandbox cannot
reach prod DBs — see spec 46 constraints).
"""
from app.services.org_auth.reconcile import build_report

VALID = "b75ce29e-344c-4e6c-964e-5ac236d0b49a"


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
