"""Lead market scoring endpoints: score / status / per-lead descriptions."""
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from app.models.market_scoring import (
    LeadMarketScoresRequest,
    LeadMarketScoresResponse,
    LeadMarketScoreDescriptionsResponse,
    LeadMarketScoringStatusResponse,
    LeadMarketScoreStatusItem,
    MARKET_SCORE_COMPONENT_KEYS,
)
from app.services import market_scoring as market_scoring_service
from app.services.leads import get_leads_for_org


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
    score_coll, run_coll = market_scoring_service._get_market_score_collections()
    run_filter: Dict[str, Any] = {"org_id": org_id, "user_id": user_id}
    if run_id:
        run_filter["run_id"] = run_id
    run_doc = run_coll.find_one(run_filter, sort=[("created_at", -1)])
    if not run_doc:
        raise HTTPException(status_code=404, detail="No market scoring run found for org_id")

    run_doc.pop("_id", None)
    target_run_id = str(run_doc.get("run_id"))
    total_leads = int(run_doc.get("total_leads") or 0)
    processed_leads = int(run_doc.get("processed_count") or 0)
    failed_count = int(run_doc.get("failed_count") or 0)

    if total_leads <= 0:
        total_leads = len(get_leads_for_org(org_id, limit=5000, order_by_recent=True, raise_on_error=False))

    run_score_filter = {"org_id": org_id, "user_id": user_id, "run_id": target_run_id}
    scored_doc_count = score_coll.count_documents(run_score_filter)
    if processed_leads < scored_doc_count:
        processed_leads = scored_doc_count

    processed_with_descriptions = score_coll.count_documents(
        {
            **run_score_filter,
            "component_descriptions": {"$type": "object"},
        }
    )

    progress_denominator = max(total_leads, 1)
    progress_percent = round(min(100.0, (processed_leads / progress_denominator) * 100.0), 2)

    recent_docs = list(
        score_coll.find(run_score_filter, {"lead_id": 1, "scoring_status": 1, "market_total_score": 1, "updated_at": 1, "component_descriptions": 1})
        .sort("updated_at", -1)
        .limit(recent_items_limit)
    )
    recent_items: List[LeadMarketScoreStatusItem] = []
    for doc in recent_docs:
        recent_items.append(
            LeadMarketScoreStatusItem(
                lead_id=str(doc.get("lead_id")),
                scoring_status=str(doc.get("scoring_status", "unknown")),
                combined_score=float(doc.get("market_total_score", 0)) if doc.get("market_total_score") is not None else None,
                updated_at=doc.get("updated_at"),
                description_preview=market_scoring_service._extract_description_preview(doc.get("component_descriptions")),
            )
        )

    return LeadMarketScoringStatusResponse(
        org_id=org_id,
        run_id=target_run_id,
        processing_status=str(run_doc.get("status", "idle")),
        processed_leads=processed_leads,
        total_leads=total_leads,
        processed_with_descriptions=int(processed_with_descriptions),
        failed_count=failed_count,
        progress_percent=progress_percent,
        started_at=run_doc.get("started_at"),
        updated_at=run_doc.get("updated_at"),
        completed_at=run_doc.get("completed_at"),
        recent_items=recent_items,
    )


@router.get("/leads/{lead_id}/market-score-descriptions", response_model=LeadMarketScoreDescriptionsResponse)
async def get_lead_market_score_descriptions(
    lead_id: str,
    user_id: str = Query(...),
    org_id: str = Query(...),
):
    score_coll, _ = market_scoring_service._get_market_score_collections()
    doc = score_coll.find_one({"org_id": org_id, "lead_id": lead_id, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Lead scoring descriptions not found")

    descriptions = doc.get("component_descriptions", {})
    if not isinstance(descriptions, dict):
        descriptions = {}

    normalized_descriptions = {
        key: str(descriptions.get(key, "Description not available"))
        for key in MARKET_SCORE_COMPONENT_KEYS
    }
    return LeadMarketScoreDescriptionsResponse(
        lead_id=lead_id,
        org_id=org_id,
        combined_score=float(doc.get("market_total_score", 0)),
        scored_at=doc.get("scored_at") or doc.get("updated_at"),
        descriptions=normalized_descriptions,
    )
