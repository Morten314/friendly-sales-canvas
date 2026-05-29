"""Provider-agnostic lead/company writes for connectors (spec §5.2, §5.3).

Operates on the normalized canonical dict (not on a connector type). Holds no
run-doc/connector state. Fill-only-empty is implemented as atomic UNWIND-batched
Cypher (`CASE WHEN existing IS NULL/'' THEN incoming`), explicitly NOT
read-modify-write (which is not atomic under concurrent runs).
"""
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services.connectors.normalize import CANONICAL_FIELDS

logger = logging.getLogger(__name__)

# Fill-only-empty: overwrite ONLY when the existing value is null/empty AND an
# incoming value exists. Field names come from the fixed CANONICAL_FIELDS allowlist.
_FILL_CLAUSE = ",\n    ".join(
    f"l.{f} = CASE WHEN (l.{f} IS NULL OR l.{f} = '') AND row.{f} IS NOT NULL "
    f"THEN row.{f} ELSE l.{f} END"
    for f in CANONICAL_FIELDS
)

# Plain assignment for newly created nodes (no existing value to protect).
_CREATE_SET_CLAUSE = ",\n    ".join(f"l.{f} = row.{f}" for f in CANONICAL_FIELDS)

# Company MERGE-by-domain + Has_Lead link. Runs per (row, l) after a WITH.
_COMPANY_MERGE = """
FOREACH (_ IN CASE WHEN row.company_domain_norm IS NOT NULL AND row.company_domain_norm <> ''
                   THEN [1] ELSE [] END |
    MERGE (c:Company {org_id: $org_id, domain_norm: row.company_domain_norm})
    ON CREATE SET c.domain = row.company_domain, c.name = row.company_name, c.created_at = $now
    MERGE (c)-[:Has_Lead]->(l)
)
"""

# Import: match existing leads by email_norm then apollo_contact_id, fill-only-empty.
_IMPORT_UPDATE_CYPHER = f"""
/* connector:import-update */
UNWIND $rows AS row
MATCH (l:Lead {{org_id: $org_id}})
WHERE (row.email_norm IS NOT NULL AND row.email_norm <> ''
       AND toLower(trim(coalesce(l.email, ''))) = row.email_norm)
   OR (row.apollo_contact_id IS NOT NULL AND row.apollo_contact_id <> ''
       AND l.apollo_contact_id = row.apollo_contact_id)
SET {_FILL_CLAUSE},
    l.apollo_contact_id = coalesce(l.apollo_contact_id, row.apollo_contact_id),
    l.email_norm = coalesce(l.email_norm, row.email_norm),
    l.company_domain_norm = coalesce(l.company_domain_norm, row.company_domain_norm),
    l.source = coalesce(l.source, $source),
    l.apollo_raw = coalesce(row.apollo_raw, l.apollo_raw),
    l.last_imported_at = $now
WITH DISTINCT row, l
{_COMPANY_MERGE}
RETURN DISTINCT row.idx AS idx
"""

# Import: create the residue (no existing match). file_id set ONLY here (spec §5.3).
_IMPORT_CREATE_CYPHER = f"""
/* connector:import-create */
UNWIND $rows AS row
CREATE (l:Lead {{lead_id: row.lead_id, org_id: $org_id}})
SET l.user_id = $user_id,
    {_CREATE_SET_CLAUSE},
    l.email_norm = row.email_norm,
    l.company_domain_norm = row.company_domain_norm,
    l.apollo_contact_id = row.apollo_contact_id,
    l.apollo_raw = row.apollo_raw,
    l.source = $source,
    l.file_id = $file_id,
    l.stage = 'Initial Outreach',
    l.created_at = $now,
    l.last_imported_at = $now
WITH l, row
{_COMPANY_MERGE}
"""

# Enrich: fill-only-empty onto a KNOWN target lead_id; never creates.
_ENRICH_UPDATE_CYPHER = f"""
/* connector:enrich-update */
UNWIND $rows AS row
MATCH (l:Lead {{org_id: $org_id, lead_id: row.lead_id}})
SET {_FILL_CLAUSE},
    l.apollo_contact_id = coalesce(l.apollo_contact_id, row.apollo_contact_id),
    l.email_norm = coalesce(l.email_norm, row.email_norm),
    l.company_domain_norm = coalesce(l.company_domain_norm, row.company_domain_norm),
    l.source = coalesce(l.source, $source),
    l.apollo_raw = coalesce(row.apollo_raw, l.apollo_raw),
    l.last_enriched_at = $now
WITH row, l
{_COMPANY_MERGE}
RETURN row.idx AS idx
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _chunks(items: List[Any], size: int):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def _dedupe_import_records(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Collapse intra-batch duplicates: keep first per email_norm, then per
    apollo_contact_id. Records with neither key are always kept."""
    seen_email = set()
    seen_contact = set()
    out: List[Dict[str, Any]] = []
    for rec in records:
        email = rec.get("email_norm")
        contact = rec.get("apollo_contact_id")
        if email:
            if email in seen_email:
                continue
            seen_email.add(email)
        elif contact:
            if contact in seen_contact:
                continue
            seen_contact.add(contact)
        out.append(rec)
    return out


def _import_chunk_tx(tx, org_id, user_id, chunk, file_id, source, now):
    """Atomic: fill-only-empty UPDATE matched leads, then CREATE the residue."""
    result = tx.run(_IMPORT_UPDATE_CYPHER, rows=chunk, org_id=org_id, source=source, now=now)
    matched_idxs = {record["idx"] for record in result}
    to_create = [r for r in chunk if r["idx"] not in matched_idxs]
    for rec in to_create:
        rec["lead_id"] = str(uuid.uuid4())
    if to_create:
        tx.run(
            _IMPORT_CREATE_CYPHER,
            rows=to_create,
            org_id=org_id,
            user_id=user_id,
            file_id=file_id,
            source=source,
            now=now,
        )
    return {"matched": len(matched_idxs), "created": len(to_create)}


def _enrich_chunk_tx(tx, org_id, chunk, source, now):
    result = tx.run(_ENRICH_UPDATE_CYPHER, rows=chunk, org_id=org_id, source=source, now=now)
    return {"updated": len({record["idx"] for record in result})}


def upsert_imported_leads(
    driver,
    org_id: str,
    user_id: str,
    records: List[Dict[str, Any]],
    *,
    file_id: str,
    source: str = "apollo",
    chunk_size: int = 500,
) -> Dict[str, Any]:
    """Import: dedup, then per-chunk atomic match-or-create. Returns counts."""
    deduped = _dedupe_import_records(records)
    for i, rec in enumerate(deduped):
        rec["idx"] = i
    now = _now()
    matched = created = 0
    errors: List[str] = []
    for chunk in _chunks(deduped, chunk_size):
        try:
            with driver.session() as session:
                out = session.execute_write(
                    _import_chunk_tx, org_id, user_id, chunk, file_id, source, now
                )
            matched += out["matched"]
            created += out["created"]
        except Exception as e:  # noqa: BLE001 — isolate a bad chunk, keep importing
            errors.append(str(e)[:300])
            logger.error("Import chunk failed (org_id=%s file_id=%s): %s", org_id, file_id, e)
    return {"matched": matched, "created": created, "errors": errors[:10]}


def enrich_fill_leads(
    driver,
    org_id: str,
    records: List[Dict[str, Any]],
    *,
    source: str = "apollo",
    chunk_size: int = 500,
) -> Dict[str, Any]:
    """Enrich: fill-only-empty by target lead_id. Each record must carry lead_id."""
    for i, rec in enumerate(records):
        rec["idx"] = i
    now = _now()
    updated = 0
    errors: List[str] = []
    for chunk in _chunks(records, chunk_size):
        try:
            with driver.session() as session:
                out = session.execute_write(_enrich_chunk_tx, org_id, chunk, source, now)
            updated += out["updated"]
        except Exception as e:  # noqa: BLE001
            errors.append(str(e)[:300])
            logger.error("Enrich chunk failed (org_id=%s): %s", org_id, e)
    return {"updated": updated, "errors": errors[:10]}


def _records_to_dicts(results) -> List[Dict[str, Any]]:
    """Deserialize Neo4j `RETURN l` Lead records into plain dicts (JSON-looking
    string properties re-parsed). Inlined to keep the connector package free of a
    private cross-package import from leads.normalization (review F4)."""
    leads: List[Dict[str, Any]] = []
    for record in results:
        lead_dict = dict(record["l"].items())
        processed: Dict[str, Any] = {}
        for key, value in lead_dict.items():
            if isinstance(value, str) and value.strip().startswith(("{", "[")):
                try:
                    processed[key] = json.loads(value)
                except json.JSONDecodeError:
                    processed[key] = value
            else:
                processed[key] = value
        leads.append(processed)
    return leads


def get_leads_by_ids(driver, org_id: str, lead_ids: List[str]) -> List[Dict[str, Any]]:
    """Load Lead nodes by id within an org (for building enrichment match entries)."""
    if not lead_ids:
        return []
    with driver.session() as session:
        result = session.run(
            """
            MATCH (l:Lead {org_id: $org_id})
            WHERE l.lead_id IN $lead_ids
            RETURN l
            """,
            org_id=org_id,
            lead_ids=lead_ids,
        )
        return _records_to_dicts(result)
