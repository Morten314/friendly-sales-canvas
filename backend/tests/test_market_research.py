"""Characterization tests for POST /market-research.

The endpoint uses:
  - COMPONENT_FUNCTIONS (services.py) to look up Research_Market_N
  - module-level `client` (api.client) for MongoDB Scout_Agent.Market_Intelligence
  - `driver` (api.driver) for Neo4j CompanyProfile lookup

Actual COMPONENT_FUNCTIONS keys (lowercase):
  "market size & opportunity"
  "industry trends report"
  "competitor landscape"
  "regulatory & compliance highlights"
  "market entry & growth strategy"
"""
import json
from unittest.mock import MagicMock, patch, AsyncMock
import pytest

from tests.fixtures import load_captured
from tests.helpers import scrub_dynamic
from tests.identities import TEST_USER_ID, TEST_ORG_ID


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_COMPONENTS = [
    "market size & opportunity",
    "industry trends report",
    "competitor landscape",
    "regulatory & compliance highlights",
    "market entry & growth strategy",
]

# Map component names to their captured fixture slugs.
_COMPONENT_FIXTURE_SLUG = {
    "market size & opportunity": "market_research_market_size_groq",
    "industry trends report": "market_research_industry_trends_groq",
    "competitor landscape": "market_research_competitor_landscape_groq",
    "regulatory & compliance highlights": "market_research_regulatory_compliance_groq",
    "market entry & growth strategy": "market_research_market_entry_groq",
}


def _captured_result(component_name: str = "market size & opportunity") -> dict:
    slug = _COMPONENT_FIXTURE_SLUG.get(component_name, "market_research_market_size_groq")
    return load_captured(slug)


def _make_neo4j_record():
    """Minimal Neo4j record mock for CompanyProfile node."""
    node = MagicMock()
    node.items.return_value = [
        ("industry", "SaaS"),
        ("targetMarkets", ["US", "EMEA"]),
        ("companySize", "50-200"),
    ]
    record = MagicMock()
    record.values.return_value = [node]
    return record


def _base_payload(component_name: str, refresh: bool = True) -> dict:
    return {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "component_name": component_name,
        "data": {"industry": "SaaS"},
        "refresh": refresh,
    }


# ---------------------------------------------------------------------------
# POST /market-research — 5 component names each return 200
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("component_name", VALID_COMPONENTS)
def test_post_market_research_all_components(client, mock_neo4j, mock_mongo, component_name):
    """Each valid component_name → 200 with status=success."""
    # Neo4j returns a CompanyProfile record
    mock_neo4j["session"].run.return_value.single.return_value = _make_neo4j_record()

    # COMPONENT_FUNCTIONS lives in app.services.market_research; the router
    # accesses it via `market_research_service.COMPONENT_FUNCTIONS`, so patch
    # the source module. `_fetch_pinecone_supporting_context` is called inside
    # the service — patch the binding there too.
    with patch("app.services.market_research.COMPONENT_FUNCTIONS", {component_name: lambda agent_chain, _: _captured_result(component_name)}), \
         patch("app.services.market_research._fetch_pinecone_supporting_context", return_value=[]):
        response = client.post("/market-research", json=_base_payload(component_name))

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert "data" in body


# ---------------------------------------------------------------------------
# cached path — refresh=False and Mongo has cached doc → LLM not called
# ---------------------------------------------------------------------------

def test_post_market_research_cached_path(client, mock_neo4j, mock_mongo):
    """When refresh=False and Mongo has a cached doc, return cached result without calling LLM."""
    component_name = "market size & opportunity"

    # Simulate cached Mongo document
    cached_doc = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "component_name": component_name,
        "timestamp": "2026-05-07T10:00:00",
        "tamValue": "$3.0B",
        "GrowthRate": "18%",
    }

    # mock_mongo["Scout_Agent"]["Market_Intelligence"].find_one returns the cached doc
    coll_mock = MagicMock()
    coll_mock.find_one.return_value = cached_doc
    db_mock = MagicMock()
    db_mock.__getitem__.return_value = coll_mock
    mock_mongo.__getitem__.return_value = db_mock

    # The research function should never be called
    research_fn = MagicMock()
    with patch("app.services.market_research.COMPONENT_FUNCTIONS", {component_name: research_fn}):
        response = client.post("/market-research", json=_base_payload(component_name, refresh=False))

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    # LLM / research function not invoked
    research_fn.assert_not_called()


# ---------------------------------------------------------------------------
# invalid component → 400
# ---------------------------------------------------------------------------

def test_post_market_research_invalid_component(client):
    """Unknown component_name → 400 with detail."""
    payload = _base_payload("totally_unknown_component")
    response = client.post("/market-research", json=payload)

    assert response.status_code == 400
    body = response.json()
    assert "detail" in body
    assert "Unsupported" in body["detail"] or "unsupported" in body["detail"].lower()


def test_post_market_research_missing_user_id(client):
    """POST /market-research without user_id → 422 (pydantic field required).

    MarketRequest.user_id has no default, so validation fires before the
    handler. Ensures a refactor that adds a default (e.g. for an unauthed
    fallback) doesn't silently bypass the requirement.
    """
    payload = _base_payload("market size & opportunity")
    payload.pop("user_id")
    response = client.post("/market-research", json=payload)
    assert response.status_code == 422
