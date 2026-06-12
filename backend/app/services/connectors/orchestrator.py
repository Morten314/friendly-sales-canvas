"""Apollo connector orchestration — router-facing service functions + the two
BackgroundTasks bodies. Sibling modules are reached via module imports so a
single test patch intercepts every caller (patch-where-used; TESTING.md).
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import BackgroundTasks

from app.core.exceptions import (
    ApolloAPIError,
    ApolloCreditsExhaustedError,
    BrewraError,
    ConnectorCredentialsInvalidError,
    DiscoveryInProgressError,
    MasterKeyRequiredError,
    ProfileIncompleteError,
)
from app.models.connectors import (
    ApolloConnectRequest,
    ApolloDiscoverRequest,
    ApolloEnrichRequest,
    ApolloImportRequest,
)
from app.services.connectors import apollo as apollo_mod
from app.services.connectors import credentials
from app.services.connectors import discovery
from app.services.connectors import ingestion
from app.services.connectors import runs
from app.services.connectors import warmup
from app.services.connectors.normalize import normalize_apollo_record

logger = logging.getLogger(__name__)

IMPORT_RECORD_CAP = 25_000  # spec §8 hard per-import cap
INGEST_CHUNK_SIZE = 500
SEARCH_SCAN_CAP = 500
MAX_LEADS_DEFAULT = 50
MAX_LEADS_HARD_CAP = 200
REVEAL_RATE_DELAY = 0.3  # seconds between sequential people/match reveals (plan-tuned; respects Apollo rate limits)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Connection ───

def connect_apollo(mongo, request: ApolloConnectRequest) -> Dict[str, Any]:
    """Gate on ICP completeness + master-key probe, then store the key."""
    # Check 1 — profile completeness (UC6). Reuses the warmup ICP logic.
    icps = warmup._icps_for_org(mongo, request.org_id)
    if not any(warmup.icp_is_complete(icp)[0] for icp in icps):
        missing = warmup.icp_is_complete(icps[-1] if icps else None)[1] or "icp"
        raise ProfileIncompleteError(missing_section=missing)

    # Check 2 — master-key + search capability via a free 1-record api_search probe.
    connector = apollo_mod.ApolloConnector(request.api_key)
    try:
        connector.search_people({}, page=1, per_page=1)
    except ApolloAPIError as e:
        # _request raises ApolloAPIError on 403 (insufficient plan / not a master key)
        raise MasterKeyRequiredError(str(e))
    # 401 -> ConnectorCredentialsInvalidError propagates (handled -> 400 "Invalid key")

    credentials.save_credentials(mongo, request.org_id, "apollo", request.api_key, status="connected")
    return {"connected": True, "status": "connected"}


def get_apollo_status(mongo, org_id: str) -> Dict[str, Any]:
    doc = credentials.get_credentials(mongo, org_id, "apollo")
    if not doc:
        return {"connected": False, "status": "disconnected", "connected_at": None}
    return {
        "connected": doc.get("status") == "connected",
        "status": str(doc.get("status") or "disconnected"),
        "connected_at": doc.get("connected_at"),
    }


def disconnect_apollo(mongo, org_id: str) -> Dict[str, Any]:
    removed = credentials.delete_credentials(mongo, org_id, "apollo")
    return {
        "status": "disconnected" if removed else "not_connected",
        "message": "Apollo disconnected." if removed else "No Apollo connection to remove.",
    }


def list_apollo_lists(mongo, org_id: str) -> Dict[str, Any]:
    api_key = credentials.get_api_key(mongo, org_id, "apollo")  # raises if not connected
    connector = apollo_mod.ApolloConnector(api_key)
    return {"lists": connector.list_collections()}


# ─── Import ───

def start_apollo_import(driver, mongo, request: ApolloImportRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    credentials.get_api_key(mongo, request.org_id, "apollo")  # ensure connected (raises 404 otherwise)
    filename = request.label or f"Apollo import {_now()}"
    file_id = runs.create_import_batch(mongo, request.org_id, request.user_id, filename)
    background_tasks.add_task(
        _run_import, driver, mongo, request.org_id, request.user_id, file_id, request.list_id, request.label,
    )
    return {"file_id": file_id, "status": "queued"}


def _run_import(driver, mongo, org_id, user_id, file_id, list_id, label) -> None:
    """Background body: pull Apollo contacts → normalize → ingest → finalize batch."""
    try:
        api_key = credentials.get_api_key(mongo, org_id, "apollo")
        connector = apollo_mod.ApolloConnector(api_key)

        # If no explicit label and a list was chosen, name the batch after the list.
        if not label and list_id:
            try:
                for lst in connector.list_collections():
                    if lst["id"] == str(list_id):
                        runs.update_import_filename(mongo, file_id, lst["name"])
                        break
            except Exception as e:
                logger.warning("Could not resolve Apollo list name (file_id=%s): %s", file_id, e)

        total_rows = created = matched = error_count = 0
        capped = False
        for page in connector.fetch_contacts(list_id=list_id):
            if total_rows >= IMPORT_RECORD_CAP:
                capped = True
                break
            remaining = IMPORT_RECORD_CAP - total_rows
            page = page[:remaining]
            records = [normalize_apollo_record(raw) for raw in page]
            result = ingestion.upsert_imported_leads(
                driver, org_id, user_id, records, file_id=file_id, source="apollo", chunk_size=INGEST_CHUNK_SIZE,
            )
            created += result["created"]
            matched += result["matched"]
            error_count += len(result["errors"])
            total_rows += len(page)
            runs.update_import_progress(
                mongo, file_id, created_count=created, matched_count=matched, error_count=error_count,
            )

        message = None
        if capped:
            message = f"Reached the {IMPORT_RECORD_CAP:,}-record import cap; narrow by Apollo list to import the rest."
        runs.complete_import_batch(
            mongo, file_id, total_rows=total_rows, created_count=created, matched_count=matched,
            error_count=error_count, capped=capped, message=message,
        )
    except ConnectorCredentialsInvalidError as e:
        credentials.set_status(mongo, org_id, "apollo", "error")
        runs.fail_import_batch(mongo, file_id, f"Apollo credentials invalid: {e}")
    except BrewraError as e:
        runs.fail_import_batch(mongo, file_id, str(e))
    except Exception as e:  # noqa: BLE001
        logger.error("Apollo import failed (org_id=%s file_id=%s): %s", org_id, file_id, e)
        runs.fail_import_batch(mongo, file_id, str(e))


# ─── Enrichment ───

def start_apollo_enrich(driver, mongo, request: ApolloEnrichRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    credentials.get_api_key(mongo, request.org_id, "apollo")  # ensure connected
    runs.fail_stale_enrich_runs(mongo, request.org_id)
    run_id = runs.create_enrich_run(mongo, request.org_id, request.user_id, total=len(request.lead_ids))
    background_tasks.add_task(
        _run_enrich, driver, mongo, request.org_id, request.user_id, run_id,
        request.lead_ids, request.reveal_personal_emails, request.reveal_phone_number,
    )
    return {"run_id": run_id, "status": "queued"}


def get_apollo_enrich_status(mongo, org_id: str, run_id: Optional[str]) -> Dict[str, Any]:
    return runs.get_enrich_run(mongo, org_id, run_id)


def _build_match_entry(lead: Dict[str, Any]) -> Dict[str, Any]:
    """Strongest identifier per spec §6.1: apollo_contact_id (exact) else identity fields."""
    contact_id = lead.get("apollo_contact_id")
    if contact_id:
        return {"id": str(contact_id)}
    entry: Dict[str, Any] = {}
    for key in ("email", "first_name", "last_name"):
        if lead.get(key):
            entry[key] = lead[key]
    if lead.get("company_name"):
        entry["organization_name"] = lead["company_name"]
    if lead.get("company_domain"):
        entry["domain"] = lead["company_domain"]
    return entry


def _run_enrich(driver, mongo, org_id, user_id, run_id, lead_ids, reveal_personal_emails, reveal_phone_number) -> None:
    """Background body: load leads → bulk_match in 10s → fill-only-empty write-back."""
    try:
        api_key = credentials.get_api_key(mongo, org_id, "apollo")
        connector = apollo_mod.ApolloConnector(api_key)
        leads = ingestion.get_leads_by_ids(driver, org_id, lead_ids)

        processed = updated = unmatched = failed = 0
        errors: List[str] = []
        runs.mark_enrich_processing(mongo, run_id)

        # F2: count leads that were requested but not returned by get_leads_by_ids
        # (deleted/foreign ids silently omitted). These are skipped before any Apollo call.
        loaded_ids = {lead.get("lead_id") for lead in leads}
        missing = [lid for lid in lead_ids if lid not in loaded_ids]
        skipped = len(missing)
        errors.extend(f"Lead {lid} not found in org" for lid in missing)

        for i in range(0, len(leads), apollo_mod.BULK_MATCH_CHUNK):
            chunk = leads[i:i + apollo_mod.BULK_MATCH_CHUNK]

            # F3: filter out leads with no identifiers to avoid burning a credit for a
            # guaranteed no-match (apollo_contact_id / email / name / company all absent).
            entries = []
            match_leads = []  # parallel to entries: leads with a non-empty match entry
            for lead in chunk:
                entry = _build_match_entry(lead)
                if not entry:
                    processed += 1
                    unmatched += 1
                    continue
                entries.append(entry)
                match_leads.append(lead)

            if not entries:
                runs.update_enrich_progress(
                    mongo, run_id, processed=processed, updated=updated,
                    unmatched=unmatched, failed=failed, errors=errors, skipped=skipped,
                )
                continue

            try:
                matches = connector.bulk_match(
                    entries,
                    reveal_personal_emails=reveal_personal_emails,
                    reveal_phone_number=reveal_phone_number,
                )
            except ApolloCreditsExhaustedError:
                runs.complete_enrich_run(
                    mongo, run_id, processed=processed, updated=updated, unmatched=unmatched,
                    failed=failed, errors=errors + ["Apollo credits exhausted."], skipped=skipped,
                    status="partial",
                )
                return

            # Misalignment guard: bulk_match returns one slot per input in request order.
            # If the count differs, do NOT positional-zip (that would write enrichment onto
            # the WRONG leads) — treat the matched-entry leads as unmatched.
            if len(matches) != len(entries):
                processed += len(match_leads)
                unmatched += len(match_leads)
                errors.append(
                    f"bulk_match returned {len(matches)} results for {len(entries)} inputs; "
                    "chunk skipped to avoid miswrite."
                )
                runs.update_enrich_progress(
                    mongo, run_id, processed=processed, updated=updated,
                    unmatched=unmatched, failed=failed, errors=errors, skipped=skipped,
                )
                continue

            enrich_records: List[Dict[str, Any]] = []
            for lead, match in zip(match_leads, matches):
                processed += 1
                if not match:
                    unmatched += 1
                    continue
                rec = normalize_apollo_record(match)
                rec["lead_id"] = lead["lead_id"]
                enrich_records.append(rec)

            if enrich_records:
                result = ingestion.enrich_fill_leads(driver, org_id, enrich_records, source="apollo", chunk_size=INGEST_CHUNK_SIZE)
                updated += result["updated"]
                failed += len(result["errors"])
                errors.extend(result["errors"])

            runs.update_enrich_progress(
                mongo, run_id, processed=processed, updated=updated, unmatched=unmatched, failed=failed, errors=errors, skipped=skipped,
            )

        runs.complete_enrich_run(
            mongo, run_id, processed=processed, updated=updated, unmatched=unmatched, failed=failed, errors=errors,
            skipped=skipped, status="completed",
        )
    except ConnectorCredentialsInvalidError as e:
        credentials.set_status(mongo, org_id, "apollo", "error")
        runs.fail_enrich_run(mongo, run_id, f"Apollo credentials invalid: {e}")
    except BrewraError as e:
        runs.fail_enrich_run(mongo, run_id, str(e))
    except Exception as e:  # noqa: BLE001
        logger.error("Apollo enrich failed (org_id=%s run_id=%s): %s", org_id, run_id, e)
        runs.fail_enrich_run(mongo, run_id, str(e))


# ─── Discovery ───

def _run_discover(driver, mongo, org_id, user_id, run_id, icp, mode, max_leads, llm=None) -> None:
    """Background body: search -> free funnel -> LLM re-rank -> reveal -> quality gate -> ingest.
    In `replace` mode: tag old discovery leads superseded first; delete only after a clean ingest."""
    counts = {"searched": 0, "qualified": 0, "selected": 0, "revealed": 0,
              "verified": 0, "unverified": 0, "created": 0, "matched": 0,
              "skipped_duplicates": 0, "errors": []}
    credits = 0
    tagged = False
    try:
        api_key = credentials.get_api_key(mongo, org_id, "apollo")
        connector = apollo_mod.ApolloConnector(api_key)
        runs.mark_discovery_processing(mongo, run_id)

        if mode == "replace":
            ingestion.tag_superseded_discovery_leads(driver, org_id)
            tagged = True

        filters = discovery.build_search_filters(icp)
        existing = ingestion.get_existing_apollo_contact_ids(driver, org_id, include_superseded=False)

        # 1-2: search + paginate up to the scan cap; 3a: drop no-email + dupes.
        candidates: List[Dict[str, Any]] = []
        page = 1
        while len(candidates) < SEARCH_SCAN_CAP:
            body = connector.search_people(filters, page=page, per_page=100)
            people = body.get("people") or []
            counts["searched"] += len(people)
            for p in people:
                if not p.get("has_email"):
                    continue
                cid = str(p.get("id")) if p.get("id") is not None else None
                if cid and cid in existing:
                    counts["skipped_duplicates"] += 1
                    continue
                candidates.append(p)
            total_pages = int((body.get("pagination") or {}).get("total_pages") or 1)
            if page >= total_pages or not people:
                break
            page += 1

        # 3b: hard-dimension drop; 4: LLM re-rank to top max_leads.
        candidates = [c for c in candidates if discovery.passes_hard_dimensions(c, icp)]
        counts["qualified"] = len(candidates)
        selected = discovery.rerank_candidates(llm, candidates, icp, max_leads=max_leads)
        counts["selected"] = len(selected)
        runs.update_discovery_progress(mongo, run_id, counts=counts, credits_consumed=credits)

        # 5-6: reveal sequentially; keep any revealed email, tag verified/unverified.
        records: List[Dict[str, Any]] = []
        for i, cand in enumerate(selected):
            if i:
                apollo_mod._sleep(REVEAL_RATE_DELAY)  # throttle between reveals (Apollo rate limits)
            try:
                person, spent = connector.match_person(str(cand.get("id")))
            except ApolloCreditsExhaustedError:
                # Credit wall mid-reveal — the ONLY path that raises this (search is credit-free),
                # so set the low-credit flag (UC10) HERE. Ingest what we revealed FIRST so counts
                # reflect created/matched, THEN record the run with post-ingest counts.
                credentials.set_low_credit(mongo, org_id, "apollo", True)
                if records:
                    _ingest_discovery(driver, org_id, user_id, run_id, records, counts)
                # A partial run is closer to a failure than a success: in `replace` mode RESTORE
                # the prior discovery leads (clear, NOT delete) so the pool never drops below its
                # pre-run count (spec AC4, no-loss). Done unconditionally on `tagged`.
                if tagged:
                    ingestion.clear_superseded_discovery_leads(driver, org_id)
                runs.complete_discovery_run(mongo, run_id, counts=counts, credits_consumed=credits, status="partial")
                return
            credits += spent
            counts["revealed"] += 1
            if not person or not person.get("email"):
                continue
            if person.get("email_status") == "verified":
                counts["verified"] += 1
            else:
                counts["unverified"] += 1
            rec = normalize_apollo_record(person)
            records.append(rec)
            runs.update_discovery_progress(mongo, run_id, counts=counts, credits_consumed=credits)

        # 7: ingest.
        if records:
            _ingest_discovery(driver, org_id, user_id, run_id, records, counts)

        if tagged:
            ingestion.delete_superseded_discovery_leads(driver, org_id)  # commit the swap

        status = "completed" if counts["created"] or counts["matched"] else "completed_empty"
        if credits > 0:
            credentials.set_low_credit(mongo, org_id, "apollo", False)  # a clean revealing run clears the flag
        runs.complete_discovery_run(mongo, run_id, counts=counts, credits_consumed=credits, status=status)

    except ConnectorCredentialsInvalidError as e:
        credentials.set_status(mongo, org_id, "apollo", "error")
        if tagged:
            ingestion.clear_superseded_discovery_leads(driver, org_id)
        runs.fail_discovery_run(mongo, run_id, f"Apollo credentials invalid: {e}")
    # NOTE: no outer except ApolloCreditsExhaustedError — unreachable (only match_person raises it,
    # caught inside the reveal loop which returns). search_people is credit-free.
    except BrewraError as e:
        if tagged:
            ingestion.clear_superseded_discovery_leads(driver, org_id)
        runs.fail_discovery_run(mongo, run_id, str(e))
    except Exception as e:  # noqa: BLE001
        logger.error("Apollo discovery failed (org_id=%s run_id=%s): %s", org_id, run_id, e)
        if tagged:
            ingestion.clear_superseded_discovery_leads(driver, org_id)
        runs.fail_discovery_run(mongo, run_id, str(e))


def start_apollo_discover(driver, mongo, request: "ApolloDiscoverRequest", background_tasks, *, llm=None) -> Dict[str, Any]:
    credentials.get_api_key(mongo, request.org_id, "apollo")  # ensure connected (404 otherwise)

    icp = warmup.get_active_icp(mongo, request.org_id, request.icp_id)
    fingerprint = discovery.icp_fingerprint(icp or {})
    discovery.build_search_filters(icp or {})  # raises IcpUnderspecifiedError (422) early

    # Retire a hung run first; if the killed run was a `replace`, clear its orphaned
    # superseded tags so those leads don't stay tagged (spec §5.7).
    stale = runs.fail_stale_discovery_runs(mongo, request.org_id)
    if stale and stale.get("mode") == "replace":
        ingestion.clear_superseded_discovery_leads(driver, request.org_id)
    if runs.get_active_discovery_run(mongo, request.org_id):
        raise DiscoveryInProgressError("A discovery run is already in progress for this org.")

    max_leads = min(request.max_leads or MAX_LEADS_DEFAULT, MAX_LEADS_HARD_CAP)
    run_id = runs.create_discovery_run(
        mongo, request.org_id, request.user_id,
        icp_id=(icp or {}).get("id"), icp_fingerprint=fingerprint,
        mode=request.mode, max_leads=max_leads,
    )
    background_tasks.add_task(
        _run_discover, driver, mongo, request.org_id, request.user_id, run_id,
        icp, request.mode, max_leads, llm,
    )
    return {"run_id": run_id, "status": "queued"}


def _ingest_discovery(driver, org_id, user_id, run_id, records, counts) -> None:
    result = ingestion.upsert_imported_leads(
        driver, org_id, user_id, records,
        file_id=run_id, source="apollo", apollo_origin="discovery",
        discovery_run_id=run_id, chunk_size=INGEST_CHUNK_SIZE,
    )
    counts["created"] += result["created"]
    counts["matched"] += result["matched"]
    counts["errors"].extend(result["errors"])
