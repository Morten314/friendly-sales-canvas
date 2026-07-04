"""Org-lead fetch for signal-generation pre-data (spec 47).

Shared by search.py and batch.py. Caps the fetch by the admin `lead_fetch_limit`
setting and is caller-tolerant: any failure yields an empty list so signal
generation still proceeds.
"""
from typing import Any, Dict, List

from app.core.logging import logger
from app.services.leads import get_leads_for_org
from app.services.settings import get_app_settings


def fetch_org_leads_for_signals(driver, mongo, org_id: str) -> List[Dict[str, Any]]:
    try:
        limit = get_app_settings(mongo).lead_fetch_limit
        leads, _ = get_leads_for_org(driver, org_id=org_id, limit=limit, offset=0)
        return leads
    except Exception as e:  # noqa: BLE001 — leads are optional pre-data enrichment
        logger.warning(f"Could not fetch leads for signals: {e}")
        return []
