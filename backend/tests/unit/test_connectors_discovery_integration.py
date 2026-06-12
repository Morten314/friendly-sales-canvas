"""Transport-level integration test for the Apollo discovery pipeline.

Mocks only the HTTP transport seam (apollo._http_request) and the two
Neo4j-backed ingestion calls; lets the real ApolloConnector, discovery
funnel, and run-doc lifecycle execute end-to-end against fake Mongo.

Exercises spec AC2 & AC3:
  credits_consumed == revealed (3) <= selected <= max_leads
  run doc records credits, status == "completed".
"""
from app.services.connectors import apollo as apollo_mod
from app.services.connectors import orchestrator
from app.services.connectors import runs


def _route(method, url, **kwargs):
    if url.endswith("/mixed_people/api_search"):
        page = (kwargs.get("json") or {}).get("page", 1)
        if page == 1:
            return _Resp(200, {"people": [
                {"id": f"p{i}", "has_email": True, "title": "VP Sales",
                 "organization": {"industry": "SaaS", "estimated_num_employees": 80}} for i in range(3)
            ], "pagination": {"page": 1, "total_pages": 1}})
        return _Resp(200, {"people": [], "pagination": {"page": page, "total_pages": 1}})
    if url.endswith("/people/match"):
        pid = (kwargs.get("json") or {}).get("id")
        return _Resp(200, {"person": {"id": pid, "email": f"{pid}@x.com", "email_status": "verified",
                                      "organization": {"name": "X", "primary_domain": "x.com"}},
                           "credits_consumed": 1})
    return _Resp(404, {})


class _Resp:
    def __init__(self, code, body):
        self.status_code = code
        self._b = body
        self.text = ""

    def json(self):
        return self._b


def test_full_pipeline_counts_and_credits(monkeypatch, fake_mongo):
    monkeypatch.setattr(apollo_mod, "_http_request", _route)
    monkeypatch.setattr(apollo_mod, "_sleep", lambda _s: None)
    monkeypatch.setattr(orchestrator.credentials, "get_api_key", lambda *a, **k: "key")
    monkeypatch.setattr(orchestrator.ingestion, "get_existing_apollo_contact_ids", lambda *a, **k: set())
    created = {"n": 0}
    monkeypatch.setattr(orchestrator.ingestion, "upsert_imported_leads",
                        lambda *a, **k: created.__setitem__("n", created["n"] + len(a[3])) or
                                        {"created": len(a[3]), "matched": 0, "errors": []})

    icp = {"id": "i1", "primary_region": "NA", "industry": ["SaaS"], "company_size": ["51-200"],
           "buyer_role": ["VP Sales"], "fit_confidence": "high"}
    rid = runs.create_discovery_run(fake_mongo, "org1", "u1", icp_id="i1",
                                    icp_fingerprint="fp", mode="keep", max_leads=50)

    class _StubLLM:  # rerank: identity order (<= max_leads; won't actually be called)
        def invoke(self, _):
            class R:
                content = '["p0","p1","p2"]'
            return R()

    orchestrator._run_discover(object(), fake_mongo, "org1", "u1", rid, icp, "keep", 50, llm=_StubLLM())

    doc = runs.get_discovery_run(fake_mongo, "org1", rid)
    assert doc["counts"]["searched"] == 3
    assert doc["counts"]["revealed"] == 3
    assert doc["counts"]["verified"] == 3
    assert doc["credits_consumed"] == 3
    assert doc["status"] == "completed"
    assert created["n"] == 3
