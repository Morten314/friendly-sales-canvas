"""ICP endpoints: synthesis, multi-component research, and saved-ICP delete."""
from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.core.dependencies import (
    get_agent_chain,
    get_mongo,
    get_neo4j_driver,
    get_pinecone,
)
from app.models.icp import ICPDeleteResponse, ICPListResponse, ICPResearchResponse
from app.models.market_research import MarketRequest
from app.services import icp as icp_service

router = APIRouter(tags=["icp"])


@router.get("/icp", response_model=ICPListResponse)
async def get_or_create_icp_config(
    response: Response,
    user_id: str = Query(...),
    refresh: bool = Query(False),
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
    agent_chain=Depends(get_agent_chain),
):
    """**Deprecated:** use `GET /api/v2/icp` for the paginated envelope.

    Returns the user's ICP list (typically 5-10 items; hard cap of 500).
    """
    response.headers["Deprecation"] = "true"
    response.headers["Link"] = '</api/v2/icp>; rel="successor-version"'
    items, _ = icp_service.list_icps(driver, mongo, agent_chain, user_id=user_id, refresh=refresh)
    return {"suggestedICPs": items}


@router.post("/icp-research", response_model=ICPResearchResponse)
async def icp_research(
    request: MarketRequest,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
    pc=Depends(get_pinecone),
    agent_chain=Depends(get_agent_chain),
):
    return await icp_service.run_icp_research(driver, mongo, pc, agent_chain, request, llm_backend="groq")


@router.post("/icp-research_claude", response_model=ICPResearchResponse)
async def icp_research_claude(
    request: MarketRequest,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
    pc=Depends(get_pinecone),
    agent_chain=Depends(get_agent_chain),
):
    """Same as /icp-research but research is generated with Claude (Tavily + Anthropic)."""
    from app.services._claude_budget import CLAUDE_API_KEY
    if not CLAUDE_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")
    return await icp_service.run_icp_research(driver, mongo, pc, agent_chain, request, llm_backend="claude")


@router.delete("/icp/recommended/{icp_id}", response_model=ICPDeleteResponse)
async def delete_recommended_icp(
    icp_id: str,
    user_id: str = Query(...),
    mongo=Depends(get_mongo),
):
    """
    Delete a single recommended ICP from ICP_config by icp_id for a given user_id.
    """
    return icp_service.delete_recommended_icp(mongo, icp_id=icp_id, user_id=user_id)
