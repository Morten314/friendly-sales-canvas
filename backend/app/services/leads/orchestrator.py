"""Lead orchestration flows — multi-step CSV upload and bulk delete."""
from datetime import datetime, timezone
from typing import Any, Dict

from app.services._neo4j_helpers import upsert_node
from app.core.exceptions import LeadCSVValidationError, LeadNotFoundError
from app.core.logging import logger


def batch_upload_leads(
    driver,
    mongo,
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
        profiler_db = mongo["Profiler"]
        lead_stream_coll = profiler_db["Lead_Stream_Files"]
        # Generate backend file_id
        file_id = str(uuid.uuid4())
        uploaded_at = datetime.now(timezone.utc).isoformat()
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
                raise LeadCSVValidationError(
                    f"Could not parse CSV with supported encodings. Tried: {', '.join(encodings_to_try)}"
                )

        if df.empty:
            raise LeadCSVValidationError("CSV file is empty")

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
                lead_data["created_at"] = datetime.now(timezone.utc).isoformat()
                lead_data["file_id"] = file_id

                # Set default stage if not provided
                if "stage" not in lead_data and "status" not in lead_data and "Status" not in lead_data:
                    lead_data["stage"] = "Initial Outreach"

                # Convert all values to strings for Neo4j compatibility (except dict/list)
                lead_data = {k: str(v) if not isinstance(v, (dict, list)) else v for k, v in lead_data.items()}

                # Create Lead node with all data as-is (no extraction, no mapping)
                with driver.session() as session:
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
                "last_processed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
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


def delete_leads_by_file(driver, mongo, file_id: str, user_id: str, org_id: str) -> Dict[str, Any]:
    """
    Delete all leads belonging to a specific file_id (scoped by user_id and org_id).
    Also updates lead-stream tracking status in MongoDB.
    """
    # First count matching leads
    count_query = """
        MATCH (l:Lead)
        WHERE l.user_id = $user_id AND l.org_id = $org_id AND l.file_id = $file_id
        RETURN count(l) AS total
    """
    with driver.session() as session:
        count_result = session.run(count_query, user_id=user_id, org_id=org_id, file_id=file_id)
        count_record = count_result.single()
        total = int(count_record["total"]) if count_record and count_record["total"] is not None else 0

        if total == 0:
            raise LeadNotFoundError(
                f"No leads found for file_id: {file_id} under provided user_id/org_id"
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
    profiler_db = mongo["Profiler"]
    coll = profiler_db["Lead_Stream_Files"]
    coll.update_one(
        {"file_id": file_id, "user_id": user_id, "org_id": org_id},
        {"$set": {
            "processing_status": "deleted",
            "deleted_count": total,
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "last_processed_at": datetime.now(timezone.utc).isoformat()
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
