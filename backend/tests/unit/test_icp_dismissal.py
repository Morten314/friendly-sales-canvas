"""Unit tests for app/services/icp/dismissal.py — content-signature dismissed-set."""
from app.services.icp.dismissal import (
    DISMISSED_FIELD,
    compute_icp_signature,
    read_dismissed_signatures,
    with_signature_added,
)


def _icp(industry="", segment=""):
    return {"firmographics": {"industry": industry, "segment": segment}}


def test_signature_canonicalizes_case_whitespace_punctuation():
    a = compute_icp_signature(_icp("Financial   Services!", "Mid-Market"))
    b = compute_icp_signature(_icp("financial services", "mid market"))
    assert a == b == "financial services|mid market"


def test_signature_stable_across_id_regeneration():
    # Same firmographics, different ids → same signature (the point of the fix).
    x = dict(_icp("SaaS", "SMB"), id="uuid-1")
    y = dict(_icp("SaaS", "SMB"), id="uuid-2")
    assert compute_icp_signature(x) == compute_icp_signature(y)


def test_empty_or_missing_firmographics_yields_empty_signature():
    assert compute_icp_signature(_icp("", "")) == ""
    assert compute_icp_signature({}) == ""
    assert compute_icp_signature({"firmographics": None}) == ""


def test_segment_only_still_produces_a_signature():
    assert compute_icp_signature(_icp("", "Enterprise")) == "|enterprise"


def test_read_dismissed_handles_missing_and_bad_shapes():
    assert read_dismissed_signatures(None) == set()
    assert read_dismissed_signatures({}) == set()
    assert read_dismissed_signatures({DISMISSED_FIELD: "nope"}) == set()
    assert read_dismissed_signatures({DISMISSED_FIELD: ["a|b", "", "c|d"]}) == {"a|b", "c|d"}


def test_with_signature_added_unions_and_ignores_empty():
    assert with_signature_added({"a|b"}, "c|d") == ["a|b", "c|d"]
    assert with_signature_added({"a|b"}, "") == ["a|b"]
    assert with_signature_added(set(), "x|y") == ["x|y"]
