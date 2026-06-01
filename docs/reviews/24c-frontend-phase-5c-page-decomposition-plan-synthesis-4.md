---
synthesizes_review: docs/reviews/24c-frontend-phase-5c-page-decomposition-plan-review-4.md
artifact: plans/24c-frontend-phase-5c-page-decomposition.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-05-31
round: 4
---

## Round Recommendation

no

Reason: All six findings agreed or acknowledged and revised; the two Mediums are a duplicate-type clarification and a TDD-fit correction, neither of which opens new design surface — the loop converges.

## Agreed Findings

- **F1 (Medium — duplicate type `ScoutResearchContext` vs existing `ChatWithScoutResearchContext`):** Task 4 Step 1a now (1) acknowledges the identical legacy type, (2) states the decision — create the **feature-local** `ScoutResearchContext` and **accept the duplication** (the feature owns its types; importing the legacy type would point the feature *at* a leaving component, the wrong direction under the same one-way boundary Task 3 enforces; `ChatWithScout` leaves Phase 7+), and (3) notes structural typing lets `TrendsTab` pass a `ScoutResearchContext` into `ChatWithScout`'s `researchContext` prop with no cast. Added an instruction to comment the new interface as an intentional mirror until the legacy component is retired.

- **F2 (Medium — Task 1 Step 1 TDD overengineered for a pure move):** Rewrote Step 1 from "write the failing render test" to a **post-extraction mount smoke** test, written *after* Step 3 and run with the Step 5 suite. Rationale recorded inline: a verbatim move has no new behavior to drive, its characterization is the existing page-level Vitest suite + `journeys/04`, and test-first would force guessing the prop surface pre-extraction plus MSW for all 9 moved fetches. The smoke catches a broken extraction; real characterization TDD stays where it belongs (Task 2's sanitizer).

- **F3 (Low — verify trends `TabsTrigger` still navigates after the matching `TabsContent` is removed):** Added to Task 4 Step 2 a verification that the controlled trends trigger still fires navigation once its empty panel is gone — confirm `journeys/04` clicks the `chatwithscout` trigger (not just URL-navigates), else add an explicit click→navigate assertion / manual check. The trigger is the trends tab's only nav path and a regression there is invisible to `tsc`/lint.

- **F4 (Low — Task 5 Step 2 underspecified on what to remove):** Added a removal checklist to Task 5 Step 2 — delete imports/helpers/state that only served the moved code (including destructured/re-exported forms a name-grep misses), and assert the shell's import block contains *only* router + `Layout` + the three tab containers + shared types + `Tabs` chrome + the three handlers' dependencies. Notes that `tsc`/eslint already catch unused *imports*; the checklist targets the dead *helpers* and stale state they miss, making "thin shell" diff-auditable.

- **F5 (Nit — Task 4 Step 1c mount/unmount decision resolvable now):** Replaced the "verify in Step 2 and decide" hedge with the direct statement, grounded in the Task-0 Key facts: the out-of-band block renders conditionally (`{activeTab === "trends" && …}`) → mounts/unmounts on tab change → the `activeTab` guard is implicit → no `isActive` prop. Kept a one-line defensive fallback (re-add `isActive` only if a future change converts it to an always-mounted CSS-hide).

- **F6 (Nit — legacy import paths verified correct):** Acknowledged; no action. The review confirms `ScoutLeadStream`, `ScoutChatWithHistory`, `ChatWithScout`, and `SignalsChatContext` paths in Tasks 3–4 match live source. Recorded for traceability.

## Disagreed Findings

(none)

## Deferred Findings

(none)

## Severity Disagreements

(none — F1/F2 Medium, F3/F4 Low, F5/F6 Nit all accepted as rated. F2 is borderline Low↔Medium — the cost is wasted MSW setup and an awkward red-first step, not a correctness risk — but Medium is defensible because an implementer could sink real time provisioning 9-fetch MSW before realizing the mismatch.)

## Open Questions

- **Independent source re-verification was partially blocked this session** by an intermittent tool-output delivery glitch. F1's "identical shape" claim (`ChatWithScout.tsx` L16–21 vs page L392) and F5's `{activeTab === "trends" && …}` render form were taken from the review's stated source verification + the plan's Task-0 Key facts (which independently record the L392 inline `useState` shape and the `activeTab`-gated out-of-band render). The implementer should re-confirm both at execution time before relying on them.
- F3's "no-op" expectation assumes the page's `<Tabs>` is **controlled** (`value={activeTab}` + `onValueChange={handleTabChange}`). If it is uncontrolled, removing the matching `TabsContent` could behave differently — the added verification step covers this either way, but the assumption is worth confirming when Task 4 executes.
