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

from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException, Body, APIRouter, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
import boto3
from pinecone import Pinecone
from langchain_pinecone import PineconeVectorStore
from langchain_community.document_loaders import PyPDFLoader, TextLoader, CSVLoader, UnstructuredExcelLoader
from langchain_core.documents import Document
import pandas as pd
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
import requests

from config import origins, STAGE_ORDER, STAGE_MAPPING, s3_bucket, aws_region, aws_access_key, aws_secret_key, pinecone_api_key, together_api_key, claude_sonnet_model, tavily_api_key, claude_signal_window_seconds, claude_signal_token_limit_5m, claude_signal_max_output_tokens
from models import (
    ProspectData, Lead, Contact, SalesPipelineResponse, TimeframeResponse, StageStats,
    CompanyProfile, UserProfile, ScoutProfile, MarketRequest, EditRequest,
    CustomerProfileRequest, CustomerProfileICP, LeadCreateRequest, LeadUpdateRequest,
    SignalActionRequest, SignalAskRequest, RegistrationRequest, RegistrationResponse,
    SuggestedICPToCustomerProfileRequest, LeadMarketScoresRequest, LeadMarketScoresResponse,
    LeadMarketScoreRow, LeadMarketScoreDescriptionsResponse, LeadMarketScoringStatusResponse,
    LeadMarketScoreStatusItem, MARKET_SCORE_COMPONENT_KEYS
)
from database import driver, graph, client, upsert_node
from llm_config import chain, chain2, llm2
from langchain_core.messages import HumanMessage
from services import (
    grapher, create_prospect_node, convert_audio_to_text, process_prospect_list,
    ICP_FUNCTIONS, COMPONENT_FUNCTIONS, ICP_generator, SIGNALS_FUNCTIONS,
    search_signals_scout, search_signals_profiler, fetch_leads_for_org,
    get_company_profile_for_org, get_market_reports_for_org, score_single_lead_against_market
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

CLAUDE_SIGNAL_WINDOW_SECONDS = claude_signal_window_seconds
CLAUDE_SIGNAL_TOKEN_LIMIT_5M = claude_signal_token_limit_5m
CLAUDE_SIGNAL_MAX_OUTPUT_TOKENS = claude_signal_max_output_tokens
CLAUDE_API_KEY = os.getenv("ANTHROPIC_API_KEY") or ""
_claude_signal_usage_window = deque()
_claude_signal_usage_lock = threading.Lock()
_claude_signal_total_runs = 0


def _stringify_context_for_query(payload: Any) -> str:
    """Convert payload into compact text for context query generation."""
    try:
        if isinstance(payload, str):
            return payload
        if isinstance(payload, dict):
            parts = []
            for key, value in payload.items():
                if isinstance(value, (str, int, float, bool)):
                    parts.append(f"{key}: {value}")
            if parts:
                return " | ".join(parts)
            return json.dumps(payload, default=str)[:1500]
        return json.dumps(payload, default=str)[:1500]
    except Exception:
        return str(payload)


def _build_market_context_queries(component_name: str, context_payload: Any) -> List[str]:
    """Generate lightweight Pinecone queries for market research support."""
    base_text = _stringify_context_for_query(context_payload)
    trimmed = " ".join(base_text.split())[:220]
    if not trimmed:
        trimmed = "company profile and market context"
    return [
        f"{component_name} market context {trimmed}",
        f"{component_name} buyer pain points and triggers {trimmed}",
    ][:2]


def _build_signal_context_queries(agent_name: str, context_payload: Any) -> List[str]:
    """Generate 1-2 Pinecone queries for signal support context."""
    base_text = _stringify_context_for_query(context_payload)
    trimmed = " ".join(base_text.split())[:220]
    if not trimmed:
        trimmed = "company profile and signals context"
    return [
        f"{agent_name} signal opportunities and trigger events {trimmed}",
        f"{agent_name} expansion intent risk changes {trimmed}",
    ][:2]


def _fetch_pinecone_supporting_context(
    queries: List[str],
    org_id: Optional[str],
    top_k: int = 3
) -> List[Dict[str, Any]]:
    """
    Best-effort Pinecone retrieval.
    Never raises; returns [] on any issue.
    """
    if not queries or not pinecone_api_key:
        return []
    if not org_id:
        return []

    try:
        index = Pinecone(api_key=pinecone_api_key).Index("brewra-documents")
        embeddings = OpenAIEmbeddings(
            openai_api_key=together_api_key,
            openai_api_base="https://api.together.xyz/v1",
            model="intfloat/multilingual-e5-large-instruct"
        )

        results: List[Dict[str, Any]] = []
        seen_ids = set()
        for q in queries:
            try:
                vector = embeddings.embed_query(q)
                response = index.query(
                    vector=vector,
                    top_k=top_k,
                    namespace=org_id,
                    include_metadata=True
                )
                matches = getattr(response, "matches", []) or []
                for match in matches:
                    match_id = getattr(match, "id", None)
                    if match_id and match_id in seen_ids:
                        continue
                    if match_id:
                        seen_ids.add(match_id)
                    metadata = getattr(match, "metadata", {}) or {}
                    results.append({
                        "query": q,
                        "id": match_id,
                        "score": getattr(match, "score", None),
                        "content": metadata.get("text") or metadata.get("page_content") or "",
                        "metadata": metadata,
                    })
            except Exception as query_error:
                logger.warning(f"Pinecone support query failed, continuing: {query_error}")
                continue
        return results
    except Exception as e:
        logger.warning(f"Pinecone support context unavailable, continuing without it: {e}")
        return []

# Create FastAPI app
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    with driver.session() as session:
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
    with driver.session() as session:
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


def _estimate_token_count(text: str) -> int:
    """Conservative local token estimate when provider usage metadata is unavailable."""
    if not text:
        return 0
    return max(1, int(math.ceil(len(text) / 4)))


def _prune_claude_signal_window(now_ts: float) -> None:
    while _claude_signal_usage_window and (now_ts - _claude_signal_usage_window[0]["timestamp"]) > CLAUDE_SIGNAL_WINDOW_SECONDS:
        _claude_signal_usage_window.popleft()


def _reserve_claude_signal_budget(input_tokens_estimate: int, max_output_tokens: int) -> Dict[str, Any]:
    global _claude_signal_total_runs

    now_ts = datetime.utcnow().timestamp()
    reserved_tokens = max(0, input_tokens_estimate) + max(0, max_output_tokens)
    run_id = str(uuid.uuid4())

    with _claude_signal_usage_lock:
        _prune_claude_signal_window(now_ts)
        current_tokens_5m = sum(int(x.get("tokens", 0)) for x in _claude_signal_usage_window)
        if current_tokens_5m + reserved_tokens > CLAUDE_SIGNAL_TOKEN_LIMIT_5M:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Token budget exceeded for signal_ask_claude",
                    "token_limit_5m": CLAUDE_SIGNAL_TOKEN_LIMIT_5M,
                    "current_tokens_5m": current_tokens_5m,
                    "requested_tokens": reserved_tokens
                }
            )

        _claude_signal_usage_window.append(
            {
                "run_id": run_id,
                "timestamp": now_ts,
                "tokens": reserved_tokens
            }
        )
        _claude_signal_total_runs += 1
        reserved_tokens_5m = current_tokens_5m + reserved_tokens
        run_count_5m = len(_claude_signal_usage_window)
        run_count_total = _claude_signal_total_runs

    return {
        "run_id": run_id,
        "reserved_tokens": reserved_tokens,
        "window_tokens_5m": reserved_tokens_5m,
        "run_count_5m": run_count_5m,
        "run_count_total": run_count_total
    }


def _finalize_claude_signal_budget(run_id: str, actual_total_tokens: int) -> Dict[str, int]:
    now_ts = datetime.utcnow().timestamp()
    with _claude_signal_usage_lock:
        _prune_claude_signal_window(now_ts)
        for item in _claude_signal_usage_window:
            if item.get("run_id") == run_id:
                item["tokens"] = max(0, int(actual_total_tokens))
                break

        window_tokens_5m = sum(int(x.get("tokens", 0)) for x in _claude_signal_usage_window)
        run_count_5m = len(_claude_signal_usage_window)
        run_count_total = _claude_signal_total_runs

    return {
        "window_tokens_5m": window_tokens_5m,
        "run_count_5m": run_count_5m,
        "run_count_total": run_count_total
    }

@app.post("/upload_file/")
async def upload_document(file: UploadFile = File(...)):
    file_path = f"uploaded_{file.filename}"
    with open(file_path, "wb") as f:
        f.write(file.file.read())
    grapher(file_path)
    return {"message": f"File {file.filename} processed and graph updated."}

@app.post("/create-company/")
async def create_prospect(data: ProspectData):
    if not data.Name or not data.Company or not data.answers:
        raise HTTPException(status_code=400, detail="Missing name, company, or answers")

    try:
        node = create_prospect_node(data.Name, data.Company, data.answers)
        return {"message": "Prospect node created", "node": node}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
@app.get("/ask/")
async def ask_question(question: str):
    response = chain.run(question)
    return {response}

@app.get("/chat/")
async def ask_question(question: str):
    response = chain2.run(question)
    return {"response": response}

@app.get("/query/")
async def run_query(cypher_query: str):
    from database import query
    result = query(cypher_query)
    return {"result": result}

@app.post("/voice_graph/")
async def add_engagement_voice(
    prospect_name: str = Form(...), 
    update_type: str = Form(...),  # Can be note, offline meeting, email, online meeting
    voice_file: UploadFile = File(...)
):
    audio_path = f"temp_{voice_file.filename}"
    
    with open(audio_path, "wb") as buffer:
        shutil.copyfileobj(voice_file.file, buffer)
    
    text = convert_audio_to_text(audio_path)
    
    now_utc = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc)
    import pytz
    ist = pytz.timezone("Asia/Kolkata")
    now_ist = now_utc.astimezone(ist)
    
    newId = int(now_ist.timestamp())
    current_time_str = now_ist.strftime("%Y-%m-%d %H:%M:%S")
    
    # Ensure the prospect node exists
    from database import query
    query(f"MERGE (p:Prospect {{Name: '{prospect_name}'}})")
    
    # Create a generic Engagement node and link it to the prospect
    query(f"""
    CREATE (e:Engagement {{
        text: '{text}', 
        id: {newId}, 
        created_at: '{current_time_str}',
        type: '{update_type}'
    }})
    WITH e
    MATCH (p:Prospect {{Name: '{prospect_name}'}})
    CREATE (p)-[:HAS_ENGAGEMENT]->(e)""")
    
    return {"message": f"Engagement of type '{update_type}' added for {prospect_name}"}

@app.post("/text_graph/")
async def add_engagement_text(
    prospect_name: str = Form(...), 
    update_type: str = Form(...),  # note, offline meeting, email, online meeting
    text: str = Form(...)
):
    now_utc = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc)
    import pytz
    ist = pytz.timezone("Asia/Kolkata")
    now_ist = now_utc.astimezone(ist)

    newId = int(now_ist.timestamp())
    current_time_str = now_ist.strftime("%Y-%m-%d %H:%M:%S")

    # Ensure the prospect node exists
    from database import query
    query(f"MERGE (p:Prospect {{Name: '{prospect_name}'}})")

    # Create Engagement node and link to Prospect
    query(f"""
    CREATE (e:Engagement {{
        text: '{text}', 
        id: {newId}, 
        created_at: '{current_time_str}',
        type: '{update_type}'
    }})
    WITH e
    MATCH (p:Prospect {{Name: '{prospect_name}'}})
    CREATE (p)-[:HAS_ENGAGEMENT]->(e)
    """)

    return {"message": f"Engagement of type '{update_type}' added for {prospect_name}"}
    
@app.post('/upload')
async def upload_prospect_list(file: UploadFile = File(...)):
    file_path = f"/tmp/{file.filename}"
    with open(file_path, 'wb') as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    result = process_prospect_list(file_path)
    return result

@app.get("/leads", response_model=List[Dict[str, Any]])
def get_all_leads(org_id: str = Query(...)):
    """
    Get all leads filtered by org_id (multitenant).
    Returns all lead properties directly - completely flexible like company profile.
    Uses parameterized queries for security.
    """
    try:
        # Use parameterized query for security with org-scoped multitenancy
        query_string = """
        MATCH (l:Lead)
        WHERE l.org_id = $org_id
        RETURN l
        """
        
        # Execute query with parameters
        with driver.session() as session:
            results = session.run(query_string, org_id=org_id)
            leads = []
            for record in results:
                # Get all properties from the Lead node
                lead_node = record["l"]
                lead_dict = dict(lead_node.items())
                
                # Convert all values to JSON-compatible types
                processed_lead = {}
                for key, value in lead_dict.items():
                    # Try to parse JSON strings back to objects
                    if isinstance(value, str) and value.strip().startswith(('{', '[')):
                        try:
                            processed_lead[key] = json.loads(value)
                        except json.JSONDecodeError:
                            processed_lead[key] = value
                    else:
                        processed_lead[key] = value
                
                leads.append(processed_lead)
        
        return leads
        
    except Exception as e:
        logger.error(f"Error fetching leads: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch leads: {str(e)}")

@app.post("/leads", response_model=Dict[str, Any])
async def add_lead(request: LeadCreateRequest):
    """
    Add a single lead manually with flexible key-value pairs.
    NO REQUIRED FIELDS - all fields are optional.
    Stores all data directly on Lead node - no mapping or extraction.
    Works exactly like company profile endpoint - completely flexible.
    """
    try:
        import uuid
        from datetime import datetime
        
        # Generate unique lead ID
        lead_id = str(uuid.uuid4())
        
        # Prepare lead data - store everything as-is, just add multitenancy fields
        lead_data = request.data.copy()
        lead_data["user_id"] = request.user_id
        lead_data["org_id"] = request.org_id
        lead_data["lead_id"] = lead_id
        lead_data["created_at"] = datetime.utcnow().isoformat()
        
        # Set default stage if not provided
        if "stage" not in lead_data and "status" not in lead_data and "Status" not in lead_data:
            lead_data["stage"] = "Initial Outreach"
        
        # Create Lead node with all data as-is (no extraction, no mapping)
        with driver.session() as session:
            session.execute_write(
                upsert_node,
                "Lead",
                "lead_id",
                lead_id,
                lead_data
            )
        
        return {
            "status": "success",
            "message": "Lead created successfully",
            "lead_id": lead_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating lead: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create lead: {str(e)}")

@app.put("/leads/{lead_id}", response_model=Dict[str, Any])
async def update_lead(lead_id: str, request: LeadUpdateRequest):
    """
    Modify a single lead with flexible key-value pairs.
    Updates lead properties while maintaining multitenancy (user_id and org_id).
    Stores all data directly on Lead node - no mapping or extraction.
    Works exactly like company profile endpoint - completely flexible.
    """
    try:
        from datetime import datetime
        
        with driver.session() as session:
            # Verify lead exists and belongs to user/org
            verify_query = """
                MATCH (l:Lead {lead_id: $lead_id})
                WHERE l.user_id = $user_id AND l.org_id = $org_id
                RETURN l
            """
            result = session.run(verify_query, lead_id=lead_id, user_id=request.user_id, org_id=request.org_id)
            if not result.single():
                raise HTTPException(status_code=404, detail="Lead not found or access denied")
            
            # Prepare update data - store everything as-is
            update_data = request.data.copy()
            update_data["updated_at"] = datetime.utcnow().isoformat()
            
            # Update Lead node with all data directly (no extraction, no mapping)
            session.execute_write(
                upsert_node,
                "Lead",
                "lead_id",
                lead_id,
                update_data
            )
        
        return {
            "status": "success",
            "message": "Lead updated successfully",
            "lead_id": lead_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating lead: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update lead: {str(e)}")

@app.delete("/leads/{lead_id}", response_model=Dict[str, Any])
async def delete_lead(lead_id: str, user_id: str = Query(...), org_id: str = Query(...)):
    """
    Delete a single lead.
    Verifies multitenancy (user_id and org_id) before deletion.
    """
    try:
        with driver.session() as session:
            # Verify lead exists and belongs to user/org
            verify_query = """
                MATCH (l:Lead {lead_id: $lead_id})
                WHERE l.user_id = $user_id AND l.org_id = $org_id
                RETURN l
            """
            result = session.run(verify_query, lead_id=lead_id, user_id=user_id, org_id=org_id)
            if not result.single():
                raise HTTPException(status_code=404, detail="Lead not found or access denied")
            
            # Delete lead and its relationships
            # Note: We keep Company, Contact, and Tech nodes but remove relationships
            delete_query = """
                MATCH (l:Lead {lead_id: $lead_id})
                OPTIONAL MATCH (c:Company)-[r1:Has_Lead]->(l)
                OPTIONAL MATCH (contact:Contact)-[r2:Is_POC_For]->(l)
                OPTIONAL MATCH (l)-[r3]->()
                DELETE r1, r2, r3, l
            """
            session.run(delete_query, lead_id=lead_id)
        
        return {
            "status": "success",
            "message": "Lead deleted successfully",
            "lead_id": lead_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting lead: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete lead: {str(e)}")

@app.post("/leads/batch-upload", response_model=Dict[str, Any])
async def batch_upload_leads(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    org_id: str = Form(...)
):
    """
    Batch upload leads from CSV file.
    Column headings become keys and row values become values.
    NO REQUIRED FIELDS - all fields are optional.
    Stores all data directly on Lead node - no mapping or extraction.
    Works exactly like company profile endpoint - completely flexible.
    """
    try:
        import pandas as pd
        import uuid
        from datetime import datetime
        import tempfile
        import os
        
        # Validate file type
        filename_lower = (file.filename or "").lower()
        if not (filename_lower.endswith('.csv') or filename_lower.endswith('.xlsx') or filename_lower.endswith('.xls')):
            raise HTTPException(status_code=400, detail="Only CSV and Excel files (.csv, .xlsx, .xls) are supported")
        
        # Save uploaded file temporarily
        temp_suffix = ".csv"
        if filename_lower.endswith(".xlsx"):
            temp_suffix = ".xlsx"
        elif filename_lower.endswith(".xls"):
            temp_suffix = ".xls"
        with tempfile.NamedTemporaryFile(delete=False, suffix=temp_suffix) as tmp_file:
            shutil.copyfileobj(file.file, tmp_file)
            tmp_path = tmp_file.name
        
        try:
            # Prepare lead stream tracking (Mongo)
            mongo_client = _get_profiler_mongo_client()
            profiler_db = mongo_client["Profiler"]
            lead_stream_coll = profiler_db["Lead_Stream_Files"]
            lead_stream_coll.create_index("file_id", unique=True)
            lead_stream_coll.create_index([("user_id", 1), ("org_id", 1)])
            # Generate backend file_id
            file_id = str(uuid.uuid4())
            uploaded_at = datetime.utcnow().isoformat()
            lead_stream_coll.insert_one({
                "file_id": file_id,
                "user_id": user_id,
                "org_id": org_id,
                "filename": file.filename,
                "uploaded_at": uploaded_at,
                "processing_status": "processing",
                "total_rows": 0,
                "created_count": 0,
                "error_count": 0,
                "last_processed_at": uploaded_at
            })

            # Read input file with robust encoding support for CSV.
            if filename_lower.endswith(".xlsx") or filename_lower.endswith(".xls"):
                df = pd.read_excel(tmp_path)
            else:
                csv_read_errors = []
                df = None
                # Common encodings seen in lead exports.
                encodings_to_try = ["utf-8-sig", "utf-8", "cp1252", "latin-1", "utf-16"]
                for enc in encodings_to_try:
                    try:
                        df = pd.read_csv(tmp_path, encoding=enc)
                        break
                    except Exception as csv_err:
                        csv_read_errors.append(f"{enc}: {str(csv_err)}")
                        continue
                if df is None:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Could not parse CSV with supported encodings. Tried: {', '.join(encodings_to_try)}"
                    )
            
            if df.empty:
                raise HTTPException(status_code=400, detail="CSV file is empty")
            
            # Convert column names to lowercase for consistency (optional)
            df.columns = df.columns.str.strip()
            
            # Process each row
            created_count = 0
            error_count = 0
            errors = []
            total_rows = int(len(df))
            
            for index, row in df.iterrows():
                try:
                    # Convert row to dictionary (column headings become keys)
                    lead_data = row.to_dict()
                    
                    # Remove NaN values
                    lead_data = {k: v for k, v in lead_data.items() if pd.notna(v)}
                    
                    # Generate unique lead ID
                    lead_id = str(uuid.uuid4())
                    
                    # Add multitenancy fields
                    lead_data["user_id"] = user_id
                    lead_data["org_id"] = org_id
                    lead_data["lead_id"] = lead_id
                    lead_data["created_at"] = datetime.utcnow().isoformat()
                    lead_data["file_id"] = file_id
                    
                    # Set default stage if not provided
                    if "stage" not in lead_data and "status" not in lead_data and "Status" not in lead_data:
                        lead_data["stage"] = "Initial Outreach"
                    
                    # Convert all values to strings for Neo4j compatibility (except dict/list)
                    lead_data = {k: str(v) if not isinstance(v, (dict, list)) else v for k, v in lead_data.items()}
                    
                    # Create Lead node with all data as-is (no extraction, no mapping)
                    with driver.session() as session:
                        session.execute_write(
                            upsert_node,
                            "Lead",
                            "lead_id",
                            lead_id,
                            lead_data
                        )
                    
                    created_count += 1
                    
                except Exception as e:
                    error_count += 1
                    errors.append(f"Row {index + 1}: {str(e)}")
                    logger.error(f"Error processing row {index + 1}: {str(e)}")
                    continue
            
            # Update stream status
            lead_stream_coll.update_one(
                {"file_id": file_id},
                {"$set": {
                    "processing_status": "completed",
                    "total_rows": total_rows,
                    "created_count": created_count,
                    "error_count": error_count,
                    "last_processed_at": datetime.utcnow().isoformat()
                }}
            )
            mongo_client.close()
            return {
                "status": "success",
                "message": f"Batch upload completed. {created_count} leads created, {error_count} errors.",
                "file_id": file_id,
                "filename": file.filename,
                "uploaded_at": uploaded_at,
                "total_rows": total_rows,
                "created_count": created_count,
                "error_count": error_count,
                "errors": errors[:10] if errors else []  # Limit errors to first 10
            }
            
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in batch upload: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process CSV file: {str(e)}")

@app.get("/leads/by-file", response_model=List[Dict[str, Any]])
def get_leads_by_file(org_id: str = Query(...), file_id: str = Query(...)):
    """
    Fetch leads filtered by file_id within an org.
    Returns full lead records with all properties similar to GET /leads.
    """
    try:
        query_string = """
        MATCH (l:Lead)
        WHERE l.org_id = $org_id AND l.file_id = $file_id
        RETURN l
        """
        with driver.session() as session:
            results = session.run(query_string, org_id=org_id, file_id=file_id)
            leads: List[Dict[str, Any]] = []
            for record in results:
                lead_node = record["l"]
                lead_dict = dict(lead_node.items())
                processed_lead: Dict[str, Any] = {}
                for key, value in lead_dict.items():
                    if isinstance(value, str) and value.strip().startswith(('{', '[')):
                        try:
                            processed_lead[key] = json.loads(value)
                        except json.JSONDecodeError:
                            processed_lead[key] = value
                    else:
                        processed_lead[key] = value
                leads.append(processed_lead)
        return leads
    except Exception as e:
        logger.error(f"Error fetching leads by file_id: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch leads by file_id: {str(e)}")

@app.get("/leads/stream/status", response_model=Dict[str, Any])
def get_lead_stream_status(org_id: str = Query(...)):
    """
    List lead-stream uploads (file_id registry/status) for an org.
    """
    mongo_client = None
    try:
        mongo_client = _get_profiler_mongo_client()
        profiler_db = mongo_client["Profiler"]
        coll = profiler_db["Lead_Stream_Files"]
        cursor = coll.find({"org_id": org_id}).sort("uploaded_at", -1)
        files = []
        for doc in cursor:
            item = {
                "file_id": str(doc.get("file_id")),
                "filename": doc.get("filename"),
                "uploaded_at": doc.get("uploaded_at"),
                "last_processed_at": doc.get("last_processed_at"),
                "total_rows": doc.get("total_rows", 0),
                "created_count": doc.get("created_count", 0),
                "error_count": doc.get("error_count", 0),
                "processing_status": doc.get("processing_status", "completed")
            }
            files.append(item)
        return {"files": files}
    except Exception as e:
        logger.error(f"Error fetching lead-stream status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch lead-stream status: {str(e)}")
    finally:
        if mongo_client:
            mongo_client.close()

@app.delete("/leads/by-file/{file_id}", response_model=Dict[str, Any])
def delete_leads_by_file(file_id: str, user_id: str = Query(...), org_id: str = Query(...)):
    """
    Delete all leads belonging to a specific file_id (scoped by user_id and org_id).
    Also updates lead-stream tracking status in MongoDB.
    """
    mongo_client = None
    try:
        # First count matching leads
        count_query = """
            MATCH (l:Lead)
            WHERE l.user_id = $user_id AND l.org_id = $org_id AND l.file_id = $file_id
            RETURN count(l) AS total
        """
        with driver.session() as session:
            count_result = session.run(count_query, user_id=user_id, org_id=org_id, file_id=file_id)
            count_record = count_result.single()
            total = int(count_record["total"]) if count_record and count_record["total"] is not None else 0

            if total == 0:
                raise HTTPException(
                    status_code=404,
                    detail=f"No leads found for file_id: {file_id} under provided user_id/org_id"
                )

            # Delete only leads and their relationships; keep company/contact/tech nodes.
            delete_query = """
                MATCH (l:Lead)
                WHERE l.user_id = $user_id AND l.org_id = $org_id AND l.file_id = $file_id
                OPTIONAL MATCH (c:Company)-[r1:Has_Lead]->(l)
                OPTIONAL MATCH (contact:Contact)-[r2:Is_POC_For]->(l)
                OPTIONAL MATCH (l)-[r3]->()
                DELETE r1, r2, r3, l
            """
            session.run(delete_query, user_id=user_id, org_id=org_id, file_id=file_id)

        # Update lead stream tracking document if present
        mongo_client = _get_profiler_mongo_client()
        profiler_db = mongo_client["Profiler"]
        coll = profiler_db["Lead_Stream_Files"]
        coll.update_one(
            {"file_id": file_id, "user_id": user_id, "org_id": org_id},
            {"$set": {
                "processing_status": "deleted",
                "deleted_count": total,
                "deleted_at": datetime.utcnow().isoformat(),
                "last_processed_at": datetime.utcnow().isoformat()
            }}
        )

        return {
            "status": "success",
            "message": "All leads for file_id deleted successfully",
            "file_id": file_id,
            "deleted_count": total,
            "user_id": user_id,
            "org_id": org_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting leads by file_id: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete leads by file_id: {str(e)}")
    finally:
        if mongo_client:
            mongo_client.close()


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

@app.get("/Sales_Pipeline")
def get_sales_pipeline(user_id: str = Query(...), timeframe: int = Query(...)):
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=timeframe)

    query_string = """
    MATCH (l:Lead)
    WHERE l.last_stage_update_date >= $start_date AND l.last_stage_update_date <= $end_date
    RETURN l.stage AS stage, count(*) AS count
    """

    with driver.session() as session:
        results = session.run(query_string, {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        })

        # Count occurrences per mapped UI stage
        ui_stage_counts: Dict[str, int] = {stage: 0 for stage in STAGE_ORDER}

        for record in results:
            neo4j_stage = record["stage"]
            count = record["count"]
            mapped_stage = STAGE_MAPPING.get(neo4j_stage)
            if mapped_stage in ui_stage_counts:
                ui_stage_counts[mapped_stage] += count

        # Build ordered stage data and calculate conversion rates
        ordered_counts = [ui_stage_counts[stage] for stage in STAGE_ORDER]

        stages = []
        for i, stage in enumerate(STAGE_ORDER):
            count = ordered_counts[i]
            if i == 0:
                conversion = 1.0
            else:
                prev = ordered_counts[i - 1]
                conversion = round(count / prev, 2) if prev > 0 else 0.0

            stages.append({
                "name": stage,
                "count": count,
                "conversionRate": conversion
            })

        return {
            "timeframes": [
                {
                    "days": timeframe,
                    "stages": stages
                }
            ]
        }

@app.post("/profile/{profile_type}")
async def create_or_update_profile(
    profile_type: str,
    payload: dict = Body(...)
):
    """
    Flexible profile endpoint that accepts any JSON structure.
    Only checks for 'profile_type' key to determine node type.
    All other fields are stored as-is in Neo4j.
    """
    try:
        # Check if profile_type is provided in payload (optional, can use path param)
        if "profile_type" in payload:
            profile_type = payload["profile_type"]
        
        # Extract user_id if present (for multitenancy)
        # user_id is optional for company profiles (shared profile)
        user_id = payload.get("user_id")
        if profile_type != "company" and not user_id:
            raise HTTPException(status_code=400, detail="user_id is required in payload")
        
        # Extract org_id for company profiles (required for multi-org support)
        org_id = payload.get("org_id")
        if profile_type == "company" and not org_id:
            raise HTTPException(status_code=400, detail="org_id is required for company profiles")
        
        # Prepare data - convert all values to Neo4j-compatible types
        data = {}
        for key, value in payload.items():
            # Skip profile_type as it's used for node label
            if key == "profile_type":
                continue
            # Skip user_id for company profiles (shared profile, no multitenancy)
            if key == "user_id" and profile_type == "company":
                continue
            
            # Handle different value types
            if isinstance(value, (dict, list)):
                # Convert complex types to JSON string
                data[key] = json.dumps(value)
            elif isinstance(value, (str, int, float, bool)):
                # Direct assignment for primitive types
                data[key] = value
            elif value is None:
                # Skip None values
                continue
            else:
                # Convert everything else to string
                data[key] = str(value)
        
        with driver.session() as session:
            # Map profile_type to Neo4j label (handle case differences)
            neo4j_label = profile_type
            if profile_type == "company":
                neo4j_label = "CompanyProfile"
            
            # Determine unique identifier field based on profile_type
            if profile_type == "company":
                # For company profile, use org_id for multi-org support
                match_field = "org_id"
                match_value = org_id
                # Delete existing company profile for this org_id only
                session.run(
                    "MATCH (p:CompanyProfile {org_id: $org_id}) DELETE p",
                    org_id=org_id
                )
            elif profile_type == "user":
                match_field = "name"
                match_value = payload.get("name") or payload.get("user_id")
                # Delete existing profile for this user_id (multitenancy)
                session.run(
                    f"MATCH (p:{neo4j_label} {{user_id: $user_id}}) DELETE p",
                    user_id=user_id
                )
            elif profile_type == "agent_name":
                match_field = "agentName"
                match_value = payload.get("agentName") or "Scout"
                # Delete existing profile for this user_id (multitenancy)
                session.run(
                    f"MATCH (p:{neo4j_label} {{user_id: $user_id}}) DELETE p",
                    user_id=user_id
                )
            else:
                # For any other profile_type, use user_id as match field
                match_field = "user_id"
                match_value = user_id
                # Delete existing profile for this user_id (multitenancy)
                session.run(
                    f"MATCH (p:{neo4j_label} {{user_id: $user_id}}) DELETE p",
                    user_id=user_id
                )
            
            # Insert/update the profile (Neo4j v5+)
            session.execute_write(
                upsert_node,
                neo4j_label,
                match_field,
                match_value,
                data
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": f"{profile_type} profile processed successfully"}

@app.get("/profile/{profile_type}")
async def get_single_profile(
    profile_type: str,
    user_id: str = Query(None),
    org_id: str = Query(None)
):
    """
    Flexible profile fetch endpoint that returns any JSON structure.
    Filters by user_id for multitenancy (except for company profiles which are filtered by org_id).
    For company profiles, also includes customer profiles from MongoDB.
    """
    try:
        with driver.session() as session:
            # For company profiles, filter by org_id (required for multi-org support)
            if profile_type == "company":
                if not org_id:
                    raise HTTPException(
                        status_code=400,
                        detail="org_id is required for company profiles"
                    )
                neo4j_label = "CompanyProfile"
                query_string = f"MATCH (p:{neo4j_label} {{org_id: $org_id}}) RETURN p LIMIT 1"
                result = session.run(query_string, org_id=org_id)
            else:
                # For other profiles, user_id is required
                if not user_id:
                    raise HTTPException(
                        status_code=400,
                        detail="user_id is required for non-company profiles"
                    )
                # Query by profile_type and user_id (multitenancy)
                query_string = f"MATCH (p:{profile_type} {{user_id: $user_id}}) RETURN p LIMIT 1"
                result = session.run(query_string, user_id=user_id)
            
            record = result.single()

            if not record:
                if profile_type == "company":
                    raise HTTPException(
                        status_code=404,
                        detail="No company profile found"
                    )
                else:
                    raise HTTPException(
                        status_code=404, 
                        detail=f"No {profile_type} profile found for user_id: {user_id}"
                    )

            profile_data = dict(record.values()[0])

            # Try to parse JSON strings back to objects (flexible handling)
            for key, value in profile_data.items():
                if isinstance(value, str):
                    # Try to parse as JSON if it looks like JSON
                    if value.strip().startswith(('{', '[')):
                        try:
                            profile_data[key] = json.loads(value)
                        except json.JSONDecodeError:
                            pass  # Keep as string if not valid JSON

            # For company profiles, also fetch customer profiles from MongoDB
            if profile_type == "company":
                try:
                    # MongoDB connection
                    username = urllib.parse.quote_plus("techbrewra")
                    password = urllib.parse.quote_plus("Brewra@Best09")
                    mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
                    mongo_client = MongoClient(mongo_uri)
                    db = mongo_client["Profiler"]
                    collection = db["Company_Profile"]
                    
                    # Find the company profile document with customer profiles (filter by org_id)
                    filter_query = {"profile_type": "company", "org_id": org_id}
                    document = collection.find_one(filter_query)
                    
                    mongo_client.close()
                    
                    if document:
                        customer_profiles = document.get("customer_profiles", {})
                        icps = customer_profiles.get("icps", [])
                        # Remove MongoDB _id if present in ICPs
                        for icp in icps:
                            if "_id" in icp:
                                del icp["_id"]
                        profile_data["customer_profiles"] = {"icps": icps}
                    else:
                        profile_data["customer_profiles"] = {"icps": []}
                except Exception as e:
                    # If MongoDB fetch fails, just add empty customer profiles
                    profile_data["customer_profiles"] = {"icps": []}

            return profile_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/cleanup-company-profiles")
async def cleanup_company_profiles():
    """
    Ensure only one CompanyProfile exists in Neo4j.
    Keeps the first one found and deletes all others.
    """
    try:
        with driver.session() as session:
            # Get all company profiles
            result = session.run("MATCH (c:CompanyProfile) RETURN c, id(c) as node_id ORDER BY id(c)")
            records = list(result)
            
            if len(records) == 0:
                return {"message": "No company profiles found", "deleted": 0, "remaining": 0}
            
            if len(records) == 1:
                return {"message": "Only one company profile exists", "deleted": 0, "remaining": 1}
            
            # Keep the first one (oldest by node ID)
            first_node_id = records[0]["node_id"]
            
            # Delete all others
            delete_result = session.run(
                "MATCH (c:CompanyProfile) WHERE id(c) <> $keep_id DELETE c RETURN count(c) as deleted",
                keep_id=first_node_id
            )
            deleted_count = delete_result.single()["deleted"]
            
            return {
                "message": f"Cleanup completed. Kept 1 profile, deleted {deleted_count} duplicate(s).",
                "deleted": deleted_count,
                "remaining": 1
            }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    db = client["Scout_Agent"]
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
        with driver.session() as session:
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
        with driver.session() as session:
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
            with driver.session() as session:
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

@app.post("/generate-signals-batch")
async def generate_signals_batch(request: MarketRequest):
    """Generate 2 signals for scout and 2 signals for profiler"""
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
                signals_result = await asyncio.to_thread(search_signals_scout, pre_data)
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
                signals_result = await asyncio.to_thread(search_signals_profiler, profiler_pre_data)
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

@app.get("/test-llm")
async def test_llm():
    """Test if LLM is working"""
    try:
        from llm_config import llm2
        from langchain_core.messages import HumanMessage
        
        test_prompt = "Generate a simple JSON: {\"test\": \"hello\"}"
        messages = [HumanMessage(content=test_prompt)]
        response = llm2.invoke(messages)
        return {"status": "success", "response": str(response.content)}
    except Exception as e:
        return {"status": "error", "error": str(e)}

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
            with driver.session() as session:
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
        from llm_config import agent_chain
        
        raw_response = await asyncio.to_thread(
            agent_chain.invoke,
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
            with driver.session() as session:
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

@app.post("/edit")
def process_edit(request: EditRequest):
    username = urllib.parse.quote_plus("techbrewra")
    password = urllib.parse.quote_plus("Brewra@Best09")
    mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
    client = MongoClient(mongo_uri)
    db = client["Scout_Agent"]
    collection = db["Market_Intelligence"]
    
    try:
        if request.edit_type == "modification":
            # Ensure user_id is in the modified_json before inserting (multitenancy)
            modified_doc = request.modified_json.copy()
            modified_doc["user_id"] = request.user_id
            # Add timestamp to ensure edited components are fetched as most recent
            modified_doc["timestamp"] = datetime.utcnow()
            
            # Insert modified JSON into MongoDB
            insert_result = collection.insert_one(modified_doc)
            return {
                "status": "success",
                "inserted_id": str(insert_result.inserted_id)
            }
        elif request.edit_type == "comment":
            # Placeholder for comment feature
            return {"status": "feature coming soon"}
        else:
            return {"error": "Invalid edit_type. Must be 'comment' or 'modification'."}
    finally:
        client.close()

@app.post("/customer_profile")
async def create_or_update_customer_profile(request: CustomerProfileRequest):
    """
    Create or update customer profiles (ICPs) in MongoDB.
    Customer profiles are stored within the company profile document.
    """
    try:
        # MongoDB connection
        mongo_client = _get_profiler_mongo_client()
        db = mongo_client["Profiler"]
        _ensure_icp_id_registry_indexes(db)
        collection = db["Company_Profile"]
        
        # Get company profile from Neo4j to include in MongoDB document (filter by org_id)
        company_profile_data = {}
        with driver.session() as session:
            result = session.run(
                "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                org_id=request.org_id
            )
            record = result.single()
            if record:
                company_profile_data = dict(record.values()[0])
                # Parse JSON strings back to objects
                for key, value in company_profile_data.items():
                    if isinstance(value, str) and value.strip().startswith(('{', '[')):
                        try:
                            company_profile_data[key] = json.loads(value)
                        except json.JSONDecodeError:
                            pass
        
        # Prepare ICPs with backend-generated globally unique IDs and timestamps.
        current_time = datetime.now(timezone.utc).isoformat()
        processed_icps = []
        
        for icp in request.icps:
            icp_dict = icp.model_dump(exclude_none=True)
            
            # Set created_at if not provided
            if not icp_dict.get("created_at"):
                icp_dict["created_at"] = current_time
            
            # Ensure status has default value
            if not icp_dict.get("status"):
                icp_dict["status"] = "saved"
            
            processed_icps.append(icp_dict)
        
        # Upsert the document - store company profile + customer profiles together (filter by org_id)
        # Merge with existing ICPs instead of overwriting the entire list.
        filter_query = {"profile_type": "company", "org_id": request.org_id}
        existing_doc = collection.find_one(filter_query) or {}
        existing_icps = (((existing_doc.get("customer_profiles") or {}).get("icps")) or [])
        existing_by_id = {str(x.get("id")): x for x in existing_icps if isinstance(x, dict) and x.get("id")}

        # Ensure existing records have globally reserved IDs.
        repaired_existing = {}
        for existing in existing_icps:
            if not isinstance(existing, dict):
                continue
            existing_id = str(existing.get("id") or "").strip()
            if existing_id:
                reserved_existing_id = _reserve_unique_icp_id(
                    db,
                    id_type="customer_profile_icp",
                    owner_key=str(request.org_id),
                    preferred_id=existing_id
                )
                existing["id"] = reserved_existing_id
                repaired_existing[reserved_existing_id] = existing
            else:
                new_existing_id = _reserve_unique_icp_id(
                    db,
                    id_type="customer_profile_icp",
                    owner_key=str(request.org_id)
                )
                existing["id"] = new_existing_id
                repaired_existing[new_existing_id] = existing

        existing_by_id = repaired_existing

        # Upsert by id for existing ICPs. New ICPs always get backend-generated IDs.
        for icp in processed_icps:
            requested_id = str(icp.get("id") or "").strip()
            if requested_id and requested_id in existing_by_id:
                icp["id"] = requested_id
                existing_by_id[requested_id] = icp
                continue

            generated_id = _reserve_unique_icp_id(
                db,
                id_type="customer_profile_icp",
                owner_key=str(request.org_id)
            )
            icp["id"] = generated_id
            existing_by_id[generated_id] = icp

        merged_icps = list(existing_by_id.values())
        
        update_doc = {
            "$set": {
                "profile_type": "company",
                "org_id": request.org_id,
                "company_profile": company_profile_data,
                "customer_profiles": {
                    "icps": merged_icps
                },
                "updated_at": current_time
            }
        }
        
        collection.update_one(filter_query, update_doc, upsert=True)
        
        mongo_client.close()
        
        return {
            "success": True,
            "message": "Customer profiles saved successfully",
            "data": {
                "icps": merged_icps
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/customer_profile")
async def get_customer_profile(org_id: str = Query(...)):
    """
    Get customer profiles (ICPs) from MongoDB.
    Returns both company profile and associated customer profiles from the same document.
    Filtered by org_id for multi-org support.
    """
    mongo_client = None
    try:
        # MongoDB connection
        mongo_client = _get_profiler_mongo_client()
        db = mongo_client["Profiler"]
        _ensure_icp_id_registry_indexes(db)
        collection = db["Company_Profile"]
        
        # Find the company profile document (filter by org_id)
        filter_query = {"profile_type": "company", "org_id": org_id}
        document = collection.find_one(filter_query)
        
        if not document:
            # If no MongoDB document exists, try to get from Neo4j and return empty customer profiles
            with driver.session() as session:
                result = session.run(
                    "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                    org_id=org_id
                )
                record = result.single()
                if not record:
                    raise HTTPException(
                        status_code=404,
                        detail=f"No company profile found for org_id: {org_id}"
                    )
            
            return {
                "success": True,
                "data": {
                    "icps": []
                }
            }
        
        # Extract customer profiles
        customer_profiles = document.get("customer_profiles", {})
        icps = customer_profiles.get("icps", [])

        # Ensure frontend always receives ids and every id is globally unique/reserved.
        changed = False
        for icp in icps:
            if not isinstance(icp, dict):
                continue
            existing_id = str(icp.get("id") or "").strip()
            if existing_id:
                reserved_id = _reserve_unique_icp_id(
                    db,
                    id_type="customer_profile_icp",
                    owner_key=str(org_id),
                    preferred_id=existing_id
                )
                if reserved_id != existing_id:
                    icp["id"] = reserved_id
                    changed = True
            else:
                icp["id"] = _reserve_unique_icp_id(
                    db,
                    id_type="customer_profile_icp",
                    owner_key=str(org_id)
                )
                changed = True

        if changed:
            collection.update_one(
                filter_query,
                {"$set": {"customer_profiles.icps": icps, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        
        # Remove MongoDB _id if present in ICPs
        for icp in icps:
            if "_id" in icp:
                del icp["_id"]
        
        return {
            "success": True,
            "data": {
                "icps": icps
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if mongo_client:
            mongo_client.close()


@app.post("/customer_profile/from_suggested_icp")
async def save_suggested_icp_as_customer_profile(request: SuggestedICPToCustomerProfileRequest):
    """
    Convert a suggested/recommended ICP (from GET /icp) into a Customer Profile ICP and save it.
    Enforces uniqueness by source suggested ICP id within the org's saved customer profiles.
    """
    try:
        # --- Load suggested ICPs for this user_id ---
        mongo_client = _get_profiler_mongo_client()

        profiler_db = mongo_client["Profiler"]
        _ensure_icp_id_registry_indexes(profiler_db)
        icp_config_collection = profiler_db["ICP_config"]
        icp_config = icp_config_collection.find_one({"user_id": request.user_id}) or {}
        icps_payload = icp_config.get("icps") or {}
        suggested = []
        if isinstance(icps_payload, dict) and isinstance(icps_payload.get("suggestedICPs"), list):
            suggested = icps_payload.get("suggestedICPs", [])
        elif isinstance(icps_payload, list):
            suggested = icps_payload

        # Find requested suggested ICP by id
        target = None
        for item in suggested:
            if isinstance(item, dict) and str(item.get("id")) == str(request.icp_id):
                target = item
                break
        if not target:
            mongo_client.close()
            raise HTTPException(status_code=404, detail=f"Suggested ICP not found for icp_id: {request.icp_id}")

        # --- Map suggested ICP -> CustomerProfileICP schema ---
        regions = target.get("regions") if isinstance(target.get("regions"), list) else []
        decision_makers = target.get("decisionMakers") if isinstance(target.get("decisionMakers"), list) else []

        primary_region = (regions[0] if regions else None) or "global"
        industry_list = [x for x in [target.get("industry"), target.get("segment")] if isinstance(x, str) and x.strip()]
        company_size_list = [target.get("companySize")] if isinstance(target.get("companySize"), str) and target.get("companySize").strip() else []
        buyer_role_list = [x for x in decision_makers if isinstance(x, str) and x.strip()]

        # fit_confidence: map from confidenceScore if possible, else default to medium
        raw_conf = str(target.get("confidenceScore") or "").strip().lower()
        if raw_conf in {"high", "medium", "low"}:
            fit_confidence = raw_conf
        else:
            # Try to parse numeric confidence
            fit_confidence = "medium"
            try:
                conf_num = float(raw_conf)
                if conf_num >= 0.75:
                    fit_confidence = "high"
                elif conf_num <= 0.35:
                    fit_confidence = "low"
            except Exception:
                pass

        # Pydantic required fields guardrails
        if not industry_list:
            industry_list = ["unknown"]
        if not company_size_list:
            company_size_list = ["unknown"]
        if not buyer_role_list:
            buyer_role_list = ["unknown"]

        why_suggested = target.get("whySuggested") if isinstance(target.get("whySuggested"), list) else []
        additional_context_parts = []
        if why_suggested:
            additional_context_parts.append("Why suggested: " + "; ".join([str(x) for x in why_suggested if str(x).strip()]))
        if target.get("topPainPoint"):
            additional_context_parts.append("Top pain point: " + str(target.get("topPainPoint")))
        if target.get("growthIndicator"):
            additional_context_parts.append("Growth indicator: " + str(target.get("growthIndicator")))
        additional_context = "\n".join([p for p in additional_context_parts if p])

        new_icp = {
            "id": _reserve_unique_icp_id(
                profiler_db,
                id_type="customer_profile_icp",
                owner_key=str(request.org_id)
            ),
            "primary_region": str(primary_region),
            "industry": industry_list,
            "company_size": company_size_list,
            "buyer_role": buyer_role_list,
            "fit_confidence": fit_confidence,
            "status": "saved",
            "created_at": datetime.now(timezone.utc).isoformat(),
            # Track source suggested icp for uniqueness + traceability (allowed due to extra='allow')
            "source_suggested_icp_id": str(request.icp_id),
            "source_user_id": str(request.user_id),
            "source_payload": target,
            "additional_context": additional_context or None,
        }

        # --- Save into Company_Profile customer_profiles.icps (org-scoped) with uniqueness check ---
        company_profile_collection = profiler_db["Company_Profile"]
        filter_query = {"profile_type": "company", "org_id": request.org_id}
        existing_doc = company_profile_collection.find_one(filter_query) or {}
        existing_icps = (((existing_doc.get("customer_profiles") or {}).get("icps")) or [])

        # Reject if this suggested ICP was already saved for this org
        for existing in existing_icps:
            if isinstance(existing, dict) and str(existing.get("source_suggested_icp_id")) == str(request.icp_id):
                mongo_client.close()
                raise HTTPException(status_code=409, detail="This suggested ICP is already saved in customer profile.")

        merged_icps = [x for x in existing_icps if isinstance(x, dict)] + [new_icp]

        # Get company profile from Neo4j to include (reuse existing if present)
        company_profile_data = existing_doc.get("company_profile") or {}
        if not company_profile_data:
            with driver.session() as session:
                result = session.run(
                    "MATCH (c:CompanyProfile {org_id: $org_id}) RETURN c LIMIT 1",
                    org_id=request.org_id
                )
                record = result.single()
                if record:
                    company_profile_data = dict(record.values()[0])
                    for key, value in company_profile_data.items():
                        if isinstance(value, str) and value.strip().startswith(('{', '[')):
                            try:
                                company_profile_data[key] = json.loads(value)
                            except json.JSONDecodeError:
                                pass

        current_time = datetime.now(timezone.utc).isoformat()
        update_doc = {
            "$set": {
                "profile_type": "company",
                "org_id": request.org_id,
                "company_profile": company_profile_data,
                "customer_profiles": {"icps": merged_icps},
                "updated_at": current_time,
            }
        }
        company_profile_collection.update_one(filter_query, update_doc, upsert=True)
        mongo_client.close()

        return {
            "success": True,
            "message": "Suggested ICP saved to customer profile successfully",
            "data": {"icp": new_icp}
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/customer_profile/icp/{icp_id}")
async def delete_customer_profile_icp(icp_id: str, org_id: str = Query(...)):
    """
    Delete a single saved customer profile ICP by icp_id for a given org_id.
    """
    mongo_client = None
    try:
        mongo_client = _get_profiler_mongo_client()
        db = mongo_client["Profiler"]
        _ensure_icp_id_registry_indexes(db)
        collection = db["Company_Profile"]

        filter_query = {"profile_type": "company", "org_id": org_id}
        document = collection.find_one(filter_query)
        if not document:
            raise HTTPException(status_code=404, detail=f"No customer profile document found for org_id: {org_id}")

        existing_icps = (((document.get("customer_profiles") or {}).get("icps")) or [])
        updated_icps = []
        deleted_icp = None
        for icp in existing_icps:
            if isinstance(icp, dict) and str(icp.get("id")) == str(icp_id):
                deleted_icp = icp
                continue
            updated_icps.append(icp)

        if not deleted_icp:
            raise HTTPException(status_code=404, detail=f"Customer profile ICP not found for icp_id: {icp_id}")

        collection.update_one(
            filter_query,
            {"$set": {"customer_profiles.icps": updated_icps, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        _release_icp_id(db, icp_id)

        return {
            "success": True,
            "message": "Customer profile ICP deleted successfully",
            "data": {
                "deleted_icp_id": str(icp_id),
                "remaining_count": len(updated_icps)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if mongo_client:
            mongo_client.close()


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

# ============================================================================
# ORG MANAGEMENT APIs
# ============================================================================

@app.get("/org")
async def get_org_by_user(user_id: str = Query(...)):
    """
    Get org_id and org_name for a given user_id.
    Fetches from MongoDB users collection (single document) and orgs collection for org_name.
    """
    try:
        # MongoDB connection
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["Org_Management"]
        users_collection = db["users"]
        orgs_collection = db["orgs"]
        
        # Get the single users document
        users_doc = users_collection.find_one({"_id": "users"})
        
        if not users_doc:
            mongo_client.close()
            raise HTTPException(status_code=404, detail="Users document not found")
        
        # Get user_id to org_id mapping
        user_mappings = users_doc.get("user_mappings", {})
        org_id = user_mappings.get(user_id)
        
        if not org_id:
            mongo_client.close()
            raise HTTPException(
                status_code=404,
                detail=f"No org_id found for user_id: {user_id}"
            )
        
        # Get org_name from orgs collection
        org_name = None
        orgs_doc = orgs_collection.find_one({"_id": "orgs"})
        if orgs_doc:
            org_names = orgs_doc.get("org_names", {})
            org_name = org_names.get(org_id)
        
        mongo_client.close()
        
        response = {
            "status": "success",
            "user_id": user_id,
            "org_id": org_id
        }
        if org_name:
            response["org_name"] = org_name
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching org for user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch org: {str(e)}")

@app.post("/org")
async def create_org(request: dict = Body(None)):
    """
    Generate a new org_id and save it to MongoDB orgs collection (single document).
    Optionally accepts org_name to link with the org_id.
    Returns the newly created org_id and org_name (if provided).
    """
    try:
        # Extract org_name from request body (optional)
        org_name = None
        if request and "org_name" in request:
            org_name = request.get("org_name")
        
        # Generate new org_id
        new_org_id = str(uuid.uuid4())
        
        # MongoDB connection
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["Org_Management"]
        collection = db["orgs"]
        
        # Get or create the single orgs document
        orgs_doc = collection.find_one({"_id": "orgs"})
        
        if orgs_doc:
            # Add new org_id to existing list
            org_list = orgs_doc.get("org_list", [])
            if new_org_id not in org_list:
                org_list.append(new_org_id)
            
            # Update org_names mapping if org_name is provided
            org_names = orgs_doc.get("org_names", {})
            if org_name:
                org_names[new_org_id] = org_name
            
            collection.update_one(
                {"_id": "orgs"},
                {
                    "$set": {
                        "org_list": org_list,
                        "org_names": org_names,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
        else:
            # Create new document with the org_id
            org_data = {
                "_id": "orgs",
                "org_list": [new_org_id],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            if org_name:
                org_data["org_names"] = {new_org_id: org_name}
            collection.insert_one(org_data)
        
        mongo_client.close()
        
        response = {
            "status": "success",
            "message": "Org created successfully",
            "org_id": new_org_id
        }
        if org_name:
            response["org_name"] = org_name
        
        return response
        
    except Exception as e:
        logger.error(f"Error creating org: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create org: {str(e)}")

@app.post("/connect_org")
async def connect_user_to_org(user_id: str = Body(...), org_id: str = Body(...)):
    """
    Connect a user_id to an org_id.
    Saves the mapping in MongoDB users collection (single document).
    """
    try:
        # MongoDB connection
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["Org_Management"]
        collection = db["users"]
        
        # Get or create the single users document
        users_doc = collection.find_one({"_id": "users"})
        
        if users_doc:
            # Update existing user_mappings
            user_mappings = users_doc.get("user_mappings", {})
            user_mappings[user_id] = org_id
            
            collection.update_one(
                {"_id": "users"},
                {
                    "$set": {
                        "user_mappings": user_mappings,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
        else:
            # Create new document with the mapping
            collection.insert_one({
                "_id": "users",
                "user_mappings": {user_id: org_id},
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })
        
        mongo_client.close()
        
        return {
            "status": "success",
            "message": f"User {user_id} connected to org {org_id}",
            "user_id": user_id,
            "org_id": org_id
        }
        
    except Exception as e:
        logger.error(f"Error connecting user to org: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to connect user to org: {str(e)}")

@app.post("/registration", response_model=RegistrationResponse)
async def create_registration(registration: RegistrationRequest):
    """
    POST registration endpoint.
    Creates a new registration entry in MongoDB.
    Uses separate database 'Registration_DB' and collection 'registrations'.
    """
    try:
        # Connect to separate registration database
        db = client["Registration_DB"]
        collection = db["registrations"]
        
        # Create registration document with timestamp
        registration_doc = {
            "name": registration.name,
            "email": registration.email,
            "timestamp": datetime.utcnow()
        }
        
        # Insert the document
        result = collection.insert_one(registration_doc)
        
        # Return the created registration
        return RegistrationResponse(
            id=str(result.inserted_id),
            name=registration.name,
            email=registration.email,
            timestamp=registration_doc["timestamp"].isoformat()
        )
        
    except Exception as e:
        logger.error(f"Error creating registration: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create registration: {str(e)}")

@app.get("/registration", response_model=List[RegistrationResponse])
async def get_registrations():
    """
    GET registration endpoint.
    Fetches all registration entries ordered by recency (most recent first).
    Uses separate database 'Registration_DB' and collection 'registrations'.
    """
    try:
        # Connect to separate registration database
        db = client["Registration_DB"]
        collection = db["registrations"]
        
        # Fetch all registrations ordered by timestamp (descending - most recent first)
        registrations = collection.find().sort("timestamp", -1)
        
        # Convert to response format
        result = []
        for reg in registrations:
            result.append(RegistrationResponse(
                id=str(reg["_id"]),
                name=reg["name"],
                email=reg["email"],
                timestamp=reg["timestamp"].isoformat() if isinstance(reg["timestamp"], datetime) else reg["timestamp"]
            ))
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching registrations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch registrations: {str(e)}")

# Initialize S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=aws_access_key,
    aws_secret_access_key=aws_secret_key,
    region_name=aws_region
)

# Initialize Pinecone
pc = Pinecone(api_key=pinecone_api_key)

async def process_file_to_embeddings(file_key: str, user_id: str, file_name: str, org_id: str, file_id: str):
    """Background task to convert file to embeddings and store in Pinecone with org_id namespace.
    Processes PDF, TXT, CSV, and XLSX files. Other file types are skipped gracefully."""
    try:
        # Only process PDF, TXT, CSV, and XLSX files
        supported_extensions = ('.pdf', '.txt', '.csv', '.xlsx')
        if not file_name.lower().endswith(supported_extensions):
            logger.info(f"Skipping Pinecone embedding for unsupported file type: {file_name}")
            # Update status to completed (not embedded)
            try:
                username = urllib.parse.quote_plus("techbrewra")
                password = urllib.parse.quote_plus("Brewra@Best09")
                mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
                mongo_client = MongoClient(mongo_uri)
                db = mongo_client["File_Processing"]
                collection = db["file_status"]
                
                collection.update_one(
                    {"file_key": file_key},
                    {"$set": {
                        "status": "completed",
                        "completed_at": datetime.utcnow(),
                        "embedding_supported": False
                    }},
                    upsert=True
                )
                mongo_client.close()
            except Exception as e:
                logger.warning(f"Failed to update status: {str(e)}")
            return
        
        # Download file from S3
        local_file_path = f"/tmp/{file_name}"
        s3_client.download_file(s3_bucket, file_key, local_file_path)
        
        # Load document based on file type
        if file_name.lower().endswith('.pdf'):
            loader = PyPDFLoader(local_file_path)
            documents = loader.load()
        elif file_name.lower().endswith('.txt'):
            loader = TextLoader(local_file_path)
            documents = loader.load()
        elif file_name.lower().endswith('.csv'):
            # Load CSV using pandas and convert to text documents
            try:
                df = pd.read_csv(local_file_path)
                # Convert DataFrame to text format
                documents = []
                # Create a document for each row, combining all columns
                for idx, row in df.iterrows():
                    row_text = " | ".join([f"{col}: {str(val)}" for col, val in row.items() if pd.notna(val)])
                    documents.append(Document(page_content=row_text, metadata={"row_index": idx}))
                # Also create a summary document with column names and data types
                summary_text = f"CSV File Summary:\nColumns: {', '.join(df.columns.tolist())}\nRows: {len(df)}\n\n"
                summary_text += "Sample data:\n" + df.head(10).to_string()
                documents.insert(0, Document(page_content=summary_text, metadata={"type": "summary"}))
            except Exception as e:
                logger.error(f"Error loading CSV file {file_name}: {str(e)}")
                # Fallback to CSVLoader if pandas fails
                loader = CSVLoader(local_file_path)
                documents = loader.load()
        elif file_name.lower().endswith('.xlsx'):
            # Load XLSX using pandas and convert to text documents
            try:
                # Read all sheets
                excel_file = pd.ExcelFile(local_file_path)
                documents = []
                
                for sheet_name in excel_file.sheet_names:
                    df = pd.read_excel(local_file_path, sheet_name=sheet_name)
                    # Create a document for each row in the sheet
                    for idx, row in df.iterrows():
                        row_text = " | ".join([f"{col}: {str(val)}" for col, val in row.items() if pd.notna(val)])
                        documents.append(Document(
                            page_content=row_text, 
                            metadata={"sheet_name": sheet_name, "row_index": idx}
                        ))
                    # Add summary for each sheet
                    summary_text = f"Sheet: {sheet_name}\nColumns: {', '.join(df.columns.tolist())}\nRows: {len(df)}\n\n"
                    summary_text += "Sample data:\n" + df.head(10).to_string()
                    documents.append(Document(
                        page_content=summary_text, 
                        metadata={"type": "summary", "sheet_name": sheet_name}
                    ))
            except Exception as e:
                logger.error(f"Error loading XLSX file {file_name}: {str(e)}")
                # Fallback to UnstructuredExcelLoader if pandas fails
                try:
                    loader = UnstructuredExcelLoader(local_file_path)
                    documents = loader.load()
                except Exception as e2:
                    logger.error(f"Error with UnstructuredExcelLoader: {str(e2)}")
                    raise
        else:
            logger.warning(f"Unexpected file type in process_file_to_embeddings: {file_name}")
            return
        
        # Split documents into chunks
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(documents)
        
        # Add metadata to each chunk (file_key, file_id, org_id for filtering/deletion)
        for chunk in chunks:
            if not hasattr(chunk, 'metadata'):
                chunk.metadata = {}
            chunk.metadata['file_key'] = file_key
            chunk.metadata['file_id'] = file_id
            chunk.metadata['org_id'] = org_id
            chunk.metadata['user_id'] = user_id
            chunk.metadata['file_name'] = file_name
        
        # Initialize embeddings (using TogetherAI with multilingual-e5-large-instruct)
        embeddings = OpenAIEmbeddings(
            openai_api_key=together_api_key,
            openai_api_base="https://api.together.xyz/v1",
            model="intfloat/multilingual-e5-large-instruct"
        )
        
        # Create or get Pinecone index
        index_name = "brewra-documents"
        try:
            pc.create_index(
                name=index_name,
                dimension=1024,  # multilingual-e5-large-instruct embedding dimension (1024)
                metric="cosine"
            )
        except Exception:
            # Index already exists
            pass
        
        # Store embeddings in Pinecone with org_id as namespace
        vectorstore = PineconeVectorStore.from_documents(
            chunks,
            embeddings,
            index_name=index_name,
            namespace=org_id,  # Use org_id as namespace for multitenancy
            pinecone_api_key=pinecone_api_key
        )
        
        # Update status in MongoDB (optional - for tracking)
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["File_Processing"]
        collection = db["file_status"]
        
        collection.update_one(
            {"file_key": file_key},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.utcnow(),
                "chunks_count": len(chunks),
                "embedding_supported": True
            }},
            upsert=True
        )
        mongo_client.close()
        
        # Clean up local file
        import os
        if os.path.exists(local_file_path):
            os.remove(local_file_path)
            
    except Exception as e:
        # Update status with error
        try:
            username = urllib.parse.quote_plus("techbrewra")
            password = urllib.parse.quote_plus("Brewra@Best09")
            mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
            mongo_client = MongoClient(mongo_uri)
            db = mongo_client["File_Processing"]
            collection = db["file_status"]
            
            collection.update_one(
                {"file_key": file_key},
                {"$set": {
                    "status": "failed",
                    "error": str(e),
                    "failed_at": datetime.utcnow()
                }},
                upsert=True
            )
            mongo_client.close()
        except:
            pass
        logger.error(f"Error processing file {file_key}: {str(e)}")

@app.post("/upload-document")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(None),
    user_id: str = Form(...),
    org_id: str = Form(...),
    url: str = Form(None),
    name: str = Form(None),
    tags: str = Form(None),  # Comma-separated string or JSON array string
    description: str = Form(None)
):
    """
    Upload a file (any format) to S3 OR save a URL as data source.
    PDF, TXT, CSV, and XLSX files are embedded into Pinecone.
    Other formats are uploaded to S3 but not vectorized.
    Returns immediately with upload status.
    
    Parameters:
    - file: File to upload (required if url not provided)
    - url: URL to save as data source (required if file not provided)
    - name: Name for the URL data source (required if url provided)
    - tags: Optional comma-separated string or JSON array string (e.g., "tag1,tag2" or '["tag1","tag2"]')
    - description: Optional description of the document
    """
    try:
        # Validate that either file or url is provided
        if not file and not url:
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "error": "validation_failed",
                    "message": "Either 'file' or 'url' must be provided"
                }
            )
        
        # If URL is provided, handle URL data source
        if url:
            if not name:
                return JSONResponse(
                    status_code=400,
                    content={
                        "status": "error",
                        "error": "validation_failed",
                        "message": "name is required when url is provided"
                    }
                )
            
            # Generate unique ID for URL data source
            file_id = str(uuid.uuid4())
            
            # Parse tags
            tags_list = None
            if tags:
                try:
                    tags_list = json.loads(tags)
                    if not isinstance(tags_list, list):
                        tags_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
                except (json.JSONDecodeError, AttributeError):
                    tags_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
            
            # Save URL data source to MongoDB
            try:
                username = urllib.parse.quote_plus("techbrewra")
                password = urllib.parse.quote_plus("Brewra@Best09")
                mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
                mongo_client = MongoClient(mongo_uri)
                db = mongo_client["File_Processing"]
                collection = db["file_status"]
                
                doc = {
                    "file_id": file_id,
                    "user_id": user_id,
                    "org_id": org_id,
                    "file_name": name,
                    "url": url,
                    "status": "completed",
                    "uploaded_at": datetime.utcnow(),
                    "embedding_supported": False,
                    "data_source_type": "url"
                }
                
                if tags_list:
                    doc["tags"] = tags_list
                if description:
                    doc["description"] = description
                
                collection.insert_one(doc)
                mongo_client.close()
            except Exception as e:
                logger.error(f"Failed to save URL data source to MongoDB: {str(e)}")
                return JSONResponse(
                    status_code=500,
                    content={
                        "status": "error",
                        "error": "save_failed",
                        "message": f"Failed to save URL data source: {str(e)}"
                    }
                )
            
            response = {
                "status": "success",
                "message": "URL data source saved successfully",
                "file_id": file_id,
                "name": name,
                "url": url
            }
            
            if tags_list:
                response["tags"] = tags_list
            if description:
                response["description"] = description
            
            return response
        
        # Handle file upload - accept ALL file formats for AWS upload
        # Check if file will be embedded (PDF, TXT, CSV, XLSX)
        will_be_embedded = file.filename.lower().endswith(('.pdf', '.txt', '.csv', '.xlsx'))
        
        # Generate unique file key for S3 (organized by org_id)
        file_id = str(uuid.uuid4())
        file_key = f"{org_id}/{file_id}_{file.filename}"
        
        # Upload to S3
        try:
            file_content = await file.read()
            s3_client.put_object(
                Bucket=s3_bucket,
                Key=file_key,
                Body=file_content,
                ContentType=file.content_type or 'application/octet-stream'
            )
        except Exception as e:
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "error": "upload_failed",
                    "message": f"Failed to upload file to S3: {str(e)}"
                }
            )
        
        # Parse tags - handle both comma-separated string and JSON array string
        tags_list = None
        if tags:
            try:
                # Try to parse as JSON array first
                tags_list = json.loads(tags)
                if not isinstance(tags_list, list):
                    # If not a list, treat as comma-separated string
                    tags_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
            except (json.JSONDecodeError, AttributeError):
                # If JSON parsing fails, treat as comma-separated string
                tags_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
        
        # Store initial status in MongoDB
        try:
            username = urllib.parse.quote_plus("techbrewra")
            password = urllib.parse.quote_plus("Brewra@Best09")
            mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
            mongo_client = MongoClient(mongo_uri)
            db = mongo_client["File_Processing"]
            collection = db["file_status"]
            
            doc = {
                "file_key": file_key,
                "file_id": file_id,
                "user_id": user_id,
                "org_id": org_id,
                "file_name": file.filename,
                "status": "processing" if will_be_embedded else "completed",
                "uploaded_at": datetime.utcnow(),
                "s3_url": f"s3://{s3_bucket}/{file_key}",
                "embedding_supported": will_be_embedded
            }
            
            # Add tags and description if provided
            if tags_list:
                doc["tags"] = tags_list
            if description:
                doc["description"] = description
            
            collection.insert_one(doc)
            mongo_client.close()
        except Exception as e:
            logger.warning(f"Failed to store status in MongoDB: {str(e)}")
        
        # Start background task for PDF, TXT, CSV, and XLSX files (vectorization)
        if will_be_embedded:
            background_tasks.add_task(process_file_to_embeddings, file_key, user_id, file.filename, org_id, file_id)
        else:
            # For non-embeddable files, mark as completed immediately
            try:
                username = urllib.parse.quote_plus("techbrewra")
                password = urllib.parse.quote_plus("Brewra@Best09")
                mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
                mongo_client = MongoClient(mongo_uri)
                db = mongo_client["File_Processing"]
                collection = db["file_status"]
                
                collection.update_one(
                    {"file_key": file_key},
                    {"$set": {
                        "status": "completed",
                        "completed_at": datetime.utcnow(),
                        "embedding_supported": False
                    }},
                    upsert=True
                )
                mongo_client.close()
            except Exception as e:
                logger.warning(f"Failed to update status for non-embeddable file: {str(e)}")
        
        response = {
            "status": "success",
            "message": f"File uploaded successfully. {'Processing embeddings in background.' if will_be_embedded else 'File uploaded to S3 (not vectorized).'}",
            "file_key": file_key,
            "file_id": file_id,
            "file_name": file.filename
        }
        
        # Include tags and description in response if provided
        if tags_list:
            response["tags"] = tags_list
        if description:
            response["description"] = description
        
        return response
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "error": "upload_failed",
                "message": f"Unexpected error: {str(e)}"
            }
        )

@app.get("/document-status/{file_key:path}")
async def get_document_status(file_key: str):
    """
    Get the processing status of a document.
    Returns status: processing, completed, or failed
    """
    try:
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["File_Processing"]
        collection = db["file_status"]
        
        status_doc = collection.find_one({"file_key": file_key})
        mongo_client.close()
        
        if not status_doc:
            raise HTTPException(status_code=404, detail="File not found")
        
        status_doc.pop("_id", None)
        return {
            "status": "success",
            "data": status_doc
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/user-documents")
async def get_user_documents(org_id: str = Query(...)):
    """
    Get all data sources (files and URLs) for an organization.
    Returns list of files and URLs with file_name, file_id, and other metadata.
    Filtered by org_id for multi-org support.
    """
    try:
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["File_Processing"]
        collection = db["file_status"]
        
        # Find all data sources (files and URLs) for this org
        files = collection.find({"org_id": org_id}).sort("uploaded_at", -1)
        
        file_list = []
        for file_doc in files:
            file_item = {
                "file_id": file_doc.get("file_id") or file_doc.get("file_key"),
                "file_key": file_doc.get("file_key"),
                "file_name": file_doc.get("file_name"),
                "status": file_doc.get("status", "unknown"),
                "uploaded_at": file_doc.get("uploaded_at"),
                "data_source_type": file_doc.get("data_source_type", "file")  # "file" or "url"
            }
            
            # Include URL if it's a URL data source
            if file_doc.get("url"):
                file_item["url"] = file_doc.get("url")
            
            # Include tags and description if they exist
            if "tags" in file_doc:
                file_item["tags"] = file_doc.get("tags")
            if "description" in file_doc:
                file_item["description"] = file_doc.get("description")
            
            file_list.append(file_item)
        
        mongo_client.close()
        
        return {
            "status": "success",
            "count": len(file_list),
            "files": file_list
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/data-source/{file_id}")
async def delete_data_source(file_id: str):
    """
    Delete a data source file from AWS S3, Pinecone, and MongoDB.
    Deletes based on file_id.
    """
    try:
        # Log the received file_id for debugging
        logger.info(f"DELETE /data-source received file_id: '{file_id}' (length: {len(file_id)}, repr: {repr(file_id)})")
        
        # Strip any trailing slashes that might be added by the router or client
        original_file_id = file_id
        file_id = file_id.rstrip('/')
        
        if original_file_id != file_id:
            logger.warning(f"Stripped trailing slash from file_id: '{original_file_id}' -> '{file_id}'")
        
        # MongoDB connection
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["File_Processing"]
        collection = db["file_status"]
        
        # Log what we're searching for
        logger.info(f"Searching MongoDB for file_id: '{file_id}'")
        
        # If file_id contains a slash, it might be a file_key from old documents
        # Extract just the UUID part if it looks like a file_key path
        search_file_id = file_id
        if "/" in file_id:
            # Format: {org_id}/{file_id}_{filename} - extract the file_id part
            parts = file_id.split("/")
            if len(parts) > 1:
                # Get the part after the slash
                file_part = parts[-1]
                # Extract UUID (before underscore if present)
                if "_" in file_part:
                    search_file_id = file_part.split("_")[0]
                    logger.info(f"Extracted file_id from path: '{file_id}' -> '{search_file_id}'")
                else:
                    search_file_id = file_part
        
        # Find file document by file_id
        file_doc = collection.find_one({"file_id": search_file_id})
        logger.info(f"Search by file_id field '{search_file_id}' result: {file_doc is not None}")
        
        if not file_doc:
            # Try to find by file_key if file_id not found (for backward compatibility)
            logger.info(f"Trying to find by file_key: '{file_id}'")
            file_doc = collection.find_one({"file_key": file_id})
            logger.info(f"Search by file_key result: {file_doc is not None}")
            
            if not file_doc:
                # Log some sample documents to help debug
                sample_docs = list(collection.find({}, {"file_id": 1, "file_key": 1, "_id": 0}).limit(3))
                logger.error(f"File not found. Searched for file_id='{search_file_id}' and file_key='{file_id}'. Sample documents: {sample_docs}")
                mongo_client.close()
                raise HTTPException(status_code=404, detail=f"File with id '{file_id}' not found")
        
        file_key = file_doc.get("file_key")
        url = file_doc.get("url")
        data_source_type = file_doc.get("data_source_type")
        org_id = file_doc.get("org_id")
        actual_file_id = file_doc.get("file_id")  # Get the actual file_id from document
        
        # Check if this is a URL data source (not a file)
        is_url_data_source = url is not None or data_source_type == "url"
        
        # For backward compatibility: extract org_id from file_key if not in document
        if not org_id and file_key:
            # Try to extract org_id from file_key pattern: {org_id}/{file_id}_{filename}
            parts = file_key.split("/")
            if len(parts) > 1:
                org_id = parts[0]
        
        # Use actual_file_id for Pinecone deletion, fallback to search_file_id if not available
        if not actual_file_id:
            actual_file_id = search_file_id
        
        deletion_errors = []
        
        # 1. Delete from AWS S3 (only for file data sources, not URLs)
        if not is_url_data_source and file_key:
            try:
                s3_client.delete_object(Bucket=s3_bucket, Key=file_key)
                logger.info(f"Deleted file from S3: {file_key}")
            except Exception as e:
                error_msg = str(e)
                # Check if it's a permissions error
                if "AccessDenied" in error_msg or "not authorized" in error_msg:
                    deletion_errors.append(f"S3 deletion failed: AWS IAM user does not have s3:DeleteObject permission. Please update IAM policy for user 'brewra-ai'.")
                else:
                    deletion_errors.append(f"S3 deletion failed: {error_msg}")
                logger.error(f"Failed to delete from S3: {error_msg}")
        elif is_url_data_source:
            logger.info(f"Skipping S3 deletion for URL data source: {url}")
        else:
            logger.warning(f"No file_key found, skipping S3 deletion")
        
        # 2. Delete from Pinecone (only for file data sources that were embedded, not URLs)
        if not is_url_data_source and org_id and file_key:
            try:
                index_name = "brewra-documents"
                index = pc.Index(index_name)
                
                # Check if namespace exists first and log what we're searching for
                logger.info(f"Attempting Pinecone deletion: namespace='{org_id}', file_id='{actual_file_id}', file_key='{file_key}'")
                
                try:
                    stats = index.describe_index_stats()
                    namespaces = stats.get('namespaces', {})
                    logger.info(f"Available namespaces in Pinecone: {list(namespaces.keys())}")
                    
                    if org_id not in namespaces:
                        logger.warning(f"Namespace '{org_id}' does not exist in Pinecone. Available namespaces: {list(namespaces.keys())}")
                        deletion_errors.append(f"Pinecone deletion skipped: Namespace '{org_id}' not found. Available namespaces: {list(namespaces.keys())}")
                    else:
                        # Namespace exists, try to delete
                        # First, try to query vectors with our file_id to see if they exist
                        try:
                            # Query with a dummy vector to see if we can access the namespace and find our vectors
                            from pinecone import QueryResponse
                            sample_query = index.query(
                                vector=[0.0] * 1024,  # Dummy vector
                                top_k=10,
                                namespace=org_id,
                                filter={"file_id": {"$eq": actual_file_id}},
                                include_metadata=True
                            )
                            if sample_query.matches:
                                logger.info(f"Found {len(sample_query.matches)} vectors with file_id='{actual_file_id}' in namespace '{org_id}'. Sample metadata: {sample_query.matches[0].metadata}")
                            else:
                                logger.warning(f"No vectors found with file_id='{actual_file_id}' in namespace '{org_id}'. Trying with file_key...")
                                # Try querying with file_key
                                sample_query2 = index.query(
                                    vector=[0.0] * 1024,
                                    top_k=10,
                                    namespace=org_id,
                                    filter={"file_key": {"$eq": file_key}},
                                    include_metadata=True
                                )
                                if sample_query2.matches:
                                    logger.info(f"Found {len(sample_query2.matches)} vectors with file_key='{file_key}' in namespace '{org_id}'. Sample metadata: {sample_query2.matches[0].metadata}")
                                else:
                                    logger.warning(f"No vectors found with either file_id='{actual_file_id}' or file_key='{file_key}' in namespace '{org_id}'")
                        except Exception as query_error:
                            error_str = str(query_error)
                            if "Namespace not found" in error_str or "code\":5" in error_str:
                                logger.error(f"Namespace '{org_id}' not accessible during query. This suggests the namespace name might not match exactly. Error: {error_str}")
                                deletion_errors.append(f"Pinecone deletion failed: Namespace '{org_id}' not accessible. Check if namespace name matches exactly (case-sensitive). Error: {error_str}")
                                # Don't raise, continue to try deletion anyway
                            else:
                                logger.warning(f"Query failed but continuing with deletion attempt: {error_str}")
                        
                        # Delete vectors by metadata filter (file_id in the specific namespace)
                        # Pinecone delete by metadata filter - try both file_id and file_key for compatibility
                        try:
                            logger.info(f"Attempting delete with filter: file_id='{actual_file_id}' in namespace='{org_id}'")
                            index.delete(
                                filter={"file_id": {"$eq": actual_file_id}},
                                namespace=org_id
                            )
                            logger.info(f"Successfully deleted vectors from Pinecone for file_id: {actual_file_id} in namespace: {org_id}")
                        except Exception as delete_error:
                            error_str = str(delete_error)
                            logger.warning(f"Delete with file_id failed: {error_str}. Trying with file_key...")
                            
                            # Try with file_key if file_id filter doesn't work
                            try:
                                logger.info(f"Attempting delete with filter: file_key='{file_key}' in namespace='{org_id}'")
                                index.delete(
                                    filter={"file_key": {"$eq": file_key}},
                                    namespace=org_id
                                )
                                logger.info(f"Successfully deleted vectors from Pinecone for file_key: {file_key} in namespace: {org_id}")
                            except Exception as e2:
                                error_str = str(e2)
                                # If both fail, check if it's a namespace not found error
                                if "Namespace not found" in error_str or "code\":5" in error_str:
                                    logger.error(f"Namespace '{org_id}' not found during deletion. This is unexpected since it exists in stats. Error: {error_str}")
                                    deletion_errors.append(f"Pinecone deletion failed: Namespace '{org_id}' not accessible during deletion. Error: {error_str}")
                                else:
                                    logger.error(f"Pinecone deletion failed with both file_id and file_key filters. Last error: {error_str}")
                                    deletion_errors.append(f"Pinecone deletion failed: No vectors found matching file_id='{actual_file_id}' or file_key='{file_key}'. Error: {error_str}")
                                    raise e2
                except Exception as stats_error:
                    # If we can't get stats, try deletion anyway
                    logger.warning(f"Could not check namespace stats: {str(stats_error)}. Attempting deletion anyway.")
                    try:
                        index.delete(
                            filter={"file_id": {"$eq": actual_file_id}},
                            namespace=org_id
                        )
                        logger.info(f"Deleted vectors from Pinecone for file_id: {actual_file_id} in namespace: {org_id}")
                    except Exception as delete_error:
                        error_str = str(delete_error)
                        if "Namespace not found" in error_str or "code\":5" in error_str:
                            logger.warning(f"Namespace '{org_id}' not found. Vectors may not exist.")
                            deletion_errors.append(f"Pinecone deletion skipped: Namespace '{org_id}' not found. Vectors may not have been stored.")
                        else:
                            raise delete_error
            except Exception as e:
                error_str = str(e)
                if "Namespace not found" in error_str or "code\":5" in error_str:
                    logger.warning(f"Namespace '{org_id}' not found. Vectors may not exist.")
                    deletion_errors.append(f"Pinecone deletion skipped: Namespace '{org_id}' not found. Vectors may not have been stored.")
                else:
                    deletion_errors.append(f"Pinecone deletion failed: {error_str}")
                    logger.error(f"Failed to delete from Pinecone: {error_str}")
        elif is_url_data_source:
            logger.info(f"Skipping Pinecone deletion for URL data source: {url}")
        elif not org_id:
            deletion_errors.append("Pinecone deletion skipped: Organization ID not found")
            logger.warning(f"Pinecone deletion skipped for file_id {file_id}: org_id not found")
        elif not file_key:
            logger.info(f"Skipping Pinecone deletion: No file_key found (may be URL data source or incomplete record)")
        
        # 3. Delete from MongoDB
        try:
            # Use actual_file_id from document, fallback to search_file_id
            delete_result = collection.delete_one({"file_id": actual_file_id})
            if delete_result.deleted_count == 0:
                # Fallback: try with the original file_id parameter
                collection.delete_one({"file_id": file_id})
            logger.info(f"Deleted data source record from MongoDB: file_id={actual_file_id}")
        except Exception as e:
            deletion_errors.append(f"MongoDB deletion failed: {str(e)}")
            logger.error(f"Failed to delete from MongoDB: {str(e)}")
        
        mongo_client.close()
        
        # Return success even if some deletions failed (partial success)
        if deletion_errors:
            return {
                "status": "partial_success",
                "message": "File deletion completed with some errors",
                "file_id": file_id,
                "file_key": file_key,
                "errors": deletion_errors
            }
        
        return {
            "status": "success",
            "message": "File deleted successfully from all storage systems",
            "file_id": file_id,
            "file_key": file_key
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting file {file_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

@app.put("/data-source/{file_id}")
async def update_data_source(file_id: str, request: dict = Body(...)):
    """
    Update tags and description for a data source file.
    """
    try:
        file_id = file_id.rstrip('/')
        
        tags = request.get("tags")
        description = request.get("description")
        
        if tags is None and description is None:
            raise HTTPException(status_code=400, detail="At least one of 'tags' or 'description' must be provided")
        
        username = urllib.parse.quote_plus("techbrewra")
        password = urllib.parse.quote_plus("Brewra@Best09")
        mongo_uri = f"mongodb+srv://{username}:{password}@brewra-db.d3hvuf8.mongodb.net/?retryWrites=true&w=majority&appName=brewra-db"
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["File_Processing"]
        collection = db["file_status"]
        
        file_doc = collection.find_one({"file_id": file_id})
        if not file_doc:
            file_doc = collection.find_one({"file_key": file_id})
            if not file_doc:
                mongo_client.close()
                raise HTTPException(status_code=404, detail=f"File with id '{file_id}' not found")
        
        update_doc = {}
        
        if tags is not None:
            if isinstance(tags, str):
                try:
                    tags_list = json.loads(tags)
                    if not isinstance(tags_list, list):
                        tags_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
                except (json.JSONDecodeError, AttributeError):
                    tags_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
            elif isinstance(tags, list):
                tags_list = tags
            else:
                raise HTTPException(status_code=400, detail="tags must be a list or comma-separated string")
            update_doc["tags"] = tags_list
        
        if description is not None:
            if not isinstance(description, str):
                raise HTTPException(status_code=400, detail="description must be a string")
            update_doc["description"] = description
        
        collection.update_one(
            {"file_id": file_doc.get("file_id") or file_doc.get("file_key")},
            {"$set": update_doc}
        )
        
        mongo_client.close()
        
        return {
            "status": "success",
            "message": "Data source updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update file: {str(e)}")
