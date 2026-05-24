"""Scoring task body for market_scoring/.

_run_market_scoring_for_org is the background task invoked from
trigger_or_get_market_scores via BackgroundTasks.add_task. Re-exported
from __init__.py per §3.7 (imported by tests/unit/test_market_scoring.py).

Cross-module dependency: _run_market_scoring_for_org calls three
orchestrator-resident helpers (score_single_lead_against_market,
_persist_market_score_for_lead, get_market_reports_for_org) that aren't
moved out as part of Phase H. They're imported lazily inside the function
body to break the orchestrator <-> scoring import cycle.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict

from app.core.exceptions import BrewraError
from app.models.market_scoring import LeadMarketScoreRow, MARKET_SCORE_COMPONENT_KEYS
from app.services.leads import get_leads_for_org
from app.services.market_scoring import persistence
from app.services.market_scoring.normalization import _parse_iso_datetime


logger = logging.getLogger(__name__)


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


def _run_market_scoring_for_org(driver, mongo, llm2, user_id: str, org_id: str, run_id: str) -> None:
    from app.services.market_scoring import orchestrator

    run_coll = None
    try:
        score_coll, run_coll = persistence._get_market_score_collections(mongo)
        now_iso = datetime.now(timezone.utc).isoformat()
        run_coll.update_one(
            {"run_id": run_id},
            {"$set": {"status": "processing", "started_at": now_iso, "updated_at": now_iso}},
        )

        leads, total_leads = get_leads_for_org(driver, org_id=org_id, limit=5000, offset=0)
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

        company_profile = persistence.get_company_profile_for_org(driver, org_id)
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

        market_reports = orchestrator.get_market_reports_for_org(mongo, user_id, org_id)
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
                scoring_payload = orchestrator.score_single_lead_against_market(
                    llm2,
                    lead=lead,
                    company_profile=company_profile,
                    market_reports=market_reports,
                )
                orchestrator._persist_market_score_for_lead(
                    driver,
                    mongo,
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
                orchestrator._persist_market_score_for_lead(
                    driver,
                    mongo,
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
    except BrewraError as e:
        # Typed domain failure — expected category, log at warning.
        logger.warning(
            "Market scoring run failed for org_id=%s run_id=%s: %s",
            org_id, run_id, e,
        )
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
    except Exception as e:
        # Unexpected failure (Neo4j driver, LLM call, etc.) — log at error
        # then mark run failed so the BackgroundTasks runner doesn't
        # swallow the failure silently.
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
