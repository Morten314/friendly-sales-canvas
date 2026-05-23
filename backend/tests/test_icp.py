"""Characterization tests for ICP endpoints.

After Phase B Task 5, all Mongo access goes via the singleton client from
app.core.clients. All per-test Mongo mocks use patch("app.core.clients.client", mc).

Endpoints:
  POST /customer_profile        — create/merge ICPs
  GET  /customer_profile        — list ICPs
  DELETE /customer_profile/icp/{icp_id}
  GET  /icp                     — suggested ICPs (cached or generate)
  POST /customer_profile/from_suggested_icp
  DELETE /icp/recommended/{icp_id}
  POST /icp-research            — 4 component names
"""
import json
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

from tests.fixtures import load_captured
from tests.helpers import scrub_dynamic, DEFAULT_SCRUB_KEYS
from tests.identities import TEST_USER_ID, TEST_ORG_ID, TEST_ICP_ID_1

_SCRUB_WITH_ID = DEFAULT_SCRUB_KEYS | {"id"}


@contextmanager
def _override_mongo(mongo_instance):
    """Phase F: customer_profile router reads Mongo via Depends(get_mongo).
    Replaces the legacy `with patch("app.core.clients.client", mongo_instance)`
    for tests that depend on the *specific* mock data shape (not just route
    code path). icp router is not yet converted; use legacy patch for /icp tests."""
    from app.main import app
    from app.core.dependencies import get_mongo
    app.dependency_overrides[get_mongo] = lambda: mongo_instance
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_mongo, None)


# ---------------------------------------------------------------------------
# Mock-builder helpers
# ---------------------------------------------------------------------------

def _make_coll(find_one=None, find=None):
    """Build a minimal collection mock."""
    coll = MagicMock()
    coll.find_one.return_value = find_one
    coll.find.return_value = find or []
    coll.update_one.return_value = MagicMock(modified_count=1, matched_count=1)
    coll.insert_one.return_value = MagicMock(inserted_id="test_id")
    coll.create_index.return_value = None
    return coll


def _make_db(routing: dict):
    """Build a database mock routing collection names to mocks.

    routing: {collection_name: collection_mock | find_one_value}
    """
    db = MagicMock()

    def _getitem(name):
        val = routing.get(name)
        if val is None:
            return _make_coll()
        if isinstance(val, MagicMock):
            return val
        # Treat as find_one return value
        return _make_coll(find_one=val)

    db.__getitem__.side_effect = _getitem
    return db


def _mc_factory(profiler_routing: dict):
    """Return a MongoClient mock where ["Profiler"] uses profiler_routing."""
    db = _make_db(profiler_routing)
    mc = MagicMock()
    mc.__getitem__.return_value = db
    return mc


# ---------------------------------------------------------------------------
# Shared ICP payload
# ---------------------------------------------------------------------------

_ICP_PAYLOAD = {
    "profile_type": "customer",
    "org_id": TEST_ORG_ID,
    "icps": [
        {
            "primary_region": "US",
            "industry": ["SaaS"],
            "company_size": ["50-500"],
            "buyer_role": ["CTO"],
            "fit_confidence": "high",
        }
    ],
}

_COMPANY_PROFILE_DOC = {
    "profile_type": "company",
    "org_id": TEST_ORG_ID,
    "customer_profiles": {
        "icps": [
            {
                "id": TEST_ICP_ID_1,
                "primary_region": "US",
                "industry": ["SaaS"],
                "company_size": ["50-500"],
                "buyer_role": ["CTO"],
                "fit_confidence": "high",
                "status": "saved",
            }
        ]
    },
}


# ---------------------------------------------------------------------------
# POST /customer_profile
# ---------------------------------------------------------------------------

def test_post_customer_profile_creates_icp(client, mock_neo4j, snapshot):
    """Creates ICP in Company_Profile collection via local MongoClient."""
    mock_record = MagicMock()
    mock_record.values.return_value = [{"org_id": TEST_ORG_ID, "name": "Test Org"}]
    mock_neo4j["session"].run.return_value.single.return_value = mock_record

    mc = _mc_factory({
        "Company_Profile": _make_coll(find_one=None),  # no existing doc
        "icp_id_registry": _make_coll(find_one=None),
    })

    with _override_mongo(mc):
        response = client.post("/customer_profile", json=_ICP_PAYLOAD)

    assert response.status_code in (200, 201)
    body_scrubbed = scrub_dynamic(response.json(), keys=_SCRUB_WITH_ID)
    assert body_scrubbed == snapshot


def test_post_customer_profile_requires_icps(client):
    """Missing icps field → 422."""
    payload = {"profile_type": "customer", "org_id": TEST_ORG_ID}
    mc = _mc_factory({})
    with _override_mongo(mc):
        response = client.post("/customer_profile", json=payload)
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# GET /customer_profile
# ---------------------------------------------------------------------------

def test_get_customer_profile_returns_icp_list(client, mock_neo4j, snapshot):
    """Returns ICPs from Mongo Company_Profile document."""
    mc = _mc_factory({
        "Company_Profile": _make_coll(find_one=_COMPANY_PROFILE_DOC),
        "icp_id_registry": _make_coll(find_one=None),
    })

    with _override_mongo(mc):
        response = client.get("/customer_profile", params={"org_id": TEST_ORG_ID})

    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True
    assert "icps" in data.get("data", {})
    body_scrubbed = scrub_dynamic(data)
    assert body_scrubbed == snapshot


def test_get_customer_profile_empty_when_no_mongo_doc(client, mock_neo4j, snapshot):
    """No Mongo doc → falls back to Neo4j; returns empty ICPs list."""
    mc = _mc_factory({
        "Company_Profile": _make_coll(find_one=None),
    })
    mock_neo4j["session"].run.return_value.single.return_value = MagicMock()

    with _override_mongo(mc):
        response = client.get("/customer_profile", params={"org_id": TEST_ORG_ID})

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_get_customer_profile_requires_org_id(client):
    """Missing org_id → 422."""
    response = client.get("/customer_profile")
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# DELETE /customer_profile/icp/{icp_id}
# ---------------------------------------------------------------------------

def test_delete_customer_profile_icp_removes_from_mongo(client):
    """DELETE removes ICP from Company_Profile.customer_profiles.icps."""
    coll = _make_coll(find_one=_COMPANY_PROFILE_DOC)
    mc = _mc_factory({
        "Company_Profile": coll,
        "icp_id_registry": _make_coll(find_one=None),
    })

    with _override_mongo(mc):
        response = client.delete(
            f"/customer_profile/icp/{TEST_ICP_ID_1}",
            params={"org_id": TEST_ORG_ID},
        )

    assert response.status_code in (200, 204)
    assert coll.update_one.called


def test_delete_customer_profile_icp_404_when_not_found(client):
    """404 when ICP not in document."""
    doc_empty = {**_COMPANY_PROFILE_DOC, "customer_profiles": {"icps": []}}
    mc = _mc_factory({
        "Company_Profile": _make_coll(find_one=doc_empty),
        "icp_id_registry": _make_coll(find_one=None),
    })

    with _override_mongo(mc):
        response = client.delete(
            "/customer_profile/icp/nonexistent_id",
            params={"org_id": TEST_ORG_ID},
        )

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# GET /icp  (suggested ICPs — cached path)
# ---------------------------------------------------------------------------

_CACHED_ICP_CONFIG = {
    "user_id": TEST_USER_ID,
    "icps": {
        "suggestedICPs": [
            {
                "id": "sug_001",
                "title": "SaaS CTOs",
                "industry": "SaaS",
                "segment": "Mid-market",
                "companySize": "50-500",
                "decisionMakers": ["CTO"],
                "confidenceScore": 0.85,
            },
        ]
    },
}


def test_get_icp_returns_cached_suggested_icps(client, snapshot):
    """When ICP_config doc exists and refresh=False, returns cached ICPs."""
    icp_config_coll = _make_coll(find_one=_CACHED_ICP_CONFIG)
    mc = _mc_factory({
        "ICP_config": icp_config_coll,
        "icp_id_registry": _make_coll(find_one=None),
    })

    with _override_mongo(mc):
        response = client.get("/icp", params={"user_id": TEST_USER_ID})

    assert response.status_code == 200
    data = response.json()
    assert "suggestedICPs" in data
    body_scrubbed = scrub_dynamic(data)
    assert body_scrubbed == snapshot


def test_get_icp_refresh_true_calls_neo4j_and_llm(client, mock_neo4j):
    """refresh=True triggers Neo4j lookup and ICP_generator call."""
    mc = _mc_factory({
        "ICP_config": _make_coll(find_one=None),
        "icp_id_registry": _make_coll(find_one=None),
    })

    mock_record = MagicMock()
    mock_record.values.return_value = [{"org_id": TEST_ORG_ID, "name": "Test Org"}]
    mock_neo4j["session"].run.return_value.single.return_value = mock_record

    mock_generator = MagicMock(return_value={"suggestedICPs": []})

    with _override_mongo(mc), \
         patch("app.services.icp.ICP_generator", mock_generator):
        response = client.get("/icp", params={"user_id": TEST_USER_ID, "refresh": "true"})

    assert response.status_code == 200
    assert mock_neo4j["session"].run.called
    assert mock_generator.called


def test_get_icp_404_when_no_company_profile(client, mock_neo4j):
    """No Neo4j company profile → 404 (when refresh=True, no cached doc)."""
    mc = _mc_factory({
        "ICP_config": _make_coll(find_one=None),
        "icp_id_registry": _make_coll(find_one=None),
    })
    mock_neo4j["session"].run.return_value.single.return_value = None

    with _override_mongo(mc):
        response = client.get("/icp", params={"user_id": TEST_USER_ID, "refresh": "true"})

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# POST /customer_profile/from_suggested_icp
# ---------------------------------------------------------------------------

def test_post_customer_profile_from_suggested_icp_promotes(client, mock_neo4j, snapshot):
    """Promotes suggested ICP to saved customer profile ICP."""
    icp_config_doc = {
        "user_id": TEST_USER_ID,
        "icps": {
            "suggestedICPs": [
                {
                    "id": "sug_001",
                    "industry": "SaaS",
                    "segment": "Mid-market",
                    "companySize": "50-500",
                    "decisionMakers": ["CTO"],
                    "confidenceScore": 0.85,
                    "regions": ["US"],
                }
            ]
        },
    }
    mc = _mc_factory({
        "ICP_config": _make_coll(find_one=icp_config_doc),
        "Company_Profile": _make_coll(find_one=None),
        "icp_id_registry": _make_coll(find_one=None),
    })
    mock_neo4j["session"].run.return_value.single.return_value = None

    payload = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "icp_id": "sug_001",
    }

    with _override_mongo(mc):
        response = client.post("/customer_profile/from_suggested_icp", json=payload)

    assert response.status_code in (200, 201)
    data = response.json()
    assert data.get("success") is True
    body_scrubbed = scrub_dynamic(data, keys=_SCRUB_WITH_ID)
    assert body_scrubbed == snapshot


def test_post_customer_profile_from_suggested_icp_404_when_not_found(client):
    """404 when the requested suggested ICP id doesn't exist."""
    icp_config_doc = {
        "user_id": TEST_USER_ID,
        "icps": {"suggestedICPs": []},
    }
    mc = _mc_factory({
        "ICP_config": _make_coll(find_one=icp_config_doc),
        "icp_id_registry": _make_coll(find_one=None),
    })

    payload = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "icp_id": "nonexistent_id",
    }

    with _override_mongo(mc):
        response = client.post("/customer_profile/from_suggested_icp", json=payload)

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /icp/recommended/{icp_id}
# ---------------------------------------------------------------------------

def test_delete_recommended_icp_removes_from_mongo(client):
    """DELETE removes suggested ICP from ICP_config.icps.suggestedICPs."""
    icp_config_doc = {
        "user_id": TEST_USER_ID,
        "icps": {
            "suggestedICPs": [
                {"id": "sug_001", "title": "SaaS CTOs"},
            ]
        },
    }
    coll = _make_coll(find_one=icp_config_doc)
    mc = _mc_factory({
        "ICP_config": coll,
        "icp_id_registry": _make_coll(find_one=None),
    })

    with _override_mongo(mc):
        response = client.delete(
            "/icp/recommended/sug_001",
            params={"user_id": TEST_USER_ID},
        )

    assert response.status_code in (200, 204)
    assert coll.update_one.called


def test_delete_recommended_icp_404_when_not_found(client):
    """404 when ICP not in ICP_config."""
    icp_config_doc = {
        "user_id": TEST_USER_ID,
        "icps": {"suggestedICPs": []},
    }
    mc = _mc_factory({
        "ICP_config": _make_coll(find_one=icp_config_doc),
        "icp_id_registry": _make_coll(find_one=None),
    })

    with _override_mongo(mc):
        response = client.delete(
            "/icp/recommended/nonexistent",
            params={"user_id": TEST_USER_ID},
        )

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# POST /icp-research
# Component names (from services.ICP_FUNCTIONS):
#   "icp summary & market opportunity"
#   "buyer map & roles, pain points, triggers"
#   "competitive overlap & buying signals"
#   "regulatory, compliance & recommended icp"
# ---------------------------------------------------------------------------

def _icp_research_payload(component_name: str, refresh: bool = True) -> dict:
    return {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "component_name": component_name,
        "data": {},
        "refresh": refresh,
    }


def _setup_icp_research_neo4j(mock_neo4j):
    mock_record = MagicMock()
    mock_record.values.return_value = [{"org_id": TEST_ORG_ID, "name": "Test Org"}]
    mock_neo4j["session"].run.return_value.single.return_value = mock_record


def _set_invoke_output(mock_llm_chain, json_str: str):
    """Configure agent_chain.invoke(...) to return {"output": json_str}.

    The icp research service calls:
        raw_response = agent_chain.invoke({"input": prompt})
        return raw_response["output"]
    """
    mock_llm_chain.invoke.return_value = {"output": json_str}


def test_post_icp_research_icp_summary(client, mock_neo4j, mock_llm_chain, mock_pinecone, snapshot):
    """icp-research: icp summary & market opportunity component."""
    _setup_icp_research_neo4j(mock_neo4j)
    _set_invoke_output(
        mock_llm_chain,
        json.dumps(load_captured("icp_research_icp_summary_groq")),
    )

    mc = _mc_factory({
        "ICPs": _make_coll(find_one=None),
        "icp_id_registry": _make_coll(find_one=None),
    })

    with _override_mongo(mc):
        response = client.post(
            "/icp-research",
            json=_icp_research_payload("icp summary & market opportunity"),
        )

    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "success"
    body_scrubbed = scrub_dynamic(data)
    assert body_scrubbed == snapshot


def test_post_icp_research_buyer_map(client, mock_neo4j, mock_llm_chain, mock_pinecone, snapshot):
    """icp-research: buyer map & roles, pain points, triggers component."""
    _setup_icp_research_neo4j(mock_neo4j)
    _set_invoke_output(
        mock_llm_chain,
        json.dumps(load_captured("icp_research_icp_buyer_map_groq")),
    )

    mc = _mc_factory({
        "ICPs": _make_coll(find_one=None),
        "icp_id_registry": _make_coll(find_one=None),
    })

    with _override_mongo(mc):
        response = client.post(
            "/icp-research",
            json=_icp_research_payload("buyer map & roles, pain points, triggers"),
        )

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_post_icp_research_competitive_overlap(client, mock_neo4j, mock_llm_chain, mock_pinecone, snapshot):
    """icp-research: competitive overlap & buying signals component."""
    _setup_icp_research_neo4j(mock_neo4j)
    _set_invoke_output(
        mock_llm_chain,
        json.dumps(load_captured("icp_research_icp_competitive_groq")),
    )

    mc = _mc_factory({
        "ICPs": _make_coll(find_one=None),
        "icp_id_registry": _make_coll(find_one=None),
    })

    with _override_mongo(mc):
        response = client.post(
            "/icp-research",
            json=_icp_research_payload("competitive overlap & buying signals"),
        )

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_post_icp_research_regulatory(client, mock_neo4j, mock_llm_chain, mock_pinecone, snapshot):
    """icp-research: regulatory, compliance & recommended icp component."""
    _setup_icp_research_neo4j(mock_neo4j)
    _set_invoke_output(
        mock_llm_chain,
        json.dumps(load_captured("icp_research_icp_regulatory_groq")),
    )

    mc = _mc_factory({
        "ICPs": _make_coll(find_one=None),
        "icp_id_registry": _make_coll(find_one=None),
    })

    with _override_mongo(mc):
        response = client.post(
            "/icp-research",
            json=_icp_research_payload("regulatory, compliance & recommended icp"),
        )

    assert response.status_code == 200
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot


def test_post_icp_research_invalid_component_returns_400(client):
    """Unsupported component_name returns 400."""
    mc = _mc_factory({})
    with _override_mongo(mc):
        response = client.post(
            "/icp-research",
            json=_icp_research_payload("invalid_component"),
        )
    assert response.status_code == 400


def test_post_icp_research_returns_cached_when_available(client, mock_neo4j, mock_llm_chain, snapshot):
    """When Mongo has a cached result, LLM should NOT be called."""
    cached_doc = {
        "user_id": TEST_USER_ID,
        "component_name": "icp summary & market opportunity",
        "summary": "Cached summary",
        "market_opportunity": "Cached TAM",
    }
    mc = _mc_factory({
        "ICPs": _make_coll(find_one=cached_doc),
        "icp_id_registry": _make_coll(find_one=None),
    })

    with _override_mongo(mc):
        response = client.post(
            "/icp-research",
            json=_icp_research_payload("icp summary & market opportunity", refresh=False),
        )

    assert response.status_code == 200
    # Cached path: neither .run nor .invoke should be called
    assert not mock_llm_chain.run.called, "Cached path must not invoke LLM (run)"
    assert not mock_llm_chain.invoke.called, "Cached path must not invoke LLM (invoke)"
    body_scrubbed = scrub_dynamic(response.json())
    assert body_scrubbed == snapshot
