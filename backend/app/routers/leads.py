"""Leads endpoints: CRUD, batch upload, file-grouped queries."""
import shutil
from typing import Any, Dict, List

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from app.models.leads import LeadCreateRequest, LeadUpdateRequest
import app.services.leads as leads_service

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("", response_model=List[Dict[str, Any]])
def get_all_leads(org_id: str = Query(...)):
    """Get all leads filtered by org_id (multitenant)."""
    return leads_service.get_all_leads(org_id)


@router.post("", response_model=Dict[str, Any])
async def add_lead(request: LeadCreateRequest):
    """Add a single lead manually with flexible key-value pairs."""
    return leads_service.create_lead(request)


@router.put("/{lead_id}", response_model=Dict[str, Any])
async def update_lead(lead_id: str, request: LeadUpdateRequest):
    """Modify a single lead with flexible key-value pairs."""
    return leads_service.update_lead(lead_id, request)


@router.delete("/{lead_id}", response_model=Dict[str, Any])
async def delete_lead(lead_id: str, user_id: str = Query(...), org_id: str = Query(...)):
    """Delete a single lead."""
    return leads_service.delete_lead(lead_id, user_id, org_id)


@router.post("/batch-upload", response_model=Dict[str, Any])
async def batch_upload_leads(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    org_id: str = Form(...)
):
    """Batch upload leads from CSV file."""
    filename = file.filename or ""
    filename_lower = filename.lower()
    if not (filename_lower.endswith('.csv') or filename_lower.endswith('.xlsx') or filename_lower.endswith('.xls')):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files (.csv, .xlsx, .xls) are supported")
    file_content = await file.read()
    return leads_service.batch_upload_leads(file_content, filename, user_id, org_id)


@router.get("/by-file", response_model=List[Dict[str, Any]])
def get_leads_by_file(org_id: str = Query(...), file_id: str = Query(...)):
    """Fetch leads filtered by file_id within an org."""
    return leads_service.list_leads_by_file(org_id, file_id)


@router.get("/stream/status", response_model=Dict[str, Any])
def get_lead_stream_status(org_id: str = Query(...)):
    """List lead-stream uploads (file_id registry/status) for an org."""
    return leads_service.get_stream_status(org_id)


@router.delete("/by-file/{file_id}", response_model=Dict[str, Any])
def delete_leads_by_file(file_id: str, user_id: str = Query(...), org_id: str = Query(...)):
    """Delete all leads belonging to a specific file_id."""
    return leads_service.delete_leads_by_file(file_id, user_id, org_id)
