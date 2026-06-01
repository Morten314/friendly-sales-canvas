---
synthesizes_review: docs/reviews/phase-5c-page-decomposition-impl-review-1.md
artifact: phase-5c-page-decomposition
artifact_type: impl
reactor_model: claude-opus-4-8
date: 2026-06-01
round: 1
---

## Round Recommendation

no

Reason: All seven findings are Medium-or-below and are either faithful moves of pre-existing behavior (structural-only scope) or consciously deferred to 5d–5h / Phase 7 — none is a defect introduced by 5c, and none blocks merge.

## Agreed Findings

(No finding calls for a fix applied *now* — all agreed items are deferred-by-design; see Deferred Findings. The substance of each finding is accepted as a real, correctly-characterized observation; the disposition is "defer," not "fix in this round.")

## Disagreed Findings

- **F4 (Low — `opportunityFilter` in the data-layer hook is a "cohesion violation").** Agree the observation, disagree the framing that it's a smell to clean up. `opportunityFilter` is **shell-shared cross-tab state** (written by `handleViewOpportunityLeads` on the intelligence→analysis jump, read by the analysis tab), so it fails the "tab-local" test and cannot live inside `LeadStreamTab` — that's exactly why the filter split (§9 delta 9) kept it in the hook. `useMarketResearchData()` is currently the single home for *all* shell-shared market-research state, not strictly "server data," so a shared UI filter living there is consistent with the hook's present role, not a cohesion break. It is correct as-is; the only real question is the hook's eventual internal organization, which 5d–5h owns. (Recorded rather than actioned.)

## Deferred Findings

- **F1 (Medium — `IntelligenceTab` casts the assembled prop object `as unknown as MarketIntelligenceTabProps`, defeating type safety).** Real and correctly described: `IntelligenceTabProps = Pick<MarketResearchData, …>` types the *inputs*, but the re-keyed `intelligenceProps` object handed to `MarketIntelligenceSections` is untyped at the cast boundary (line 652), so a rename on `MarketIntelligenceTabProps` compiles and fails at runtime. **Defer:** this is the pre-existing page-JSX prop spread moved verbatim (structural-only scope — a typed re-assembly would be a rewrite, out of scope), and it is self-extinguishing — 5d–5h replace `MarketIntelligenceTabProps` with per-section hook consumption, at which point the cast disappears with the type. **Trigger to revisit:** the first 5d–5h section conversion that touches the intelligence prop surface; until then, treat any `MarketIntelligenceTabProps` field rename as requiring manual verification at this boundary (note it in the 5d plan).

- **F2 (Medium — `useMarketResearchData.ts` is 6,039 LOC).** Accepted; this is the explicitly-planned outcome of the "pure move" (the spec/plan called for a verbatim extraction, no decomposition in 5c). **Defer:** 5d–5h progressively convert the hook's internals to the 5b TanStack hooks, shrinking it section-by-section. **Trigger:** each 5d–5h section sub-phase should treat the file size as active pressure to decompose its slice early rather than late; 24i confirms the residual.

- **F3 (Low — shell is 1,098 LOC, "thin" is aspirational).** Accepted as characterized: ~265 LOC hook destructure + ~190 LOC `<IntelligenceTab>` prop spread + ~140 LOC commented JSX. The prop spread is the intended consequence of props-not-context (correct for 2 shallow consumers); it shrinks as 5d–5h move sections to hook consumption. **Defer:** the "thin" end-state is reached across 5d–5h, not at 5c. **Trigger:** 5d–5h section conversions (prop surface) + F5 (commented blocks).

- **F5 (Low — two large commented-out JSX blocks remain, ~140 LOC).** Accepted; pre-existing (predate 5c), documented in §9 delta 9 and judged out of structural-only scope by the Task-6 reviews. **Defer:** a future sweep deletes or feature-flags them. **Trigger:** the 5i dead-code sweep is the natural home (alongside TD-FE-18); pull forward only if they obstruct a 5d–5h edit. (This is the one finding with a cheap "do it now" option — see Open Questions.)

- **F6 (Nit — thin test coverage: 3 files / 8 cases).** Accepted; the plan explicitly scoped these as smoke/mount-smoke tests for a structural move, with `journeys/04` + the existing suite as the behavioral guard. **Defer:** 5d–5h add per-section characterization tests as each section decomposes (§6 / §8). Related: TD-FE-20 already logs the trends/analysis e2e-parity gap.

## Severity Disagreements

- **F1: agree Medium (not lower).** One could argue Low since the cast is contained and self-extinguishing, but the failure mode is a *silent* compile-clean runtime break on a field rename across a 170-key surface — Medium is the right weight for a type-safety hole of that blast radius, even deferred.
- F2 (Medium), F3/F4/F5 (Low), F6/F7 (Nit) — all accepted as rated.

## Open Questions

- **F5 cheap-win option:** deleting the two commented-out JSX blocks (~140 LOC, pre-existing, no behavioral effect) is a low-risk edit that would materially improve the "thin shell" claim and could land before merge if desired. It was consciously deferred in Task 6 (out of structural-only scope) and is consistent to keep deferred to the 5i sweep — but it's the one finding actionable now at near-zero risk. Operator's call whether to do it pre-merge or leave to 5i.
- **F7 (Nit — `ScoutResearchContext` duplicates `ChatWithScoutResearchContext`):** acknowledged, intentional, no action — the feature-local type + structural typing is the deliberate one-way-boundary choice (§5 / Task 5); removed when `ChatWithScout` is retired (Phase 7+). Listed here only for completeness (no open action).
