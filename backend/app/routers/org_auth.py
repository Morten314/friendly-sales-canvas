"""Org and registration router. HTTP wiring only."""
from typing import List

from fastapi import APIRouter, Body, Depends, Query, Response

from app.core.dependencies import get_mongo
from app.models.org_auth import OrgResponse, RegistrationRequest, RegistrationResponse
from app.services import org_auth as org_auth_service

router = APIRouter(tags=["org-auth"])


@router.get("/org", response_model=OrgResponse)
async def get_org_by_user(user_id: str = Query(...), mongo=Depends(get_mongo)):
    return org_auth_service.list_orgs(mongo, user_id)


@router.post("/org", response_model=OrgResponse)
async def create_org(request: dict = Body(None), mongo=Depends(get_mongo)):
    return org_auth_service.create_org(mongo, request)


@router.post("/connect_org", response_model=OrgResponse)
async def connect_user_to_org(
    user_id: str = Body(...),
    org_id: str = Body(...),
    mongo=Depends(get_mongo),
):
    return org_auth_service.connect_user_to_org(mongo, user_id, org_id)


@router.post("/registration", response_model=RegistrationResponse)
async def create_registration(
    registration: RegistrationRequest,
    mongo=Depends(get_mongo),
):
    return org_auth_service.create_registration(mongo, registration)


@router.get("/registration", response_model=List[RegistrationResponse])
async def get_registrations(
    response: Response,
    mongo=Depends(get_mongo),
):
    """**Deprecated:** use `GET /api/v2/registration` for the paginated envelope.

    Returns up to 500 registrations (silent cap; previously unbounded).
    Admin-only cross-tenant view — no org_id filter — see spec §2.1 #2.
    Reads from the separate `Registration_DB` database (not `Profiler`).
    """
    response.headers["Deprecation"] = "true"
    response.headers["Link"] = '</api/v2/registration>; rel="successor-version"'
    items, _ = org_auth_service.list_registrations(mongo)
    return items
