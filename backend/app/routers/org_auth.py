"""Org and registration router. HTTP wiring only."""
from typing import List

from fastapi import APIRouter, Body, Query

from app.models.org_auth import OrgResponse, RegistrationRequest, RegistrationResponse
from app.services import org_auth as org_auth_service

router = APIRouter(tags=["org-auth"])


@router.get("/org", response_model=OrgResponse)
async def get_org_by_user(user_id: str = Query(...)):
    return org_auth_service.list_orgs(user_id)


@router.post("/org", response_model=OrgResponse)
async def create_org(request: dict = Body(None)):
    return org_auth_service.create_org(request)


@router.post("/connect_org", response_model=OrgResponse)
async def connect_user_to_org(user_id: str = Body(...), org_id: str = Body(...)):
    return org_auth_service.connect_user_to_org(user_id, org_id)


@router.post("/registration", response_model=RegistrationResponse)
async def create_registration(registration: RegistrationRequest):
    return org_auth_service.create_registration(registration)


@router.get("/registration", response_model=List[RegistrationResponse])
async def get_registrations():
    return org_auth_service.list_registrations()
