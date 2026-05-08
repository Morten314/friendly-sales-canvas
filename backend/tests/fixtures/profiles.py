"""Hand-crafted profile fixtures (org / user / scout / profiler / agent_name)."""
from tests.identities import TEST_USER_ID, TEST_ORG_ID, TEST_TIMESTAMP


def org_profile(**overrides) -> dict:
    base = {
        "org_id": TEST_ORG_ID,
        "name": "Test Org",
        "industry": "SaaS",
        "size": "50-500",
        "website": "https://test-org.test",
        "created_at": TEST_TIMESTAMP,
    }
    return {**base, **overrides}


def user_profile(**overrides) -> dict:
    base = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "email": "test@brewra.test",
        "display_name": "Test User",
        "role": "member",
    }
    return {**base, **overrides}


def scout_profile(**overrides) -> dict:
    base = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "agent_name": "Scout",
        "industry_focus": "SaaS",
        "geographic_focus": ["US", "EU"],
    }
    return {**base, **overrides}


def profiler_profile(**overrides) -> dict:
    base = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "agent_name": "Profiler",
        "icp_count": 2,
    }
    return {**base, **overrides}


def agent_name_payload(name: str = "Custom Agent Name") -> dict:
    return {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "agent_name": name,
    }


def org_list(n: int = 2) -> list[dict]:
    return [
        org_profile(org_id=f"org_{i:03d}", name=f"Org {i}")
        for i in range(n)
    ]


def registration_payload(**overrides) -> dict:
    base = {
        "user_id": TEST_USER_ID,
        "email": "test@brewra.test",
        "org_name": "Test Org",
        "org_id": TEST_ORG_ID,
    }
    return {**base, **overrides}
