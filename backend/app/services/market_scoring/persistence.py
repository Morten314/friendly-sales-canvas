"""Persistence layer for market_scoring/ — Mongo and Neo4j I/O helpers.

Public re-exports (§3.7): _ensure_market_scoring_indexes (lifespan),
_get_latest_market_score_rows (unit test), get_company_profile_for_org.

Normalization helpers (_extract_company_name, _extract_lead_name,
_normalize_non_empty_string, _lead_to_score_row) come from normalization.py
at module top.
"""
import json
from typing import Any, Dict, List, Optional

from app.models.market_scoring import LeadMarketScoreRow
from app.services.market_scoring.normalization import (
    _extract_company_name,
    _extract_lead_name,
    _lead_to_score_row,
    _normalize_non_empty_string,
)


def _ensure_market_scoring_indexes(mongo) -> None:
    """Create Mongo indexes for Lead_Market_Scores and Lead_Market_Score_Runs.
    Idempotent — `create_index` is a no-op when an equivalent index exists.
    """
    if mongo is None:
        return
    score_coll, run_coll = _get_market_score_collections(mongo)
    score_coll.create_index([("org_id", 1), ("lead_id", 1)], unique=True)
    score_coll.create_index([("org_id", 1), ("updated_at", -1)])
    run_coll.create_index([("org_id", 1), ("status", 1)])
    run_coll.create_index([("org_id", 1), ("created_at", -1)])


def _get_market_score_collections(mongo):
    # Returns only the collections — never the client. Callers MUST NOT close
    # the underlying connection; it is the shared singleton from app.core.clients.
    profiler_db = mongo["Profiler"]
    return profiler_db["Lead_Market_Scores"], profiler_db["Lead_Market_Score_Runs"]


def _get_lead_identity_from_neo4j(driver, org_id: str, lead_id: str) -> Dict[str, Optional[str]]:
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


def _get_latest_market_score_rows(
    driver,
    mongo,
    org_id: str,
    limit: int = 500,
    offset: int = 0,
) -> tuple[List[LeadMarketScoreRow], int]:
    score_coll, _ = _get_market_score_collections(mongo)
    flt = {"org_id": org_id}
    total = score_coll.count_documents(flt)
    docs = list(
        score_coll.find(flt).sort("updated_at", -1).skip(offset).limit(limit)
    )
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
    return rows, total


def _get_latest_scoring_run(mongo, org_id: str) -> Optional[Dict[str, Any]]:
    _, run_coll = _get_market_score_collections(mongo)
    run_doc = run_coll.find_one({"org_id": org_id}, sort=[("created_at", -1)])
    if not run_doc:
        return None
    run_doc.pop("_id", None)
    return run_doc


def get_company_profile_for_org(driver, org_id: str) -> Dict[str, Any]:
    """Fetch a single company profile for an org."""
    with driver.session() as session:
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
