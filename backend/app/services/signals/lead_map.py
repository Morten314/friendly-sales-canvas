"""Read-time signal↔lead relevance mapping (Claude). See specs/36.

Disposable derived cache in Signals.signal_lead_map, keyed per (org, user).
No signal-schema change; no persisted hard link.
"""

import hashlib
from typing import Any, Dict, List, Optional

_CACHE_DB = "Signals"
_CACHE_COLL = "signal_lead_map"


def _signal_ids(signals: List[Dict[str, Any]]) -> List[str]:
    out: List[str] = []
    for s in signals:
        sid = s.get("signal_id") or s.get("id")
        if sid:
            out.append(str(sid))
    return out


def _lead_ids(leads: List[Dict[str, Any]]) -> List[str]:
    return [str(l.get("lead_id")) for l in leads if l.get("lead_id")]


def _compute_fingerprint(signal_ids: List[str], lead_ids: List[str]) -> str:
    payload = ",".join(sorted(signal_ids)) + "|" + ",".join(sorted(lead_ids))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _cache_key(org_id: str, user_id: str) -> str:
    return f"{org_id}:{user_id}"


def _get_cached_lead_map(mongo, org_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    return mongo[_CACHE_DB][_CACHE_COLL].find_one({"_id": _cache_key(org_id, user_id)})


def _save_lead_map(
    mongo, org_id: str, user_id: str,
    mapping: List[Dict[str, Any]], fingerprint: str, generated_at: str,
) -> None:
    mongo[_CACHE_DB][_CACHE_COLL].update_one(
        {"_id": _cache_key(org_id, user_id)},
        {"$set": {"mapping": mapping, "fingerprint": fingerprint, "generated_at": generated_at}},
        upsert=True,
    )
