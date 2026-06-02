---
synthesizes_review: docs/reviews/24g-frontend-phase-5g-industry-trends-plan-review-1.md
artifact: plans/24g-frontend-phase-5g-industry-trends.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-02
round: 1
---

## Round Recommendation

yes

Reason: Finding 1 (High) is a real spec-§6 compliance gap; the fix adds page-level `useMarketResearchData` slice removal + cascade handling — new design surface that warrants a re-review.

## Agreed Findings

- **[High] Page-level `useMarketResearchData` industry-trends fetch not addressed.** Confirmed against spec §6 "Done when" ("the page's raw `fetch` site + cache slice for this section is removed") and §6's explanatory bullet ("the actual removal of each section's raw `fetch` site + its slice of the `CACHE_DURATION`/localStorage cache + cascade/timestamp/edit-history handling happens **here**"). Per spec §5 (line 181) and §2.1 (line 98), after 5c the page's raw-`fetch`/cache machinery lives in `useMarketResearchData()`. The plan only replaces the section's *own* dormant `fetchIndustryTrendsData` (Task 3) and drops the `MarketIntelligenceTabProps` data slice (Task 8) — it never references `useMarketResearchData`, so the industry-trends fetch/state/cascade-contribution/cache slice survives as orphaned I/O. **Revision:** add a Task 8 step (or new task) to remove the industry-trends slice from `useMarketResearchData` — its `fetch` site, `industryTrendsData` state, `CACHE_DURATION`/localStorage slice, and `data: previousContext` cascade contribution — explicitly documenting any cross-section cascade/timestamp/edit-history dependencies and migrating-or-consciously-dropping each per the §6 bullet. Update Task 9 Done-when item 2 to assert the page-level slice (not just the section file) is clean, tying it to 24i's zero-raw-`fetch` gate. If full removal proves coupled beyond 5g's blast radius, the fallback is an explicit deferral to a named sub-phase with a recorded `TD-FE` entry (not silent omission).
- **[Medium] Batching note names wrong section.** Confirmed against §1.4 table (5e=RegulatoryCompliance, 5h=MarketSize) and the §1.4 escape-hatch text ("IndustryTrends + MarketSize"); the plan also self-contradicts at Task 8 line 391 (5e=regulatory, 5h=market-size). **Revision:** change line 19 "5h RegulatoryCompliance" → "5h MarketSize".
- **[Medium] Task 8 Step 5 is one ~400-word checklist item.** Confirmed — it collapses ≥4 distinct actions (member removal, asymmetric-naming caveat, grep-first verification, keep-list, remaining-consumer projection, execution-time confirmation, 5h/5i cross-ref) into a single checkbox, defeating per-step reviewability and revert precision. **Revision:** decompose Step 5 into discrete sub-steps, each independently checkable.
- **[Medium] `useAuth()` availability not verified as a prerequisite.** Confirmed — Task 8 Step 3 sources `userId` via `useAuth()` (`currentUser?.uid`) without confirming `useAuth` is reachable from the feature's module space (it is likely a legacy context under the transitional import exception). **Revision:** add a one-line verification (to Task 0's seam audit or a Task 8 pre-step) confirming `useAuth`'s import path and recording it as a transitional legacy import.
- **[Low] Task 4 "Done when" overclaims consumption.** Confirmed — line 284 says "container/blocks consume them" but wiring happens in Tasks 7–8; Task 4 only creates and unit-tests the helpers. **Revision:** reword to "helpers unit-tested and green; consumed in Tasks 7–8."
- **[Low] Missed parallelizability of Tasks 3–4 vs 5–6.** Confirmed — Tasks 3–4 create new files; Tasks 5–6 modify the container; the two pairs share no state. **Revision:** add a one-line note that the 3–4 and 5–6 pairs MAY run in parallel (noting 5 and 6 both touch the container and so stay serial within their pair).
- **[Low] `orgId` source in importer JSX left unspecified.** Confirmed — Task 8 Step 4 says "Add `orgId={…}`" with an ellipsis, inconsistent with the plan's care over the asymmetric `industryTrendSnapshots` naming. **Revision:** add a note identifying `orgId`'s source prop/context (to be confirmed at execution time).
- **[Nit] Task 1 full `npm run test` vs later focused vitest.** Confirmed and intentional (relocation can affect anything). **Revision:** add a one-line note explaining the difference so an implementer doesn't generalize either approach.

## Disagreed Findings

(none)

## Deferred Findings

(none)

## Severity Disagreements

(none — agree with all assigned severities. Finding 1's High is appropriate: it is a spec "Done when" gate, and 24i's zero-raw-`fetch`/zero-`CACHE_DURATION` gate is load-bearing on every section sub-phase performing this removal.)

## Open Questions

- Spec §6's bullet describes 5c as relocating the raw data flow "into `IntelligenceTab`," but spec §5 (line 181) and §2.1 (line 98) — reflecting the 5c R1 hook-first replan — place it in `useMarketResearchData()`. The Finding-1 revision should target `useMarketResearchData` (the as-shipped location); the §6 wording is stale but immaterial to the finding. The plan should name the concrete hook so the implementer doesn't chase the stale `IntelligenceTab` phrasing.
- Whether removing the industry-trends slice from `useMarketResearchData` disturbs other still-unmigrated sections' cascade (`previousContext` chaining) is unknown until execution. If it does, that is the R3 escape-hatch trigger (coupling beyond this plan) and should be called out as such in the new step, not fixed-forward blindly.
