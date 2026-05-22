"""Signals endpoints: research, batch generation, signal feed, signal Q&A."""
from fastapi import APIRouter, Query

from app.models.market_research import MarketRequest
from app.models.signals import SignalActionRequest, SignalAskRequest
from app.services import signals as signals_service

router = APIRouter(tags=["signals"])


@router.post("/signals-research")
async def signals_research(request: MarketRequest):
    """Research web signals for specific agents (scout/profiler)"""
    return await signals_service.run_signals_research(request)


@router.post("/generate-signals-batch")
async def generate_signals_batch(request: MarketRequest):
    """Generate 2 signals for scout and 2 signals for profiler"""
    return await signals_service.generate_signals_batch(request)


@router.post("/generate-signals-batch_claude")
async def generate_signals_batch_claude(request: MarketRequest):
    """Same as /generate-signals-batch but signal text is produced with Claude (Tavily + Anthropic)."""
    return await signals_service.generate_signals_batch_claude(request)


@router.get("/fetch-signals")
async def fetch_signals(user_id: str = Query(...), limit: int = Query(10)):
    """Fetch signals and return them in a simple list format - filtered by user_id only"""
    return await signals_service.fetch_signals(user_id, limit)


@router.post("/signal_action")
async def signal_action(request: SignalActionRequest):
    """Accept or reject a signal."""
    return await signals_service.record_signal_action(request)


@router.post("/signal_Ask")
async def signal_ask(request: SignalAskRequest):
    """
    Answer a question about signals using company profile, customer profile, history, and WebSearch.
    """
    return await signals_service.signal_ask(request)


@router.post("/signal_ask_claude")
async def signal_ask_claude(request: SignalAskRequest):
    """
    Claude-powered signal ask endpoint with local token/run limiter.
    """
    return await signals_service.signal_ask_claude(request)
