"""Global app-settings store — a single `{_id:"settings"}` document in the
Org_Management DB (spec 47), mirroring the orgs/users singleton pattern.

Read-on-request: each caller resolves the current value with one `_id` lookup,
so an admin edit takes effect on the next request with no cache to invalidate.
Reads never raise — a settings-store failure falls back to defaults so signal
generation and the matched-leads map keep working.
"""
from app.core.logging import logger
from app.models.settings import AppSettings

_DB = "Org_Management"
_COLL = "settings"
_DOC_ID = "settings"


def get_app_settings(mongo) -> AppSettings:
    """Return the stored settings, or defaults if the doc is missing, the read
    errors, or the stored value is malformed."""
    try:
        doc = mongo[_DB][_COLL].find_one({"_id": _DOC_ID})
        if not doc:
            return AppSettings()
        return AppSettings(**{k: v for k, v in doc.items() if k != "_id"})
    except Exception:  # noqa: BLE001 — never break callers on a settings read
        logger.warning("get_app_settings failed; falling back to defaults", exc_info=True)
        return AppSettings()


def update_app_settings(mongo, settings: AppSettings) -> AppSettings:
    """Upsert the settings document and return the stored value."""
    mongo[_DB][_COLL].update_one(
        {"_id": _DOC_ID}, {"$set": settings.model_dump()}, upsert=True
    )
    return settings
