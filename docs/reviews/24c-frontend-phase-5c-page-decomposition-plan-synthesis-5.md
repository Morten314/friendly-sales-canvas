---
synthesizes_review: docs/reviews/24c-frontend-phase-5c-page-decomposition-plan-review-5.md
artifact: plans/24c-frontend-phase-5c-page-decomposition.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-01
round: 5
---

## Round Recommendation

no

Reason: All seven findings are Medium-or-below and agreed (one with a corrected mechanism); they harden verification/wording on the delta-8 hook-first rewrite without opening new design surface — the loop converges.

## Agreed Findings

- **F1 (Medium — Task 2 omits `journeys/04` despite extracting the primary MR surface):** Agree. Task 2 lifts the ~390-line intelligence subtree and rebuilds its ~169-prop surface via `{...slice}`; a miswired prop is a likely failure mode that the existing Vitest suite may not fully exercise, and the next `journeys/04` isn't until Task 5 (a regression could ride through Tasks 3–4). Add `journeys/04` (with the orphan-server kill guard, as in Tasks 1/5/7) to Task 2 Step 4's green gate. Low cost, closes a two-commit blind spot on the most user-visible surface.

- **F2 (Medium — Task 5 Step 2 must preserve the tab conditional when swapping in `<TrendsTab/>`) — agree finding, CORRECT the mechanism:** Agree the instruction "Replace the out-of-band block (L6494–6511) with `<TrendsTab .../>`" is unsafe read literally. **But the reviewer's stated structure is wrong:** the live source (verified this session, `MarketResearchPage.tsx` L6494) is a **ternary**, not `{activeTab === "trends" && (…)}` — `{activeTab === "trends" ? (<trends block, L6494–6511>) : (<ScrollArea>…the other tabs' content…</ScrollArea>)}`. So a literal replacement of exactly L6494–6511 doesn't make TrendsTab "render on every tab" (the reviewer's failure mode); it produces a **broken ternary** (`<TrendsTab/> ) : ( <ScrollArea>…`) and/or mis-renders the other tabs. Fix Step 2 to be explicit: replace only the **true-branch content** of the ternary, preserving `{activeTab === "trends" ? <TrendsTab … /> : (<ScrollArea>… `<IntelligenceTab/>` / `<LeadStreamTab/>` …</ScrollArea>)}`. Keep Medium.

- **F3 (Low — Task 2 has no explicit "write the test file" step):** Agree. The test appears in Step 4's `git add` but no step says to write it. Fold into Step 3: "Create both `IntelligenceTab.tsx` and `__tests__/IntelligenceTab.test.tsx`" (the smoke test still authored after the component exists, run in Step 4). Cheap clarity fix for a literal executor.

- **F4 (Low — `TrendsTabProps` sketch omits `onTabChange`):** Agree. Step 2 passes `onTabChange={setActiveTab}` and Step 1c references it, but the Step 1b interface sketch lists only `scoutResearchContext`/`scoutMode`/`editHistory`. Add `onTabChange: (tab: string) => void` (matching the shell's `setActiveTab` signature) to the sketch so it matches the props later passed.

- **F5 (Low — no secondary abort heuristic beyond the R1 coupling trigger):** Agree, minimally. Given R1 fired twice (both replans), a one-line human decision tripwire is cheap and warranted: add to "Failure handling" — "if ≥2 non-coupling tasks need human intervention for unexpected failures, pause and reassess whether the hook-first cut is viable before continuing." Advisory only; does not change execution.

- **F6 (Nit — Task 3 hardcodes the wrapper `className` from inventory):** Agree. Replace the hardcoded `className` with an instruction to copy the exact wrapper `className` from the `MarketIntelligenceTab` source being deleted (guarding against drift since the inventory snapshot), keeping the shown value as the expected/illustrative form.

- **F7 (Nit — Task 1 smoke test may need disproportionate MSW for 9 fetches):** Agree. Soften Step 4: a coarse fetch stub (e.g. `vi.spyOn(globalThis, "fetch")` returning a canned envelope, or MSW only for the mount-fired sites) is sufficient — the smoke test's job is to catch a broken extraction, not to characterize all 9 endpoints (the existing suite + `journeys/04` do that). Avoids standing up 9 handlers for a pure-move guard.

## Disagreed Findings

(none — all findings hold; F2's substance is correct, only its structural characterization was wrong and is corrected above.)

## Deferred Findings

(none)

## Severity Disagreements

(none — F1/F2 Medium, F3/F4/F5 Low, F6/F7 Nit all accepted as rated. Note F1 is borderline Low↔Medium — Vitest + the Task-5 `journeys/04` would surface a regression within two commits — but Medium is defensible because the gap is on the primary surface and bisection across the intervening commits is the cost being avoided.)

## Open Questions

- **F2 line-range precision at apply time:** the exact split between the ternary's true-branch end and the `) : (` is an implementation-time read (the plan's "L6494–6511" is a 2026-05-31 anchor that a `sync.sh` merge can shift). The revised Step 2 should instruct the implementer to locate the ternary boundaries in the live file rather than trust the line numbers — consistent with the plan's existing line-anchor caveat.
