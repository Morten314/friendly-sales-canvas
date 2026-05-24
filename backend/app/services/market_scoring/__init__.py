"""market_scoring service — package skeleton (Phase H commit 1/M).

All code lives in orchestrator.py for now; subsequent commits extract
persistence.py, normalization.py, and scoring.py. __init__.py re-exports
the public surface plus the §3.7 _-prefix exceptions.
"""

from app.services.market_scoring.orchestrator import (
    trigger_or_get_market_scores,
    get_market_scores_status,
    get_lead_market_score_descriptions,
    get_company_profile_for_org,
    get_market_reports_for_org,
    score_single_lead_against_market,
    _ensure_market_scoring_indexes,
    _run_market_scoring_for_org,
    _get_latest_market_score_rows,
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
