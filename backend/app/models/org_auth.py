"""Org registration / auth models."""
from typing import Optional
from pydantic import BaseModel, ConfigDict


# Registration Request model
class RegistrationRequest(BaseModel):
    name: str
    email: str


# Registration Response model
class RegistrationResponse(BaseModel):
    id: str
    name: str
    email: str
    timestamp: str


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class OrgResponse(BaseModel):
    """Flexible response for /org, /connect_org, /create_org.

    The org_auth service returns varying-shape dicts (status + ids + names)
    depending on the operation. `extra="allow"` keeps any handler-specific
    fields without dropping them through response_model filtering.
    """
    model_config = ConfigDict(extra="allow")
    status: Optional[str] = None
    user_id: Optional[str] = None
    org_id: Optional[str] = None
    org_name: Optional[str] = None
    message: Optional[str] = None
