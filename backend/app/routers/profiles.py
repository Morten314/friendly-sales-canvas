"""Profiles router: HTTP wiring."""
from fastapi import APIRouter, Body, Depends, Query

from app.core.dependencies import get_mongo, get_neo4j_driver
from app.services import profiles as profiles_service
from app.models.profiles import (
    CleanupProfilesResponse,
    EditProfileResponse,
    EditRequest,
    ProfileMessageResponse,
)

router = APIRouter(tags=["profiles"])


@router.post("/profile/{profile_type}", response_model=ProfileMessageResponse)
async def create_or_update_profile(
    profile_type: str,
    payload: dict = Body(...),
    driver=Depends(get_neo4j_driver),
):
    return profiles_service.upsert_profile(driver, profile_type, payload)


# Response shape varies by profile_type (CompanyProfile, UserProfile, ScoutProfile);
# annotation deferred.
@router.get("/profile/{profile_type}")
async def get_single_profile(
    profile_type: str,
    user_id: str = Query(None),
    org_id: str = Query(None),
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
):
    return profiles_service.get_profile(driver, mongo, profile_type, user_id, org_id)


@router.post("/cleanup-company-profiles", response_model=CleanupProfilesResponse)
async def cleanup_company_profiles(driver=Depends(get_neo4j_driver)):
    return profiles_service.cleanup_company_profiles(driver)


@router.post("/edit", response_model=EditProfileResponse)
def process_edit(request: EditRequest, mongo=Depends(get_mongo)):
    return profiles_service.edit_profile_field(mongo, request)
