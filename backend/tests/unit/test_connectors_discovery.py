import pytest
from app.services.connectors import discovery
from app.core.exceptions import IcpUnderspecifiedError
from app.core import prompts as prompt_registry


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


# ---------------------------------------------------------------------------
# Task 11 — rerank_candidates
# ---------------------------------------------------------------------------

class _FakeLLM:
    def __init__(self, content):
        self._content = content
    def invoke(self, _prompt):
        class R: pass
        r = R(); r.content = self._content; return r


def test_rerank_uses_llm_order_then_caps(monkeypatch):
    monkeypatch.setattr(discovery, "_render_rerank_prompt", lambda icp, cands: "PROMPT")
    cands = [_cand(id="p1"), _cand(id="p2"), _cand(id="p3")]
    out = discovery.rerank_candidates(_FakeLLM('["p3","p1","p2"]'), cands, _icp(), max_leads=2)
    assert [c["id"] for c in out] == ["p3", "p1"]


def test_rerank_falls_back_to_fit_score_on_llm_error(monkeypatch):
    monkeypatch.setattr(discovery, "_render_rerank_prompt", lambda icp, cands: "PROMPT")
    class _Boom:
        def invoke(self, _): raise RuntimeError("llm down")
    cands = [
        _cand(id="weak", organization={"industry": "Mining", "estimated_num_employees": 5}),
        _cand(id="strong"),
        _cand(id="middle"),
    ]
    out = discovery.rerank_candidates(_Boom(), cands, _icp(), max_leads=2)
    assert out[0]["id"] == "strong"   # deterministic fit-score fallback, best first
    assert len(out) == 2              # capped at max_leads


def test_rerank_falls_back_on_bad_json(monkeypatch):
    monkeypatch.setattr(discovery, "_render_rerank_prompt", lambda icp, cands: "PROMPT")
    cands = [
        _cand(id="weak", organization={"industry": "Mining", "estimated_num_employees": 5}),
        _cand(id="strong"),
        _cand(id="middle"),
    ]
    out = discovery.rerank_candidates(_FakeLLM("not json at all"), cands, _icp(), max_leads=2)
    assert out[0]["id"] == "strong"   # bad JSON -> deterministic fit fallback
    assert len(out) == 2


def test_rerank_short_circuits_without_llm_when_all_fit(monkeypatch):
    class _NeverCall:
        def invoke(self, _):
            raise AssertionError("LLM must not be called when candidates already fit")
    cands = [_cand(id="a"), _cand(id="b")]
    out = discovery.rerank_candidates(_NeverCall(), cands, _icp(), max_leads=5)
    assert [c["id"] for c in out] == ["a", "b"]   # all returned, arrival order preserved


def test_rerank_prompt_is_discoverable_and_renders():
    prompt_registry.init_registry()
    rendered = prompt_registry.render("apollo_discovery_rerank", icp=_icp(), candidates="[]")
    assert rendered.body  # non-empty; proves prompts/connectors/ is discovered + the template renders
