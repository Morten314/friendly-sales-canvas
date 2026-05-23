from typing import Any, Dict

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_mongo
from app.models import PaginatedResponse
from app.services.signals import fetch_signals

router = APIRouter(prefix="/fetch-signals", tags=["v2", "signals"])


@router.get("", response_model=PaginatedResponse[Dict[str, Any]])
async def fetch_signals_v2(
    user_id: str = Query(...),
    limit: int = Query(10, ge=1, le=500),
    offset: int = Query(0, ge=0),
    mongo=Depends(get_mongo),
):
    items, total = await fetch_signals(mongo, user_id, limit=limit, offset=offset)
    return PaginatedResponse(items=items, total=total, limit=limit, offset=offset)
