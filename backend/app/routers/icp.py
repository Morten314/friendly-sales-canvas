"""ICP endpoints: synthesis, multi-component research, and saved-ICP delete."""
from fastapi import APIRouter, Query

from app.models.market_research import MarketRequest
from app.services import icp as icp_service

router = APIRouter(tags=["icp"])


@router.get("/icp")
async def get_or_create_icp_config(user_id: str = Query(...), refresh: bool = Query(False)):
    return icp_service.list_icps(user_id=user_id, refresh=refresh)


@router.post("/icp-research")
async def icp_research(request: MarketRequest):
    return await icp_service.run_icp_research(request, llm_backend="groq")


@router.post("/icp-research_claude")
async def icp_research_claude(request: MarketRequest):
    """Same as /icp-research but research is generated with Claude (Tavily + Anthropic)."""
    return await icp_service.run_icp_research(request, llm_backend="claude")


@router.delete("/icp/recommended/{icp_id}")
async def delete_recommended_icp(icp_id: str, user_id: str = Query(...)):
    """
    Delete a single recommended ICP from ICP_config by icp_id for a given user_id.
    """
    return icp_service.delete_recommended_icp(icp_id=icp_id, user_id=user_id)
