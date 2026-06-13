"""Pure normalization helpers — Apollo raw record -> Brewra canonical lead dict.

No I/O. The output dict is consumed by ingestion.py. `apollo_raw` is JSON-encoded
to a string because Neo4j properties cannot hold nested maps; the leads read-path
(`leads/normalization._process_neo4j_lead_records`) re-parses JSON-looking strings.
"""
import json
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

# The fill-only-empty canonical set written flat onto the Lead node (spec §5.1).
CANONICAL_FIELDS: List[str] = [
    "name",
    "first_name",
    "last_name",
    "email",
    "email_status",
    "title",
    "seniority",
    "company_name",
    "company_domain",
    "phone",
    "linkedin_url",
    "location",
]


def normalize_email(value: Optional[str]) -> Optional[str]:
    """lower(trim(email)); empty/None -> None."""
    if not value or not isinstance(value, str):
        return None
    cleaned = value.strip().lower()
    return cleaned or None


def normalize_domain(value: Optional[str]) -> Optional[str]:
    """Strip scheme/path/`www.`, lowercase. empty/None -> None."""
    if not value or not isinstance(value, str):
        return None
    raw = value.strip().lower()
    if not raw:
        return None
    if "://" in raw:
        raw = urlparse(raw).netloc or urlparse(raw).path
    raw = raw.split("/")[0]
    if raw.startswith("www."):
        raw = raw[4:]
    return raw or None


def _domain_from_email(email_norm: Optional[str]) -> Optional[str]:
    if not email_norm or "@" not in email_norm:
        return None
    return email_norm.split("@", 1)[1] or None


def _compose_name(first: Optional[str], last: Optional[str], full: Optional[str]) -> Optional[str]:
    if full and str(full).strip():
        return str(full).strip()
    parts = [p for p in [first, last] if p and str(p).strip()]
    return " ".join(str(p).strip() for p in parts) or None


def _first_phone(raw: Dict[str, Any]) -> Optional[str]:
    phones = raw.get("phone_numbers") or []
    if isinstance(phones, list):
        for p in phones:
            if isinstance(p, dict):
                num = p.get("sanitized_number") or p.get("raw_number") or p.get("number")
                if num:
                    return str(num)
    direct = raw.get("phone") or raw.get("sanitized_phone")
    return str(direct) if direct else None


def _location(raw: Dict[str, Any]) -> Optional[str]:
    parts = [raw.get("city"), raw.get("state"), raw.get("country")]
    parts = [str(p).strip() for p in parts if p and str(p).strip()]
    return ", ".join(parts) or None


def normalize_apollo_record(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Map one Apollo contact/person object to a flat canonical record.

    NOTE: exact Apollo field names are confirmed against recorded fixtures at
    implementation time (spec open question). Mapping is `.get()`-tolerant so a
    missing field yields None rather than KeyError.
    """
    if not isinstance(raw, dict):
        raw = {}
    org = raw.get("organization") or {}
    if not isinstance(org, dict):
        org = {}

    email = raw.get("email")
    email_norm = normalize_email(email)

    company_name = org.get("name") or raw.get("organization_name")
    company_domain_raw = (
        org.get("primary_domain")
        or org.get("website_url")
        or raw.get("organization_domain")
    )
    company_domain = normalize_domain(company_domain_raw)
    company_domain_norm = company_domain or normalize_domain(_domain_from_email(email_norm))

    record: Dict[str, Any] = {
        "name": _compose_name(raw.get("first_name"), raw.get("last_name"), raw.get("name")),
        "first_name": raw.get("first_name"),
        "last_name": raw.get("last_name"),
        "email": email,
        "email_status": raw.get("email_status"),
        "title": raw.get("title"),
        "seniority": raw.get("seniority"),
        "company_name": company_name,
        "company_domain": company_domain,
        "phone": _first_phone(raw),
        "linkedin_url": raw.get("linkedin_url"),
        "location": _location(raw),
        # derived dedup keys + bookkeeping
        "email_norm": email_norm,
        "company_domain_norm": company_domain_norm,
        "apollo_contact_id": str(raw["id"]) if raw.get("id") is not None else None,
        "apollo_raw": json.dumps(raw, default=str),
    }
    return record
