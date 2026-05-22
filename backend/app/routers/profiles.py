"""Profiles router: HTTP wiring."""
from fastapi import APIRouter, Body, Query

from app.services import profiles as profiles_service
from app.models.profiles import EditRequest

router = APIRouter(tags=["profiles"])


@router.post("/profile/{profile_type}")
async def create_or_update_profile(
    profile_type: str,
    payload: dict = Body(...)
):
    return profiles_service.upsert_profile(profile_type, payload)


@router.get("/profile/{profile_type}")
async def get_single_profile(
    profile_type: str,
    user_id: str = Query(None),
    org_id: str = Query(None)
):
    return profiles_service.get_profile(profile_type, user_id, org_id)


@router.post("/cleanup-company-profiles")
async def cleanup_company_profiles():
    return profiles_service.cleanup_company_profiles()


@router.post("/edit")
def process_edit(request: EditRequest):
    return profiles_service.edit_profile_field(request)
