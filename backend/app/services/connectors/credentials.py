"""Per-org connector credential storage (Mongo Profiler.Connector_Credentials).

One doc per (org_id, provider). Stored unencrypted by deliberate MVP posture
(spec §5.4 — conscious risk acceptance; do NOT add encryption/authz here).
"""
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.core.exceptions import ConnectorNotConnectedError
from app.services.connectors.runs import DISCOVERY_RUNS_COLLECTION

CREDENTIALS_COLLECTION = "Connector_Credentials"
ENRICH_RUNS_COLLECTION = "Connector_Enrich_Runs"


def _coll(mongo):
    return mongo["Profiler"][CREDENTIALS_COLLECTION]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_connectors_indexes(mongo) -> None:
    """Create Mongo indexes for the connector collections.
    Idempotent — `create_index` is a no-op when an equivalent index exists.
    """
    if mongo is None:
        return
    creds = mongo["Profiler"][CREDENTIALS_COLLECTION]
    creds.create_index([("org_id", 1), ("provider", 1)], unique=True)

    runs = mongo["Profiler"][ENRICH_RUNS_COLLECTION]
    runs.create_index([("org_id", 1), ("status", 1)])
    runs.create_index([("org_id", 1), ("created_at", -1)])
    runs.create_index("run_id", unique=True)

    discovery = mongo["Profiler"][DISCOVERY_RUNS_COLLECTION]
    discovery.create_index([("org_id", 1), ("status", 1)])
    discovery.create_index([("org_id", 1), ("created_at", -1)])
    discovery.create_index("run_id", unique=True)


def save_credentials(mongo, org_id: str, provider: str, api_key: str, status: str = "connected") -> Dict[str, Any]:
    now = _now()
    _coll(mongo).update_one(
        {"org_id": org_id, "provider": provider},
        {
            "$set": {
                "org_id": org_id,
                "provider": provider,
                "api_key": api_key,
                "status": status,
                "updated_at": now,
            },
            "$setOnInsert": {"connected_at": now},
        },
        upsert=True,
    )
    # Read back the stored doc so the returned connected_at reflects the persisted value.
    # On insert: connected_at == now. On update: $setOnInsert is a no-op, so connected_at
    # is the original insertion time — which is what callers need.
    stored = get_credentials(mongo, org_id, provider) or {}
    connected_at = stored.get("connected_at", now)
    return {"org_id": org_id, "provider": provider, "status": status, "connected_at": connected_at}


def get_credentials(mongo, org_id: str, provider: str) -> Optional[Dict[str, Any]]:
    doc = _coll(mongo).find_one({"org_id": org_id, "provider": provider})
    if doc:
        doc.pop("_id", None)
    return doc


def get_api_key(mongo, org_id: str, provider: str = "apollo") -> str:
    doc = get_credentials(mongo, org_id, provider)
    if not doc or not doc.get("api_key"):
        raise ConnectorNotConnectedError(f"No {provider} credentials connected for this org.")
    return str(doc["api_key"])


def set_status(mongo, org_id: str, provider: str, status: str) -> None:
    _coll(mongo).update_one(
        {"org_id": org_id, "provider": provider},
        {"$set": {"status": status, "updated_at": _now()}},
    )


def delete_credentials(mongo, org_id: str, provider: str) -> bool:
    result = _coll(mongo).delete_one({"org_id": org_id, "provider": provider})
    return bool(getattr(result, "deleted_count", 0))
