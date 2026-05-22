"""Lead and contact models."""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


# Contact model
class Contact(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None


# Lead model
class Lead(BaseModel):
    lead_id: Optional[str] = None
    company: str
    industry: str
    size: str
    region: str
    location: str
    techStack: List[str]
    contact: Contact
    status: str
    user_id: Optional[str] = None
    org_id: Optional[str] = None


# Lead Create Request (flexible key-value pairs)
class LeadCreateRequest(BaseModel):
    user_id: str
    org_id: str
    data: Dict[str, Any]  # Flexible key-value pairs for lead properties


# Lead Update Request
class LeadUpdateRequest(BaseModel):
    user_id: str
    org_id: str
    data: Dict[str, Any]  # Flexible key-value pairs for lead properties


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class LeadMutationResponse(BaseModel):
    """Returned by create_lead, update_lead, delete_lead."""
    status: str
    message: str
    lead_id: str


class BatchUploadResponse(BaseModel):
    """Returned by batch_upload_leads."""
    status: str
    message: str
    file_id: str
    filename: str
    uploaded_at: str
    total_rows: int
    created_count: int
    error_count: int
    errors: List[str]


class StreamFileEntry(BaseModel):
    """Single entry in the files list returned by get_stream_status."""
    file_id: str
    filename: Optional[str] = None
    uploaded_at: Optional[str] = None
    last_processed_at: Optional[str] = None
    total_rows: int = 0
    created_count: int = 0
    error_count: int = 0
    processing_status: str = "completed"


class StreamStatusResponse(BaseModel):
    """Returned by get_stream_status."""
    files: List[StreamFileEntry]


class DeleteLeadsByFileResponse(BaseModel):
    """Returned by delete_leads_by_file."""
    status: str
    message: str
    file_id: str
    deleted_count: int
    user_id: str
    org_id: str
