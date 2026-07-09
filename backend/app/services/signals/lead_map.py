"""Read-time signal↔lead relevance mapping (Claude). See specs/36.

Disposable derived cache in Signals.signal_lead_map, keyed per (org, user).
No signal-schema change; no persisted hard link.
"""

import asyncio
import hashlib
import json
import os
import random
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core import prompts
from app.core.logging import logger
from app.services import _llm_helpers
from app.services.signals import persistence
from app.services.leads import persistence as leads_persistence
from app.services.settings import get_app_settings

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
_MAX_RETRIES = 2
_RELEVANCE = {"high", "medium", "low"}

def _int_env(name: str, default: int) -> int:
    """Positive-int env override, falling back to `default` on unset/invalid (a bad
    value must not crash module import — and thus the whole app)."""
    try:
        return max(1, int(os.getenv(name) or default))
    except (TypeError, ValueError):
        logger.warning("invalid %s=%r; using default %d", name, os.getenv(name), default)
        return default


# TD-014/TD-015: instead of one Claude call over all leads — which blew the output
# budget (truncated → empty mapping) and ran ~180s (past the proxy → 502) — split
# the leads into bounded batches, map each (full signal set × one lead batch) in its
# own call, and run them concurrently. Two knobs are now admin settings (AppSettings,
# read per-request in build_signal_lead_map_claude → tunable from the ops panel with
# no deploy): `signal_lead_map_lead_limit` (max newest leads the map covers — the only
# real latency lever, since wall-clock is floored by total Claude output ÷ the
# Anthropic OTPM ceiling) and `signal_lead_map_batch_size` (leads per call — smaller =
# faster, non-truncating outputs + less peak memory). Concurrency and the per-call
# output cap stay env-tuned: C=5 sits near the ~4.4 effective-stream OTPM ceiling with
# low 429/memory pressure.
_MAP_MAX_CONCURRENCY = _int_env("SIGNAL_LEAD_MAP_MAX_CONCURRENCY", 5)
# Per-batch output cap. The shared CLAUDE_RESEARCH_MAX_TOKENS default (8192) was
# too small here: a full signal set × 40 leads routinely overflowed it, so nearly
# every batch truncated and paid the adaptive-split penalty (extra discarded
# calls). Lead-map gets its own, larger cap so most batches parse on the first
# call. Kept env-overridable; do not raise so high that a single non-streaming
# call (blocking requests.post, 300s socket) risks the ~120s edge ceiling on the
# client path — see docs/TECH_DEBT.md TD-014.
_LEAD_MAP_MAX_TOKENS = _int_env("SIGNAL_LEAD_MAP_MAX_TOKENS", 24000)
# Per-batch retry backoff: base * 2**(attempt-1) + U(0, jitter). Jitter de-syncs
# the concurrent batches so they don't retry in lockstep against a throttling API.
_RETRY_BASE_S = 1.0
_RETRY_JITTER_S = 0.5
# On a truncated/unparseable batch, split it in half and re-map — bounded so a
# pathological batch can't recurse without end (40→20→10→5 covers any realistic case).
_MAX_SPLIT_DEPTH = 3


def _build_result(
    mapping: List[Dict[str, Any]], generated_at: str, cached: bool, status: str = "success"
) -> Dict[str, Any]:
    return {"status": status, "data": {"mapping": mapping, "generated_at": generated_at, "cached": cached}}


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

# Contact fields (Spec 43 CSV export). Same normalized-alias pattern as above:
# keys are normalized (lowercased, non-alphanumerics stripped) before lookup, so
# "Email_Id" -> "emailid", "Contact_Number" -> "contactnumber", "LinkedIn_URL" ->
# "linkedinurl". Apollo leads use canonical keys (email/email_status/phone/
# linkedin_url). email_status has no common CSV equivalent -> canonical key only.
_EMAIL_ALIASES = ("email", "emailid", "emailaddress")
_EMAIL_STATUS_ALIASES = ("emailstatus",)
_PHONE_ALIASES = ("phone", "contactnumber", "phonenumber", "mobile")
_LINKEDIN_ALIASES = ("linkedinurl", "linkedin")


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
    """Attach display-only prospect + contact fields (name/title/seniority/email/
    email_status/phone/linkedin_url) to each matched
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
                "email": _first_alias(norm, _EMAIL_ALIASES),
                "email_status": _first_alias(norm, _EMAIL_STATUS_ALIASES),
                "phone": _first_alias(norm, _PHONE_ALIASES),
                "linkedin_url": _first_alias(norm, _LINKEDIN_ALIASES),
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
) -> tuple[List[Dict[str, Any]], bool]:
    """Return (mapping, clean). clean=False means the model's JSON was
    incomplete/unparseable (almost always a max_tokens truncation) and we only
    recovered a prefix — the caller should split-and-retry rather than trust it."""
    sig_set = set(valid_signal_ids)
    lead_set = set(valid_lead_ids)
    headline_by_id = {
        str(s.get("signal_id") or s.get("id")): s.get("headline", "")
        for s in signals
        if (s.get("signal_id") or s.get("id"))
    }
    clean = True
    try:
        parsed = _llm_helpers._extract_research_json(
            raw, escape_keys=("why",), trim_braces=True, strip_final_answer=True
        )
        raw_mapping = parsed.get("mapping", []) if isinstance(parsed, dict) else []
    except (ValueError, TypeError):
        # Incomplete/invalid JSON — recover the complete-object prefix for best-effort
        # data, but flag clean=False so the caller splits instead of silently caching
        # a truncated (tail-leads-dropped) map as a success.
        clean = False
        raw_mapping = _recover_mapping_entries(raw)

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
    return out, clean


def _merge_batch_mappings(
    batch_mappings: List[List[Dict[str, Any]]],
    signal_order: List[str],
    headline_by_id: Dict[str, str],
) -> List[Dict[str, Any]]:
    """Merge the per-batch mappings into one. Every lead_id lives in exactly one
    batch, so a signal's matched leads are simply concatenated across batches.
    Entries are emitted in signal-feed order, only for signals that at least one
    batch returned (matches the single-call shape the FE already consumes)."""
    leads_by_signal: Dict[str, List[Dict[str, Any]]] = {}
    for batch_mapping in batch_mappings:
        for entry in batch_mapping:
            sid = str(entry.get("signal_id", ""))
            if not sid:
                continue
            leads_by_signal.setdefault(sid, []).extend(entry.get("leads", []) or [])
    return [
        {"signal_id": sid, "headline": headline_by_id.get(sid, ""), "leads": leads_by_signal[sid]}
        for sid in signal_order
        if sid in leads_by_signal
    ]


async def build_signal_lead_map_claude(driver, mongo, request) -> Dict[str, Any]:
    """Map newest-50 signals × ≤N leads (N = admin lead_fetch_limit) → mapping[];
    cached per (org, user) by an input-set fingerprint. The leads are split into
    bounded batches mapped in concurrent Claude calls and merged (TD-014), so the
    payload per call stays parseable and the request stays under the upstream proxy
    timeout. Never raises to a 500: a batch failure degrades that batch to empty; if
    ANY batch fails the map is incomplete, so the result carries status:"error"
    (still HTTP 200, not cached) — the FE surfaces its error/retry state instead of
    a silently incomplete map. Only an all-batches-ok result is cached and returned
    as status:"success" (including a genuine zero-match). (Router handles the
    missing-key 500.)"""
    now = datetime.now(timezone.utc).isoformat()

    # 1. signals (user-scoped feed read; async)
    signals, _ = await persistence.fetch_signals(mongo, request.user_id, limit=_MAX_SIGNALS, offset=0)
    if not signals:
        return _build_result([], now, False)

    # 2. leads (org-scoped; sync → thread). The map's lead cap and batch size are
    # admin settings (AppSettings), read once here. Lead cap = min(map limit, admin
    # lead_fetch_limit) so the map never exceeds the global fetch (spec 47); fewer
    # leads is the only real latency lever (TD-015).
    settings = await asyncio.to_thread(get_app_settings, mongo)
    lead_limit = min(settings.signal_lead_map_lead_limit, settings.lead_fetch_limit)
    batch_size = settings.signal_lead_map_batch_size
    leads, _ = await asyncio.to_thread(
        leads_persistence.get_leads_for_org, driver, request.org_id, lead_limit, 0
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

    # 5-6. Chunked, concurrent Claude mapping (TD-014). Split the leads into
    # bounded batches; map each (full signal set × one lead batch) in its own
    # call with the same per-call retry; run the batches concurrently. A batch
    # that fails after retries contributes nothing but does not sink the others.
    signals_json = _signals_for_prompt(signals)
    context_json = json.dumps(context, default=str)
    headline_by_id = {
        str(s.get("signal_id") or s.get("id")): s.get("headline", "")
        for s in signals
        if (s.get("signal_id") or s.get("id"))
    }
    batches = [leads[i:i + batch_size] for i in range(0, len(leads), batch_size)]
    loop = asyncio.get_running_loop()

    async def _map_batch(executor, batch: List[Dict[str, Any]], depth: int = 0):
        """(parsed_mapping, ok) for one lead batch; ok=False after exhausted retries.
        ALL work (render + call + parse) is inside the try so nothing escapes to a
        500. If the model's output is truncated/unparseable, split the batch in half
        and re-map the halves (bounded by _MAX_SPLIT_DEPTH) so no leads are silently
        dropped; a batch that can't be split further degrades loudly to ([], False)."""
        batch_lead_ids = _lead_ids(batch)
        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                rendered = prompts.render(
                    "signals_lead_map",
                    signals_json=signals_json,
                    leads_json=_leads_for_prompt(batch),
                    context_json=context_json,
                )
                raw = await loop.run_in_executor(
                    executor,
                    _llm_helpers._claude_messages_text,
                    rendered.body,
                    _LEAD_MAP_MAX_TOKENS,
                )
                mapping, clean = _parse_mapping(raw, signals, sig_ids, batch_lead_ids)
                if clean:
                    return mapping, True
                # Truncated/unparseable output. Rather than silently caching the
                # recovered prefix as a success (dropping the tail leads), split the
                # batch so each half's output fits, and re-map. Retrying the same
                # batch would just truncate again, so we split instead of looping.
                if len(batch) > 1 and depth < _MAX_SPLIT_DEPTH:
                    logger.warning(
                        "signal_lead_map: batch output truncated (%d leads, depth %d); splitting",
                        len(batch), depth,
                    )
                    mid = len(batch) // 2
                    halves = await asyncio.gather(
                        _map_batch(executor, batch[:mid], depth + 1),
                        _map_batch(executor, batch[mid:], depth + 1),
                    )
                    merged = _merge_batch_mappings(
                        [m for m, _ in halves], sig_ids, headline_by_id
                    )
                    return merged, all(ok for _, ok in halves)
                # Single lead (or hit the split cap) and STILL truncated → fail loudly
                # (uncached, surfaced) instead of returning a silently-partial map.
                logger.warning(
                    "signal_lead_map: batch truncated and unsplittable (%d leads, depth %d); marking failed",
                    len(batch), depth,
                )
                return [], False
            except Exception as e:  # degrade this batch; never surface a 500
                if attempt < _MAX_RETRIES:
                    await asyncio.sleep(
                        _RETRY_BASE_S * (2 ** (attempt - 1)) + random.uniform(0, _RETRY_JITTER_S)
                    )
                else:
                    logger.warning("signal_lead_map: lead batch failed after retries: %s", e)
                    return [], False

    with ThreadPoolExecutor(
        max_workers=min(_MAP_MAX_CONCURRENCY, len(batches)), thread_name_prefix="leadmap"
    ) as executor:
        # Warm the prompt cache with the first batch alone, THEN fan out the rest.
        # The signal-set + ICP context prefix is identical across batches and
        # cache_control-marked (see signals_lead_map.md.j2 / PROMPT_CACHE_SPLIT_MARKER).
        # A cache entry only becomes readable once the first response has been
        # written, so firing every batch at once makes the whole first concurrent
        # wave miss and each pays full input price. Running batch 0 to completion
        # first lets every remaining batch — and every split-recursion sub-call —
        # read the prefix at ~0.1x. Costs one batch of extra serial latency, which
        # the direct-to-Render path (no ~120s edge ceiling) affords. TD-014.
        if len(batches) > 1:
            first = await _map_batch(executor, batches[0])
            rest = await asyncio.gather(*[_map_batch(executor, b) for b in batches[1:]])
            batch_results = [first, *rest]
        else:
            batch_results = await asyncio.gather(*[_map_batch(executor, b) for b in batches])

    mapping = _merge_batch_mappings([m for m, _ in batch_results], sig_ids, headline_by_id)
    all_ok = all(ok for _, ok in batch_results)

    # A batch that failed after retries makes the map INCOMPLETE — its leads are
    # missing. We can't infer that from an empty `mapping`: the prompt echoes every
    # signal with a (possibly empty) "leads" array, so any surviving batch leaves
    # `mapping` non-empty even on a zero-match batch. Decide on `all_ok` instead —
    # surface status:"error" (HTTP 200, not cached) so the FE shows its retry state
    # (whose refetch re-runs the full compute) rather than presenting a silently
    # incomplete map as success. A genuine zero-match with every batch OK falls
    # through to the success return below.
    if not all_ok:
        n_failed = sum(1 for _, ok in batch_results if not ok)
        logger.warning(
            "signal_lead_map: %d/%d lead batches failed; returning error status (not cached)",
            n_failed, len(batch_results),
        )
        return _build_result([], now, False, status="error")

    # 7. cache write — every batch succeeded, so the map is complete. Log + swallow
    # on write failure.
    try:
        await asyncio.to_thread(
            _save_lead_map, mongo, request.org_id, request.user_id, mapping, fingerprint, now
        )
    except Exception as e:
        logger.warning("signal_lead_map: cache write failed: %s", e)

    return _build_result(_enrich_matched_leads(mapping, leads_by_id), now, False)
