"""Customer profile router: HTTP wiring."""
from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_mongo, get_neo4j_driver
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
async def get_customer_profile(
    org_id: str = Query(...),
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
):
    return cp_service.get_customer_profile(driver, mongo, org_id)


@router.post("", response_model=CustomerProfileResponse)
async def create_or_update_customer_profile(
    request: CustomerProfileRequest,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
):
    return cp_service.upsert_customer_profile(driver, mongo, request)


@router.post("/from_suggested_icp", response_model=SuggestedICPResponse)
async def save_suggested_icp_as_customer_profile(
    request: SuggestedICPToCustomerProfileRequest,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
):
    return cp_service.create_from_suggested_icp(driver, mongo, request)


@router.delete("/icp/{icp_id}", response_model=CustomerProfileDeleteResponse)
async def delete_customer_profile_icp(
    icp_id: str,
    org_id: str = Query(...),
    mongo=Depends(get_mongo),
):
    return cp_service.delete_icp_from_customer_profile(mongo, icp_id, org_id)
