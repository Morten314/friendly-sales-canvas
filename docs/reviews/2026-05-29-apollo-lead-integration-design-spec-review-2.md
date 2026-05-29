---
artifact: specs/23-apollo-lead-integration-design.md
artifact_type: spec
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-29
round: 2
---

## Context

Round 2 review of a spec that was substantially revised after round 1. Most round-1 findings (concurrent-write semantics, import cap, no-email dedup, connector seam, `reveal_*` config, 429 parameters, `requests`/async) are resolved in the current text. This review is independent — it evaluates the spec as it stands, not delta from round 1.

## Findings

### [High] `file_id` overwrite on cross-source matches corrupts batch ownership semantics

**Location:** §5.3 ("Bookkeeping fields … `file_id` … always refresh"); §5.5 ("import = a synthetic file"); §6 ("Reused as-is: … `DELETE /leads/by-file/{file_id}`")

The spec says `file_id` "always refreshes" on a dedup match. This means: if a user imports 100 leads via CSV (batch A), then imports from Apollo and 40 match by email, those 40 leads get their `file_id` overwritten to the Apollo batch (batch B). The user then sees batch A shrink by 40 and batch B include 40 leads they think of as "CSV leads." If they `DELETE /leads/by-file/{batch-B-id}`, those 40 originally-CSV leads are deleted — a surprising data-loss scenario.

The existing `batch_upload_leads` does the same thing via `upsert_node` (full SET), but cross-source matches are far more likely with Apollo than with re-uploading the same CSV. The spec claims the file-batch surface lights up "with **no new CRUD**" and doesn't acknowledge this interaction.

**Suggestion:** Either (a) use a multi-valued tracking field (e.g. `file_ids: ["csv-batch-A", "apollo-batch-B"]`) and change delete to REMOVE rather than MATCH-AND-DELETE, (b) skip `file_id` overwrite on cross-source match (only set it on newly-created leads), or (c) explicitly document the behavior and accept it as a known limitation. Option (b) is simplest and preserves the "delete batch = delete only leads that originated from that source" mental model.

### [Medium] Enrichment flow does not specify whether Company MERGE occurs

**Location:** §4 `ingestion.py` ("`MERGE` company-by-domain"); §5.2 ("Additionally `MERGE` a `Company` node"); §6.1 Enrichment flow

§4 describes `ingestion.py` as doing "`MERGE` company-by-domain" and §5.2 says imported records produce a Company node. But the enrichment flow in §6.1 only says "normalize results → `upsert_lead_by_email` fill-only-empty write-back" — no mention of Company MERGE. If enrichment returns updated company data (e.g., a different `company_domain`), should the Company node be created/updated? Should fill-only-empty apply to Company properties too? The spec needs to state whether enrichment touches Company nodes or only Lead nodes.

### [Medium] No batch-write strategy for large imports

**Location:** §6.1 Import flow ("`ingestion.upsert_lead_by_email` … per row"); §8 ("hard cap of 25,000 records")

The import processes contacts one at a time: paginate → normalize → upsert per row. At 25,000 leads, that's 25,000 individual Neo4j transactions (each a MERGE + per-property coalesce SET + Company MERGE). No write-coalescing, batched Cypher, or `UNWIND`-based bulk upsert is mentioned. On a hosted Neo4j instance (e.g., AuraDB or similar), this could take tens of minutes and hit connection limits. The spec should either specify a batch-write strategy or explicitly defer to the plan with a performance budget (e.g., "import of 10K contacts completes in under 5 minutes on staging hardware").

### [Medium] `bulk_match` request payload is unspecified

**Location:** §6.1 Enrichment flow ("calls `/people/bulk_match` in batches of 10")

Apollo's `/people/bulk_match` accepts a list of person-search objects (first_name, last_name, email, organization_name, etc.) and returns matched profiles. The spec says enrichment "applies the §5.3 match hierarchy (email → `apollo_contact_id`)" but doesn't specify what identifying data is sent per lead to `bulk_match`. Is it just `{email}`? `{email, first_name, last_name, organization_name}` for better match quality? Does `apollo_contact_id` map to a specific `bulk_match` parameter? The match quality and credit cost depend on this choice. One sentence specifying the per-lead request payload would suffice.

### [Medium] `list_id` vs `label` parameter semantics on POST /import are ambiguous

**Location:** §6 ("`POST /connectors/apollo/import` `{org_id, user_id, list_id?, label?}`")

Both `list_id` and `label` are optional. What's the relationship? Is `list_id` an Apollo list identifier and `label` the human-readable name for the batch? Can both be provided? If neither is provided, does the import pull all contacts? §6.1 says "optionally scoped to a chosen Apollo list (label)" which implies `label` is the Apollo list filter, but the parameter name `list_id` suggests an ID. The spec should clarify: (a) which parameter filters the Apollo contact search, (b) which becomes the batch's display name, and (c) what happens when neither is provided (import all contacts for the org?).

### [Low] Credential validation endpoint is unspecified

**Location:** §5.4 ("Validated by a cheap authenticated Apollo call on save")

Which Apollo endpoint is the "cheap authenticated call"? A minimal `/contacts/search` with `page=1&per_page=1`? The `/labels` endpoint? Specifying this would help the plan author choose correctly and avoid accidentally burning enrichment credits on validation.

### [Low] `ingestion.py` mixes provider-agnostic lead writes with connector-specific run tracking

**Location:** §4 `ingestion.py` ("provider-agnostic … the enrichment run-doc lifecycle")

The module is described as "provider-agnostic (operates on the normalized canonical dict, not on a connector type)" but also owns "the enrichment run-doc lifecycle" — a connector-specific concern tied to `Connector_Enrich_Runs`. If a future HubSpot connector reuses `ingestion.py` for lead writes but has its own run-tracking semantics, the run-doc logic either gets tangled or needs extraction. Not a blocker for v1, but worth noting the seam isn't clean.

### [Low] `DELETE /connect` accepts `user_id` with no stated purpose

**Location:** §6 ("`DELETE /connectors/apollo/connect?org_id=&user_id=`")

The endpoint takes both `org_id` and `user_id`. Given the unauthenticated tenant posture (no authz on `org_id`), what is `user_id` used for? Audit logging? A future auth check? If unused in v1, it should be documented as reserved or removed to avoid a dead parameter that implies a security check that doesn't exist.

### [Nit] "One uniform rule" framing in §5.3 is slightly overstated

**Location:** §5.3 ("Identity, dedup & merge — one uniform rule (import **and** enrichment)")

The third branch of the match-key hierarchy is "create a new lead (new `lead_id` UUID)" — this only applies to import. For enrichment, unmatched leads are reported as `unmatched`, not created. The parenthetical ("A selected lead with neither key is reported as **unmatched** in the run") covers the enrichment case, but the "one uniform rule" heading could mislead a reader into thinking the entire hierarchy applies identically to both flows. Suggest rephrasing the heading to "match-key hierarchy (shared, with divergent fallback)" or similar.

### [Nit] §7 frontend detail will drift during FE refactor

**Location:** §7 (entire section)

The section itself acknowledges this ("file paths below are accurate to *today's* layout; they will be re-grounded") and the deferral rationale in §12.2 is solid. Flagging only because the level of implementation detail (specific component names, file paths, hook patterns) in a deferred section is unusually high — a briefer intent statement with fewer path references would age better and reduce re-grounding effort.
