"""Internal ops-console router. Mounted at prefix='/admin' (spec 44)."""
from typing import List

from fastapi import APIRouter, Depends

from app.core.dependencies import get_mongo
from app.models.admin import AdminOrgSummary
from app.services.admin import list_all_orgs

router = APIRouter(tags=["admin"])


@router.get("/orgs", response_model=List[AdminOrgSummary])
async def admin_list_orgs(mongo=Depends(get_mongo)):
    return list_all_orgs(mongo)
