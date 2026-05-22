"""Customer profile models."""
from typing import Dict, List, Literal, Optional, Any
from pydantic import BaseModel, Field, ConfigDict


# Customer Profile ICP model
class CustomerProfileICP(BaseModel):
    model_config = ConfigDict(extra='allow')  # Allow any additional fields for flexibility

    id: Optional[str] = None
    primary_region: str = Field(..., min_length=1)
    industry: List[str] = Field(..., min_items=1)
    company_size: List[str] = Field(..., min_items=1)
    buyer_role: List[str] = Field(..., min_items=1)
    accounts_on_watchlist: Optional[List[str]] = None
    accounts_to_avoid: Optional[List[str]] = None
    fit_confidence: Literal["high", "medium", "low"]
    additional_context: Optional[str] = None
    location: Optional[List[str]] = None
    status: str = "saved"
    created_at: Optional[str] = None


# Customer Profile Request model
class CustomerProfileRequest(BaseModel):
    profile_type: Literal["customer"] = "customer"
    org_id: str  # Required for multi-org support
    icps: List[CustomerProfileICP] = Field(..., min_items=1)


# Convert a recommended/suggested ICP (from GET /icp) into a saved customer profile ICP
class SuggestedICPToCustomerProfileRequest(BaseModel):
    user_id: str
    org_id: str
    icp_id: str


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class CustomerProfileICPListData(BaseModel):
    """Inner data: list of ICPs."""
    icps: List[Any]


class CustomerProfileResponse(BaseModel):
    """Returned by get_customer_profile and upsert_customer_profile."""
    success: bool
    message: Optional[str] = None
    data: CustomerProfileICPListData


class CustomerProfileDeleteData(BaseModel):
    """Inner data returned on ICP deletion."""
    deleted_icp_id: str
    remaining_count: int


class CustomerProfileDeleteResponse(BaseModel):
    """Returned by delete_icp_from_customer_profile."""
    success: bool
    message: str
    data: CustomerProfileDeleteData


class SuggestedICPData(BaseModel):
    """Inner data returned by create_from_suggested_icp."""
    icp: Dict[str, Any]


class SuggestedICPResponse(BaseModel):
    """Returned by create_from_suggested_icp."""
    success: bool
    message: str
    data: SuggestedICPData
