"""Hand-crafted ICP (Ideal Customer Profile) fixtures."""
from tests.identities import (
    TEST_ICP_ID_1, TEST_ICP_ID_2,
    TEST_USER_ID, TEST_ORG_ID, TEST_TIMESTAMP,
)


def icp(**overrides) -> dict:
    """Customer profile / ICP — shape from Mongo customer_profile collection."""
    base = {
        "icp_id": TEST_ICP_ID_1,
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "name": "SaaS CTOs",
        "industry": "SaaS",
        "company_size": "50-500",
        "geography": ["US", "EU"],
        "pain_points": ["scaling engineering teams", "technical debt management"],
        "key_personas": ["CTO", "VP Engineering"],
        "buying_signals": ["recently raised Series B", "hiring engineering managers"],
        "created_at": TEST_TIMESTAMP,
    }
    return {**base, **overrides}


def icp_create_payload(**overrides) -> dict:
    """Payload for POST /api/customer_profile (no icp_id; backend generates)."""
    base = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "name": "SaaS CTOs",
        "industry": "SaaS",
        "company_size": "50-500",
    }
    return {**base, **overrides}


def suggested_icp_list(n: int = 3) -> list[dict]:
    """GET /api/icp returns suggested ICPs (LLM-generated). Minimal sketch — TD-001."""
    return [
        {
            "icp_id": f"suggested_icp_{i}",
            "name": f"Suggested Profile {i}",
            "industry": ["SaaS", "Fintech", "Healthcare"][i % 3],
            "match_score": 0.8 - (i * 0.1),
        }
        for i in range(n)
    ]


def icp_research_response() -> dict:
    """Canned response for POST /api/icp-research. Minimal sketch — TD-001."""
    return {
        "research_type": "personas",
        "result": {
            "personas": [
                {
                    "title": "CTO",
                    "responsibilities": ["technical strategy", "team scaling"],
                    "pain_points": ["legacy systems", "hiring"],
                    "preferred_channels": ["LinkedIn", "tech podcasts"],
                }
            ],
        },
        "cached": False,
        "timestamp": TEST_TIMESTAMP,
    }
