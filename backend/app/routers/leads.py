"""Leads endpoints: CRUD, batch upload, file-grouped queries."""
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile

from app.core.dependencies import get_mongo, get_neo4j_driver
from app.models.leads import (
    BatchUploadResponse,
    DeleteLeadsByFileResponse,
    LeadCreateRequest,
    LeadMutationResponse,
    LeadUpdateRequest,
    StreamStatusResponse,
)
import app.services.leads as leads_service

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("", response_model=List[Dict[str, Any]])
def get_all_leads(
    response: Response,
    org_id: str = Query(...),
    driver=Depends(get_neo4j_driver),
):
    """**Deprecated:** use `GET /api/v2/leads` for the paginated envelope.

    Returns up to 500 leads (silent cap). The 500 cap is a silent recent
    addition; older clients may not expect it. Results are now returned in
    creation order (newest first) — previously the order was unspecified, as
    Cypher returns rows in arbitrary order without `ORDER BY`.
    """
    response.headers["Deprecation"] = "true"
    response.headers["Link"] = '</api/v2/leads>; rel="successor-version"'
    items, _ = leads_service.get_leads_for_org(driver, org_id=org_id)
    return items


@router.post("", response_model=LeadMutationResponse)
async def add_lead(request: LeadCreateRequest, driver=Depends(get_neo4j_driver)):
    """Add a single lead manually with flexible key-value pairs."""
    return leads_service.create_lead(driver, request)


@router.put("/{lead_id}", response_model=LeadMutationResponse)
async def update_lead(
    lead_id: str,
    request: LeadUpdateRequest,
    driver=Depends(get_neo4j_driver),
):
    """Modify a single lead with flexible key-value pairs."""
    return leads_service.update_lead(driver, lead_id, request)


@router.delete("/{lead_id}", response_model=LeadMutationResponse)
async def delete_lead(
    lead_id: str,
    user_id: str = Query(...),
    org_id: str = Query(...),
    driver=Depends(get_neo4j_driver),
):
    """Delete a single lead."""
    return leads_service.delete_lead(driver, lead_id, user_id, org_id)


@router.post("/batch-upload", response_model=BatchUploadResponse)
async def batch_upload_leads(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    org_id: str = Form(...),
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
):
    """Batch upload leads from CSV file."""
    filename = file.filename or ""
    filename_lower = filename.lower()
    if not (filename_lower.endswith('.csv') or filename_lower.endswith('.xlsx') or filename_lower.endswith('.xls')):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files (.csv, .xlsx, .xls) are supported")
    file_content = await file.read()
    return leads_service.batch_upload_leads(driver, mongo, file_content, filename, user_id, org_id)


@router.get("/by-file", response_model=List[Dict[str, Any]])
def get_leads_by_file(
    response: Response,
    org_id: str = Query(...),
    file_id: str = Query(...),
    driver=Depends(get_neo4j_driver),
):
    """**Deprecated:** use `GET /api/v2/leads/by-file` for the paginated envelope.

    Returns up to 500 leads (silent cap; previously unbounded). Results are now
    ordered by `created_at DESC` — previously had no ORDER BY at all.
    """
    response.headers["Deprecation"] = "true"
    response.headers["Link"] = '</api/v2/leads/by-file>; rel="successor-version"'
    items, _ = leads_service.list_leads_by_file(driver, org_id, file_id)
    return items


@router.get("/stream/status", response_model=StreamStatusResponse)
def get_lead_stream_status(org_id: str = Query(...), mongo=Depends(get_mongo)):
    """List lead-stream uploads (file_id registry/status) for an org."""
    return leads_service.get_stream_status(mongo, org_id)


@router.delete("/by-file/{file_id}", response_model=DeleteLeadsByFileResponse)
def delete_leads_by_file(
    file_id: str,
    user_id: str = Query(...),
    org_id: str = Query(...),
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
):
    """Delete all leads belonging to a specific file_id."""
    return leads_service.delete_leads_by_file(driver, mongo, file_id, user_id, org_id)
