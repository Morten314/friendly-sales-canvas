"""Hand-crafted lead fixtures. See TD-001 for upgrade path."""
from tests.identities import (
    TEST_LEAD_ID_1, TEST_LEAD_ID_2,
    TEST_USER_ID, TEST_ORG_ID, TEST_TIMESTAMP, TEST_FILE_ID,
)


def lead(**overrides) -> dict:
    """Single lead, full Neo4j Lead-node shape."""
    base = {
        "lead_id": TEST_LEAD_ID_1,
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "company_name": "Acme Corp",
        "contact_name": "Jane Doe",
        "email": "jane@acme.test",
        "phone": "+1-555-0100",
        "industry": "SaaS",
        "stage": "Discovery",
        "source": "manual",
        "created_at": TEST_TIMESTAMP,
        "updated_at": TEST_TIMESTAMP,
    }
    return {**base, **overrides}


def lead_list(n: int = 3) -> list[dict]:
    return [
        lead(
            lead_id=f"lead_{i:08d}",
            company_name=f"Company {i}",
            email=f"contact{i}@example.test",
        )
        for i in range(n)
    ]


def csv_upload_payload() -> bytes:
    """Minimal CSV payload for batch-upload endpoint."""
    return (
        b"company_name,contact_name,email,industry\n"
        b"Acme Corp,Jane Doe,jane@acme.test,SaaS\n"
        b"Beta Inc,John Smith,john@beta.test,Fintech\n"
        b"Gamma LLC,Alice Jones,alice@gamma.test,Healthcare\n"
    )


def lead_create_payload(**overrides) -> dict:
    """Payload for POST /api/leads (no lead_id; backend generates it)."""
    base = {
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "company_name": "Acme Corp",
        "contact_name": "Jane Doe",
        "email": "jane@acme.test",
        "industry": "SaaS",
    }
    return {**base, **overrides}


def lead_update_payload(**overrides) -> dict:
    base = {
        "stage": "Qualification",
        "phone": "+1-555-9999",
    }
    return {**base, **overrides}


def file_tracking_doc(**overrides) -> dict:
    """MongoDB tracking doc for batch upload."""
    base = {
        "file_id": TEST_FILE_ID,
        "user_id": TEST_USER_ID,
        "org_id": TEST_ORG_ID,
        "filename": "test_leads.csv",
        "lead_count": 3,
        "uploaded_at": TEST_TIMESTAMP,
        "status": "completed",
    }
    return {**base, **overrides}
