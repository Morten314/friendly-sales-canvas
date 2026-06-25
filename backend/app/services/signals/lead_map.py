"""Read-time signal↔lead relevance mapping (Claude). See specs/36.

Disposable derived cache in Signals.signal_lead_map, keyed per (org, user).
No signal-schema change; no persisted hard link.
"""

import asyncio
import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core import prompts
from app.core.logging import logger
from app.services import _llm_helpers
from app.services.signals import persistence
from app.services.leads import persistence as leads_persistence

_CACHE_DB = "Signals"
_CACHE_COLL = "signal_lead_map"


def _signal_ids(signals: List[Dict[str, Any]]) -> List[str]:
    out: List[str] = []
    for s in signals:
        sid = s.get("signal_id") or s.get("id")
        if sid:
            out.append(str(sid))
    return out


def _lead_ids(leads: List[Dict[str, Any]]) -> List[str]:
    return [str(l.get("lead_id")) for l in leads if l.get("lead_id")]


def _compute_fingerprint(signal_ids: List[str], lead_ids: List[str]) -> str:
    payload = ",".join(sorted(signal_ids)) + "|" + ",".join(sorted(lead_ids))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _cache_key(org_id: str, user_id: str) -> str:
    return f"{org_id}:{user_id}"


def _get_cached_lead_map(mongo, org_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    return mongo[_CACHE_DB][_CACHE_COLL].find_one({"_id": _cache_key(org_id, user_id)})


def _save_lead_map(
    mongo, org_id: str, user_id: str,
    mapping: List[Dict[str, Any]], fingerprint: str, generated_at: str,
) -> None:
    mongo[_CACHE_DB][_CACHE_COLL].update_one(
        {"_id": _cache_key(org_id, user_id)},
        {"$set": {"mapping": mapping, "fingerprint": fingerprint, "generated_at": generated_at}},
        upsert=True,
    )


# ---------------------------------------------------------------------------
# Task-10: parse helpers + async orchestration service
# ---------------------------------------------------------------------------
_MAX_SIGNALS = 50
_MAX_LEADS = 100
_MAX_RETRIES = 2
_RELEVANCE = {"high", "medium", "low"}


def _build_result(mapping: List[Dict[str, Any]], generated_at: str, cached: bool) -> Dict[str, Any]:
    return {"status": "success", "data": {"mapping": mapping, "generated_at": generated_at, "cached": cached}}


def _signals_for_prompt(signals: List[Dict[str, Any]]) -> str:
    rows = [{"signal_id": str(s.get("signal_id") or s.get("id")), "headline": s.get("headline", "")}
            for s in signals if (s.get("signal_id") or s.get("id"))]
    return json.dumps(rows, default=str)


# CSV/Excel uploads keep their column headings verbatim as Lead-node keys
# (the upload orchestrator stores them as-is — no canonicalization), so the
# three fields the matching prompt reasons over (company / industry / region)
# must be resolved by alias, not by a single hard-coded key. Keys are
# normalized — lowercased, non-alphanumerics stripped — before lookup, so
# "Company Name", "company_name" and "COMPANY  NAME" all collapse to the same
# alias. Apollo/manual leads (already canonical keys) keep working unchanged.
_COMPANY_ALIASES = (
    "companyname", "company", "organizationname", "organisationname",
    "organization", "organisation", "accountname", "account", "org",
)
_INDUSTRY_ALIASES = ("industry", "sector", "vertical")
_REGION_ALIASES = (
    "region", "country", "location", "geo", "geography",
    "state", "province", "city", "countryregion",
)
_TITLE_ALIASES = ("jobtitle", "title", "designation", "position", "jobrole")
_SENIORITY_ALIASES = ("senioritylevel", "seniority", "joblevel")
_NAME_ALIASES = ("name", "fullname", "contactname", "leadname", "personname", "contactfullname")
_FIRST_NAME_ALIASES = ("firstname", "givenname", "fname")
_LAST_NAME_ALIASES = ("lastname", "surname", "familyname", "lname")


def _normalize_lead_keys(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Index a lead by normalized key (lowercased, non-alphanumerics stripped).
    First non-empty value wins, so a populated column isn't clobbered by a
    later blank one that normalizes to the same key."""
    norm: Dict[str, Any] = {}
    for key, value in lead.items():
        nk = re.sub(r"[^a-z0-9]", "", str(key).lower())
        if not nk:
            continue
        if nk not in norm or (norm[nk] in (None, "") and value not in (None, "")):
            norm[nk] = value
    return norm


def _first_alias(norm: Dict[str, Any], aliases: tuple) -> str:
    """Return the first non-empty value among the alias keys, else ''."""
    for alias in aliases:
        value = norm.get(alias)
        if value not in (None, ""):
            return str(value)
    return ""


def _resolve_contact_name(norm: Dict[str, Any]) -> str:
    """Single name field if present, else 'First Last' composed from aliases, else ''."""
    single = _first_alias(norm, _NAME_ALIASES)
    if single:
        return single
    first = _first_alias(norm, _FIRST_NAME_ALIASES)
    last = _first_alias(norm, _LAST_NAME_ALIASES)
    return f"{first} {last}".strip()


def _enrich_matched_leads(
    mapping: List[Dict[str, Any]], leads_by_id: Dict[str, Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Attach display-only prospect fields (name/title/seniority) to each matched
    lead by re-joining lead_id -> the full lead dict (alias-resolved). PURE: returns
    a new mapping so the cached narrow shape is never mutated. Never raises; an
    unknown lead_id yields empty fields. Matching is unchanged — this only widens
    the response shape."""
    enriched: List[Dict[str, Any]] = []
    for entry in mapping:
        leads_out = []
        for lead in entry.get("leads", []) or []:
            full = leads_by_id.get(str(lead.get("lead_id", "")))
            norm = _normalize_lead_keys(full) if full else {}
            leads_out.append({
                **lead,
                "name": _resolve_contact_name(norm),
                "title": _first_alias(norm, _TITLE_ALIASES),
                "seniority": _first_alias(norm, _SENIORITY_ALIASES),
            })
        enriched.append({**entry, "leads": leads_out})
    return enriched


def _leads_for_prompt(leads: List[Dict[str, Any]]) -> str:
    rows = []
    for lead in leads:
        if not lead.get("lead_id"):
            continue
        norm = _normalize_lead_keys(lead)
        rows.append({
            "lead_id": str(lead.get("lead_id")),
            "company": _first_alias(norm, _COMPANY_ALIASES),
            "industry": _first_alias(norm, _INDUSTRY_ALIASES),
            "region": _first_alias(norm, _REGION_ALIASES),
        })
    return json.dumps(rows, default=str)


def _recover_mapping_entries(raw: str) -> List[Dict[str, Any]]:
    """Best-effort recovery of a structurally-truncated mapping[] — decode whole
    objects from the array prefix and stop at the first incomplete one."""
    m = re.search(r'"mapping"\s*:\s*\[', raw)
    if not m:
        return []
    decoder = json.JSONDecoder()
    idx = m.end()
    entries: List[Dict[str, Any]] = []
    while idx < len(raw):
        while idx < len(raw) and raw[idx] in " \t\r\n,":
            idx += 1
        if idx >= len(raw) or raw[idx] == "]":
            break
        try:
            obj, end = decoder.raw_decode(raw, idx)
        except ValueError:
            break  # truncated tail
        if isinstance(obj, dict):
            entries.append(obj)
        idx = end
    return entries


def _parse_mapping(
    raw: str, signals: List[Dict[str, Any]],
    valid_signal_ids: List[str], valid_lead_ids: List[str],
) -> List[Dict[str, Any]]:
    sig_set = set(valid_signal_ids)
    lead_set = set(valid_lead_ids)
    headline_by_id = {
        str(s.get("signal_id") or s.get("id")): s.get("headline", "")
        for s in signals
        if (s.get("signal_id") or s.get("id"))
    }
    try:
        parsed = _llm_helpers._extract_research_json(
            raw, escape_keys=("why",), trim_braces=True, strip_final_answer=True
        )
        raw_mapping = parsed.get("mapping", []) if isinstance(parsed, dict) else []
    except (ValueError, TypeError):
        raw_mapping = _recover_mapping_entries(raw)  # truncated-prefix tolerance

    out: List[Dict[str, Any]] = []
    for entry in raw_mapping:
        if not isinstance(entry, dict):
            continue
        sid = str(entry.get("signal_id", ""))
        if sid not in sig_set:
            continue  # drop invented signal ids
        leads_out = []
        for lead in entry.get("leads", []) or []:
            if not isinstance(lead, dict):
                continue
            lid = str(lead.get("lead_id", ""))
            if lid not in lead_set:
                continue  # drop invented lead ids
            rel = str(lead.get("relevance", "")).lower()
            if rel not in _RELEVANCE:
                rel = "low"
            leads_out.append({
                "lead_id": lid,
                "company": str(lead.get("company") or ""),
                "relevance": rel,
                "why": str(lead.get("why") or ""),
            })
        out.append({"signal_id": sid, "headline": headline_by_id.get(sid, ""), "leads": leads_out})
    return out


async def build_signal_lead_map_claude(driver, mongo, request) -> Dict[str, Any]:
    """One Claude call over (newest-50 signals × ≤100 leads) → mapping[]; cached
    per (org, user) by an input-set fingerprint. Never raises to a 500: a Claude
    failure degrades to an empty mapping (the router handles the missing-key 500)."""
    now = datetime.now(timezone.utc).isoformat()

    # 1. signals (user-scoped feed read; async)
    signals, _ = await persistence.fetch_signals(mongo, request.user_id, limit=_MAX_SIGNALS, offset=0)
    if not signals:
        return _build_result([], now, False)

    # 2. leads (org-scoped; sync → thread)
    leads, _ = await asyncio.to_thread(
        leads_persistence.get_leads_for_org, driver, request.org_id, _MAX_LEADS, 0
    )
    if not leads:
        return _build_result([], now, False)

    # 3. fingerprint + cache check (a hit still pays the two fetches above)
    sig_ids = _signal_ids(signals)
    ld_ids = _lead_ids(leads)
    fingerprint = _compute_fingerprint(sig_ids, ld_ids)
    leads_by_id = {str(l["lead_id"]): l for l in leads if l.get("lead_id")}
    if not request.refresh:
        cached = await asyncio.to_thread(_get_cached_lead_map, mongo, request.org_id, request.user_id)
        if cached and cached.get("fingerprint") == fingerprint:
            return _build_result(
                _enrich_matched_leads(cached.get("mapping", []), leads_by_id),
                cached.get("generated_at", now), True,
            )

    # 4. context (ICP/company profile grounding)
    context = await asyncio.to_thread(
        persistence._get_signal_ask_customer_profile, mongo, request.org_id
    ) or {}

    # 5. render + 6. one Claude call (retries=2) + parse
    rendered = prompts.render(
        "signals_lead_map",
        signals_json=_signals_for_prompt(signals),
        leads_json=_leads_for_prompt(leads),
        context_json=json.dumps(context, default=str),
    )
    mapping: List[Dict[str, Any]] = []
    last_err: Optional[Exception] = None
    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            raw = await asyncio.to_thread(
                _llm_helpers._claude_messages_text, rendered.body, _llm_helpers.CLAUDE_RESEARCH_MAX_TOKENS
            )
            mapping = _parse_mapping(raw, signals, sig_ids, ld_ids)
            last_err = None
            break
        except Exception as e:  # degrade, never surface a 500
            last_err = e
            if attempt < _MAX_RETRIES:
                await asyncio.sleep(1)
    if last_err is not None:
        logger.warning("signal_lead_map: claude failed after retries, empty mapping: %s", last_err)
        return _build_result([], now, False)

    # 7. cache write (log + swallow on failure)
    try:
        await asyncio.to_thread(
            _save_lead_map, mongo, request.org_id, request.user_id, mapping, fingerprint, now
        )
    except Exception as e:
        logger.warning("signal_lead_map: cache write failed: %s", e)

    return _build_result(_enrich_matched_leads(mapping, leads_by_id), now, False)
