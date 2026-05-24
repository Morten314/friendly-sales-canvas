"""market_scoring service — public API (Phase H Sequence A final form).

Service for triggering, monitoring, and reading per-lead market scores.
Submodules:
  - orchestrator.py: trigger_or_get_market_scores, get_market_scores_status,
    get_lead_market_score_descriptions, get_market_reports_for_org,
    score_single_lead_against_market, _persist_market_score_for_lead
  - persistence.py: Mongo + Neo4j I/O — get_company_profile_for_org,
    _ensure_market_scoring_indexes, _get_latest_market_score_rows,
    _get_market_score_collections, _get_lead_identity_from_neo4j,
    _get_latest_scoring_run
  - normalization.py: pure data shapers — _safe_json_to_obj,
    _extract_company_name / _lead_name, _parse_iso_datetime, etc.
  - scoring.py: _lead_to_score_row, _is_stale_queued_run,
    _run_market_scoring_for_org (background task body)

§3.7 _-prefix exceptions re-exported below: _ensure_market_scoring_indexes
(lifespan), _run_market_scoring_for_org (unit-test import),
_get_latest_market_score_rows (unit-test import).
"""

from app.services.market_scoring.orchestrator import (
    trigger_or_get_market_scores,
    get_market_scores_status,
    get_lead_market_score_descriptions,
    get_market_reports_for_org,
    score_single_lead_against_market,
)
from app.services.market_scoring.persistence import (
    get_company_profile_for_org,
    _ensure_market_scoring_indexes,
    _get_latest_market_score_rows,
)
from app.services.market_scoring.scoring import (
    _run_market_scoring_for_org,
)

__all__ = [
    "trigger_or_get_market_scores",
    "get_market_scores_status",
    "get_lead_market_score_descriptions",
    "get_company_profile_for_org",
    "get_market_reports_for_org",
    "score_single_lead_against_market",
    "_ensure_market_scoring_indexes",
    "_run_market_scoring_for_org",
    "_get_latest_market_score_rows",
]
