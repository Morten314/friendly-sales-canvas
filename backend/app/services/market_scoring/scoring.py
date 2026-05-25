"""Scoring task body for market_scoring/.

_run_market_scoring_for_org is the background task invoked from
trigger_or_get_market_scores via BackgroundTasks.add_task. Re-exported
from __init__.py per §3.7 (imported by tests/unit/test_market_scoring.py).

Cross-module dependency: _run_market_scoring_for_org calls three
orchestrator-resident helpers (score_single_lead_against_market,
_persist_market_score_for_lead, get_market_reports_for_org). The
orchestrator module is imported at module top; the partial-load case
is handled because scoring only accesses orchestrator.X symbols from
function bodies (by call-time, orchestrator has finished loading).
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict

from app.core.exceptions import BrewraError
from app.models.market_scoring import MARKET_SCORE_COMPONENT_KEYS
from app.services.leads import get_leads_for_org
from app.services.market_scoring import persistence
from app.services.market_scoring.normalization import _parse_iso_datetime
from app.services.market_scoring import orchestrator


logger = logging.getLogger(__name__)


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
