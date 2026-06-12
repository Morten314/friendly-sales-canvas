"""Apollo warmup readiness + ICP helpers (spec §5.4, §5.5)."""
from __future__ import annotations

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
