"""Lead and contact models."""
from typing import Dict, List, Optional, Any
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
