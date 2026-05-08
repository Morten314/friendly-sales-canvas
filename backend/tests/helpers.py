"""Test helpers — most importantly, scrub_dynamic for snapshot stability."""
from typing import Any


DEFAULT_SCRUB_KEYS = {
    "lead_id", "icp_id", "signal_id", "file_id", "file_key",
    "created_at", "updated_at", "timestamp", "_id", "task_id",
    "session_id", "request_id", "trace_id",
}


def scrub_dynamic(obj: Any, keys: set[str] | None = None,
                  placeholder: str = "<scrubbed>") -> Any:
    """Recursively replace values for keys in `keys` with `placeholder`.

    Used to make snapshots stable across runs that produce real UUIDs/timestamps.

    Args:
        obj: Dict, list, or scalar.
        keys: Set of keys to scrub. Defaults to DEFAULT_SCRUB_KEYS.
        placeholder: Replacement value.

    Returns:
        New object with scrubbed values; original is not mutated.
    """
    keys = keys if keys is not None else DEFAULT_SCRUB_KEYS

    if isinstance(obj, dict):
        return {
            k: (placeholder if k in keys else scrub_dynamic(v, keys, placeholder))
            for k, v in obj.items()
        }
    if isinstance(obj, list):
        return [scrub_dynamic(item, keys, placeholder) for item in obj]
    return obj
