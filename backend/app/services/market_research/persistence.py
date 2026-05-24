"""Persistence layer for market_research/ — Mongo reads/writes for assembled
market-research reports stored in Scout_Agent.Market_Intelligence.

All helpers are synchronous; the orchestrator wraps them in
``asyncio.to_thread`` at call sites to preserve the original async semantics
of ``run_market_research``. Internal-only — no re-export from __init__.py.
"""
from typing import Optional


def _get_market_intelligence_collection(mongo):
    """Return the Scout_Agent.Market_Intelligence Mongo collection handle.

    Extracted from run_market_research body during Phase H to centralize the
    database/collection name lookup.
    """
    return mongo["Scout_Agent"]["Market_Intelligence"]


def _find_latest_market_research_report(
    mongo, user_id: str, component_name: str
) -> Optional[dict]:
    """Return the most recent Market_Intelligence document for a user +
    component, or None if no prior report exists. The Mongo `_id` is stripped
    so the caller can return the result directly.
    """
    collection = _get_market_intelligence_collection(mongo)
    query = {"user_id": user_id, "component_name": component_name}
    latest_report = collection.find_one(query, sort=[("timestamp", -1)])
    if latest_report is None:
        return None
    latest_report.pop("_id", None)
    return latest_report


def _insert_market_research_report(mongo, report: dict) -> None:
    """Insert a fully-assembled market-research report. Mutates ``report`` to
    add the Mongo-assigned ``_id``; caller is expected to pop it before
    returning the dict to HTTP clients.
    """
    collection = _get_market_intelligence_collection(mongo)
    collection.insert_one(report)
