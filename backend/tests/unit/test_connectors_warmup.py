"""warmup.py — ICP completeness + active-ICP resolution (spec §5.4, §5.5)."""
from app.services.connectors import warmup


def _complete_icp():
    return {"id": "i1", "primary_region": "NA", "industry": ["SaaS"],
            "company_size": ["11-50"], "buyer_role": ["VP Sales"], "fit_confidence": "high",
            "created_at": "2026-06-01T00:00:00Z"}


def test_icp_is_complete_true():
    ok, missing = warmup.icp_is_complete(_complete_icp())
    assert ok is True and missing is None


def test_icp_is_complete_reports_first_missing_section():
    icp = _complete_icp(); icp["industry"] = []
    ok, missing = warmup.icp_is_complete(icp)
    assert ok is False and missing == "industry"


def test_get_active_icp_picks_by_id_then_most_recent(fake_mongo):
    fake_mongo["Profiler"]["Company_Profile"].insert_one({
        "profile_type": "company", "org_id": "org1",
        "customer_profiles": {"icps": [
            {"id": "old", "created_at": "2026-01-01T00:00:00Z", "industry": ["X"]},
            {"id": "new", "created_at": "2026-06-01T00:00:00Z", "industry": ["Y"]},
        ]},
    })
    assert warmup.get_active_icp(fake_mongo, "org1", "old")["id"] == "old"
    assert warmup.get_active_icp(fake_mongo, "org1", None)["id"] == "new"
