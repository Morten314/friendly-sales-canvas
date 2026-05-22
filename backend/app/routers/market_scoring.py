"""Lead market scoring endpoints: score / status / per-lead descriptions."""
import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Query

from app.models.market_scoring import (
    LeadMarketScoresRequest,
    LeadMarketScoresResponse,
    LeadMarketScoreDescriptionsResponse,
    LeadMarketScoringStatusResponse,
)
from app.services import market_scoring as market_scoring_service


router = APIRouter(tags=["market-scoring"])
logger = logging.getLogger(__name__)


@router.post("/leads/market-scores", response_model=LeadMarketScoresResponse)
async def get_or_refresh_lead_market_scores(
    request: LeadMarketScoresRequest,
    background_tasks: BackgroundTasks,
):
    return market_scoring_service.trigger_or_get_market_scores(request, background_tasks)


@router.get("/leads/market-scores/status", response_model=LeadMarketScoringStatusResponse)
async def get_lead_market_scores_status(
    user_id: str = Query(...),
    org_id: str = Query(...),
    run_id: Optional[str] = Query(None),
    recent_items_limit: int = Query(10, ge=1, le=100),
):
    return market_scoring_service.get_market_scores_status(
        user_id=user_id, org_id=org_id, run_id=run_id, recent_items_limit=recent_items_limit,
    )


@router.get("/leads/{lead_id}/market-score-descriptions", response_model=LeadMarketScoreDescriptionsResponse)
async def get_lead_market_score_descriptions(
    lead_id: str,
    user_id: str = Query(...),
    org_id: str = Query(...),
):
    return market_scoring_service.get_lead_market_score_descriptions(
        lead_id=lead_id, user_id=user_id, org_id=org_id,
    )
