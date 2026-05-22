"""Lead market scoring service.

Owns:
  - Profiler Mongo collections (shared primary cluster via app.core.clients.client)
  - Lead identity extraction (cross-source name normalization)
  - Single-lead scoring against market reports
  - Bulk scoring background task with stale-run detection

Largest service module in phase A.
"""
import json
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from fastapi import BackgroundTasks, HTTPException
from langchain_core.messages import HumanMessage
from app.core import clients
from app.core import llm_config
from app.core.clients import upsert_node
from app.models.market_scoring import (
    LeadMarketScoreRow,
    LeadMarketScoresRequest,
    MARKET_SCORE_COMPONENT_KEYS,
)
from app.services.leads import get_leads_for_org


logger = logging.getLogger(__name__)


def _get_market_score_collections():
    # Returns only the collections — never the client. Callers MUST NOT close
    # the underlying connection; it is the shared singleton from app.core.clients.
    profiler_db = clients.client["Profiler"]
    score_coll = profiler_db["Lead_Market_Scores"]
    run_coll = profiler_db["Lead_Market_Score_Runs"]
    score_coll.create_index([("org_id", 1), ("lead_id", 1)], unique=True)
    score_coll.create_index([("org_id", 1), ("updated_at", -1)])
    run_coll.create_index([("org_id", 1), ("status", 1)])
    run_coll.create_index([("org_id", 1), ("created_at", -1)])
    return score_coll, run_coll


def _safe_json_to_obj(value: Any) -> Any:
    if isinstance(value, str) and value.strip().startswith(("{", "[")):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


def _normalize_non_empty_string(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _canonicalize_key(key: Any) -> str:
    return "".join(ch.lower() for ch in str(key) if ch.isalnum())


def _build_lookup_maps(payload: Dict[str, Any]) -> Dict[str, Any]:
    lookup: Dict[str, Any] = {}
    for key, value in payload.items():
        canonical = _canonicalize_key(key)
        if canonical and canonical not in lookup:
            lookup[canonical] = value
    return lookup


def _first_non_empty_value_from_keys(payload: Dict[str, Any], aliases: List[str]) -> Optional[str]:
    canonical_lookup = _build_lookup_maps(payload)
    for alias in aliases:
        value = canonical_lookup.get(_canonicalize_key(alias))
        normalized = _normalize_non_empty_string(value)
        if normalized:
            return normalized
    return None


def _extract_company_name(lead: Dict[str, Any]) -> Optional[str]:
    candidate_keys = [
        "company_name",
        "company",
        "Company",
        "account_name",
        "organization",
        "org_name",
        "companyName",
        "comp",
        "comp_name",
        "companyname",
        "org",
        "organization_name",
        "account",
        "business_name",
    ]
    return _first_non_empty_value_from_keys(lead, candidate_keys)


def _extract_lead_name(lead: Dict[str, Any]) -> Optional[str]:
    candidate_keys = [
        "lead_name",
        "name",
        "lead",
        "contact_name",
        "prospect_name",
        "full_name",
        "fullName",
        "fullname",
        "first_name",
        "firstName",
        "firstname",
        "last_name",
        "lastName",
        "lastname",
        "leadName",
        "person_name",
        "contact",
    ]
    top_level_name = _first_non_empty_value_from_keys(lead, candidate_keys)
    if top_level_name:
        return top_level_name

    contact_obj = lead.get("contact")
    if isinstance(contact_obj, dict):
        contact_name = _first_non_empty_value_from_keys(
            contact_obj,
            [
                "name",
                "full_name",
                "fullName",
                "first_name",
                "firstName",
                "last_name",
                "lastName",
                "contact_name",
                "display_name",
            ],
        )
        if contact_name:
            return contact_name
    return None


def _get_lead_identity_from_neo4j(org_id: str, lead_id: str) -> Dict[str, Optional[str]]:
    query_string = """
    MATCH (l:Lead {org_id: $org_id, lead_id: $lead_id})
    RETURN l
    LIMIT 1
    """
    with clients.driver.session() as session:
        record = session.run(query_string, org_id=org_id, lead_id=lead_id).single()
        if not record:
            return {"company_name": None, "lead_name": None}
        lead_node = record["l"]
        lead_data = dict(lead_node.items())
        return {
            "company_name": _extract_company_name(lead_data),
            "lead_name": _extract_lead_name(lead_data),
        }


def _lead_to_score_row(lead_doc: Dict[str, Any]) -> LeadMarketScoreRow:
    component_scores = lead_doc.get("component_scores", {}) if isinstance(lead_doc.get("component_scores"), dict) else {}
    return LeadMarketScoreRow(
        lead_id=str(lead_doc.get("lead_id")),
        org_id=str(lead_doc.get("org_id")),
        file_id=lead_doc.get("file_id"),
        company_name=lead_doc.get("company_name"),
        lead_name=lead_doc.get("lead_name"),
        score_market_size_opportunity=float(component_scores.get("market size & opportunity", 0)),
        score_industry_trends_report=float(component_scores.get("industry trends report", 0)),
        score_competitor_landscape=float(component_scores.get("competitor landscape", 0)),
        score_regulatory_compliance_highlights=float(component_scores.get("regulatory & compliance highlights", 0)),
        score_market_entry_growth_strategy=float(component_scores.get("market entry & growth strategy", 0)),
        combined_score=float(lead_doc.get("market_total_score", 0)),
        scoring_status=str(lead_doc.get("scoring_status", "completed")),
        scored_at=lead_doc.get("scored_at"),
        updated_at=lead_doc.get("updated_at"),
    )


def _extract_description_preview(component_descriptions: Any) -> Optional[str]:
    if not isinstance(component_descriptions, dict):
        return None
    for component in MARKET_SCORE_COMPONENT_KEYS:
        value = component_descriptions.get(component)
        if isinstance(value, str) and value.strip():
            return value.strip()[:220]
    return None


def _get_latest_market_score_rows(org_id: str) -> List[LeadMarketScoreRow]:
    score_coll, _ = _get_market_score_collections()
    docs = list(score_coll.find({"org_id": org_id}).sort("updated_at", -1))
    rows: List[LeadMarketScoreRow] = []
    for doc in docs:
        doc.pop("_id", None)
        has_company_name = _normalize_non_empty_string(doc.get("company_name")) is not None
        has_lead_name = _normalize_non_empty_string(doc.get("lead_name")) is not None
        if not has_company_name or not has_lead_name:
            lead_identity = _get_lead_identity_from_neo4j(org_id=org_id, lead_id=str(doc.get("lead_id")))
            updates: Dict[str, Optional[str]] = {}
            if not has_company_name and lead_identity.get("company_name"):
                doc["company_name"] = lead_identity.get("company_name")
                updates["company_name"] = lead_identity.get("company_name")
            if not has_lead_name and lead_identity.get("lead_name"):
                doc["lead_name"] = lead_identity.get("lead_name")
                updates["lead_name"] = lead_identity.get("lead_name")
            if updates:
                score_coll.update_one(
                    {"org_id": org_id, "lead_id": str(doc.get("lead_id"))},
                    {"$set": updates},
                )
        rows.append(_lead_to_score_row(doc))
    return rows


def _get_latest_scoring_run(org_id: str) -> Optional[Dict[str, Any]]:
    _, run_coll = _get_market_score_collections()
    run_doc = run_coll.find_one({"org_id": org_id}, sort=[("created_at", -1)])
    if not run_doc:
        return None
    run_doc.pop("_id", None)
    return run_doc


def _parse_iso_datetime(value: Any) -> Optional[datetime]:
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError:
        return None


def _is_stale_queued_run(run_doc: Dict[str, Any], stale_after_seconds: int = 300) -> bool:
    if str(run_doc.get("status", "")).lower() != "queued":
        return False
    if run_doc.get("started_at"):
        return False

    reference_time = _parse_iso_datetime(run_doc.get("updated_at")) or _parse_iso_datetime(run_doc.get("created_at"))
    if reference_time is None:
        return True

    age_seconds = (datetime.now(timezone.utc) - reference_time).total_seconds()
    return age_seconds >= stale_after_seconds


def trigger_or_get_market_scores(
    request: LeadMarketScoresRequest,
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    """Trigger a new market-scoring run or return current/latest scores for an org.

    Returns a dict matching the LeadMarketScoresResponse schema:
      org_id, total_leads, processing_status, active_run_id, last_scored_at, rows.
    Raises HTTPException(404) if no rows exist and no refresh was requested.
    """
    import uuid  # function-local: uuid is used only in this function

    _, run_coll = _get_market_score_collections()
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
            request.user_id,
            request.org_id,
            run_id,
        )
    elif active_run:
        active_run.pop("_id", None)
        run_doc = active_run
    else:
        run_doc = _get_latest_scoring_run(request.org_id)

    rows = _get_latest_market_score_rows(request.org_id)
    if not rows and not request.refresh:
        raise HTTPException(status_code=404, detail="No lead market scores found for org_id")

    latest_run = run_doc or _get_latest_scoring_run(request.org_id)
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
    user_id: str,
    org_id: str,
    run_id: Optional[str],
    recent_items_limit: int,
) -> Dict[str, Any]:
    """Return progress + recent items for a market-scoring run.

    Returns a dict matching the LeadMarketScoringStatusResponse schema.
    Raises HTTPException(404) if no run is found for the given filter.
    """
    score_coll, run_coll = _get_market_score_collections()
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
        # get_leads_for_org is already imported at module top (updated in Task 4 Step 6).
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
    lead_id: str,
    user_id: str,
    org_id: str,
) -> Dict[str, Any]:
    """Return the component descriptions for a single lead's scoring.

    Returns a dict matching the LeadMarketScoreDescriptionsResponse schema.
    Raises HTTPException(404) if the lead has no scoring document.
    """
    score_coll, _ = _get_market_score_collections()
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
    return {
        "lead_id": lead_id,
        "org_id": org_id,
        "combined_score": float(doc.get("market_total_score", 0)),
        "scored_at": doc.get("scored_at") or doc.get("updated_at"),
        "descriptions": normalized_descriptions,
    }


def get_company_profile_for_org(org_id: str) -> Dict[str, Any]:
    """Fetch a single company profile for an org."""
    with clients.driver.session() as session:
        result = session.run(
            "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
            org_id=org_id,
        )
        record = result.single()
        if not record:
            return {}
        company_profile = dict(record.values()[0])
        if "socialMediaUrls" in company_profile and isinstance(company_profile["socialMediaUrls"], str):
            try:
                company_profile["socialMediaUrls"] = json.loads(company_profile["socialMediaUrls"])
            except json.JSONDecodeError:
                pass
        return company_profile


def get_market_reports_for_org(user_id: str, org_id: str) -> Dict[str, Dict[str, Any]]:
    """Fetch latest market research reports for all five components."""
    db = clients.client["Scout_Agent"]
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
    response = llm_config.llm2.invoke([HumanMessage(content=prompt)])
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
        local_score_coll, _ = _get_market_score_collections()
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
    with clients.driver.session() as session:
        session.execute_write(
            upsert_node,
            "Lead",
            "lead_id",
            lead_id,
            neo4j_update,
        )


def _run_market_scoring_for_org(user_id: str, org_id: str, run_id: str) -> None:
    run_coll = None
    try:
        score_coll, run_coll = _get_market_score_collections()
        now_iso = datetime.now(timezone.utc).isoformat()
        run_coll.update_one(
            {"run_id": run_id},
            {"$set": {"status": "processing", "started_at": now_iso, "updated_at": now_iso}},
        )

        leads = get_leads_for_org(org_id, limit=5000, order_by_recent=True, raise_on_error=False)
        total_leads = len(leads)
        if not leads:
            run_coll.update_one(
                {"run_id": run_id},
                {
                    "$set": {
                        "status": "failed",
                        "error": "No leads found for org_id",
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
            )
            return

        company_profile = get_company_profile_for_org(org_id)
        if not company_profile:
            run_coll.update_one(
                {"run_id": run_id},
                {
                    "$set": {
                        "status": "failed",
                        "error": "Company profile not found for org_id",
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
            )
            return

        market_reports = get_market_reports_for_org(user_id, org_id)
        if len(market_reports) < len(MARKET_SCORE_COMPONENT_KEYS):
            run_coll.update_one(
                {"run_id": run_id},
                {
                    "$set": {
                        "status": "failed",
                        "error": "Missing market research components. Generate all 5 components first.",
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
            )
            return

        processed_count = 0
        failed_count = 0
        run_coll.update_one(
            {"run_id": run_id},
            {
                "$set": {
                    "total_leads": total_leads,
                    "processed_count": 0,
                    "failed_count": 0,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        for lead in leads:
            lead_id = str(lead.get("lead_id") or "")
            if not lead_id:
                failed_count += 1
                run_coll.update_one(
                    {"run_id": run_id},
                    {
                        "$set": {
                            "processed_count": processed_count,
                            "failed_count": failed_count,
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        }
                    },
                )
                continue
            try:
                scoring_payload = score_single_lead_against_market(
                    lead=lead,
                    company_profile=company_profile,
                    market_reports=market_reports,
                )
                _persist_market_score_for_lead(
                    user_id=user_id,
                    org_id=org_id,
                    lead=lead,
                    scoring_payload=scoring_payload,
                    run_id=run_id,
                    scoring_status="completed",
                    score_coll=score_coll,
                )
                processed_count += 1
            except Exception as lead_error:
                failed_count += 1
                fallback_payload = {
                    "component_scores": {key: 0.0 for key in MARKET_SCORE_COMPONENT_KEYS},
                    "component_descriptions": {
                        key: f"Scoring failed: {str(lead_error)[:180]}" for key in MARKET_SCORE_COMPONENT_KEYS
                    },
                    "market_total_score": 0.0,
                }
                _persist_market_score_for_lead(
                    user_id=user_id,
                    org_id=org_id,
                    lead=lead,
                    scoring_payload=fallback_payload,
                    run_id=run_id,
                    scoring_status="failed",
                    score_coll=score_coll,
                )
            run_coll.update_one(
                {"run_id": run_id},
                {
                    "$set": {
                        "processed_count": processed_count,
                        "failed_count": failed_count,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
            )

        run_coll.update_one(
            {"run_id": run_id},
            {
                "$set": {
                    "status": "completed",
                    "processed_count": processed_count,
                    "failed_count": failed_count,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
    except Exception as e:
        logger.error(f"Lead market scoring run failed for org {org_id}: {e}")
        if run_coll is not None:
            run_coll.update_one(
                {"run_id": run_id},
                {
                    "$set": {
                        "status": "failed",
                        "error": str(e),
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
            )
