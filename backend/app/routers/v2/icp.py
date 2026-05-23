from typing import Any, Dict

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_agent_chain, get_mongo, get_neo4j_driver
from app.models import PaginatedResponse
from app.services.icp import list_icps

router = APIRouter(prefix="/icp", tags=["v2", "icp"])


@router.get("", response_model=PaginatedResponse[Dict[str, Any]])
async def list_icps_v2(
    user_id: str = Query(...),
    refresh: bool = Query(False),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
    agent_chain=Depends(get_agent_chain),
):
    items, total = list_icps(
        driver, mongo, agent_chain,
        user_id=user_id, refresh=refresh,
        limit=limit, offset=offset,
    )
    return PaginatedResponse(items=items, total=total, limit=limit, offset=offset)
