"""Data normalization helpers for market_scoring/.

Pure functions — no I/O, no LLM, no DB. Used by scoring.py, persistence.py,
and orchestrator.py for canonicalizing lead/scoring payloads and parsing
common scalar formats.
"""
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.models.market_scoring import MARKET_SCORE_COMPONENT_KEYS


def _safe_json_to_obj(value: Any) -> Any:
    if isinstance(value, str) and value.strip().startswith(("{", "[")):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


def _normalize_non_empty_string(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _canonicalize_key(key: Any) -> str:
    return "".join(ch.lower() for ch in str(key) if ch.isalnum())


def _build_lookup_maps(payload: Dict[str, Any]) -> Dict[str, Any]:
    lookup: Dict[str, Any] = {}
    for key, value in payload.items():
        canonical = _canonicalize_key(key)
        if canonical and canonical not in lookup:
            lookup[canonical] = value
    return lookup


def _first_non_empty_value_from_keys(payload: Dict[str, Any], aliases: List[str]) -> Optional[str]:
    canonical_lookup = _build_lookup_maps(payload)
    for alias in aliases:
        value = canonical_lookup.get(_canonicalize_key(alias))
        normalized = _normalize_non_empty_string(value)
        if normalized:
            return normalized
    return None


def _extract_company_name(lead: Dict[str, Any]) -> Optional[str]:
    candidate_keys = [
        "company_name",
        "company",
        "Company",
        "account_name",
        "organization",
        "org_name",
        "companyName",
        "comp",
        "comp_name",
        "companyname",
        "org",
        "organization_name",
        "account",
        "business_name",
    ]
    return _first_non_empty_value_from_keys(lead, candidate_keys)


def _extract_lead_name(lead: Dict[str, Any]) -> Optional[str]:
    candidate_keys = [
        "lead_name",
        "name",
        "lead",
        "contact_name",
        "prospect_name",
        "full_name",
        "fullName",
        "fullname",
        "first_name",
        "firstName",
        "firstname",
        "last_name",
        "lastName",
        "lastname",
        "leadName",
        "person_name",
        "contact",
    ]
    top_level_name = _first_non_empty_value_from_keys(lead, candidate_keys)
    if top_level_name:
        return top_level_name

    contact_obj = lead.get("contact")
    if isinstance(contact_obj, dict):
        contact_name = _first_non_empty_value_from_keys(
            contact_obj,
            [
                "name",
                "full_name",
                "fullName",
                "first_name",
                "firstName",
                "last_name",
                "lastName",
                "contact_name",
                "display_name",
            ],
        )
        if contact_name:
            return contact_name
    return None


def _extract_description_preview(component_descriptions: Any) -> Optional[str]:
    if not isinstance(component_descriptions, dict):
        return None
    for component in MARKET_SCORE_COMPONENT_KEYS:
        value = component_descriptions.get(component)
        if isinstance(value, str) and value.strip():
            return value.strip()[:220]
    return None


def _parse_iso_datetime(value: Any) -> Optional[datetime]:
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError:
        return None
