"""Apollo ICP-discovery pipeline helpers (spec §5.2). Pure functions; no I/O
except the LLM call in rerank_candidates."""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Dict, List, Optional

from app.core.exceptions import IcpUnderspecifiedError
from app.services.connectors.warmup import icp_is_complete

logger = logging.getLogger(__name__)

# Fields that define an ICP's identity for change detection (spec §5.7).
_FINGERPRINT_FIELDS = [
    "primary_region", "industry", "company_size", "buyer_role",
    "fit_confidence", "location", "additional_context",
]


def _canon(value: Any) -> Any:
    if isinstance(value, list):
        return sorted(str(v).strip().lower() for v in value if v is not None)
    if isinstance(value, str):
        return value.strip().lower()
    return value


def icp_fingerprint(icp: Dict[str, Any]) -> str:
    """SHA-1 of canonical JSON over the semantic fields (volatile fields excluded).

    SHA-1 here is a plain (non-security) hash: the fingerprint is persisted on the run
    doc and surfaced via /status, so a compact stable key beats storing/re-serialising
    the full normalized JSON on every comparison.
    """
    canon = {f: _canon(icp.get(f)) for f in _FINGERPRINT_FIELDS}
    blob = json.dumps(canon, sort_keys=True, default=str)
    return hashlib.sha1(blob.encode("utf-8")).hexdigest()


def build_search_filters(icp: Dict[str, Any]) -> Dict[str, Any]:
    """Map a complete ICP to Apollo api_search params. Raises IcpUnderspecifiedError
    if the ICP fails the completeness bar (avoids an unbounded, credit-burning search).

    Industry maps to q_organization_keywords (keyword match on names) — NOT
    organization_industry_tag_ids, which needs a numeric tag-ID table we don't have
    (spec §5.2). The step-3 funnel drops industry mismatches the keyword filter lets through.
    """
    ok, missing = icp_is_complete(icp)
    if not ok:
        raise IcpUnderspecifiedError(f"ICP is missing '{missing}' — too underspecified for discovery.")
    # NB: buyer_role maps to person_titles only — NOT person_seniorities. Apollo's
    # person_seniorities filter expects enum values (c_suite/vp/director/manager/...),
    # whereas buyer_role is free text ("VP Sales"); free text sent as a seniority is
    # silently ignored. Mapping common roles -> seniority enums is a future enhancement
    # (this is a deliberate, documented divergence from spec §5.2's "person_seniorities").
    filters: Dict[str, Any] = {
        "person_titles": list(icp.get("buyer_role") or []),
        "organization_num_employees_ranges": list(icp.get("company_size") or []),
        "q_organization_keywords": " ".join(str(i) for i in (icp.get("industry") or [])),
    }
    locations = list(icp.get("location") or [])
    if not locations and icp.get("primary_region"):
        locations = [icp["primary_region"]]
    if locations:
        filters["person_locations"] = locations
    return filters
