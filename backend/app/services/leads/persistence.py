"""Lead persistence — direct Neo4j/Mongo reads and writes."""
from datetime import datetime, timezone
from typing import Any, Dict, List

from app.services._neo4j_helpers import upsert_node
from app.core.exceptions import LeadNotFoundError
from app.models.leads import LeadCreateRequest, LeadUpdateRequest

from .normalization import _process_neo4j_lead_records


def _ensure_leads_indexes(mongo) -> None:
    """Create Mongo indexes for Lead_Stream_Files.
    Idempotent — `create_index` is a no-op when an equivalent index exists.
    """
    coll = mongo["Profiler"]["Lead_Stream_Files"]
    coll.create_index("file_id", unique=True)
    coll.create_index([("user_id", 1), ("org_id", 1)])


def get_leads_for_org(
    driver,
    org_id: str,
    limit: int = 500,
    offset: int = 0,
) -> tuple[List[Dict[str, Any]], int]:
    """Fetch leads from Neo4j for a given org, paginated. Returns (items, total).

    Results ordered by `created_at DESC` (newest first) — mandatory for stable pagination.
    Raises on storage or query failures; callers wanting silent failure wrap with
    ``except BrewraError`` (or ``except Exception``).
    """
    with driver.session() as s:
        items_result = s.run(
            """
            MATCH (l:Lead {org_id: $org_id})
            RETURN l
            ORDER BY l.created_at DESC
            SKIP $offset LIMIT $limit
            """,
            org_id=org_id, limit=limit, offset=offset,
        )
        items = _process_neo4j_lead_records(items_result)

        total_result = s.run(
            "MATCH (l:Lead {org_id: $org_id}) RETURN count(l) AS total",
            org_id=org_id,
        )
        total = total_result.single()["total"]

    return items, total


def create_lead(driver, request: LeadCreateRequest) -> Dict[str, Any]:
    """
    Add a single lead manually with flexible key-value pairs.
    NO REQUIRED FIELDS - all fields are optional.
    Stores all data directly on Lead node - no mapping or extraction.
    Works exactly like company profile endpoint - completely flexible.
    """
    import uuid

    # Generate unique lead ID
    lead_id = str(uuid.uuid4())

    # Prepare lead data - store everything as-is, just add multitenancy fields
    lead_data = request.data.copy()
    if "source" not in lead_data:
        lead_data["source"] = "manual"
    lead_data["user_id"] = request.user_id
    lead_data["org_id"] = request.org_id
    lead_data["lead_id"] = lead_id
    lead_data["created_at"] = datetime.now(timezone.utc).isoformat()

    # Set default stage if not provided
    if "stage" not in lead_data and "status" not in lead_data and "Status" not in lead_data:
        lead_data["stage"] = "Initial Outreach"

    # Create Lead node with all data as-is (no extraction, no mapping)
    with driver.session() as session:
        session.execute_write(
            upsert_node,
            "Lead",
            "lead_id",
            lead_id,
            lead_data
        )

    return {
        "status": "success",
        "message": "Lead created successfully",
        "lead_id": lead_id
    }


def update_lead(driver, lead_id: str, request: LeadUpdateRequest) -> Dict[str, Any]:
    """
    Modify a single lead with flexible key-value pairs.
    Updates lead properties while maintaining multitenancy (user_id and org_id).
    Stores all data directly on Lead node - no mapping or extraction.
    Works exactly like company profile endpoint - completely flexible.
    """
    with driver.session() as session:
        # Verify lead exists and belongs to user/org
        verify_query = """
            MATCH (l:Lead {lead_id: $lead_id})
            WHERE l.user_id = $user_id AND l.org_id = $org_id
            RETURN l
        """
        result = session.run(verify_query, lead_id=lead_id, user_id=request.user_id, org_id=request.org_id)
        if not result.single():
            raise LeadNotFoundError("Lead not found or access denied")

        # Prepare update data - store everything as-is
        update_data = request.data.copy()
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        # Update Lead node with all data directly (no extraction, no mapping)
        session.execute_write(
            upsert_node,
            "Lead",
            "lead_id",
            lead_id,
            update_data
        )

    return {
        "status": "success",
        "message": "Lead updated successfully",
        "lead_id": lead_id
    }


def delete_lead(driver, lead_id: str, user_id: str, org_id: str) -> Dict[str, Any]:
    """
    Delete a single lead.
    Verifies multitenancy (user_id and org_id) before deletion.
    """
    with driver.session() as session:
        # Verify lead exists and belongs to user/org
        verify_query = """
            MATCH (l:Lead {lead_id: $lead_id})
            WHERE l.user_id = $user_id AND l.org_id = $org_id
            RETURN l
        """
        result = session.run(verify_query, lead_id=lead_id, user_id=user_id, org_id=org_id)
        if not result.single():
            raise LeadNotFoundError("Lead not found or access denied")

        # Delete lead and its relationships
        # Note: We keep Company, Contact, and Tech nodes but remove relationships
        delete_query = """
            MATCH (l:Lead {lead_id: $lead_id})
            OPTIONAL MATCH (c:Company)-[r1:Has_Lead]->(l)
            OPTIONAL MATCH (contact:Contact)-[r2:Is_POC_For]->(l)
            OPTIONAL MATCH (l)-[r3]->()
            DELETE r1, r2, r3, l
        """
        session.run(delete_query, lead_id=lead_id)

    return {
        "status": "success",
        "message": "Lead deleted successfully",
        "lead_id": lead_id
    }


def list_leads_by_file(
    driver,
    org_id: str,
    file_id: str,
    limit: int = 500,
    offset: int = 0,
) -> tuple[List[Dict[str, Any]], int]:
    """Fetch leads filtered by file_id within an org, paginated. Returns (items, total).

    Results ordered by `created_at DESC` (newest first) — mandatory for stable pagination.
    """
    with driver.session() as s:
        items_result = s.run(
            """
            MATCH (l:Lead)
            WHERE l.org_id = $org_id AND l.file_id = $file_id
            RETURN l
            ORDER BY l.created_at DESC
            SKIP $offset LIMIT $limit
            """,
            org_id=org_id, file_id=file_id, limit=limit, offset=offset,
        )
        items = _process_neo4j_lead_records(items_result)

        total_result = s.run(
            "MATCH (l:Lead) WHERE l.org_id = $org_id AND l.file_id = $file_id RETURN count(l) AS total",
            org_id=org_id, file_id=file_id,
        )
        total = total_result.single()["total"]

    return items, total


def get_stream_status(mongo, org_id: str) -> Dict[str, Any]:
    """
    List lead-stream uploads (file_id registry/status) for an org.
    """
    profiler_db = mongo["Profiler"]
    coll = profiler_db["Lead_Stream_Files"]
    cursor = coll.find({"org_id": org_id}).sort("uploaded_at", -1)
    files = []
    for doc in cursor:
        item = {
            "file_id": str(doc.get("file_id")),
            "filename": doc.get("filename"),
            "uploaded_at": doc.get("uploaded_at"),
            "last_processed_at": doc.get("last_processed_at"),
            "total_rows": doc.get("total_rows", 0),
            "created_count": doc.get("created_count", 0),
            "error_count": doc.get("error_count", 0),
            "processing_status": doc.get("processing_status", "completed"),
            "source": doc.get("source"),
            "matched_count": doc.get("matched_count", 0),
            "capped": doc.get("capped", False),
        }
        files.append(item)
    return {"files": files}
