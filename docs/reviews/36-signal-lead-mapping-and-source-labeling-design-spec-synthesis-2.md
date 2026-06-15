---
synthesizes_review: docs/reviews/36-signal-lead-mapping-and-source-labeling-design-spec-review-2.md
artifact: specs/36-signal-lead-mapping-and-source-labeling-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-15
round: 2
---

## Round Recommendation

no

Reason: No Critical/High remain; all 14 findings are Medium/Low/Nit, agreed, and resolved by textual/scoping corrections that open no new design surface. Safe to proceed to planning (a round 3 is optional).

## Agreed Findings

(Each line is the revision being made.)

- **[Medium] Fingerprint step-ordering is self-contradictory.** Verified: §5.2 listed "compute fingerprint" in step 1, but the fingerprint hashes the ids fetched in steps 2–3. Reorder §5.2: (1) fetch signals → (2) fetch leads → (3) compute fingerprint + cache check + early-return-on-hit → (4) context → (5) Claude call → (6) parse → (7) cache write. Also state a cache hit still pays both DB fetches; it optimizes out only the Claude call, not the reads.
- **[Medium] `_claude_budget` is not the batch path's call mechanism.** Verified: `_reserve/_finalize_claude_signal_budget` are used only by `ask.py` (254/291/334); the batch/search path uses `_llm_helpers._claude_messages_text` (raw `/v1/messages`) with no budget call. Revise §2/§3/§5.2: the new endpoint composes a **single coherent lineage** — `_llm_helpers._claude_messages_text` for the call + `_llm_helpers._extract_research_json` for parsing (both research/batch-path helpers, no Tavily, no budget). Drop the false "shared mechanism" claim and the `_claude_budget` reference.
- **[Medium] `HeatmapLead.source` retype + `LeadSource`/`LeadSourceFilter` split unspecified.** Verified: `HeatmapLead.source` is a required `"HubSpot" | "Prospect List"` union; assigning `normalizeLeadSource` output won't typecheck. Revise §6.3: define `LeadSource = "apollo" | "csv" | "manual" | "unknown"` and `LeadSourceFilter = "all" | LeadSource`; retype `HeatmapLead.source` to raw `string | null` (keeping the sample literals valid) and apply `normalizeLeadSource` at the filter/badge boundary (legacy "HubSpot"/"Prospect List" → `unknown`).
- **[Low] LeadStream rewire silent on `filterByICP`/pagination.** Resolve in §5.7 A2: real `GET /api/v2/leads` leads carry no `matchedICP`, so the mock ICP-segment grouping/`filterByICP` is **dropped** (render a flat, source/tier-filterable list); paginate via the v2 `limit`/`offset` (first page + load-more). State this explicitly so the dropped ICP filter is intentional.
- **[Low] "Share no code path" overstated.** Qualify §1/§9: the features are independent on the data/contract layer but share the customers/LeadStream component; Feature #2's LeadStream badge/filter is **inert** (renders `unknown`) until Feature #1 rewires LeadStream to real leads.
- **[Low] §3 lists `"csv"` as a stored `Lead.source` value.** Verified: only `apollo` is ever persisted today; `"csv"` is a FE-only filter bucket. Correct §3 to stored `{"apollo", null}` and note `"csv"` is FE-only today.
- **[Low] Degrade note omits the missing-key 500/error path.** Revise §5.7: surfaces degrade silently on empty/loading/**error** (the §5.1 missing-key 500 surfaces in TanStack Query as an error → selectors return nothing → quiet).
- **[Low] `_extract_research_json` owner.** Verified: defined in `_llm_helpers.py` (imported by `parsing.py`). Cite `_llm_helpers` as the owner in §3/§5.2 (relevant for the truncated-prefix tolerance edit).
- **[Low] 50-signal window interacts with all surfaces.** State in §5.6/§5.7 that all mapping-driven surfaces (per-lead "N relevant signals" on both tables; "Affects N leads" on the Signals page) are bounded by the newest-50-signals window — "quiet when zero" beyond the window ≠ "no relevance."
- **[Low] Scoring loop location.** Verified: `_run_market_scoring_for_org` in `scoring.py:63` reads `get_leads_for_org`; `orchestrator.py:166` is only the status counter. Fix §3 attribution to `scoring.py`.
- **[Low] `create_lead` "respect explicit value".** Clarify §6.2: `create_lead` stores the flexible request `data` dict as-is, so an explicit `source` in `data` is already respected; the change is to default to `"manual"` when `data` carries none. No new API param.
- **[Nit] Missing ACs for LeadStream-rewire and windowing.** Add AC: customers/LeadStream renders real leads from `GET /api/v2/leads` with a restored empty state; and signals beyond the newest 50 are not mapped (windowing).
- **[Nit] AC #1 omits the `headline` echo.** Add `headline` (optional) to AC #1's entry shape.

## Disagreed Findings

None. All findings are correct or are ambiguities resolved by clarification.

## Deferred Findings

None new. (The round-1 cache-miss concurrency guard remains deferred, unchanged.)

## Severity Disagreements

None. The three Mediums are fair: the step-ordering contradiction and the false `_claude_budget` attribution would misdirect a plan-writer, and the `HeatmapLead.source` retype is a real unlisted edit (preflight `tsc` would catch it, but the spec should name it).

## Open Questions

None unresolved. The one scoping choice surfaced (LeadStream `filterByICP`) is resolved in this synthesis (drop the mock ICP segmentation; flat paginated real-lead list).
