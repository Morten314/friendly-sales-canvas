"""Signals endpoints: research, batch generation, signal feed, signal Q&A."""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import (
    get_agent_chain,
    get_mongo,
    get_neo4j_driver,
    get_pinecone,
)
from app.models.market_research import MarketRequest
from app.models.signals import (
    FetchSignalsResponse,
    GenerateSignalsBatchResponse,
    SignalActionRequest,
    SignalActionResponse,
    SignalAskRequest,
    SignalAskResponse,
    SignalsResearchResponse,
)
from app.services import signals as signals_service

router = APIRouter(tags=["signals"])


@router.post("/signals-research", response_model=SignalsResearchResponse)
async def signals_research(
    request: MarketRequest,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
    pc=Depends(get_pinecone),
    agent_chain=Depends(get_agent_chain),
):
    """Research web signals for specific agents (scout/profiler)"""
    return await signals_service.run_signals_research(driver, mongo, pc, agent_chain, request)


@router.post("/generate-signals-batch", response_model=GenerateSignalsBatchResponse)
async def generate_signals_batch(
    request: MarketRequest,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
    pc=Depends(get_pinecone),
    agent_chain=Depends(get_agent_chain),
):
    """Generate 2 signals for scout and 2 signals for profiler"""
    return await signals_service.generate_signals_batch(driver, mongo, pc, agent_chain, request)


@router.post("/generate-signals-batch_claude", response_model=GenerateSignalsBatchResponse)
async def generate_signals_batch_claude(
    request: MarketRequest,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
    pc=Depends(get_pinecone),
    agent_chain=Depends(get_agent_chain),
):
    """Same as /generate-signals-batch but signal text is produced with Claude (Tavily + Anthropic)."""
    from app.services._claude_budget import CLAUDE_API_KEY
    if not CLAUDE_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")
    return await signals_service.generate_signals_batch_claude(driver, mongo, pc, agent_chain, request)


@router.get("/fetch-signals", response_model=FetchSignalsResponse)
async def fetch_signals(
    user_id: str = Query(...),
    limit: int = Query(10),
    mongo=Depends(get_mongo),
):
    """Fetch signals and return them in a simple list format - filtered by user_id only"""
    return await signals_service.fetch_signals(mongo, user_id, limit)


@router.post("/signal_action", response_model=SignalActionResponse)
async def signal_action(
    request: SignalActionRequest,
    mongo=Depends(get_mongo),
):
    """Accept or reject a signal."""
    return await signals_service.record_signal_action(mongo, request)


@router.post("/signal_Ask", response_model=SignalAskResponse)
async def signal_ask(
    request: SignalAskRequest,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
    agent_chain=Depends(get_agent_chain),
):
    """
    Answer a question about signals using company profile, customer profile, history, and WebSearch.
    """
    return await signals_service.signal_ask(driver, mongo, agent_chain, request)


@router.post("/signal_ask_claude", response_model=SignalAskResponse)
async def signal_ask_claude(
    request: SignalAskRequest,
    driver=Depends(get_neo4j_driver),
    mongo=Depends(get_mongo),
):
    """
    Claude-powered signal ask endpoint with local token/run limiter.
    """
    return await signals_service.signal_ask_claude(driver, mongo, request)
