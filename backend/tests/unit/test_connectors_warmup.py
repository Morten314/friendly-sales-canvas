"""warmup.py — ICP completeness + active-ICP resolution (spec §5.4, §5.5)."""
import pytest
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


# ---------------------------------------------------------------------------
# Task 8 — four milestone checks + get_warmup_status
# ---------------------------------------------------------------------------

def _seed_all(fake_mongo, org_id="org1", user_id="u1"):
    fake_mongo["Profiler"]["Company_Profile"].insert_one({
        "profile_type": "company", "org_id": org_id,
        "customer_profiles": {"icps": [_complete_icp()]}})
    fake_mongo["Signals"]["signals"].insert_one({"org_id": org_id, "id": "s1"})
    fake_mongo["Scout_Agent"]["Market_Intelligence"].insert_one({"org_id": org_id})
    fake_mongo["Profiler"]["ICP_config"].insert_one({"user_id": user_id, "icps": {"suggestedICPs": [1]}})


def test_warmup_all_four_unlock(fake_mongo):
    _seed_all(fake_mongo)
    out = warmup.get_warmup_status(fake_mongo, "org1", "u1")
    assert out["ready_count"] == 4 and out["unlocked"] is True and out["missing"] == []


def test_warmup_missing_signals(fake_mongo):
    _seed_all(fake_mongo)
    fake_mongo["Signals"]["signals"].delete_many({})
    out = warmup.get_warmup_status(fake_mongo, "org1", "u1")
    assert out["signals_generated"] is False and out["unlocked"] is False
    assert any(m["step"] == "signals_generated" for m in out["missing"])


def test_warmup_check_error_degrades_to_false(monkeypatch, fake_mongo):
    _seed_all(fake_mongo)
    def boom(*a, **k):
        raise RuntimeError("mongo down")
    monkeypatch.setattr(warmup, "_signals_generated", boom)
    out = warmup.get_warmup_status(fake_mongo, "org1", "u1")
    assert out["signals_generated"] is False  # degraded, no exception


def test_warmup_profiler_analyzed_false_when_suggested_icps_empty(fake_mongo):
    _seed_all(fake_mongo)
    # An ICP_config wrapper present but with an empty suggestedICPs must NOT count as analyzed.
    fake_mongo["Profiler"]["ICP_config"].delete_many({})
    fake_mongo["Profiler"]["ICP_config"].insert_one({"user_id": "u1", "icps": {"suggestedICPs": []}})
    out = warmup.get_warmup_status(fake_mongo, "org1", "u1")
    assert out["profiler_analyzed"] is False and out["unlocked"] is False
