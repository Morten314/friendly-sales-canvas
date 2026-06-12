import pytest
from app.services.connectors import discovery
from app.core.exceptions import IcpUnderspecifiedError


def _icp():
    return {"id": "i1", "primary_region": "NA", "industry": ["SaaS", "Fintech"],
            "company_size": ["11-50", "51-200"], "buyer_role": ["VP Sales", "Head of Growth"],
            "fit_confidence": "high", "location": ["United States"]}


def test_build_search_filters_maps_icp_to_api_search_params():
    f = discovery.build_search_filters(_icp())
    assert f["person_titles"] == ["VP Sales", "Head of Growth"]
    assert f["organization_num_employees_ranges"] == ["11-50", "51-200"]
    assert f["q_organization_keywords"] == "SaaS Fintech"   # keyword match, not tag ids
    assert f["person_locations"] == ["United States"]
    assert "organization_industry_tag_ids" not in f


def test_build_search_filters_rejects_underspecified_icp():
    with pytest.raises(IcpUnderspecifiedError):
        discovery.build_search_filters({"primary_region": "NA"})


def test_icp_fingerprint_is_stable_and_change_sensitive():
    a = discovery.icp_fingerprint(_icp())
    b = discovery.icp_fingerprint(dict(_icp()))  # re-serialised, same semantics
    icp2 = _icp(); icp2["industry"] = ["SaaS"]
    c = discovery.icp_fingerprint(icp2)
    assert a == b and a != c
    # volatile fields don't change the fingerprint
    icp3 = _icp(); icp3["created_at"] = "whenever"; icp3["status"] = "draft"
    assert discovery.icp_fingerprint(icp3) == a


def _cand(**kw):
    base = {"id": "p1", "has_email": True, "title": "VP Sales",
            "organization": {"industry": "SaaS", "estimated_num_employees": 80}}
    base.update(kw)
    return base


def test_passes_hard_dimensions_true_for_in_icp_candidate():
    assert discovery.passes_hard_dimensions(_cand(), _icp()) is True


def test_zero_overlap_title_drops_candidate():
    assert discovery.passes_hard_dimensions(_cand(title="Warehouse Operative"), _icp()) is False


def test_no_has_email_is_not_a_hard_dimension_here():
    # has_email filtering happens in the funnel orchestration, not in this fn
    assert discovery.passes_hard_dimensions(_cand(has_email=False), _icp()) is True


def test_score_icp_fit_orders_better_matches_higher():
    strong = discovery.score_icp_fit(_cand(), _icp())
    weak = discovery.score_icp_fit(_cand(organization={"industry": "Mining", "estimated_num_employees": 5}), _icp())
    assert strong > weak
