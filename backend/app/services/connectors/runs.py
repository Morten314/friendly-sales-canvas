"""Connector run/batch tracking — separate from writes (ingestion.py).

Import batches reuse Profiler.Lead_Stream_Files (so the existing by-file CRUD +
stream-status surface lights up); enrich runs use Profiler.Connector_Enrich_Runs,
mirroring the market-scoring run-doc + stale-run failover (spec §5.5).
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.exceptions import ConnectorEnrichRunNotFoundError

logger = logging.getLogger(__name__)

LEAD_STREAM_FILES_COLLECTION = "Lead_Stream_Files"
ENRICH_RUNS_COLLECTION = "Connector_Enrich_Runs"

_STALE_AFTER_SECONDS = 300
_MAX_ERRORS = 10
_MAX_ERROR_MESSAGE_LEN = 300


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


# ─── Import batches (Lead_Stream_Files) ───

def _files_coll(mongo):
    return mongo["Profiler"][LEAD_STREAM_FILES_COLLECTION]


def create_import_batch(mongo, org_id: str, user_id: str, filename: str) -> str:
    """Mint a file_id and insert a 'processing' Lead_Stream_Files doc (apollo source)."""
    file_id = str(uuid.uuid4())
    now = _now()
    _files_coll(mongo).insert_one({
        "file_id": file_id,
        "user_id": user_id,
        "org_id": org_id,
        "filename": filename,
        "source": "apollo",
        "uploaded_at": now,
        "processing_status": "processing",
        "total_rows": 0,
        "created_count": 0,
        "matched_count": 0,
        "error_count": 0,
        "capped": False,
        "last_processed_at": now,
    })
    return file_id


def update_import_filename(mongo, file_id: str, filename: str) -> None:
    _files_coll(mongo).update_one({"file_id": file_id}, {"$set": {"filename": filename}})


def update_import_progress(mongo, file_id: str, *, created_count: int, matched_count: int, error_count: int) -> None:
    _files_coll(mongo).update_one(
        {"file_id": file_id},
        {"$set": {
            "created_count": created_count,
            "matched_count": matched_count,
            "error_count": error_count,
            "last_processed_at": _now(),
        }},
    )


def complete_import_batch(
    mongo, file_id: str, *, total_rows: int, created_count: int, matched_count: int,
    error_count: int, capped: bool, message: Optional[str] = None,
) -> None:
    fields = {
        "processing_status": "completed",
        "total_rows": total_rows,
        "created_count": created_count,
        "matched_count": matched_count,
        "error_count": error_count,
        "capped": capped,
        "last_processed_at": _now(),
    }
    if message:
        fields["message"] = message
    _files_coll(mongo).update_one({"file_id": file_id}, {"$set": fields})


def fail_import_batch(mongo, file_id: str, message: str) -> None:
    _files_coll(mongo).update_one(
        {"file_id": file_id},
        {"$set": {"processing_status": "failed", "message": message, "last_processed_at": _now()}},
    )


# ─── Enrich runs (Connector_Enrich_Runs) ───

def _runs_coll(mongo):
    return mongo["Profiler"][ENRICH_RUNS_COLLECTION]


def _is_stale_run(run_doc: Dict[str, Any], stale_after_seconds: int = _STALE_AFTER_SECONDS) -> bool:
    """A queued OR processing run is stale when its most-recent activity timestamp
    is older than the window (or absent). A healthy processing run advances
    `updated_at` every chunk, so this never reclaims a live run."""
    if str(run_doc.get("status", "")).lower() not in ("queued", "processing"):
        return False
    reference = (
        _parse_iso(run_doc.get("updated_at"))
        or _parse_iso(run_doc.get("started_at"))
        or _parse_iso(run_doc.get("created_at"))
    )
    if reference is None:
        return True
    return (datetime.now(timezone.utc) - reference).total_seconds() >= stale_after_seconds


def create_enrich_run(mongo, org_id: str, user_id: str, total: int) -> str:
    run_id = str(uuid.uuid4())
    now = _now()
    _runs_coll(mongo).insert_one({
        "run_id": run_id,
        "org_id": org_id,
        "user_id": user_id,
        "status": "queued",
        "total": total,
        "processed": 0,
        "updated": 0,
        "unmatched": 0,
        "failed": 0,
        "skipped": 0,
        "errors": [],
        "created_at": now,
        "updated_at": now,
        "started_at": None,
        "finished_at": None,
    })
    return run_id


def _update_run(mongo, run_id: str, **fields) -> None:
    fields["updated_at"] = _now()
    _runs_coll(mongo).update_one({"run_id": run_id}, {"$set": fields})


def mark_enrich_processing(mongo, run_id: str) -> None:
    _update_run(mongo, run_id, status="processing", started_at=_now())


def update_enrich_progress(mongo, run_id: str, *, processed: int, updated: int, unmatched: int, failed: int, errors: List[str], skipped: int = 0) -> None:
    _update_run(mongo, run_id, processed=processed, updated=updated, unmatched=unmatched, failed=failed, skipped=skipped, errors=errors[:_MAX_ERRORS])


def complete_enrich_run(mongo, run_id: str, *, processed: int, updated: int, unmatched: int, failed: int, errors: List[str], skipped: int = 0, status: str = "completed") -> None:
    _update_run(
        mongo, run_id, status=status, processed=processed, updated=updated,
        unmatched=unmatched, failed=failed, skipped=skipped, errors=errors[:_MAX_ERRORS], finished_at=_now(),
    )


def fail_enrich_run(mongo, run_id: str, message: str) -> None:
    _update_run(mongo, run_id, status="failed", errors=[message[:_MAX_ERROR_MESSAGE_LEN]], finished_at=_now())


def fail_stale_enrich_runs(mongo, org_id: str) -> None:
    """Mark a stale queued/processing run for the org as failed (market-scoring pattern)."""
    coll = _runs_coll(mongo)
    active = coll.find_one(
        {"org_id": org_id, "status": {"$in": ["queued", "processing"]}},
        sort=[("created_at", -1)],
    )
    if active and _is_stale_run(active):
        _update_run(mongo, active["run_id"], status="failed",
                    errors=["Run auto-failed: stale with no progress within the staleness window."],
                    finished_at=_now())
        logger.warning("Failed stale enrich run org_id=%s run_id=%s", org_id, active.get("run_id"))


def get_enrich_run(mongo, org_id: str, run_id: Optional[str]) -> Dict[str, Any]:
    flt: Dict[str, Any] = {"org_id": org_id}
    if run_id:
        flt["run_id"] = run_id
    doc = _runs_coll(mongo).find_one(flt, sort=[("created_at", -1)])
    if not doc:
        raise ConnectorEnrichRunNotFoundError("No enrichment run found for org_id")
    doc.pop("_id", None)
    total = int(doc.get("total") or 0)
    processed = int(doc.get("processed") or 0)
    skipped = int(doc.get("skipped") or 0)
    doc["skipped"] = skipped
    denom = max(total, 1)
    doc["progress_percent"] = round(min(100.0, ((processed + skipped) / denom) * 100.0), 2)
    return doc


# ─── Discovery runs (Connector_Discovery_Runs) ───

DISCOVERY_RUNS_COLLECTION = "Connector_Discovery_Runs"
_DISCOVERY_STALE_BASE_SECONDS = 120
_DISCOVERY_STALE_PER_LEAD_SECONDS = 8


def _discovery_coll(mongo):
    return mongo["Profiler"][DISCOVERY_RUNS_COLLECTION]


def create_discovery_run(
    mongo, org_id: str, user_id: str, *,
    icp_id: Optional[str], icp_fingerprint: str, mode: str, max_leads: int,
) -> str:
    run_id = str(uuid.uuid4())
    now = _now()
    _discovery_coll(mongo).insert_one({
        "run_id": run_id,
        "org_id": org_id,
        "user_id": user_id,
        "icp_id": icp_id,
        "icp_fingerprint": icp_fingerprint,
        "mode": mode,
        "max_leads": max_leads,
        "status": "queued",
        "counts": {
            "searched": 0, "qualified": 0, "selected": 0, "revealed": 0,
            "verified": 0, "unverified": 0, "created": 0, "matched": 0,
            "skipped_duplicates": 0, "errors": [],
        },
        "credits_consumed": 0,
        "created_at": now,
        "updated_at": now,
        "started_at": None,
        "finished_at": None,
        "message": None,
    })
    return run_id


def _update_discovery(mongo, run_id: str, **fields) -> None:
    fields["updated_at"] = _now()
    _discovery_coll(mongo).update_one({"run_id": run_id}, {"$set": fields})


def mark_discovery_processing(mongo, run_id: str) -> None:
    _update_discovery(mongo, run_id, status="processing", started_at=_now())


def update_discovery_progress(
    mongo, run_id: str, *, counts: Dict[str, Any], credits_consumed: int,
) -> None:
    counts = dict(counts)
    counts["errors"] = list(counts.get("errors", []))[:_MAX_ERRORS]
    _update_discovery(mongo, run_id, counts=counts, credits_consumed=credits_consumed)


def complete_discovery_run(
    mongo, run_id: str, *, counts: Dict[str, Any],
    credits_consumed: int, status: str = "completed",
) -> None:
    counts = dict(counts)
    counts["errors"] = list(counts.get("errors", []))[:_MAX_ERRORS]
    _update_discovery(mongo, run_id, status=status, counts=counts,
                      credits_consumed=credits_consumed, finished_at=_now())


def fail_discovery_run(mongo, run_id: str, message: str) -> None:
    _update_discovery(mongo, run_id, status="failed",
                      message=message[:_MAX_ERROR_MESSAGE_LEN], finished_at=_now())


def get_discovery_run(mongo, org_id: str, run_id: Optional[str]) -> Dict[str, Any]:
    flt: Dict[str, Any] = {"org_id": org_id}
    if run_id:
        flt["run_id"] = run_id
    doc = _discovery_coll(mongo).find_one(flt, sort=[("created_at", -1)])
    if not doc:
        raise ConnectorEnrichRunNotFoundError("No discovery run found for org_id")
    doc.pop("_id", None)
    counts = doc.get("counts") or {}
    selected = int(counts.get("selected") or 0)
    revealed = int(counts.get("revealed") or 0)
    denom = max(selected, 1)
    doc["progress_percent"] = (
        round(min(100.0, (revealed / denom) * 100.0), 2)
        if str(doc.get("status")) in ("processing", "queued")
        else 100.0
    )
    return doc


def latest_completed_discovery_run(mongo, org_id: str) -> Optional[Dict[str, Any]]:
    doc = _discovery_coll(mongo).find_one(
        {"org_id": org_id, "status": {"$in": ["completed", "completed_empty", "partial"]}},
        sort=[("finished_at", -1)],
    )
    if doc:
        doc.pop("_id", None)
    return doc


def sum_discovery_credits(mongo, org_id: str) -> int:
    total = 0
    for d in _discovery_coll(mongo).find({"org_id": org_id}, {"credits_consumed": 1}):
        total += int(d.get("credits_consumed") or 0)
    return total


def get_active_discovery_run(mongo, org_id: str) -> Optional[Dict[str, Any]]:
    return _discovery_coll(mongo).find_one(
        {"org_id": org_id, "status": {"$in": ["queued", "processing"]}},
        sort=[("created_at", -1)],
    )


def _is_stale_discovery_run(run_doc: Dict[str, Any]) -> bool:
    if str(run_doc.get("status", "")).lower() not in ("queued", "processing"):
        return False
    reference = (
        _parse_iso(run_doc.get("updated_at"))
        or _parse_iso(run_doc.get("started_at"))
        or _parse_iso(run_doc.get("created_at"))
    )
    if reference is None:
        return True
    window = (
        _DISCOVERY_STALE_BASE_SECONDS
        + _DISCOVERY_STALE_PER_LEAD_SECONDS * int(run_doc.get("max_leads") or 50)
    )
    return (datetime.now(timezone.utc) - reference).total_seconds() >= window


def fail_stale_discovery_runs(mongo, org_id: str) -> Optional[Dict[str, Any]]:
    """Fail a stale queued/processing discovery run; return it so the caller can
    clear any superseded tags it left. No-op when the active run is healthy."""
    active = get_active_discovery_run(mongo, org_id)
    if active and _is_stale_discovery_run(active):
        _update_discovery(
            mongo, active["run_id"],
            status="failed",
            message="Run auto-failed: stale with no progress within the staleness window.",
            finished_at=_now(),
        )
        logger.warning("Failed stale discovery run org_id=%s run_id=%s", org_id, active.get("run_id"))
        return active
    return None
