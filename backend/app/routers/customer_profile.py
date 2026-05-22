"""Customer profile router: HTTP wiring."""
from fastapi import APIRouter, Query

from app.services import customer_profile as cp_service
from app.models.customer_profile import (
    CustomerProfileDeleteResponse,
    CustomerProfileRequest,
    CustomerProfileResponse,
    SuggestedICPResponse,
    SuggestedICPToCustomerProfileRequest,
)

router = APIRouter(prefix="/customer_profile", tags=["customer-profile"])


@router.get("", response_model=CustomerProfileResponse)
async def get_customer_profile(org_id: str = Query(...)):
    return cp_service.get_customer_profile(org_id)


@router.post("", response_model=CustomerProfileResponse)
async def create_or_update_customer_profile(request: CustomerProfileRequest):
    return cp_service.upsert_customer_profile(request)


@router.post("/from_suggested_icp", response_model=SuggestedICPResponse)
async def save_suggested_icp_as_customer_profile(request: SuggestedICPToCustomerProfileRequest):
    return cp_service.create_from_suggested_icp(request)


@router.delete("/icp/{icp_id}", response_model=CustomerProfileDeleteResponse)
async def delete_customer_profile_icp(icp_id: str, org_id: str = Query(...)):
    return cp_service.delete_icp_from_customer_profile(icp_id, org_id)
