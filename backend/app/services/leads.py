"""Leads service: all business logic for lead CRUD, batch upload, and file operations.

Extracted from app/routers/leads.py during phase B modularization.
"""
import json
from datetime import datetime
from typing import Any, Dict, List

from fastapi import HTTPException

from app.core import clients
from app.core.clients import upsert_node
from app.core.logging import logger
from app.models.leads import LeadCreateRequest, LeadUpdateRequest


# ---------------------------------------------------------------------------
# Existing helper (used by market-scoring background task)
# ---------------------------------------------------------------------------

def fetch_leads_for_org(org_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    """Fetch leads from Neo4j filtered by org_id"""
    try:
        query_string = """
        MATCH (l:Lead)
        WHERE l.org_id = $org_id
        RETURN l
        ORDER BY l.created_at DESC
        LIMIT $limit
        """
        with clients.driver.session() as session:
            results = session.run(query_string, org_id=org_id, limit=limit)
            leads = []
            for record in results:
                lead_node = record["l"]
                lead_dict = dict(lead_node.items())
                # Convert JSON strings back to objects if needed
                processed_lead = {}
                for key, value in lead_dict.items():
                    if isinstance(value, str) and value.strip().startswith(('{', '[')):
                        try:
                            processed_lead[key] = json.loads(value)
                        except json.JSONDecodeError:
                            processed_lead[key] = value
                    else:
                        processed_lead[key] = value
                leads.append(processed_lead)
        return leads
    except Exception as e:
        print(f"Warning: Could not fetch leads: {e}")
        return []


# ---------------------------------------------------------------------------
# Private Neo4j result processor (shared by get_all_leads and list_leads_by_file)
# ---------------------------------------------------------------------------

def _process_neo4j_lead_records(results) -> List[Dict[str, Any]]:
    """Deserialize Neo4j Lead records into plain dicts."""
    leads = []
    for record in results:
        lead_node = record["l"]
        lead_dict = dict(lead_node.items())
        processed_lead: Dict[str, Any] = {}
        for key, value in lead_dict.items():
            if isinstance(value, str) and value.strip().startswith(('{', '[')):
                try:
                    processed_lead[key] = json.loads(value)
                except json.JSONDecodeError:
                    processed_lead[key] = value
            else:
                processed_lead[key] = value
        leads.append(processed_lead)
    return leads


# ---------------------------------------------------------------------------
# Service functions
# ---------------------------------------------------------------------------

def get_all_leads(org_id: str) -> List[Dict[str, Any]]:
    """
    Get all leads filtered by org_id (multitenant).
    Returns all lead properties directly - completely flexible like company profile.
    Uses parameterized queries for security.
    """
    try:
        query_string = """
        MATCH (l:Lead)
        WHERE l.org_id = $org_id
        RETURN l
        """
        with clients.driver.session() as session:
            results = session.run(query_string, org_id=org_id)
            leads = _process_neo4j_lead_records(results)
        return leads
    except Exception as e:
        logger.error(f"Error fetching leads: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch leads: {str(e)}")


def create_lead(request: LeadCreateRequest) -> Dict[str, Any]:
    """
    Add a single lead manually with flexible key-value pairs.
    NO REQUIRED FIELDS - all fields are optional.
    Stores all data directly on Lead node - no mapping or extraction.
    Works exactly like company profile endpoint - completely flexible.
    """
    try:
        import uuid

        # Generate unique lead ID
        lead_id = str(uuid.uuid4())

        # Prepare lead data - store everything as-is, just add multitenancy fields
        lead_data = request.data.copy()
        lead_data["user_id"] = request.user_id
        lead_data["org_id"] = request.org_id
        lead_data["lead_id"] = lead_id
        lead_data["created_at"] = datetime.utcnow().isoformat()

        # Set default stage if not provided
        if "stage" not in lead_data and "status" not in lead_data and "Status" not in lead_data:
            lead_data["stage"] = "Initial Outreach"

        # Create Lead node with all data as-is (no extraction, no mapping)
        with clients.driver.session() as session:
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

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating lead: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create lead: {str(e)}")


def update_lead(lead_id: str, request: LeadUpdateRequest) -> Dict[str, Any]:
    """
    Modify a single lead with flexible key-value pairs.
    Updates lead properties while maintaining multitenancy (user_id and org_id).
    Stores all data directly on Lead node - no mapping or extraction.
    Works exactly like company profile endpoint - completely flexible.
    """
    try:
        with clients.driver.session() as session:
            # Verify lead exists and belongs to user/org
            verify_query = """
                MATCH (l:Lead {lead_id: $lead_id})
                WHERE l.user_id = $user_id AND l.org_id = $org_id
                RETURN l
            """
            result = session.run(verify_query, lead_id=lead_id, user_id=request.user_id, org_id=request.org_id)
            if not result.single():
                raise HTTPException(status_code=404, detail="Lead not found or access denied")

            # Prepare update data - store everything as-is
            update_data = request.data.copy()
            update_data["updated_at"] = datetime.utcnow().isoformat()

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

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating lead: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update lead: {str(e)}")


def delete_lead(lead_id: str, user_id: str, org_id: str) -> Dict[str, Any]:
    """
    Delete a single lead.
    Verifies multitenancy (user_id and org_id) before deletion.
    """
    try:
        with clients.driver.session() as session:
            # Verify lead exists and belongs to user/org
            verify_query = """
                MATCH (l:Lead {lead_id: $lead_id})
                WHERE l.user_id = $user_id AND l.org_id = $org_id
                RETURN l
            """
            result = session.run(verify_query, lead_id=lead_id, user_id=user_id, org_id=org_id)
            if not result.single():
                raise HTTPException(status_code=404, detail="Lead not found or access denied")

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

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting lead: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete lead: {str(e)}")


def batch_upload_leads(
    file_content: bytes,
    filename: str,
    user_id: str,
    org_id: str,
) -> Dict[str, Any]:
    """
    Batch upload leads from CSV/Excel file bytes.
    Column headings become keys and row values become values.
    NO REQUIRED FIELDS - all fields are optional.
    Stores all data directly on Lead node - no mapping or extraction.
    Works exactly like company profile endpoint - completely flexible.
    """
    try:
        from app.services.market_scoring import _get_profiler_mongo_client
        import pandas as pd
        import uuid
        import tempfile
        import os

        filename_lower = (filename or "").lower()

        # Save bytes to a temporary file for pandas to read
        temp_suffix = ".csv"
        if filename_lower.endswith(".xlsx"):
            temp_suffix = ".xlsx"
        elif filename_lower.endswith(".xls"):
            temp_suffix = ".xls"

        with tempfile.NamedTemporaryFile(delete=False, suffix=temp_suffix) as tmp_file:
            tmp_file.write(file_content)
            tmp_path = tmp_file.name

        try:
            # Prepare lead stream tracking (Mongo)
            mongo_client = _get_profiler_mongo_client()
            profiler_db = mongo_client["Profiler"]
            lead_stream_coll = profiler_db["Lead_Stream_Files"]
            lead_stream_coll.create_index("file_id", unique=True)
            lead_stream_coll.create_index([("user_id", 1), ("org_id", 1)])
            # Generate backend file_id
            file_id = str(uuid.uuid4())
            uploaded_at = datetime.utcnow().isoformat()
            lead_stream_coll.insert_one({
                "file_id": file_id,
                "user_id": user_id,
                "org_id": org_id,
                "filename": filename,
                "uploaded_at": uploaded_at,
                "processing_status": "processing",
                "total_rows": 0,
                "created_count": 0,
                "error_count": 0,
                "last_processed_at": uploaded_at
            })

            # Read input file with robust encoding support for CSV.
            if filename_lower.endswith(".xlsx") or filename_lower.endswith(".xls"):
                df = pd.read_excel(tmp_path)
            else:
                csv_read_errors = []
                df = None
                # Common encodings seen in lead exports.
                encodings_to_try = ["utf-8-sig", "utf-8", "cp1252", "latin-1", "utf-16"]
                for enc in encodings_to_try:
                    try:
                        df = pd.read_csv(tmp_path, encoding=enc)
                        break
                    except Exception as csv_err:
                        csv_read_errors.append(f"{enc}: {str(csv_err)}")
                        continue
                if df is None:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Could not parse CSV with supported encodings. Tried: {', '.join(encodings_to_try)}"
                    )

            if df.empty:
                raise HTTPException(status_code=400, detail="CSV file is empty")

            # Strip whitespace from column names
            df.columns = df.columns.str.strip()

            # Process each row
            created_count = 0
            error_count = 0
            errors = []
            total_rows = int(len(df))

            for index, row in df.iterrows():
                try:
                    # Convert row to dictionary (column headings become keys)
                    lead_data = row.to_dict()

                    # Remove NaN values
                    lead_data = {k: v for k, v in lead_data.items() if pd.notna(v)}

                    # Generate unique lead ID
                    lead_id = str(uuid.uuid4())

                    # Add multitenancy fields
                    lead_data["user_id"] = user_id
                    lead_data["org_id"] = org_id
                    lead_data["lead_id"] = lead_id
                    lead_data["created_at"] = datetime.utcnow().isoformat()
                    lead_data["file_id"] = file_id

                    # Set default stage if not provided
                    if "stage" not in lead_data and "status" not in lead_data and "Status" not in lead_data:
                        lead_data["stage"] = "Initial Outreach"

                    # Convert all values to strings for Neo4j compatibility (except dict/list)
                    lead_data = {k: str(v) if not isinstance(v, (dict, list)) else v for k, v in lead_data.items()}

                    # Create Lead node with all data as-is (no extraction, no mapping)
                    with clients.driver.session() as session:
                        session.execute_write(
                            upsert_node,
                            "Lead",
                            "lead_id",
                            lead_id,
                            lead_data
                        )

                    created_count += 1

                except Exception as e:
                    error_count += 1
                    errors.append(f"Row {index + 1}: {str(e)}")
                    logger.error(f"Error processing row {index + 1}: {str(e)}")
                    continue

            # Update stream status
            lead_stream_coll.update_one(
                {"file_id": file_id},
                {"$set": {
                    "processing_status": "completed",
                    "total_rows": total_rows,
                    "created_count": created_count,
                    "error_count": error_count,
                    "last_processed_at": datetime.utcnow().isoformat()
                }}
            )
            mongo_client.close()
            return {
                "status": "success",
                "message": f"Batch upload completed. {created_count} leads created, {error_count} errors.",
                "file_id": file_id,
                "filename": filename,
                "uploaded_at": uploaded_at,
                "total_rows": total_rows,
                "created_count": created_count,
                "error_count": error_count,
                "errors": errors[:10] if errors else []  # Limit errors to first 10
            }

        finally:
            # Clean up temporary file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in batch upload: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process CSV file: {str(e)}")


def list_leads_by_file(org_id: str, file_id: str) -> List[Dict[str, Any]]:
    """
    Fetch leads filtered by file_id within an org.
    Returns full lead records with all properties similar to get_all_leads.
    """
    try:
        query_string = """
        MATCH (l:Lead)
        WHERE l.org_id = $org_id AND l.file_id = $file_id
        RETURN l
        """
        with clients.driver.session() as session:
            results = session.run(query_string, org_id=org_id, file_id=file_id)
            leads = _process_neo4j_lead_records(results)
        return leads
    except Exception as e:
        logger.error(f"Error fetching leads by file_id: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch leads by file_id: {str(e)}")


def get_stream_status(org_id: str) -> Dict[str, Any]:
    """
    List lead-stream uploads (file_id registry/status) for an org.
    """
    from app.services.market_scoring import _get_profiler_mongo_client
    mongo_client = None
    try:
        mongo_client = _get_profiler_mongo_client()
        profiler_db = mongo_client["Profiler"]
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
                "processing_status": doc.get("processing_status", "completed")
            }
            files.append(item)
        return {"files": files}
    except Exception as e:
        logger.error(f"Error fetching lead-stream status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch lead-stream status: {str(e)}")
    finally:
        if mongo_client:
            mongo_client.close()


def delete_leads_by_file(file_id: str, user_id: str, org_id: str) -> Dict[str, Any]:
    """
    Delete all leads belonging to a specific file_id (scoped by user_id and org_id).
    Also updates lead-stream tracking status in MongoDB.
    """
    from app.services.market_scoring import _get_profiler_mongo_client
    mongo_client = None
    try:
        # First count matching leads
        count_query = """
            MATCH (l:Lead)
            WHERE l.user_id = $user_id AND l.org_id = $org_id AND l.file_id = $file_id
            RETURN count(l) AS total
        """
        with clients.driver.session() as session:
            count_result = session.run(count_query, user_id=user_id, org_id=org_id, file_id=file_id)
            count_record = count_result.single()
            total = int(count_record["total"]) if count_record and count_record["total"] is not None else 0

            if total == 0:
                raise HTTPException(
                    status_code=404,
                    detail=f"No leads found for file_id: {file_id} under provided user_id/org_id"
                )

            # Delete only leads and their relationships; keep company/contact/tech nodes.
            delete_query = """
                MATCH (l:Lead)
                WHERE l.user_id = $user_id AND l.org_id = $org_id AND l.file_id = $file_id
                OPTIONAL MATCH (c:Company)-[r1:Has_Lead]->(l)
                OPTIONAL MATCH (contact:Contact)-[r2:Is_POC_For]->(l)
                OPTIONAL MATCH (l)-[r3]->()
                DELETE r1, r2, r3, l
            """
            session.run(delete_query, user_id=user_id, org_id=org_id, file_id=file_id)

        # Update lead stream tracking document if present
        mongo_client = _get_profiler_mongo_client()
        profiler_db = mongo_client["Profiler"]
        coll = profiler_db["Lead_Stream_Files"]
        coll.update_one(
            {"file_id": file_id, "user_id": user_id, "org_id": org_id},
            {"$set": {
                "processing_status": "deleted",
                "deleted_count": total,
                "deleted_at": datetime.utcnow().isoformat(),
                "last_processed_at": datetime.utcnow().isoformat()
            }}
        )

        return {
            "status": "success",
            "message": "All leads for file_id deleted successfully",
            "file_id": file_id,
            "deleted_count": total,
            "user_id": user_id,
            "org_id": org_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting leads by file_id: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete leads by file_id: {str(e)}")
    finally:
        if mongo_client:
            mongo_client.close()
