"""ICP endpoints: synthesis, multi-component research, and saved-ICP delete."""
from fastapi import APIRouter, HTTPException, Query

from app.core.exceptions import ICPIdRegistryError
from app.models.icp import ICPDeleteResponse, ICPListResponse, ICPResearchResponse
from app.models.market_research import MarketRequest
from app.services import icp as icp_service

router = APIRouter(tags=["icp"])


@router.get("/icp", response_model=ICPListResponse)
async def get_or_create_icp_config(user_id: str = Query(...), refresh: bool = Query(False)):
    try:
        return icp_service.list_icps(user_id=user_id, refresh=refresh)
    except ICPIdRegistryError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/icp-research", response_model=ICPResearchResponse)
async def icp_research(request: MarketRequest):
    try:
        return await icp_service.run_icp_research(request, llm_backend="groq")
    except ICPIdRegistryError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/icp-research_claude", response_model=ICPResearchResponse)
async def icp_research_claude(request: MarketRequest):
    """Same as /icp-research but research is generated with Claude (Tavily + Anthropic)."""
    from app.services._claude_budget import CLAUDE_API_KEY
    if not CLAUDE_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")
    try:
        return await icp_service.run_icp_research(request, llm_backend="claude")
    except ICPIdRegistryError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/icp/recommended/{icp_id}", response_model=ICPDeleteResponse)
async def delete_recommended_icp(icp_id: str, user_id: str = Query(...)):
    """
    Delete a single recommended ICP from ICP_config by icp_id for a given user_id.
    """
    return icp_service.delete_recommended_icp(icp_id=icp_id, user_id=user_id)
