---
synthesizes_review: docs/reviews/2026-05-29-apollo-lead-integration-design-spec-review-2.md
artifact: specs/23-apollo-lead-integration-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-05-29
round: 2
---

## Round Recommendation

no

Reason: The single High is resolved in-place with the reviewer's own simplest option (set `file_id` only on create); all four Mediums are clarifications now written into the spec; remaining items are Low/Nit or one reasoned deferral.

## Agreed Findings

- **F1 (High) — `file_id` overwrite corrupts batch ownership (§5.3, §5.5).** Adopt option (b): `file_id` is set **only on newly-created leads, never overwritten on a dedup match**. A matched lead stays attributed to the batch that created it, so `DELETE /leads/by-file/{file_id}` only ever removes leads that batch produced — no cross-source data-loss surprise. §5.5 now distinguishes `created_count` vs `matched_count`, and notes a re-import that only matches has an empty by-file view.
- **F2 (Medium) — does enrichment touch Company nodes? (§5.2, §6.1).** Enrichment write-back goes through the **same `ingestion` upsert as import**, so Company `MERGE`-by-domain + `Has_Lead` link applies identically when enrichment fills a previously-empty `company_domain`. Existing `Company` node properties are **not** separately enriched in v1 (lead-centric). Stated in §5.2 and §6.1.
- **F3 (Medium) — no batch-write strategy for large imports (§5.3, §6.1).** Specify **UNWIND-batched coalesce Cypher (chunks of ~500 leads/transaction)** over the fixed canonical fields for both import and enrichment write-back — not per-row transactions. Bounds wall-time and connection use at the 25,000 cap; `apollo_raw` is one JSON property per row. Updated §5.3 and §6.1.
- **F4 (Medium) — `bulk_match` payload unspecified (§6.1).** Specify the per-lead entry: **`id=apollo_contact_id` when present (exact match), else `{email, first_name, last_name, organization_name/domain}`** from the canonical fields. Added to §6.1.
- **F5 (Medium) — `list_id` vs `label` ambiguity (§6).** Clarify: `list_id` (optional) is the **Apollo list/label ID that filters** the contact search — omit → import all org contacts; `label` (optional) is the **Brewra batch display name** (`Lead_Stream_Files.filename`) — omit → derived default (Apollo list name, else `"Apollo import <timestamp>"`). Added to §6.
- **F6 (Low) — credential-validation endpoint unspecified (§5.4).** Specify a **credit-free** authenticated call — `GET /labels` (or `/contacts/search?per_page=1`) — explicitly **not** an enrichment/match call. Added to §5.4.
- **F7 (Low) — `ingestion.py` mixes writes with run tracking (§4).** Split the seam: `ingestion.py` becomes **pure lead/company writes**; the run-doc lifecycle (`Lead_Stream_Files` + `Connector_Enrich_Runs`) moves to a new `runs.py`. Updated the §4 module table.
- **F8 (Low) — `DELETE /connect` dead `user_id` (§6).** Drop `user_id` from `DELETE /connect`; credentials are keyed by `(org_id, provider)`, and the param implied an ownership check the unauthenticated-tenant posture doesn't perform. Updated §6.
- **F9 (Nit) — "one uniform rule" overstated (§5.3).** Reframe the heading to "shared match keys, divergent fallback" and make the create-new branch explicitly import-only (enrichment → `unmatched`). Updated §5.3.

## Disagreed Findings

(none — no finding is incorrect; F10 is deferred with reasoning below rather than disagreed)

## Deferred Findings

- **F10 (Nit) — §7 carries high implementation detail for a deferred section.** Defer (keep as-is). The detail (surfaces, hooks, affordances) is deliberate design capture and is the input to the future FE plan; trimming it now would discard useful design intent, and the §7 callout + §12.2 already fence the drift. Trigger: when the FE plan is authored post-refactor, §7 is re-grounded against the then-current `src/features/**` structure — that is the natural moment to refresh paths, not now.

## Severity Disagreements

- **F1 — accept High.** It is a genuine data-loss-on-delete path (deleting an Apollo batch could delete CSV-origin leads it merely matched), and cross-source email matches are expected, not rare. High is right.

## Open Questions

- **UNWIND chunk size** (proposing ~500 leads/transaction) — a tunable knob; confirm against staging Neo4j during the plan/impl, optionally with a stated perf budget (e.g., 10k contacts < 5 min).
- **Default batch display name** when `label` is omitted — Apollo list name vs `"Apollo import <timestamp>"`; settle in the plan (cosmetic).
