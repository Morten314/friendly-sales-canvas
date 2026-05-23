from typing import Any, Dict

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_neo4j_driver
from app.models import PaginatedResponse
from app.services.leads import get_leads_for_org, list_leads_by_file

router = APIRouter(prefix="/leads", tags=["v2", "leads"])


@router.get("", response_model=PaginatedResponse[Dict[str, Any]])
def list_leads_v2(
    org_id: str = Query(...),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    driver=Depends(get_neo4j_driver),
):
    items, total = get_leads_for_org(driver, org_id, limit=limit, offset=offset)
    return PaginatedResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/by-file", response_model=PaginatedResponse[Dict[str, Any]])
def list_leads_by_file_v2(
    org_id: str = Query(...),
    file_id: str = Query(...),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    driver=Depends(get_neo4j_driver),
):
    items, total = list_leads_by_file(driver, org_id, file_id, limit=limit, offset=offset)
    return PaginatedResponse(items=items, total=total, limit=limit, offset=offset)
