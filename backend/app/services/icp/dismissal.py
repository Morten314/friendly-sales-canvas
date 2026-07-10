"""Content-signature dismissed-set for recommended ICPs (spec 48 WS3).

Regeneration re-mints ICP ids (the LLM omits ids; _reserve_unique_icp_id mints a
fresh uuid), so an id-keyed dismissal can't survive a refresh. We instead key on
a canonicalized, lowest-variance content signature. `industry` is ~constant per
company, so `segment` is the effective discriminator — matching is best-effort
(both false-negative re-surface and false-positive over-suppression are accepted
at MVP; see the spec's residual-drift bar). An empty signature is never recorded
and never matched, so firmographics-less ICPs can't collapse onto a degenerate
key that suppresses them all.
"""
import re
from typing import Any, Dict, Optional, Set

DISMISSED_FIELD = "dismissedRecommendedSignatures"


def _canonicalize(value: Any) -> str:
    s = str(value or "").strip().lower()
    s = re.sub(r"[^\w\s]", " ", s)   # replace punctuation with a separator (not a delete)
    s = re.sub(r"\s+", " ", s).strip()  # collapse internal whitespace
    return s


def compute_icp_signature(icp: Dict[str, Any]) -> str:
    """Canonical 'industry|segment' signature, or '' when both are empty."""
    firmographics = icp.get("firmographics") if isinstance(icp, dict) else None
    if not isinstance(firmographics, dict):
        firmographics = {}
    industry = _canonicalize(firmographics.get("industry"))
    segment = _canonicalize(firmographics.get("segment"))
    if not industry and not segment:
        return ""
    return f"{industry}|{segment}"


def read_dismissed_signatures(document: Optional[Dict[str, Any]]) -> Set[str]:
    if not isinstance(document, dict):
        return set()
    raw = document.get(DISMISSED_FIELD)
    if not isinstance(raw, list):
        return set()
    return {str(s) for s in raw if isinstance(s, str) and s}


def with_signature_added(existing: Set[str], signature: str) -> list:
    """Union `signature` into `existing`; empty signature is a no-op. Sorted for
    deterministic persistence."""
    result = set(existing)
    if signature:
        result.add(signature)
    return sorted(result)
