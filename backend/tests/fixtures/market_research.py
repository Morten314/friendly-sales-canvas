"""Hand-crafted market research fixtures — minimal sketches per TD-001.

The 5 components: market_size_opportunity, industry_trends, competitor_landscape,
regulatory_compliance, market_entry. Each Research_Market_N function in
backend/services.py returns a similar shape.
"""
from tests.identities import TEST_TIMESTAMP


COMPONENT_NAMES = [
    "market_size_opportunity",
    "industry_trends",
    "competitor_landscape",
    "regulatory_compliance",
    "market_entry",
]


def market_research_response(component_name: str = "market_size_opportunity",
                              cached: bool = False) -> dict:
    """Canned LLM response for POST /api/market-research. Minimal sketch."""
    return {
        "component_name": component_name,
        "status": "completed",
        "result": {
            "title": component_name.replace("_", " ").title(),
            "summary": f"Summary for {component_name}.",
            "key_findings": [
                f"Finding 1 for {component_name}",
                f"Finding 2 for {component_name}",
                f"Finding 3 for {component_name}",
            ],
            "sources": [
                {"url": "https://example.test/source1", "title": "Source 1"},
                {"url": "https://example.test/source2", "title": "Source 2"},
            ],
        },
        "cached": cached,
        "timestamp": TEST_TIMESTAMP,
    }


def market_research_request_payload(component_name: str,
                                     user_id: str = "test_user_123",
                                     org_id: str = "test_org_abc") -> dict:
    return {
        "user_id": user_id,
        "org_id": org_id,
        "component_name": component_name,
        "industry": "SaaS",
        "geography": "US",
    }


def llm_chain_canned_response_for(component_name: str) -> str:
    """The agent_chain.run() returns a JSON string. This is what we mock it to return."""
    import json
    return json.dumps({
        "title": component_name.replace("_", " ").title(),
        "summary": f"Summary for {component_name}.",
        "key_findings": [
            f"Finding 1 for {component_name}",
            f"Finding 2 for {component_name}",
            f"Finding 3 for {component_name}",
        ],
        "sources": [
            {"url": "https://example.test/source1", "title": "Source 1"},
        ],
    })
