"""Market research endpoints: 5-component report (Groq + Claude variants)."""
from fastapi import APIRouter, HTTPException

from app.core.exceptions import BudgetExhaustedError
from app.models.market_research import MarketRequest, MarketResponse
from app.services import market_research as mr_service
from app.services._claude_budget import CLAUDE_API_KEY

router = APIRouter(tags=["market-research"])


@router.post("/market-research", response_model=MarketResponse)
async def market_research(request: MarketRequest):
    return await mr_service.run_market_research(request, llm_backend="groq")


@router.post("/market-research_claude", response_model=MarketResponse)
async def market_research_claude(request: MarketRequest):
    """Same as /market-research but research is generated with Claude (Tavily + Anthropic)."""
    if not CLAUDE_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")
    try:
        return await mr_service.run_market_research(request, llm_backend="claude")
    except BudgetExhaustedError as e:
        raise HTTPException(status_code=429, detail=str(e))
