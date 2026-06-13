"""Apollo warmup readiness + ICP helpers (spec §5.4, §5.5)."""
from __future__ import annotations

import logging
import sys
from typing import Any, Dict, List, Optional, Tuple

# Required ICP fields in display order; the first empty one is the "missing section".
_REQUIRED_ICP_FIELDS: List[str] = [
    "primary_region", "industry", "company_size", "buyer_role", "fit_confidence",
]


def _is_filled(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, (list, str)):
        return len(value) > 0
    return True


def icp_is_complete(icp: Optional[Dict[str, Any]]) -> Tuple[bool, Optional[str]]:
    """True when every required ICP field is populated; else (False, first-missing)."""
    if not icp:
        return False, _REQUIRED_ICP_FIELDS[0]
    for field in _REQUIRED_ICP_FIELDS:
        if not _is_filled(icp.get(field)):
            return False, field
    return True, None


def _company_profile_doc(mongo, org_id: str) -> Dict[str, Any]:
    return mongo["Profiler"]["Company_Profile"].find_one(
        {"profile_type": "company", "org_id": org_id}
    ) or {}


def _icps_for_org(mongo, org_id: str) -> List[Dict[str, Any]]:
    doc = _company_profile_doc(mongo, org_id)
    cp = doc.get("customer_profiles") or {}
    icps = cp.get("icps") if isinstance(cp, dict) else None
    return [i for i in (icps or []) if isinstance(i, dict)]


def get_active_icp(mongo, org_id: str, icp_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """Resolve the ICP to discover against: by id, else most-recently-created."""
    icps = _icps_for_org(mongo, org_id)
    if not icps:
        return None
    if icp_id:
        for icp in icps:
            if str(icp.get("id")) == str(icp_id):
                return icp
    return max(icps, key=lambda i: str(i.get("created_at") or ""))


# ---------------------------------------------------------------------------
# Four-milestone warmup readiness (spec §5.4)
# ---------------------------------------------------------------------------

_MILESTONES = [
    ("icp_configured", "ICP — fully configured", "icp"),
    ("signals_generated", "Signals — first run", "signals"),
    ("scout_completed", "Scout — first market research", "scout"),
    ("profiler_analyzed", "Profiler — initial ICP analysis", "profiler"),
]


def _icp_configured(mongo, org_id: str, user_id: str) -> bool:
    for icp in _icps_for_org(mongo, org_id):
        if icp_is_complete(icp)[0]:
            return True
    return False


def _signals_generated(mongo, org_id: str, user_id: str) -> bool:
    return mongo["Signals"]["signals"].find_one({"org_id": org_id}) is not None


def _scout_completed(mongo, org_id: str, user_id: str) -> bool:
    return mongo["Scout_Agent"]["Market_Intelligence"].find_one({"org_id": org_id}) is not None


def _profiler_analyzed(mongo, org_id: str, user_id: str) -> bool:
    doc = mongo["Profiler"]["ICP_config"].find_one({"user_id": user_id})
    if not doc:
        return False
    icps = doc.get("icps")
    # ICP_config stores `icps` as `{"suggestedICPs": [...]}`. A truthy-but-empty wrapper
    # ({"suggestedICPs": []}) must NOT count as analyzed, so inspect the nested list.
    if isinstance(icps, dict):
        return bool(icps.get("suggestedICPs"))
    return bool(icps)  # tolerate a bare-list shape


_logger = logging.getLogger(__name__)


def get_warmup_status(mongo, org_id: str, user_id: str) -> Dict[str, Any]:
    """Fan across the four stores via the single Mongo client. Each check is
    wrapped: a query error degrades that milestone to False (never raises)."""
    result: Dict[str, Any] = {}
    missing: List[Dict[str, str]] = []
    ready = 0
    _this_module = sys.modules[__name__]
    for key, label, hint in _MILESTONES:
        try:
            fn = getattr(_this_module, "_" + key)
            ok = bool(fn(mongo, org_id, user_id))
        except Exception as exc:  # noqa: BLE001 — degrade, don't 500 the whole signal
            _logger.warning("warmup check %s failed (org_id=%s): %s", key, org_id, exc)
            ok = False
        result[key] = ok
        if ok:
            ready += 1
        else:
            missing.append({"step": key, "label": label, "deep_link_hint": hint})
    result["ready_count"] = ready
    result["unlocked"] = ready == 4
    result["missing"] = missing
    return result
