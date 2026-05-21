import json
import shutil
import asyncio
import datetime
import urllib.parse
import uuid
import logging
import os
import math
import threading
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

from fastapi import UploadFile, File, Form, Query, HTTPException, Body, APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from langchain_pinecone import PineconeVectorStore
from langchain_community.document_loaders import PyPDFLoader, TextLoader, CSVLoader, UnstructuredExcelLoader
from langchain_core.documents import Document
import pandas as pd
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
import requests

from app.core.config import origins, STAGE_ORDER, STAGE_MAPPING, s3_bucket, aws_region, aws_access_key, aws_secret_key, pinecone_api_key, together_api_key, claude_sonnet_model, tavily_api_key, claude_signal_window_seconds, claude_signal_token_limit_5m, claude_signal_max_output_tokens
from app.models import (
    ProspectData, Lead, Contact, SalesPipelineResponse, TimeframeResponse, StageStats,
    CompanyProfile, UserProfile, ScoutProfile, MarketRequest, EditRequest,
    CustomerProfileRequest, CustomerProfileICP, LeadCreateRequest, LeadUpdateRequest,
    SignalActionRequest, SignalAskRequest, RegistrationRequest, RegistrationResponse,
    SuggestedICPToCustomerProfileRequest, LeadMarketScoresRequest, LeadMarketScoresResponse,
    LeadMarketScoreRow, LeadMarketScoreDescriptionsResponse, LeadMarketScoringStatusResponse,
    LeadMarketScoreStatusItem, MARKET_SCORE_COMPONENT_KEYS
)
from app.core import database
from app.core.database import upsert_node  # function — local binding ok
from app.core import llm_config
from langchain_core.messages import HumanMessage
from services import (
    ICP_FUNCTIONS, ICP_FUNCTIONS_CLAUDE, COMPONENT_FUNCTIONS, COMPONENT_FUNCTIONS_CLAUDE, ICP_generator, SIGNALS_FUNCTIONS,
    search_signals_scout, search_signals_profiler, fetch_leads_for_org,
    get_company_profile_for_org, get_market_reports_for_org, score_single_lead_against_market
)
from app.main import app, logger
from app.services._retrieval import (
    _stringify_context_for_query,
    _build_market_context_queries,
    _build_signal_context_queries,
    _fetch_pinecone_supporting_context,
)
from app.services._claude_budget import (
    CLAUDE_SIGNAL_WINDOW_SECONDS,
    CLAUDE_SIGNAL_TOKEN_LIMIT_5M,
    CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS,
    CLAUDE_API_KEY,
    _estimate_token_count,
    _prune_claude_signal_window,
    _reserve_claude_signal_budget,
    _finalize_claude_signal_budget,
)


def _get_profiler_mongo_client() -> MongoClient:
    username = urllib.parse.quote_plus("techbrewra")
    password = urllib.parse.quote_plus("Brewra@Best09")
    mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
    return MongoClient(mongo_uri)


def _get_market_score_collections():
    mongo_client = _get_profiler_mongo_client()
    profiler_db = mongo_client["Profiler"]
    score_coll = profiler_db["Lead_Market_Scores"]
    run_coll = profiler_db["Lead_Market_Score_Runs"]
    score_coll.create_index([("org_id", 1), ("lead_id", 1)], unique=True)
    score_coll.create_index([("org_id", 1), ("updated_at", -1)])
    run_coll.create_index([("org_id", 1), ("status", 1)])
    run_coll.create_index([("org_id", 1), ("created_at", -1)])
    return mongo_client, score_coll, run_coll


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
    with database.driver.session() as session:
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
    mongo_client = None
    try:
        mongo_client, score_coll, _ = _get_market_score_collections()
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
    finally:
        if mongo_client:
            mongo_client.close()


def _get_latest_scoring_run(org_id: str) -> Optional[Dict[str, Any]]:
    mongo_client = None
    try:
        mongo_client, _, run_coll = _get_market_score_collections()
        run_doc = run_coll.find_one({"org_id": org_id}, sort=[("created_at", -1)])
        if not run_doc:
            return None
        run_doc.pop("_id", None)
        return run_doc
    finally:
        if mongo_client:
            mongo_client.close()


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


def _persist_market_score_for_lead(
    user_id: str,
    org_id: str,
    lead: Dict[str, Any],
    scoring_payload: Dict[str, Any],
    run_id: str,
    scoring_status: str = "completed",
    score_coll=None,
) -> None:
    now_iso = datetime.utcnow().isoformat()
    lead_id = str(lead.get("lead_id"))
    file_id = lead.get("file_id")
    company_name = _extract_company_name(lead)
    lead_name = _extract_lead_name(lead)
    component_scores = scoring_payload.get("component_scores", {})
    component_descriptions = scoring_payload.get("component_descriptions", {})
    market_total_score = float(scoring_payload.get("market_total_score", 0))

    mongo_client = None
    try:
        local_score_coll = score_coll
        if local_score_coll is None:
            mongo_client, local_score_coll, _ = _get_market_score_collections()
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
    finally:
        if mongo_client:
            mongo_client.close()

    neo4j_update = {
        "market_component_scores": component_scores,
        "market_component_descriptions": component_descriptions,
        "market_total_score": market_total_score,
        "market_scored_at": now_iso,
        "market_scoring_version": "v1",
        "market_scoring_status": scoring_status,
        "market_score_run_id": run_id,
    }
    with database.driver.session() as session:
        session.execute_write(
            upsert_node,
            "Lead",
            "lead_id",
            lead_id,
            neo4j_update,
        )


def _run_market_scoring_for_org(user_id: str, org_id: str, run_id: str) -> None:
    mongo_client = None
    run_coll = None
    try:
        mongo_client, score_coll, run_coll = _get_market_score_collections()
        now_iso = datetime.utcnow().isoformat()
        run_coll.update_one(
            {"run_id": run_id},
            {"$set": {"status": "processing", "started_at": now_iso, "updated_at": now_iso}},
        )

        leads = fetch_leads_for_org(org_id, limit=5000)
        total_leads = len(leads)
        if not leads:
            run_coll.update_one(
                {"run_id": run_id},
                {
                    "$set": {
                        "status": "failed",
                        "error": "No leads found for org_id",
                        "completed_at": datetime.utcnow().isoformat(),
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
                        "completed_at": datetime.utcnow().isoformat(),
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
                        "completed_at": datetime.utcnow().isoformat(),
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
                    "updated_at": datetime.utcnow().isoformat(),
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
                            "updated_at": datetime.utcnow().isoformat(),
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
                        "updated_at": datetime.utcnow().isoformat(),
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
                    "updated_at": datetime.utcnow().isoformat(),
                    "completed_at": datetime.utcnow().isoformat(),
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
                        "completed_at": datetime.utcnow().isoformat(),
                    }
                },
            )
    finally:
        if mongo_client:
            mongo_client.close()


def _ensure_icp_id_registry_indexes(db) -> None:
    registry = db["ICP_ID_REGISTRY"]
    registry.create_index("id", unique=True)
    registry.create_index("id_type")


def _reserve_unique_icp_id(db, id_type: str, owner_key: str = "", preferred_id: str = "") -> str:
    """
    Reserve a globally unique ICP id across recommended ICPs + customer profile ICPs.
    Uses ICP_ID_REGISTRY with a unique index on `id`.
    """
    registry = db["ICP_ID_REGISTRY"]
    candidate = str(preferred_id or "").strip()
    for _ in range(20):
        if not candidate:
            candidate = str(uuid.uuid4())
        try:
            registry.insert_one({
                "id": candidate,
                "id_type": id_type,
                "owner_key": owner_key,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            return candidate
        except DuplicateKeyError:
            # If the same owner/type already reserved this id, keep it stable.
            existing = registry.find_one({"id": candidate})
            if existing and str(existing.get("id_type")) == str(id_type) and str(existing.get("owner_key")) == str(owner_key):
                return candidate
            candidate = ""
    raise HTTPException(status_code=500, detail="Failed to generate globally unique ICP id.")


def _release_icp_id(db, icp_id: str) -> None:
    if not icp_id:
        return
    registry = db["ICP_ID_REGISTRY"]
    registry.delete_one({"id": str(icp_id)})


@app.post("/leads/market-scores", response_model=LeadMarketScoresResponse)
async def get_or_refresh_lead_market_scores(
    request: LeadMarketScoresRequest,
    background_tasks: BackgroundTasks,
):
    run_doc: Optional[Dict[str, Any]] = None
    mongo_client = None
    try:
        mongo_client, _, run_coll = _get_market_score_collections()
        active_run = run_coll.find_one(
            {"org_id": request.org_id, "status": {"$in": ["queued", "processing"]}},
            sort=[("created_at", -1)],
        )

        if active_run and _is_stale_queued_run(active_run):
            stale_run_id = str(active_run.get("run_id"))
            now_iso = datetime.utcnow().isoformat()
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

        if request.refresh and not active_run:
            run_id = str(uuid.uuid4())
            queued_at = datetime.utcnow().isoformat()
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
            background_tasks.add_task(_run_market_scoring_for_org, request.user_id, request.org_id, run_id)
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
        return LeadMarketScoresResponse(
            org_id=request.org_id,
            total_leads=len(rows),
            processing_status=processing_status,
            active_run_id=(latest_run or {}).get("run_id"),
            last_scored_at=last_scored_at,
            rows=rows,
        )
    finally:
        if mongo_client:
            mongo_client.close()


@app.get("/leads/market-scores/status", response_model=LeadMarketScoringStatusResponse)
async def get_lead_market_scores_status(
    user_id: str = Query(...),
    org_id: str = Query(...),
    run_id: Optional[str] = Query(None),
    recent_items_limit: int = Query(10, ge=1, le=100),
):
    mongo_client = None
    try:
        mongo_client, score_coll, run_coll = _get_market_score_collections()
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
            total_leads = len(fetch_leads_for_org(org_id, limit=5000))

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
                    description_preview=_extract_description_preview(doc.get("component_descriptions")),
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
    finally:
        if mongo_client:
            mongo_client.close()


@app.get("/leads/{lead_id}/market-score-descriptions", response_model=LeadMarketScoreDescriptionsResponse)
async def get_lead_market_score_descriptions(
    lead_id: str,
    user_id: str = Query(...),
    org_id: str = Query(...),
):
    mongo_client = None
    try:
        mongo_client, score_coll, _ = _get_market_score_collections()
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
    finally:
        if mongo_client:
            mongo_client.close()

@app.post("/market-research")
async def market_research(request: MarketRequest):
    component_name = request.component_name.strip().lower()

    # Lookup function
    research_function = COMPONENT_FUNCTIONS.get(component_name)
    if not research_function:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported component_name: {request.component_name}"
        )

    # MongoDB (pymongo client)
    db = database.client["Scout_Agent"]
    collection = db["Market_Intelligence"]

    # Filter by user_id only for multitenancy
    query = {
        "user_id": request.user_id,
        "component_name": component_name
    }

    # If refresh is False, fetch the latest report
    if not request.refresh:
        latest_report = await asyncio.to_thread(
            collection.find_one, query, sort=[("timestamp", -1)]
        )
        if latest_report:
            latest_report.pop("_id", None)
            return {"status": "success", "data": latest_report}

    # --- Neo4j query inside a thread - get company profile by org_id ---
    def fetch_company_profile():
        with database.driver.session() as session:
            # Get the company profile filtered by org_id (if provided)
            if request.org_id:
                result = session.run(
                    "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                    org_id=request.org_id
                )
            else:
                # Fallback: get any company profile (backward compatibility)
                result = session.run(
                    "MATCH (c:CompanyProfile) RETURN c LIMIT 1"
                )
            record = result.single()
            return record

    record = await asyncio.to_thread(fetch_company_profile)
    if not record:
        org_msg = f" for org_id: {request.org_id}" if request.org_id else ""
        raise HTTPException(status_code=404, detail=f"No company profile found in Neo4j{org_msg}")

    company_profile = dict(record.values()[0])
    if "socialMediaUrls" in company_profile and isinstance(company_profile["socialMediaUrls"], str):
        try:
            company_profile["socialMediaUrls"] = json.loads(company_profile["socialMediaUrls"])
        except json.JSONDecodeError:
            pass

    # --- Run research with retries (max 2 attempts) ---
    market_context_queries = _build_market_context_queries(component_name, company_profile)
    pinecone_context = await asyncio.to_thread(
        _fetch_pinecone_supporting_context,
        market_context_queries,
        request.org_id,
        3
    )
    # Best-effort support context only; research should not depend on this.
    company_profile["pinecone_context_queries"] = market_context_queries
    company_profile["pinecone_supporting_context"] = pinecone_context

    max_retries = 2
    for attempt in range(1, max_retries + 1):
        try:
            research_result = await asyncio.to_thread(research_function, company_profile)
            break
        except Exception as e:
            if attempt == max_retries:
                raise HTTPException(
                    status_code=500,
                    detail=f"Research function failed after {max_retries} attempts: {str(e)}"
                )
            await asyncio.sleep(1)  # retry delay

    # Ensure research_result is a dict and add user_id and metadata
    if not isinstance(research_result, dict):
        research_result = {"data": research_result}
    
    # Explicitly set user_id, component_name, and timestamp (multitenancy)
    research_result["user_id"] = request.user_id
    if request.org_id:
        research_result["org_id"] = request.org_id
    research_result["component_name"] = component_name
    research_result["timestamp"] = datetime.utcnow()

    # Save to DB (pymongo → wrap in to_thread)
    await asyncio.to_thread(collection.insert_one, research_result)

    research_result.pop("_id", None)
    return {"status": "success", "data": research_result}

@app.post("/market-research_claude")
async def market_research_claude(request: MarketRequest):
    """Same as /market-research but research is generated with Claude (Tavily + Anthropic)."""
    if not CLAUDE_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")

    component_name = request.component_name.strip().lower()

    research_function = COMPONENT_FUNCTIONS_CLAUDE.get(component_name)
    if not research_function:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported component_name: {request.component_name}"
        )

    db = database.client["Scout_Agent"]
    collection = db["Market_Intelligence"]

    query = {
        "user_id": request.user_id,
        "component_name": component_name
    }

    if not request.refresh:
        latest_report = await asyncio.to_thread(
            collection.find_one, query, sort=[("timestamp", -1)]
        )
        if latest_report:
            latest_report.pop("_id", None)
            return {"status": "success", "data": latest_report}

    def fetch_company_profile():
        with database.driver.session() as session:
            if request.org_id:
                result = session.run(
                    "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                    org_id=request.org_id
                )
            else:
                result = session.run(
                    "MATCH (c:CompanyProfile) RETURN c LIMIT 1"
                )
            record = result.single()
            return record

    record = await asyncio.to_thread(fetch_company_profile)
    if not record:
        org_msg = f" for org_id: {request.org_id}" if request.org_id else ""
        raise HTTPException(status_code=404, detail=f"No company profile found in Neo4j{org_msg}")

    company_profile = dict(record.values()[0])
    if "socialMediaUrls" in company_profile and isinstance(company_profile["socialMediaUrls"], str):
        try:
            company_profile["socialMediaUrls"] = json.loads(company_profile["socialMediaUrls"])
        except json.JSONDecodeError:
            pass

    market_context_queries = _build_market_context_queries(component_name, company_profile)
    pinecone_context = await asyncio.to_thread(
        _fetch_pinecone_supporting_context,
        market_context_queries,
        request.org_id,
        3
    )
    company_profile["pinecone_context_queries"] = market_context_queries
    company_profile["pinecone_supporting_context"] = pinecone_context

    max_retries = 2
    for attempt in range(1, max_retries + 1):
        try:
            research_result = await asyncio.to_thread(research_function, company_profile)
            break
        except Exception as e:
            if attempt == max_retries:
                raise HTTPException(
                    status_code=500,
                    detail=f"Research function failed after {max_retries} attempts: {str(e)}"
                )
            await asyncio.sleep(1)

    if not isinstance(research_result, dict):
        research_result = {"data": research_result}

    research_result["user_id"] = request.user_id
    if request.org_id:
        research_result["org_id"] = request.org_id
    research_result["component_name"] = component_name
    research_result["timestamp"] = datetime.utcnow()

    await asyncio.to_thread(collection.insert_one, research_result)

    research_result.pop("_id", None)
    return {"status": "success", "data": research_result}

@app.get("/icp")
async def get_or_create_icp_config(user_id: str = Query(...), refresh: bool = Query(False)):
    print(f"[ICP] Request - user_id: {user_id}, refresh: {refresh}")
    client = None
    try:
        def normalize_icp_response(payload: Any) -> Dict[str, Any]:
            """
            Normalize ICP payload to the required schema:
            {"suggestedICPs": [{...required keys...}]}
            """
            if isinstance(payload, dict) and isinstance(payload.get("suggestedICPs"), list):
                raw_icps = payload.get("suggestedICPs", [])
            elif isinstance(payload, dict) and isinstance(payload.get("icps"), list):
                raw_icps = payload.get("icps", [])
            elif isinstance(payload, list):
                raw_icps = payload
            else:
                raw_icps = []

            normalized_icps = []
            seen_ids = set()
            for idx, icp in enumerate(raw_icps):
                if not isinstance(icp, dict):
                    icp = {}

                # Backend-controlled id generation with global uniqueness across ICP datasets.
                # Keep existing id only if non-empty and not duplicated in current response.
                preferred_id = str(icp.get("id") or "").strip()
                if preferred_id in seen_ids:
                    preferred_id = ""
                candidate_id = _reserve_unique_icp_id(
                    db,
                    id_type="recommended_icp",
                    owner_key=str(user_id),
                    preferred_id=preferred_id
                )
                seen_ids.add(candidate_id)

                # Backward/forward-compatible mapping to the expanded suggested ICP schema.
                # Old keys: industry, segment, companySize, decisionMakers, whySuggested, marketSize, topPainPoint, buyingTriggers
                # New keys: title, is_new, is_agentic, why_suggested, how_it_differs, firmographics, key_decision_makers, pain_points_and_triggers
                firmographics = icp.get("firmographics") if isinstance(icp.get("firmographics"), dict) else {}
                pain_points_and_triggers = icp.get("pain_points_and_triggers") if isinstance(icp.get("pain_points_and_triggers"), dict) else {}

                old_industry = str(icp.get("industry") or "").strip()
                old_segment = str(icp.get("segment") or "").strip()
                old_company_size = str(icp.get("companySize") or "").strip()
                old_market_size = str(icp.get("marketSize") or "").strip()

                new_title = str(icp.get("title") or "").strip()
                if not new_title:
                    # Fallback title derived from firmographics (or old keys)
                    title_parts = [p for p in [firmographics.get("industry") or old_industry,
                                              firmographics.get("segment") or old_segment,
                                              firmographics.get("company_size") or old_company_size] if isinstance(p, str) and p.strip()]
                    new_title = " - ".join([str(p).strip() for p in title_parts]) or f"Suggested ICP {idx + 1}"

                why_suggested = icp.get("why_suggested") if isinstance(icp.get("why_suggested"), list) else None
                if why_suggested is None:
                    why_suggested = icp.get("whySuggested") if isinstance(icp.get("whySuggested"), list) else []

                how_it_differs = icp.get("how_it_differs") if isinstance(icp.get("how_it_differs"), list) else []

                key_decision_makers = icp.get("key_decision_makers") if isinstance(icp.get("key_decision_makers"), list) else None
                if key_decision_makers is None:
                    key_decision_makers = icp.get("decisionMakers") if isinstance(icp.get("decisionMakers"), list) else []
                if not key_decision_makers:
                    key_decision_makers = ["unknown"]

                competitors = icp.get("competitors") if isinstance(icp.get("competitors"), list) else []
                if not competitors:
                    competitors = ["unknown"]

                # Build firmographics block with fallbacks
                firmographics_out = {
                    "industry": str(firmographics.get("industry") or old_industry),
                    "segment": str(firmographics.get("segment") or old_segment),
                    "company_size": str(firmographics.get("company_size") or old_company_size),
                    "market_size": str(firmographics.get("market_size") or old_market_size),
                }

                # Build pain points & triggers block with fallbacks
                critical_pp = pain_points_and_triggers.get("critical")
                if not (isinstance(critical_pp, str) and critical_pp.strip()):
                    critical_pp = str(icp.get("topPainPoint") or "").strip()
                others_list = pain_points_and_triggers.get("others") if isinstance(pain_points_and_triggers.get("others"), list) else None
                if others_list is None:
                    others_list = icp.get("buyingTriggers") if isinstance(icp.get("buyingTriggers"), list) else []

                pain_points_out = {
                    "critical": str(critical_pp or ""),
                    "others": others_list,
                }

                # Derive legacy output keys from new schema whenever possible.
                derived_regions = icp.get("regions") if isinstance(icp.get("regions"), list) else []
                if not derived_regions:
                    derived_regions = ["global"]

                derived_confidence = str(icp.get("confidenceScore") or "").strip()
                if not derived_confidence:
                    derived_confidence = "medium"

                normalized_icps.append({
                    "id": candidate_id,
                    "title": new_title,
                    "is_new": bool(icp.get("is_new", True)),
                    "is_agentic": bool(icp.get("is_agentic", True)),
                    "why_suggested": why_suggested,
                    "how_it_differs": how_it_differs,
                    "firmographics": firmographics_out,
                    "key_decision_makers": key_decision_makers,
                    "pain_points_and_triggers": pain_points_out,
                    # Keep legacy keys for backward compatibility
                    "industry": str(icp.get("industry") or ""),
                    "segment": str(icp.get("segment") or ""),
                    "companySize": str(icp.get("companySize") or ""),
                    "decisionMakers": icp.get("decisionMakers") if isinstance(icp.get("decisionMakers"), list) and icp.get("decisionMakers") else key_decision_makers,
                    "regions": derived_regions,
                    "keyAttributes": icp.get("keyAttributes") if isinstance(icp.get("keyAttributes"), list) else [],
                    "growthIndicator": str(icp.get("growthIndicator") or ""),
                    "whySuggested": icp.get("whySuggested") if isinstance(icp.get("whySuggested"), list) else [],
                    "confidenceScore": derived_confidence,
                    "marketSize": str(icp.get("marketSize") or ""),
                    "growth": str(icp.get("growth") or ""),
                    "topPainPoint": str(icp.get("topPainPoint") or ""),
                    "buyingTriggers": icp.get("buyingTriggers") if isinstance(icp.get("buyingTriggers"), list) else [],
                    "competitors": competitors
                })

            return {"suggestedICPs": normalized_icps}

        # MongoDB connection setup
        client = _get_profiler_mongo_client()
        db = client["Profiler"]
        _ensure_icp_id_registry_indexes(db)
        collection = db["ICP_config"]

        # Filter by user_id only for multitenancy
        existing_icp = collection.find_one({"user_id": user_id})
        
        if existing_icp:
            print(f"[ICP] Found existing ICP for user_id: {user_id}")
            if existing_icp.get("icps"):
                icps_data = existing_icp.get("icps")
                if isinstance(icps_data, dict) and "suggestedICPs" in icps_data:
                    print(f"[ICP] Existing ICP count: {len(icps_data.get('suggestedICPs', []))}")
                elif isinstance(icps_data, list):
                    print(f"[ICP] Existing ICP count (list): {len(icps_data)}")
        else:
            print(f"[ICP] No existing ICP found for user_id: {user_id}")

        if existing_icp and not refresh:
            print(f"[ICP] Returning cached ICP for user_id: {user_id}")
            normalized_cached = normalize_icp_response(existing_icp.get("icps", {"suggestedICPs": []}))
            # Persist normalized payload so ids/shape remain stable for subsequent fetches.
            collection.update_one(
                {"user_id": user_id},
                {"$set": {"user_id": user_id, "icps": normalized_cached}},
                upsert=True
            )
            return normalized_cached

        print(f"[ICP] Generating new ICPs for user_id: {user_id}")

        # Generate new ICPs from Neo4j company profile - get shared company profile
        with database.driver.session() as session:
            result = session.run(
                "MATCH (c:CompanyProfile) RETURN c LIMIT 1"
            )
            record = result.single()
            
            if not record:
                print(f"[ICP] ERROR: No company profile in Neo4j")
                client.close()
                raise HTTPException(status_code=404, detail="No company profile found in Neo4j")

            company_profile = dict(record.values()[0])
            print(f"[ICP] Company profile retrieved from Neo4j")

            # Convert JSON string if needed
            if "socialMediaUrls" in company_profile and isinstance(company_profile["socialMediaUrls"], str):
                try:
                    company_profile["socialMediaUrls"] = json.loads(company_profile["socialMediaUrls"])
                except json.JSONDecodeError:
                    pass

            # Generate ICPs
            print(f"[ICP] Calling ICP_generator() for user_id: {user_id}")
            try:
                icp_result = ICP_generator(company_profile)
                if isinstance(icp_result, dict) and "suggestedICPs" in icp_result:
                    print(f"[ICP] Generated {len(icp_result.get('suggestedICPs', []))} ICPs for user_id: {user_id}")
                else:
                    print(f"[ICP] ICP_generator returned: {type(icp_result)}")
                icp_result = normalize_icp_response(icp_result)
            except Exception as gen_error:
                print(f"[ICP] ERROR in ICP_generator: {str(gen_error)}")
                raise HTTPException(status_code=500, detail=f"ICP generation failed: {str(gen_error)}")

            # Upsert the result in MongoDB - filter by user_id only
            print(f"[ICP] Saving to MongoDB for user_id: {user_id}")
            try:
                update_result = collection.update_one(
                    {"user_id": user_id},
                    {"$set": {"user_id": user_id, "icps": icp_result}},
                    upsert=True
                )
                print(f"[ICP] Saved to MongoDB - matched: {update_result.matched_count}, modified: {update_result.modified_count}")
            except Exception as save_error:
                print(f"[ICP] ERROR saving to MongoDB: {str(save_error)}")
                raise HTTPException(status_code=500, detail=f"Failed to save ICP: {str(save_error)}")

            print(f"[ICP] Successfully returned ICPs for user_id: {user_id}")
            return icp_result

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ICP] ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    finally:
        if client:
            client.close()

@app.post("/icp-research")
async def icp_research(request: MarketRequest):
    component_name = request.component_name.strip().lower()

    # Lookup the function for the given component
    research_function = ICP_FUNCTIONS.get(component_name)
    if not research_function:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported component_name: {request.component_name}"
        )

    # MongoDB connection
    username = urllib.parse.quote_plus("techbrewra")
    password = urllib.parse.quote_plus("Brewra@Best09")
    mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
    client = MongoClient(mongo_uri)
    db = client["Profiler"]
    collection = db["ICPs"]

    try:
        # Filter by user_id only for multitenancy
        query = {
            "user_id": request.user_id,
            "component_name": component_name
        }

        # If refresh is False, fetch the latest report
        if not request.refresh:
            latest_report = await asyncio.to_thread(
                collection.find_one, query, sort=[("timestamp", -1)]
            )
            if latest_report:
                latest_report.pop("_id", None)
                return {"status": "success", "data": latest_report}

        # --- Neo4j query inside a thread - get company profile by org_id ---
        def fetch_company_profile():
            with database.driver.session() as session:
                # Get the company profile filtered by org_id (if provided)
                if request.org_id:
                    result = session.run(
                        "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                        org_id=request.org_id
                    )
                else:
                    # Fallback: get any company profile (backward compatibility)
                    result = session.run(
                        "MATCH (c:CompanyProfile) RETURN c LIMIT 1"
                    )
                record = result.single()
                return record

        record = await asyncio.to_thread(fetch_company_profile)
        if not record:
            org_msg = f" for org_id: {request.org_id}" if request.org_id else ""
            raise HTTPException(status_code=404, detail=f"No company profile found in Neo4j{org_msg}")

        company_profile = dict(record.values()[0])
        if "socialMediaUrls" in company_profile and isinstance(company_profile["socialMediaUrls"], str):
            try:
                company_profile["socialMediaUrls"] = json.loads(company_profile["socialMediaUrls"])
            except json.JSONDecodeError:
                pass

        # --- Get ICP card/data from request body (flexible data field) ---
        # Prepare combined context data with company profile and ICP card from request
        context_data = {
            "company_profile": company_profile
        }
        
        # Add ICP card data from request body if available
        if request.data:
            # The request.data is flexible and should contain ICP card data
            context_data["icp_card"] = request.data
        
        market_context_queries = _build_market_context_queries(component_name, context_data)
        pinecone_context = await asyncio.to_thread(
            _fetch_pinecone_supporting_context,
            market_context_queries,
            request.org_id,
            3
        )
        context_data["pinecone_context_queries"] = market_context_queries
        context_data["pinecone_supporting_context"] = pinecone_context
        
        # Convert to JSON string for the research function
        context_json = json.dumps(context_data)

        # --- Run research with retries (max 2 attempts) ---
        max_retries = 2
        for attempt in range(1, max_retries + 1):
            try:
                research_result = await asyncio.to_thread(research_function, context_json)
                break
            except Exception as e:
                if attempt == max_retries:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Research function failed after {max_retries} attempts: {str(e)}"
                    )
                await asyncio.sleep(1)  # retry delay

        # Add metadata - filter by user_id only
        research_result.update({
            "user_id": request.user_id,
            "component_name": component_name,
            "timestamp": datetime.utcnow()
        })
        if request.org_id:
            research_result["org_id"] = request.org_id

        # Save to DB
        await asyncio.to_thread(collection.insert_one, research_result)

        research_result.pop("_id", None)
        return {"status": "success", "data": research_result}

    finally:
        client.close()

@app.post("/icp-research_claude")
async def icp_research_claude(request: MarketRequest):
    """Same as /icp-research but research is generated with Claude (Tavily + Anthropic)."""
    if not CLAUDE_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")

    component_name = request.component_name.strip().lower()

    research_function = ICP_FUNCTIONS_CLAUDE.get(component_name)
    if not research_function:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported component_name: {request.component_name}"
        )

    username = urllib.parse.quote_plus("techbrewra")
    password = urllib.parse.quote_plus("Brewra@Best09")
    mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
    client = MongoClient(mongo_uri)
    db = client["Profiler"]
    collection = db["ICPs"]

    try:
        query = {
            "user_id": request.user_id,
            "component_name": component_name
        }

        if not request.refresh:
            latest_report = await asyncio.to_thread(
                collection.find_one, query, sort=[("timestamp", -1)]
            )
            if latest_report:
                latest_report.pop("_id", None)
                return {"status": "success", "data": latest_report}

        def fetch_company_profile():
            with database.driver.session() as session:
                if request.org_id:
                    result = session.run(
                        "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                        org_id=request.org_id
                    )
                else:
                    result = session.run(
                        "MATCH (c:CompanyProfile) RETURN c LIMIT 1"
                    )
                record = result.single()
                return record

        record = await asyncio.to_thread(fetch_company_profile)
        if not record:
            org_msg = f" for org_id: {request.org_id}" if request.org_id else ""
            raise HTTPException(status_code=404, detail=f"No company profile found in Neo4j{org_msg}")

        company_profile = dict(record.values()[0])
        if "socialMediaUrls" in company_profile and isinstance(company_profile["socialMediaUrls"], str):
            try:
                company_profile["socialMediaUrls"] = json.loads(company_profile["socialMediaUrls"])
            except json.JSONDecodeError:
                pass

        context_data = {
            "company_profile": company_profile
        }

        if request.data:
            context_data["icp_card"] = request.data

        market_context_queries = _build_market_context_queries(component_name, context_data)
        pinecone_context = await asyncio.to_thread(
            _fetch_pinecone_supporting_context,
            market_context_queries,
            request.org_id,
            3
        )
        context_data["pinecone_context_queries"] = market_context_queries
        context_data["pinecone_supporting_context"] = pinecone_context

        context_json = json.dumps(context_data)

        max_retries = 2
        for attempt in range(1, max_retries + 1):
            try:
                research_result = await asyncio.to_thread(research_function, context_json)
                break
            except Exception as e:
                if attempt == max_retries:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Research function failed after {max_retries} attempts: {str(e)}"
                    )
                await asyncio.sleep(1)

        if not isinstance(research_result, dict):
            research_result = {"data": research_result}

        research_result.update({
            "user_id": request.user_id,
            "component_name": component_name,
            "timestamp": datetime.utcnow()
        })
        if request.org_id:
            research_result["org_id"] = request.org_id

        await asyncio.to_thread(collection.insert_one, research_result)

        research_result.pop("_id", None)
        return {"status": "success", "data": research_result}

    finally:
        client.close()

@app.post("/signals-research")
async def signals_research(request: MarketRequest):
    """Research web signals for specific agents (scout/profiler)"""
    agent_name = request.component_name.strip().lower()

    # Lookup the function for the given agent
    signals_function = SIGNALS_FUNCTIONS.get(agent_name)
    if not signals_function:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported agent: {request.component_name}. Supported agents: scout, profiler"
        )

    # MongoDB connection for Signals DB
    username = urllib.parse.quote_plus("techbrewra")
    password = urllib.parse.quote_plus("Brewra@Best09")
    mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
    client = MongoClient(mongo_uri)
    db = client["Signals"]
    collection = db["signals"]

    try:
        # Filter by user_id only for multitenancy
        query = {
            "user_id": request.user_id,
            "agent": agent_name
        }

        # If refresh is False, fetch the latest signal
        if not request.refresh:
            latest_signal = await asyncio.to_thread(
                collection.find_one, query, sort=[("timestamp", -1)]
            )
            if latest_signal:
                latest_signal.pop("_id", None)
                return {"status": "success", "data": latest_signal}

        # Prepare data for the signals function
        pre_data = request.data
        
        # Fetch existing headlines from signal_track collection
        existing_headlines = []
        if request.org_id or request.user_id:
            track_db = client["Signals"]
            track_collection = track_db["signal_track"]
            track_key = request.org_id if request.org_id else f"user_{request.user_id}"
            
            def fetch_existing_headlines():
                track_doc = track_collection.find_one({"_id": track_key})
                if track_doc and track_doc.get("headlines"):
                    return track_doc.get("headlines", [])
                return []
            
            existing_headlines = await asyncio.to_thread(fetch_existing_headlines)
        
        # Add existing headlines to pre_data for prompt injection
        if isinstance(pre_data, dict):
            pre_data["existing_headlines"] = existing_headlines
        else:
            # If pre_data is a string, convert to dict
            try:
                pre_data_dict = json.loads(pre_data) if isinstance(pre_data, str) else {}
                pre_data_dict["existing_headlines"] = existing_headlines
                pre_data = pre_data_dict
            except:
                pre_data = {"company_profile": pre_data, "existing_headlines": existing_headlines}

        signal_context_queries = _build_signal_context_queries(agent_name, pre_data)
        pinecone_context = await asyncio.to_thread(
            _fetch_pinecone_supporting_context,
            signal_context_queries,
            request.org_id,
            3
        )
        if isinstance(pre_data, dict):
            pre_data["pinecone_context_queries"] = signal_context_queries
            pre_data["pinecone_supporting_context"] = pinecone_context
        
        # Fetch leads for org_id if available
        leads_data = []
        if request.org_id:
            try:
                from services import fetch_leads_for_org
                leads_data = fetch_leads_for_org(request.org_id, limit=100)
                if isinstance(pre_data, dict):
                    pre_data["leads_data"] = leads_data
                else:
                    if not isinstance(pre_data, dict):
                        try:
                            pre_data = json.loads(pre_data) if isinstance(pre_data, str) else {}
                        except:
                            pre_data = {}
                    pre_data["leads_data"] = leads_data
                    if "company_profile" not in pre_data:
                        pre_data["company_profile"] = request.data
            except Exception as e:
                logger.warning(f"Could not fetch leads: {e}")
        
        # For profiler agent, also include ICP data if available - filter by user_id
        if agent_name == "profiler":
            # Try to get ICP data from Profiler database
            try:
                profiler_client = MongoClient(mongo_uri)
                profiler_db = profiler_client["Profiler"]
                icp_collection = profiler_db["ICP_config"]
                icp_data = icp_collection.find_one({"user_id": request.user_id})
                if icp_data:
                    if isinstance(pre_data, dict):
                        pre_data["icp_data"] = icp_data.get("icps", {})
                        if "company_profile" not in pre_data:
                            pre_data["company_profile"] = request.data
                    else:
                        pre_data = {
                            "company_profile": request.data,
                            "icp_data": icp_data.get("icps", {}),
                            "existing_headlines": existing_headlines,
                            "leads_data": leads_data
                        }
                profiler_client.close()
            except Exception as e:
                logger.warning(f"Could not fetch ICP data: {e}")

        # Run signals research with retries (max 2 attempts)
        max_retries = 2
        for attempt in range(1, max_retries + 1):
            try:
                signals_result = await asyncio.to_thread(signals_function, pre_data)
                break
            except Exception as e:
                if attempt == max_retries:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Signals research failed after {max_retries} attempts: {str(e)}"
                    )
                await asyncio.sleep(1)  # retry delay

        # Generate unique ID for signal
        signal_id = str(uuid.uuid4())
        
        # Add metadata - filter by user_id only
        signals_result.update({
            "id": signal_id,
            "signal_id": signal_id,  # Ensure signal_id is also present
            "user_id": request.user_id,
            "agent": agent_name,
            "timestamp": datetime.utcnow()
        })
        if request.org_id:
            signals_result["org_id"] = request.org_id

        # Save to Signals DB
        await asyncio.to_thread(collection.insert_one, signals_result)
        
        # Store headline in signal_track collection
        if signals_result.get("headline") and (request.org_id or request.user_id):
            track_db = client["Signals"]
            track_collection = track_db["signal_track"]
            track_key = request.org_id if request.org_id else f"user_{request.user_id}"
            
            def update_signal_track():
                track_collection.update_one(
                    {"_id": track_key},
                    {
                        "$addToSet": {"headlines": signals_result.get("headline")},
                        "$set": {"last_updated": datetime.utcnow()}
                    },
                    upsert=True
                )
            
            await asyncio.to_thread(update_signal_track)

        signals_result.pop("_id", None)
        return {"status": "success", "data": signals_result}

    finally:
        client.close()

async def _generate_signals_batch_core(request: MarketRequest, llm_backend: str):
    try:
        # MongoDB connection for Signals DB
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        client = MongoClient(mongo_uri)
        db = client["Signals"]
        collection = db["signals"]

        # Prepare data for the signals functions
        pre_data = request.data
        
        # Fetch existing headlines from signal_track collection
        existing_headlines = []
        if request.org_id or request.user_id:
            track_db = client["Signals"]
            track_collection = track_db["signal_track"]
            track_key = request.org_id if request.org_id else f"user_{request.user_id}"
            
            def fetch_existing_headlines():
                track_doc = track_collection.find_one({"_id": track_key})
                if track_doc and track_doc.get("headlines"):
                    return track_doc.get("headlines", [])
                return []
            
            existing_headlines = await asyncio.to_thread(fetch_existing_headlines)
        
        # Add existing headlines to pre_data
        if isinstance(pre_data, dict):
            pre_data["existing_headlines"] = existing_headlines
        else:
            try:
                pre_data_dict = json.loads(pre_data) if isinstance(pre_data, str) else {}
                pre_data_dict["existing_headlines"] = existing_headlines
                pre_data = pre_data_dict
            except:
                pre_data = {"company_profile": pre_data, "existing_headlines": existing_headlines}

        scout_signal_context_queries = _build_signal_context_queries("scout", pre_data)
        scout_pinecone_context = await asyncio.to_thread(
            _fetch_pinecone_supporting_context,
            scout_signal_context_queries,
            request.org_id,
            3
        )
        if isinstance(pre_data, dict):
            pre_data["pinecone_context_queries"] = scout_signal_context_queries
            pre_data["pinecone_supporting_context"] = scout_pinecone_context
        
        # Fetch leads for org_id if available
        leads_data = []
        if request.org_id:
            try:
                from services import fetch_leads_for_org
                leads_data = fetch_leads_for_org(request.org_id, limit=100)
                logger.info(f"[Batch Signals] Fetched {len(leads_data)} leads for org_id: {request.org_id}")
                if isinstance(pre_data, dict):
                    pre_data["leads_data"] = leads_data
                else:
                    if not isinstance(pre_data, dict):
                        try:
                            pre_data = json.loads(pre_data) if isinstance(pre_data, str) else {}
                        except:
                            pre_data = {}
                    pre_data["leads_data"] = leads_data
                    if "company_profile" not in pre_data:
                        pre_data["company_profile"] = request.data
            except Exception as e:
                logger.warning(f"Could not fetch leads: {e}")
        else:
            logger.warning(f"[Batch Signals] No org_id provided, skipping leads fetch for user_id: {request.user_id}")
        
        # For profiler agent, also include ICP data if available - filter by user_id
        profiler_pre_data = pre_data.copy() if isinstance(pre_data, dict) else pre_data
        try:
            profiler_client = MongoClient(mongo_uri)
            profiler_db = profiler_client["Profiler"]
            icp_collection = profiler_db["ICP_config"]
            icp_data = icp_collection.find_one({"user_id": request.user_id})
            if icp_data:
                if isinstance(profiler_pre_data, dict):
                    profiler_pre_data["icp_data"] = icp_data.get("icps", {})
                    if "company_profile" not in profiler_pre_data:
                        profiler_pre_data["company_profile"] = request.data
                    # Ensure leads_data is included
                    if leads_data and "leads_data" not in profiler_pre_data:
                        profiler_pre_data["leads_data"] = leads_data
                else:
                    profiler_pre_data = {
                        "company_profile": request.data,
                        "icp_data": icp_data.get("icps", {}),
                        "existing_headlines": existing_headlines,
                        "leads_data": leads_data
                    }
            else:
                # Even if no ICP data, ensure leads_data is included
                if isinstance(profiler_pre_data, dict) and leads_data and "leads_data" not in profiler_pre_data:
                    profiler_pre_data["leads_data"] = leads_data
            profiler_client.close()
        except Exception as e:
            logger.warning(f"Could not fetch ICP data: {e}")

        profiler_signal_context_queries = _build_signal_context_queries("profiler", profiler_pre_data)
        profiler_pinecone_context = await asyncio.to_thread(
            _fetch_pinecone_supporting_context,
            profiler_signal_context_queries,
            request.org_id,
            3
        )
        if isinstance(profiler_pre_data, dict):
            profiler_pre_data["pinecone_context_queries"] = profiler_signal_context_queries
            profiler_pre_data["pinecone_supporting_context"] = profiler_pinecone_context

        generated_signals = []
        batch_id = f"batch_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        # Generate 2 signals for scout
        for i in range(2):
            try:
                print(f"Generating scout signal {i+1}...")
                signals_result = await asyncio.to_thread(search_signals_scout, pre_data, llm_backend)
                signal_id = str(uuid.uuid4())
                signals_result.update({
                    "id": signal_id,
                    "signal_id": signal_id,  # Ensure signal_id is also present
                    "user_id": request.user_id,
                    "agent": "scout",
                    "timestamp": datetime.utcnow(),
                    "batch_id": batch_id
                })
                if request.org_id:
                    signals_result["org_id"] = request.org_id
                
                # Save to Signals DB
                await asyncio.to_thread(collection.insert_one, signals_result)
                
                # Store headline in signal_track collection
                if signals_result.get("headline") and (request.org_id or request.user_id):
                    track_db = client["Signals"]
                    track_collection = track_db["signal_track"]
                    track_key = request.org_id if request.org_id else f"user_{request.user_id}"
                    
                    def update_signal_track():
                        track_collection.update_one(
                            {"_id": track_key},
                            {
                                "$addToSet": {"headlines": signals_result.get("headline")},
                                "$set": {"last_updated": datetime.utcnow()}
                            },
                            upsert=True
                        )
                    
                    await asyncio.to_thread(update_signal_track)
                    
                    # Update existing_headlines list for next iteration
                    if isinstance(pre_data, dict):
                        pre_data["existing_headlines"].append(signals_result.get("headline"))
                signals_result.pop("_id", None)
                generated_signals.append(signals_result)
                print(f"Successfully generated scout signal {i+1}")
                
            except Exception as e:
                print(f"Error generating scout signal {i+1}: {e}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to generate scout signal {i+1}: {str(e)}"
                )
        
        # Generate 2 signals for profiler
        for i in range(2):
            try:
                print(f"Generating profiler signal {i+1}...")
                signals_result = await asyncio.to_thread(search_signals_profiler, profiler_pre_data, llm_backend)
                signal_id = str(uuid.uuid4())
                signals_result.update({
                    "id": signal_id,
                    "signal_id": signal_id,  # Ensure signal_id is also present
                    "user_id": request.user_id,
                    "agent": "profiler",
                    "timestamp": datetime.utcnow(),
                    "batch_id": batch_id
                })
                if request.org_id:
                    signals_result["org_id"] = request.org_id
                
                # Save to Signals DB
                await asyncio.to_thread(collection.insert_one, signals_result)
                
                # Store headline in signal_track collection
                if signals_result.get("headline") and (request.org_id or request.user_id):
                    track_db = client["Signals"]
                    track_collection = track_db["signal_track"]
                    track_key = request.org_id if request.org_id else f"user_{request.user_id}"
                    
                    def update_signal_track():
                        track_collection.update_one(
                            {"_id": track_key},
                            {
                                "$addToSet": {"headlines": signals_result.get("headline")},
                                "$set": {"last_updated": datetime.utcnow()}
                            },
                            upsert=True
                        )
                    
                    await asyncio.to_thread(update_signal_track)
                    
                    # Update existing_headlines list for next iteration
                    if isinstance(profiler_pre_data, dict):
                        profiler_pre_data["existing_headlines"].append(signals_result.get("headline"))
                signals_result.pop("_id", None)
                generated_signals.append(signals_result)
                print(f"Successfully generated profiler signal {i+1}")
                
            except Exception as e:
                print(f"Error generating profiler signal {i+1}: {e}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to generate profiler signal {i+1}: {str(e)}"
                )

        return {
            "status": "success", 
            "message": f"Generated {len(generated_signals)} signals",
            "data": generated_signals
        }

    finally:
        client.close()


@app.post("/generate-signals-batch")
async def generate_signals_batch(request: MarketRequest):
    """Generate 2 signals for scout and 2 signals for profiler"""
    return await _generate_signals_batch_core(request, "default")


@app.post("/generate-signals-batch_claude")
async def generate_signals_batch_claude(request: MarketRequest):
    """Same as /generate-signals-batch but signal text is produced with Claude (Tavily + Anthropic)."""
    if not CLAUDE_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")
    return await _generate_signals_batch_core(request, "claude")


@app.get("/fetch-signals")
async def fetch_signals(user_id: str = Query(...), limit: int = Query(10)):
    """Fetch signals and return them in a simple list format - filtered by user_id only"""
    try:
        # MongoDB connection for Signals DB
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        client = MongoClient(mongo_uri)
        db = client["Signals"]
        collection = db["signals"]

        # Fetch signals for the user only (multitenancy), ordered by timestamp (newest first)
        signals_cursor = collection.find(
            {"user_id": user_id}
        ).sort("timestamp", -1).limit(limit)
        
        signals_list = []
        for signal in signals_cursor:
            # Remove MongoDB _id and format for simple list
            signal.pop("_id", None)
            # Ensure signal_id is present (use "id" if signal_id doesn't exist)
            if "signal_id" not in signal and "id" in signal:
                signal["signal_id"] = signal["id"]
            elif "id" not in signal and "signal_id" in signal:
                signal["id"] = signal["signal_id"]
            signals_list.append(signal)

        return {
            "status": "success",
            "count": len(signals_list),
            "signals": signals_list
        }

    finally:
        client.close()

@app.post("/signal_action")
async def signal_action(request: SignalActionRequest):
    """
    Accept or reject a signal.
    - If action is "accept": Keep the signal under the org_id (ensure org_id is set)
    - If action is "reject": Delete the signal
    """
    try:
        # MongoDB connection for Signals DB
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        client = MongoClient(mongo_uri)
        db = client["Signals"]
        collection = db["signals"]

        # Find the signal by signal_id (check both "id" and "signal_id" fields)
        signal = collection.find_one({
            "$or": [
                {"id": request.signal_id},
                {"signal_id": request.signal_id}
            ]
        })

        if not signal:
            raise HTTPException(
                status_code=404,
                detail=f"Signal with signal_id {request.signal_id} not found"
            )

        if request.action == "accept":
            # Update the signal to ensure it has the org_id
            update_result = collection.update_one(
                {"_id": signal["_id"]},
                {
                    "$set": {
                        "org_id": request.org_id,
                        "status": "accepted",
                        "actioned_at": datetime.utcnow()
                    }
                }
            )

            if update_result.modified_count > 0:
                return {
                    "status": "success",
                    "message": f"Signal {request.signal_id} accepted and assigned to org {request.org_id}",
                    "signal_id": request.signal_id,
                    "org_id": request.org_id,
                    "action": "accept"
                }
            else:
                return {
                    "status": "success",
                    "message": f"Signal {request.signal_id} already has org_id {request.org_id}",
                    "signal_id": request.signal_id,
                    "org_id": request.org_id,
                    "action": "accept"
                }

        elif request.action == "reject":
            # Delete the signal
            delete_result = collection.delete_one({"_id": signal["_id"]})

            if delete_result.deleted_count > 0:
                return {
                    "status": "success",
                    "message": f"Signal {request.signal_id} rejected and deleted",
                    "signal_id": request.signal_id,
                    "action": "reject"
                }
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to delete signal"
                )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid action: {request.action}. Must be 'accept' or 'reject'"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing signal action: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process signal action: {str(e)}")
    finally:
        if 'client' in locals():
            client.close()

@app.post("/signal_Ask")
async def signal_ask(request: SignalAskRequest):
    """
    Answer a question about signals using company profile, customer profile, history, and WebSearch.
    Fetches company profile and customer profile from org_id, includes conversation history,
    and uses WebSearch tool to provide up-to-date answers.
    """
    try:
        # Fetch company profile from Neo4j
        company_profile = None
        try:
            with database.driver.session() as session:
                result = session.run(
                    "MATCH (p:CompanyProfile {org_id: $org_id}) RETURN p LIMIT 1",
                    org_id=request.org_id
                )
                record = result.single()
                if record:
                    company_profile = dict(record["p"].items())
        except Exception as e:
            logger.warning(f"Could not fetch company profile: {e}")
        
        # Fetch customer profile from MongoDB
        customer_profile = None
        try:
            username = urllib.parse.quote_plus("techbrewra")
            password = urllib.parse.quote_plus("Brewra@Best09")
            mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
            mongo_client = MongoClient(mongo_uri)
            db = mongo_client["Profiler"]
            collection = db["Company_Profile"]
            
            filter_query = {"profile_type": "company", "org_id": request.org_id}
            document = collection.find_one(filter_query)
            
            if document:
                customer_profiles = document.get("customer_profiles", {})
                icps = customer_profiles.get("icps", [])
                # Remove MongoDB _id if present
                for icp in icps:
                    if "_id" in icp:
                        del icp["_id"]
                customer_profile = {"icps": icps}
            
            mongo_client.close()
        except Exception as e:
            logger.warning(f"Could not fetch customer profile: {e}")
        
        # Format history for prompt
        history_text = ""
        if request.history:
            history_text = "\n\nCONVERSATION HISTORY:\n"
            for i, entry in enumerate(request.history, 1):
                if isinstance(entry, dict):
                    user_msg = entry.get("user", entry.get("question", ""))
                    assistant_msg = entry.get("assistant", entry.get("answer", ""))
                    history_text += f"\nTurn {i}:\n"
                    if user_msg:
                        history_text += f"User: {user_msg}\n"
                    if assistant_msg:
                        history_text += f"Assistant: {assistant_msg}\n"
                else:
                    history_text += f"\nTurn {i}: {str(entry)}\n"
        
        # Build context for prompt
        context_parts = []
        
        if company_profile:
            company_profile_json = json.dumps(company_profile, indent=2)
            context_parts.append(f"COMPANY PROFILE:\n{company_profile_json}")
        
        if customer_profile:
            customer_profile_json = json.dumps(customer_profile, indent=2)
            context_parts.append(f"CUSTOMER PROFILE (ICPs):\n{customer_profile_json}")
        
        context = "\n\n".join(context_parts)
        
        # Build prompt
        prompt = f"""You are an intelligent assistant helping answer questions about market signals, company strategy, and customer insights.

{context}
{history_text}

CURRENT QUESTION:
{request.question}

INSTRUCTIONS:
1. Use the WebSearch tool to find the most up-to-date and accurate information to answer the question
2. Consider the company profile and customer profile (ICPs) when providing context-specific answers
3. Reference the conversation history to maintain context and continuity
4. Provide a comprehensive, well-structured answer that directly addresses the question
5. If the question relates to market signals, trends, or industry insights, use WebSearch to find recent data (2026-2027)
6. Cite sources when using information from WebSearch
7. Be specific and actionable in your response

Please use the WebSearch tool to gather current information and provide a detailed answer."""

        # Use agent_chain to answer with WebSearch
        raw_response = await asyncio.to_thread(
            llm_config.agent_chain.invoke,
            {'input': prompt}
        )
        
        answer = raw_response.get("output", "")
        
        return {
            "status": "success",
            "answer": answer,
            "org_id": request.org_id,
            "user_id": request.user_id,
            "question": request.question
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in signal_Ask: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to answer question: {str(e)}")

@app.post("/signal_ask_claude")
async def signal_ask_claude(request: SignalAskRequest):
    """
    Claude-powered signal ask endpoint with local token/run limiter.
    """
    if not CLAUDE_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")

    reservation: Optional[Dict[str, Any]] = None
    input_tokens_estimate = 0
    output_tokens_estimate = 0
    answer = ""

    try:
        # Fetch company profile from Neo4j
        company_profile = None
        try:
            with database.driver.session() as session:
                result = session.run(
                    "MATCH (p:CompanyProfile {org_id: $org_id}) RETURN p LIMIT 1",
                    org_id=request.org_id
                )
                record = result.single()
                if record:
                    company_profile = dict(record["p"].items())
        except Exception as e:
            logger.warning(f"Could not fetch company profile (Claude): {e}")

        # Fetch customer profile from MongoDB
        customer_profile = None
        try:
            username = urllib.parse.quote_plus("techbrewra")
            password = urllib.parse.quote_plus("Brewra@Best09")
            mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
            mongo_client = MongoClient(mongo_uri)
            db = mongo_client["Profiler"]
            collection = db["Company_Profile"]

            filter_query = {"profile_type": "company", "org_id": request.org_id}
            document = collection.find_one(filter_query)

            if document:
                customer_profiles = document.get("customer_profiles", {})
                icps = customer_profiles.get("icps", [])
                for icp in icps:
                    if "_id" in icp:
                        del icp["_id"]
                customer_profile = {"icps": icps}

            mongo_client.close()
        except Exception as e:
            logger.warning(f"Could not fetch customer profile (Claude): {e}")

        # Format history for prompt
        history_text = ""
        if request.history:
            history_text = "\n\nCONVERSATION HISTORY:\n"
            for i, entry in enumerate(request.history, 1):
                if isinstance(entry, dict):
                    user_msg = entry.get("user", entry.get("question", ""))
                    assistant_msg = entry.get("assistant", entry.get("answer", ""))
                    history_text += f"\nTurn {i}:\n"
                    if user_msg:
                        history_text += f"User: {user_msg}\n"
                    if assistant_msg:
                        history_text += f"Assistant: {assistant_msg}\n"
                else:
                    history_text += f"\nTurn {i}: {str(entry)}\n"

        # Build context for prompt
        context_parts = []
        if company_profile:
            company_profile_json = json.dumps(company_profile, indent=2)
            context_parts.append(f"COMPANY PROFILE:\n{company_profile_json}")

        if customer_profile:
            customer_profile_json = json.dumps(customer_profile, indent=2)
            context_parts.append(f"CUSTOMER PROFILE (ICPs):\n{customer_profile_json}")

        context = "\n\n".join(context_parts)

        web_search_results = ""
        try:
            from langchain_community.tools.tavily_search.tool import TavilySearchResults
            search_tool = TavilySearchResults(k=10, tavily_api_key=tavily_api_key)
            web_search_results = await asyncio.to_thread(search_tool.run, request.question)
        except Exception as e:
            logger.warning(f"WebSearch failed in signal_ask_claude: {e}")

        prompt = f"""You are an intelligent assistant helping answer questions about market signals, company strategy, and customer insights.

{context}
{history_text}

WEB SEARCH RESULTS:
{web_search_results}

CURRENT QUESTION:
{request.question}

INSTRUCTIONS:
1. Use the provided web search results as the freshest external context.
2. Consider the company profile and customer profile (ICPs) when providing context-specific answers.
3. Reference the conversation history to maintain context and continuity.
4. Provide a comprehensive, well-structured answer that directly addresses the question.
5. If the question relates to market signals, trends, or industry insights, prioritize recent data (2026-2027).
6. Cite sources if they appear in web search results.
7. Be specific and actionable in your response.
"""

        input_tokens_estimate = _estimate_token_count(prompt)
        reservation = _reserve_claude_signal_budget(
            input_tokens_estimate=input_tokens_estimate,
            max_output_tokens=CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS
        )

        response = await asyncio.to_thread(
            requests.post,
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": CLAUDE_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            json={
                "model": claude_sonnet_model,
                "max_tokens": CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS,
                "temperature": 0.2,
                "messages": [{"role": "user", "content": prompt}]
            },
            timeout=120
        )

        if response.status_code >= 400:
            response_text = response.text[:1000]
            raise HTTPException(
                status_code=500,
                detail=f"Claude API call failed ({response.status_code}): {response_text}"
            )

        payload = response.json()
        content_blocks = payload.get("content", [])
        answer_parts = []
        for block in content_blocks:
            if isinstance(block, dict) and block.get("type") == "text":
                answer_parts.append(block.get("text", ""))
        answer = "\n".join([x for x in answer_parts if x]).strip()

        output_tokens_estimate = _estimate_token_count(answer)
        finalized = _finalize_claude_signal_budget(
            run_id=reservation["run_id"],
            actual_total_tokens=input_tokens_estimate + output_tokens_estimate
        )
        reservation = None

        logger.info(
            "signal_ask_claude usage | org_id=%s | in=%s | out=%s | total=%s | window_tokens_5m=%s | run_count_5m=%s | run_count_total=%s",
            request.org_id,
            input_tokens_estimate,
            output_tokens_estimate,
            input_tokens_estimate + output_tokens_estimate,
            finalized["window_tokens_5m"],
            finalized["run_count_5m"],
            finalized["run_count_total"]
        )

        return {
            "status": "success",
            "answer": answer,
            "org_id": request.org_id,
            "user_id": request.user_id,
            "question": request.question,
            "provider": "anthropic",
            "model": claude_sonnet_model,
            "usage": {
                "estimated_input_tokens": input_tokens_estimate,
                "estimated_output_tokens": output_tokens_estimate,
                "estimated_total_tokens": input_tokens_estimate + output_tokens_estimate,
                "window_total_tokens_5m": finalized["window_tokens_5m"],
                "run_count_5m": finalized["run_count_5m"],
                "run_count_total": finalized["run_count_total"],
                "token_limit_5m": CLAUDE_SIGNAL_TOKEN_LIMIT_5M
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in signal_ask_claude: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to answer question (Claude): {str(e)}")
    finally:
        # Release reservation if we errored before final accounting.
        if reservation and reservation.get("run_id"):
            _finalize_claude_signal_budget(
                run_id=reservation["run_id"],
                actual_total_tokens=input_tokens_estimate + output_tokens_estimate
            )

@app.delete("/icp/recommended/{icp_id}")
async def delete_recommended_icp(icp_id: str, user_id: str = Query(...)):
    """
    Delete a single recommended ICP from ICP_config by icp_id for a given user_id.
    """
    mongo_client = None
    try:
        mongo_client = _get_profiler_mongo_client()
        db = mongo_client["Profiler"]
        _ensure_icp_id_registry_indexes(db)
        collection = db["ICP_config"]

        document = collection.find_one({"user_id": user_id})
        if not document:
            raise HTTPException(status_code=404, detail=f"No ICP config found for user_id: {user_id}")

        icps_payload = document.get("icps") or {}
        suggested = []
        if isinstance(icps_payload, dict) and isinstance(icps_payload.get("suggestedICPs"), list):
            suggested = icps_payload.get("suggestedICPs", [])
        elif isinstance(icps_payload, list):
            suggested = icps_payload

        updated_suggested = []
        deleted_icp = None
        for icp in suggested:
            if isinstance(icp, dict) and str(icp.get("id")) == str(icp_id):
                deleted_icp = icp
                continue
            updated_suggested.append(icp)

        if not deleted_icp:
            raise HTTPException(status_code=404, detail=f"Recommended ICP not found for icp_id: {icp_id}")

        new_payload = {"suggestedICPs": updated_suggested}
        collection.update_one(
            {"user_id": user_id},
            {"$set": {"user_id": user_id, "icps": new_payload}},
            upsert=True
        )
        _release_icp_id(db, icp_id)

        return {
            "success": True,
            "message": "Recommended ICP deleted successfully",
            "data": {
                "deleted_icp_id": str(icp_id),
                "remaining_count": len(updated_suggested)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if mongo_client:
            mongo_client.close()
