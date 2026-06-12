"""Apollo ICP-discovery pipeline helpers (spec §5.2). Pure functions; no I/O
except the LLM call in rerank_candidates."""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Dict, List

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


# company_size buckets are Apollo-style "min-max" strings; map to a numeric range.
def _size_range(bucket: str):
    bucket = str(bucket).replace(",", "").strip()
    if "-" in bucket:
        lo, _, hi = bucket.partition("-")
        try:
            return int(lo), (int(hi) if hi.strip() else 10 ** 9)
        except ValueError:
            return None
    if bucket.endswith("+"):
        try:
            return int(bucket[:-1]), 10 ** 9
        except ValueError:
            return None
    return None


def _norm_set(values) -> set:
    return {str(v).strip().lower() for v in (values or []) if v}


def passes_hard_dimensions(candidate: Dict[str, Any], icp: Dict[str, Any]) -> bool:
    """Drop only on ZERO overlap against a hard ICP dimension (spec §5.2 step 3):
    title/seniority vs buyer_role, org industry vs industry[], org size vs company_size[].
    A dimension that's absent on the candidate is not a drop (Apollo data is sparse)."""
    org = candidate.get("organization") or {}

    roles = _norm_set(icp.get("buyer_role"))
    title = str(candidate.get("title") or "").strip().lower()
    seniority = str(candidate.get("seniority") or "").strip().lower()
    if roles and (title or seniority):
        if not any(r in title or r in seniority or title in r for r in roles):
            return False

    industries = _norm_set(icp.get("industry"))
    cand_industry = str(org.get("industry") or "").strip().lower()
    if industries and cand_industry:
        if not any(i in cand_industry or cand_industry in i for i in industries):
            return False

    emp = org.get("estimated_num_employees")
    size_buckets = [r for r in (_size_range(b) for b in (icp.get("company_size") or [])) if r]
    if size_buckets and isinstance(emp, (int, float)):
        if not any(lo <= emp <= hi for lo, hi in size_buckets):
            return False

    return True


def score_icp_fit(candidate: Dict[str, Any], icp: Dict[str, Any]) -> float:
    """Cheap deterministic fit score in [0,1] for ranking the funnel survivors
    (and the LLM-rerank fallback). Weighted: title 0.35, industry 0.35, size 0.15, geo 0.15
    (spec §5.2 step 3 lists geo as a scoring component alongside title/industry/size)."""
    org = candidate.get("organization") or {}
    score = 0.0

    roles = _norm_set(icp.get("buyer_role"))
    title = str(candidate.get("title") or "").strip().lower()
    if roles and title and any(r in title or title in r for r in roles):
        score += 0.35

    industries = _norm_set(icp.get("industry"))
    cand_industry = str(org.get("industry") or "").strip().lower()
    if industries and cand_industry and any(i in cand_industry or cand_industry in i for i in industries):
        score += 0.35

    emp = org.get("estimated_num_employees")
    size_buckets = [r for r in (_size_range(b) for b in (icp.get("company_size") or [])) if r]
    if size_buckets and isinstance(emp, (int, float)) and any(lo <= emp <= hi for lo, hi in size_buckets):
        score += 0.15

    icp_locs = _norm_set(list(icp.get("location") or [])
                         + ([icp["primary_region"]] if icp.get("primary_region") else []))
    cand_loc = " ".join(str(candidate.get(k) or "")
                        for k in ("country", "state", "city", "present_raw_address")).strip().lower()
    if icp_locs and cand_loc and any(loc in cand_loc for loc in icp_locs):
        score += 0.15

    return round(score, 3)
