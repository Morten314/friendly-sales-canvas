"""Market research endpoints: 5-component report (Groq + Claude variants)."""
from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import (
    get_agent_chain,
    get_mongo,
    get_neo4j_driver,
    get_pinecone,
)
from app.models.market_research import MarketRequest, MarketResponse
from app.services import market_research as mr_service
from app.services._claude_budget import CLAUDE_API_KEY

router = APIRouter(tags=["market-research"])


@router.post("/market-research", response_model=MarketResponse)
async def market_research(
    request: MarketRequest,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
    pc=Depends(get_pinecone),
    agent_chain=Depends(get_agent_chain),
):
    return await mr_service.run_market_research(driver, mongo, pc, agent_chain, request, llm_backend="groq")


@router.post("/market-research_claude", response_model=MarketResponse)
async def market_research_claude(
    request: MarketRequest,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
    pc=Depends(get_pinecone),
    agent_chain=Depends(get_agent_chain),
):
    """Same as /market-research but research is generated with Claude (Tavily + Anthropic)."""
    if not CLAUDE_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")
    return await mr_service.run_market_research(driver, mongo, pc, agent_chain, request, llm_backend="claude")
