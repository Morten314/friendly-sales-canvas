---
synthesizes_review: docs/reviews/24c-frontend-phase-5c-page-decomposition-plan-review-3.md
artifact: plans/24c-frontend-phase-5c-page-decomposition.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-05-31
round: 3
---

## Round Recommendation

no

Reason: All eight findings agreed and revised; the one High was a task-boundary sequencing flaw fixed by making Task 1 a pure move (no new design surface), and the rest are faithfulness/hidden-prereq/guard additions. Loop converged.

## Agreed Findings

- **F1 (High — Task 1↔2 boundary drops sanitization + wrong knip rationale):** Reworked the boundary. Task 1 is now an explicit **pure move** that keeps rendering via the lifted `SafeMarketIntelligenceTab` (so sanitization is intact at the Task 1 commit); Task 2 does the single-concern swap (extract `sanitizeIntelligenceProps`, Safe→`FeatureErrorBoundary`, delete Safe + `MarketIntelligenceTab`). Removed the false knip-deferral note and replaced it with the accurate reason (knip in this repo reports unused *exports*, not *files*, per §7/`knip.json`; nothing is orphaned at Task 1 because `IntelligenceTab` still imports Safe). Updated Task 2's intro to note sanitization is never absent from a committed state.

- **F2 (Medium — placeholder in `TrendsTabProps`):** Removed the `/* ... */ ...` placeholder. Added Task 4 Step 1a to extract the page's inline `scoutResearchContext` shape (page L392) into a named `export interface ScoutResearchContext` in the feature `types.ts`, imported by both the page and `TrendsTab`; the interface now types the prop concretely.

- **F3 (Medium — window-global refresh helpers omitted from move inventory):** Added a bullet to Task 1 Step 3 to move the `declare global { interface Window {...} }` augmentation (page L59–65) **and** all `window.refreshStartTime`/`getAllScoutComponentResponses`/`getScoutResponses` assignments with the refresh layer, with a `grep` to confirm nothing outside the page reads them, and a matching removal note in Step 4.

- **F4 (Medium — no orphan-preview-server guard on `journeys/04`):** Added a kill-orphan-server step (`lsof -ti tcp:5173/4173 | xargs -r kill`) before the Playwright run in both Task 4 Step 3 and Task 6 Step 1, with a note explaining the repo's documented `reuseExistingServer` false-green and a reminder to match the playwright `webServer` port.

- **F5 (Low — Task 1 large commit reviewability):** Added a "moved, not modified" framing note to Task 1's intro telling the reviewer to audit move-faithfulness (byte-identical blocks modulo import paths) rather than line-by-line logic.

- **F6 (Low — shell handlers' independence from moved data unverified):** Added Task 1 Step 2 — grep/inspect the three shell-retained handlers for references to the six moved data states before the move; if any reads moved data, STOP (it's shared, not intelligence-local).

- **F7 (Low — `signalsChatContext` placement left in-flight):** Decided it. Task 4 Step 1c now moves `signalsChatContext` + its loader effect + clear into `TrendsTab` as internal state (single consumer → relocate, no hoist), with an explicit precondition: verify the out-of-band branch mounts/unmounts `TrendsTab` on tab change; if it CSS-hides instead, keep the `activeTab` guard via an `isActive` prop.

- **F8 (Nit — stale round-1/2 reviews not flagged):** Added a line to the plan's REWRITTEN note stating the pre-R1 `plan-review-{1,2}` + syntheses are superseded and review resumes at round 3.

## Disagreed Findings

(none)

## Deferred Findings

(none)

## Severity Disagreements

(none — F1 High, F2/F3/F4 Medium, F5/F6/F7 Low, F8 Nit all accepted as rated.)

## Open Questions

- F4's guard hardcodes ports 5173/4173. If the playwright config's `webServer` uses a different port, the kill step is a no-op and the false-green risk returns — the plan flags this ("confirm the port matches") but doesn't read the config. The implementer should confirm the actual E2E server port at execution time; left as a verify-step rather than hardcoding a possibly-wrong port into the plan.
