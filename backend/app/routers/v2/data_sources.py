from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_mongo
from app.models import PaginatedResponse
from app.models.data_sources import UserDocumentEntry
from app.services.data_sources import list_user_documents

router = APIRouter(prefix="/user-documents", tags=["v2", "data_sources"])


@router.get("", response_model=PaginatedResponse[UserDocumentEntry])
async def list_user_documents_v2(
    org_id: str = Query(...),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    mongo=Depends(get_mongo),
):
    items, total = await list_user_documents(mongo, org_id, limit=limit, offset=offset)
    return PaginatedResponse(items=items, total=total, limit=limit, offset=offset)
