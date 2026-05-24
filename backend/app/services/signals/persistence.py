"""Persistence layer for signals/ -- Mongo writes/reads for signal records.

Public symbol re-exported from __init__.py: record_signal_action.
Internal helper (prefix _): _load_signals_for_user extracted from
fetch_signals body during Phase H.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

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
