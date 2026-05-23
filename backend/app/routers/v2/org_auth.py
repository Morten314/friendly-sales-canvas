from typing import List

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_mongo
from app.models import PaginatedResponse
from app.models.org_auth import RegistrationResponse
from app.services.org_auth import list_registrations

router = APIRouter(prefix="/registration", tags=["v2", "org_auth"])


@router.get("", response_model=PaginatedResponse[RegistrationResponse])
async def list_registrations_v2(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    mongo=Depends(get_mongo),
):
    items, total = list_registrations(mongo, limit=limit, offset=offset)
    return PaginatedResponse(items=items, total=total, limit=limit, offset=offset)
