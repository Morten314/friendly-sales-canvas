"""Lead market scoring service.

Owns:
  - Profiler Mongo collections (shared primary cluster)
  - Lead identity extraction (cross-source name normalization)
  - Single-lead scoring against market reports
  - Bulk scoring background task with stale-run detection
"""
import json
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from fastapi import BackgroundTasks
from langchain_core.messages import HumanMessage
from app.services._neo4j_helpers import upsert_node
from app.core.exceptions import (
    BrewraError,
    MarketScoreNotFoundError,
    MarketScoringRunNotFoundError,
)
from app.models.market_scoring import (
    LeadMarketScoreRow,
    LeadMarketScoresRequest,
    MARKET_SCORE_COMPONENT_KEYS,
)
from app.services.leads import get_leads_for_org
from app.services.market_scoring import persistence
from app.services.market_scoring.normalization import (
    _safe_json_to_obj,
    _normalize_non_empty_string,
    _canonicalize_key,
    _build_lookup_maps,
    _first_non_empty_value_from_keys,
    _extract_company_name,
    _extract_lead_name,
    _extract_description_preview,
    _parse_iso_datetime,
)
from app.services.market_scoring.scoring import (
    _lead_to_score_row,
    _is_stale_queued_run,
    _run_market_scoring_for_org,
)


logger = logging.getLogger(__name__)


def trigger_or_get_market_scores(
    driver,
    mongo,
    llm2,
    request: LeadMarketScoresRequest,
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    """Trigger a new market-scoring run or return current/latest scores for an org.

    Returns a dict matching the LeadMarketScoresResponse schema:
      org_id, total_leads, processing_status, active_run_id, last_scored_at, rows.
    Raises MarketScoreNotFoundError if no rows exist and no refresh was requested.
    """
    import uuid  # function-local: uuid is used only in this function

    _, run_coll = persistence._get_market_score_collections(mongo)
    active_run = run_coll.find_one(
        {"org_id": request.org_id, "status": {"$in": ["queued", "processing"]}},
        sort=[("created_at", -1)],
    )

    if active_run and _is_stale_queued_run(active_run):
        stale_run_id = str(active_run.get("run_id"))
        now_iso = datetime.now(timezone.utc).isoformat()
        run_coll.update_one(
            {"run_id": stale_run_id},
            {
                "$set": {
                    "status": "failed",
                    "error": "Run auto-failed because it remained queued without starting.",
                    "updated_at": now_iso,
                    "completed_at": now_iso,
                }
            },
        )
        logger.warning(
            "Marked stale queued market scoring run as failed. org_id=%s run_id=%s",
            request.org_id,
            stale_run_id,
        )
        active_run = None

    run_doc: Optional[Dict[str, Any]] = None
    if request.refresh and not active_run:
        run_id = str(uuid.uuid4())
        queued_at = datetime.now(timezone.utc).isoformat()
        run_doc = {
            "run_id": run_id,
            "user_id": request.user_id,
            "org_id": request.org_id,
            "status": "queued",
            "created_at": queued_at,
            "started_at": None,
            "completed_at": None,
            "updated_at": queued_at,
            "total_leads": 0,
            "processed_count": 0,
            "failed_count": 0,
        }
        run_coll.insert_one(run_doc)
        background_tasks.add_task(
            _run_market_scoring_for_org,
            driver,
            mongo,
            llm2,
            request.user_id,
            request.org_id,
            run_id,
        )
    elif active_run:
        active_run.pop("_id", None)
        run_doc = active_run
    else:
        run_doc = persistence._get_latest_scoring_run(mongo, request.org_id)

    rows, _ = persistence._get_latest_market_score_rows(driver, mongo, request.org_id)
    if not rows and not request.refresh:
        raise MarketScoreNotFoundError("No lead market scores found for org_id")

    latest_run = run_doc or persistence._get_latest_scoring_run(mongo, request.org_id)
    processing_status = str((latest_run or {}).get("status", "idle"))
    last_scored_at = rows[0].updated_at if rows else None
    return {
        "org_id": request.org_id,
        "total_leads": len(rows),
        "processing_status": processing_status,
        "active_run_id": (latest_run or {}).get("run_id"),
        "last_scored_at": last_scored_at,
        "rows": rows,
    }


def get_market_scores_status(
    driver,
    mongo,
    user_id: str,
    org_id: str,
    run_id: Optional[str],
    recent_items_limit: int,
) -> Dict[str, Any]:
    """Return progress + recent items for a market-scoring run.

    Returns a dict matching the LeadMarketScoringStatusResponse schema.
    Raises MarketScoringRunNotFoundError if no run is found for the given filter.
    """
    score_coll, run_coll = persistence._get_market_score_collections(mongo)
    run_filter: Dict[str, Any] = {"org_id": org_id, "user_id": user_id}
    if run_id:
        run_filter["run_id"] = run_id
    run_doc = run_coll.find_one(run_filter, sort=[("created_at", -1)])
    if not run_doc:
        raise MarketScoringRunNotFoundError("No market scoring run found for org_id")

    run_doc.pop("_id", None)
    target_run_id = str(run_doc.get("run_id"))
    total_leads = int(run_doc.get("total_leads") or 0)
    processed_leads = int(run_doc.get("processed_count") or 0)
    failed_count = int(run_doc.get("failed_count") or 0)

    if total_leads <= 0:
        # Degrade-on-failure: status endpoint must stay responsive even if
        # Neo4j hiccups. total_leads=0 yields a progress_percent of 0 — UI
        # shows "no progress" rather than a hard 500.
        try:
            leads, total_leads = get_leads_for_org(driver, org_id=org_id, limit=5000, offset=0)
        except Exception as e:
            logger.warning(
                "Could not fetch leads for scoring status (org_id=%s): %s; defaulting total_leads=0",
                org_id, e,
            )
            total_leads = 0

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
    recent_items: List[Dict[str, Any]] = []
    for doc in recent_docs:
        recent_items.append(
            {
                "lead_id": str(doc.get("lead_id")),
                "scoring_status": str(doc.get("scoring_status", "unknown")),
                "combined_score": float(doc.get("market_total_score", 0)) if doc.get("market_total_score") is not None else None,
                "updated_at": doc.get("updated_at"),
                "description_preview": _extract_description_preview(doc.get("component_descriptions")),
            }
        )

    return {
        "org_id": org_id,
        "run_id": target_run_id,
        "processing_status": str(run_doc.get("status", "idle")),
        "processed_leads": processed_leads,
        "total_leads": total_leads,
        "processed_with_descriptions": int(processed_with_descriptions),
        "failed_count": failed_count,
        "progress_percent": progress_percent,
        "started_at": run_doc.get("started_at"),
        "updated_at": run_doc.get("updated_at"),
        "completed_at": run_doc.get("completed_at"),
        "recent_items": recent_items,
    }


def get_lead_market_score_descriptions(
    mongo,
    lead_id: str,
    user_id: str,
    org_id: str,
) -> Dict[str, Any]:
    """Return the component descriptions for a single lead's scoring.

    Returns a dict matching the LeadMarketScoreDescriptionsResponse schema.
    Raises MarketScoreNotFoundError if the lead has no scoring document.
    """
    score_coll, _ = persistence._get_market_score_collections(mongo)
    doc = score_coll.find_one({"org_id": org_id, "lead_id": lead_id, "user_id": user_id})
    if not doc:
        raise MarketScoreNotFoundError("Lead scoring descriptions not found")

    descriptions = doc.get("component_descriptions", {})
    if not isinstance(descriptions, dict):
        descriptions = {}

    normalized_descriptions = {
        key: str(descriptions.get(key, "Description not available"))
        for key in MARKET_SCORE_COMPONENT_KEYS
    }
    return {
        "lead_id": lead_id,
        "org_id": org_id,
        "combined_score": float(doc.get("market_total_score", 0)),
        "scored_at": doc.get("scored_at") or doc.get("updated_at"),
        "descriptions": normalized_descriptions,
    }


def get_market_reports_for_org(mongo, user_id: str, org_id: str) -> Dict[str, Dict[str, Any]]:
    """Fetch latest market research reports for all five components."""
    db = mongo["Scout_Agent"]
    collection = db["Market_Intelligence"]
    reports: Dict[str, Dict[str, Any]] = {}
    for component_name in MARKET_SCORE_COMPONENT_KEYS:
        doc = collection.find_one(
            {"user_id": user_id, "org_id": org_id, "component_name": component_name},
            sort=[("timestamp", -1)],
        )
        if doc:
            doc.pop("_id", None)
            reports[component_name] = doc
    return reports


def _clean_and_parse_json(raw_text: str) -> Dict[str, Any]:
    cleaned = (
        str(raw_text)
        .strip()
        .removeprefix("```json")
        .removeprefix("```")
        .removesuffix("```")
        .strip()
    )
    return json.loads(cleaned)


def score_single_lead_against_market(
    llm2,
    lead: Dict[str, Any],
    company_profile: Dict[str, Any],
    market_reports: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Score one lead against all five market components with explanations.
    Returns component_scores, component_descriptions and total score.
    """
    prompt = f"""
You are scoring a sales lead fit against five market-research components.
Return strict JSON only.

Component keys (must match exactly):
{json.dumps(MARKET_SCORE_COMPONENT_KEYS)}

Company profile:
{json.dumps(company_profile, default=str)}

Lead data:
{json.dumps(lead, default=str)}

Market research component reports:
{json.dumps(market_reports, default=str)}

Return JSON schema:
{{
  "component_scores": {{
    "market size & opportunity": <number 0-100>,
    "industry trends report": <number 0-100>,
    "competitor landscape": <number 0-100>,
    "regulatory & compliance highlights": <number 0-100>,
    "market entry & growth strategy": <number 0-100>
  }},
  "component_descriptions": {{
    "market size & opportunity": "<short reason>",
    "industry trends report": "<short reason>",
    "competitor landscape": "<short reason>",
    "regulatory & compliance highlights": "<short reason>",
    "market entry & growth strategy": "<short reason>"
  }}
}}
"""
    response = llm2.invoke([HumanMessage(content=prompt)])
    content = getattr(response, "content", response)
    parsed = _clean_and_parse_json(content)
    scores = parsed.get("component_scores", {}) if isinstance(parsed, dict) else {}
    descriptions = parsed.get("component_descriptions", {}) if isinstance(parsed, dict) else {}

    normalized_scores: Dict[str, float] = {}
    normalized_descriptions: Dict[str, str] = {}
    for component in MARKET_SCORE_COMPONENT_KEYS:
        raw_score = scores.get(component, 0)
        try:
            score = float(raw_score)
        except (TypeError, ValueError):
            score = 0.0
        score = max(0.0, min(100.0, score))
        normalized_scores[component] = round(score, 2)

        description = descriptions.get(component)
        if not isinstance(description, str) or not description.strip():
            description = "Score generated with limited evidence from available lead/profile context."
        normalized_descriptions[component] = description.strip()

    total_score = round(sum(normalized_scores.values()) / float(len(MARKET_SCORE_COMPONENT_KEYS)), 2)
    return {
        "component_scores": normalized_scores,
        "component_descriptions": normalized_descriptions,
        "market_total_score": total_score,
    }


def _persist_market_score_for_lead(
    driver,
    mongo,
    user_id: str,
    org_id: str,
    lead: Dict[str, Any],
    scoring_payload: Dict[str, Any],
    run_id: str,
    scoring_status: str = "completed",
    score_coll=None,
) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    lead_id = str(lead.get("lead_id"))
    file_id = lead.get("file_id")
    company_name = _extract_company_name(lead)
    lead_name = _extract_lead_name(lead)
    component_scores = scoring_payload.get("component_scores", {})
    component_descriptions = scoring_payload.get("component_descriptions", {})
    market_total_score = float(scoring_payload.get("market_total_score", 0))

    local_score_coll = score_coll
    if local_score_coll is None:
        local_score_coll, _ = persistence._get_market_score_collections(mongo)
    local_score_coll.update_one(
        {"org_id": org_id, "lead_id": lead_id},
        {
            "$set": {
                "user_id": user_id,
                "org_id": org_id,
                "lead_id": lead_id,
                "file_id": file_id,
                "company_name": company_name,
                "lead_name": lead_name,
                "component_scores": component_scores,
                "component_descriptions": component_descriptions,
                "market_total_score": market_total_score,
                "scoring_status": scoring_status,
                "run_id": run_id,
                "updated_at": now_iso,
                "scored_at": now_iso,
            },
            "$setOnInsert": {"created_at": now_iso},
        },
        upsert=True,
    )

    neo4j_update = {
        "market_component_scores": component_scores,
        "market_component_descriptions": component_descriptions,
        "market_total_score": market_total_score,
        "market_scored_at": now_iso,
        "market_scoring_version": "v1",
        "market_scoring_status": scoring_status,
        "market_score_run_id": run_id,
    }
    with driver.session() as session:
        session.execute_write(
            upsert_node,
            "Lead",
            "lead_id",
            lead_id,
            neo4j_update,
        )

