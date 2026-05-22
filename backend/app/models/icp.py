"""ICP response models."""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class ICPListResponse(BaseModel):
    """Response for GET /icp — returns the raw suggestedICPs list.

    list_icps() returns {"suggestedICPs": [...]} directly (no status wrapper).
    The list elements are LLM-generated heterogeneous dicts, so typed as
    List[Dict[str, Any]] to avoid spurious validation errors.
    """

    suggestedICPs: List[Dict[str, Any]] = []


class ICPResearchData(BaseModel):
    """Inner ``data`` blob from _run_icp_research_impl.

    The LLM may return any combination of keys depending on the component_name
    (summary, buyer_map, pain_points, etc.).  Captured as open dict; known
    metadata fields are listed explicitly so they survive response_model
    filtering.
    """

    user_id: Optional[str] = None
    org_id: Optional[str] = None
    component_name: Optional[str] = None
    timestamp: Optional[Any] = None

    class Config:
        extra = "allow"


class ICPResearchResponse(BaseModel):
    """Response for POST /icp-research and POST /icp-research_claude."""

    status: str
    data: Dict[str, Any]


class ICPDeleteData(BaseModel):
    """Inner ``data`` block returned by delete_recommended_icp."""

    deleted_icp_id: str
    remaining_count: int


class ICPDeleteResponse(BaseModel):
    """Response for DELETE /icp/recommended/{icp_id}."""

    success: bool
    message: str
    data: ICPDeleteData
