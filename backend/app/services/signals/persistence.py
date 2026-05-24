"""Persistence layer for signals/ -- Mongo writes/reads for signal records.

Public symbol re-exported from __init__.py: record_signal_action.
Internal helpers (prefix _) extracted from orchestrator bodies during
Phase H. All sync (use asyncio.to_thread at the call site for async
contexts; mirrors the original inline code's wrapping).
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.core.exceptions import (
    ServiceError,
    SignalActionValidationError,
    SignalNotFoundError,
)
from app.models.signals import SignalActionRequest


def _load_signals_for_user(
    mongo,
    user_id: str,
    limit: int,
    offset: int,
) -> Tuple[List[Dict[str, Any]], int]:
    """Mongo read for the signals collection: returns (items, total) for a
    user, newest first. Extracted from fetch_signals body during Phase H."""
    db = mongo["Signals"]
    collection = db["signals"]
    flt = {"user_id": user_id}

    signals_cursor = collection.find(flt).sort("timestamp", -1).skip(offset).limit(limit)

    signals_list = []
    for signal in signals_cursor:
        signal.pop("_id", None)
        if "signal_id" not in signal and "id" in signal:
            signal["signal_id"] = signal["id"]
        elif "id" not in signal and "signal_id" in signal:
            signal["id"] = signal["signal_id"]
        signals_list.append(signal)

    total = collection.count_documents(flt)
    return signals_list, total


def _get_latest_signal_for_user_agent(
    mongo, user_id: str, agent_name: str
) -> Optional[Dict[str, Any]]:
    """Fetch the most recent signal for a (user_id, agent_name) pair, or
    None if no signal exists. _id is stripped from the returned dict."""
    collection = mongo["Signals"]["signals"]
    latest = collection.find_one(
        {"user_id": user_id, "agent": agent_name},
        sort=[("timestamp", -1)],
    )
    if latest is None:
        return None
    latest.pop("_id", None)
    return latest


def _get_existing_headlines(mongo, track_key: str) -> List[str]:
    """Fetch existing signal headlines for a track_key (org_id when present
    else 'user_<user_id>'). Returns empty list if no track doc exists or
    has no headlines."""
    track_collection = mongo["Signals"]["signal_track"]
    track_doc = track_collection.find_one({"_id": track_key})
    if track_doc and track_doc.get("headlines"):
        return track_doc.get("headlines", [])
    return []


def _get_user_icp_config(mongo, user_id: str) -> Optional[Dict[str, Any]]:
    """Fetch ICP config for a user from Profiler.ICP_config. Returns the
    raw doc or None; _id is preserved (callers read .get('icps') only)."""
    return mongo["Profiler"]["ICP_config"].find_one({"user_id": user_id})


def _save_signal_and_track_headline(
    mongo, signals_result: Dict[str, Any], track_key: Optional[str]
) -> None:
    """Atomic-pair Mongo write: insert the signal into Signals.signals,
    then (if headline present and track_key is not None) upsert that
    headline into Signals.signal_track[_id=track_key].headlines via
    $addToSet. Consolidates 3 copy-pasted blocks from run_signals_research
    and _generate_signals_batch_impl."""
    db = mongo["Signals"]
    db["signals"].insert_one(signals_result)

    if signals_result.get("headline") and track_key:
        db["signal_track"].update_one(
            {"_id": track_key},
            {
                "$addToSet": {"headlines": signals_result.get("headline")},
                "$set": {"last_updated": datetime.now(timezone.utc)},
            },
            upsert=True,
        )


def _get_signal_ask_customer_profile(
    mongo, org_id: str
) -> Optional[Dict[str, Any]]:
    """Fetch the customer profile (ICPs) for an org from Profiler.
    Company_Profile. Returns {'icps': [...]} or None. _id is stripped from
    each ICP entry. Used by signal_ask and signal_ask_claude."""
    document = mongo["Profiler"]["Company_Profile"].find_one(
        {"profile_type": "company", "org_id": org_id}
    )
    if not document:
        return None
    customer_profiles = document.get("customer_profiles", {})
    icps = customer_profiles.get("icps", [])
    for icp in icps:
        icp.pop("_id", None)
    return {"icps": icps}


async def record_signal_action(mongo, request: SignalActionRequest) -> dict:
    """Accept or reject a signal."""
    db = mongo["Signals"]
    collection = db["signals"]

    # Find the signal by signal_id (check both "id" and "signal_id" fields)
    signal = collection.find_one({
        "$or": [
            {"id": request.signal_id},
            {"signal_id": request.signal_id}
        ]
    })

    if not signal:
        raise SignalNotFoundError(f"Signal with signal_id {request.signal_id} not found")

    if request.action == "accept":
        # Update the signal to ensure it has the org_id
        update_result = collection.update_one(
            {"_id": signal["_id"]},
            {
                "$set": {
                    "org_id": request.org_id,
                    "status": "accepted",
                    "actioned_at": datetime.now(timezone.utc)
                }
            }
        )

        if update_result.modified_count > 0:
            return {
                "status": "success",
                "message": f"Signal {request.signal_id} accepted and assigned to org {request.org_id}",
                "signal_id": request.signal_id,
                "org_id": request.org_id,
                "action": "accept"
            }
        else:
            return {
                "status": "success",
                "message": f"Signal {request.signal_id} already has org_id {request.org_id}",
                "signal_id": request.signal_id,
                "org_id": request.org_id,
                "action": "accept"
            }

    elif request.action == "reject":
        # Delete the signal
        delete_result = collection.delete_one({"_id": signal["_id"]})

        if delete_result.deleted_count > 0:
            return {
                "status": "success",
                "message": f"Signal {request.signal_id} rejected and deleted",
                "signal_id": request.signal_id,
                "action": "reject"
            }
        else:
            raise ServiceError("Failed to delete signal")
    else:
        raise SignalActionValidationError(
            f"Invalid action: {request.action}. Must be 'accept' or 'reject'"
        )
