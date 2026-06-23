---
synthesizes_review: docs/reviews/41-recommendation-artefact-plan-review-1-glm-5.2.md
artifact: plans/41-recommendation-artefact.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-23
round: 1
---

## Round Recommendation

no

Reason: One Medium (inline-error gap) — resolved in-plan this round by adding a page-owned error key + card render + tests (honors spec §6.3/§10/AC#6) — plus one Nit (duplicate import), fixed. No Critical/High; reviewer verified all ~35 anchors accurate and the rest sound. Ready for implementation.

## Agreed Findings

- **F1 [Medium] — error path was toast-only; spec §6.3/§8.4/§10 + the plan's own AC#6 require an inline-below-row error too.** Verified against the plan (Task 10 catch fired only a toast) and the spec (§10 row 1 "inline below row … + error toast"; §6.3 step 5; §8.4 step 8) and AC#6 ("yields the inline error"). The "re-enabled button" and "no hollow artefact" halves were already satisfied; the inline message was the missing piece, and AC#6 claimed an inline error the handler didn't deliver (an internal contradiction). Chose the reviewer's **option (a)** — implement, not relax the twice-reviewed spec — because the card already has the inline-`<p>` affordance (`artefactHint`) and the fix is cheap and consistent. Revisions: Task 9 adds a third prop `recommendationArtefactErrorKey: string | null`, a `showArtefactError` flag, and a red `role="alert"` inline `<p>` (rendered when the key matches and no gating hint is active) + a card-render test; Task 10 adds page state `recommendationArtefactError`, sets it in the handler `catch` (alongside the toast), clears it on retry (handler start) and on collapse (the `expandedRecommendation` reset effect), wires `recommendationArtefactErrorKey`, and adds a backend-reject wiring test (asserts the inline error appears + delivery is skipped). AC#6 now holds. (Severity agreed — see below.)
- **F2 [Nit] — Task 7 Step 3 instructed a duplicate `../contracts` import.** Verified: `signalBriefing.ts:4` already imports `SignalLeadMapLead` from `"../contracts"`; the plan's separate `import type { RecommendationArtefactResponse } from "../contracts";` line would be a second import from the same module (valid TS, not lint-gated here, but cosmetic). Revision: Task 7 Step 3 now extends the existing line-4 import (`RecommendationArtefactResponse, SignalLeadMapLead`) and the line-5 `../types` import, with an explicit "do not add a second `../contracts` line" note.

## Disagreed Findings

None. Both findings are factually correct against the plan + the cited spec sections + the source.

## Deferred Findings

None. Both are cheap and addressed this round.

## Severity Disagreements

None. F1 is correctly **Medium** — a real spec-fidelity gap and an AC#6 contradiction, but with a working (if non-spec) substitute (the toast notifies + the button reverts), so not a silent failure and low real-world cost at MVP. F2 is correctly a **Nit** (cosmetic, not lint-gated).

## Open Questions

- **F1 resolution choice (option a vs b):** the reviewer offered either implementing the inline error (a) or explicitly relaxing the spec to toast-only (b). Chose **(a)** — the spec was just twice-reviewed and deliberately specifies inline+toast, the inline pattern already exists in the card, and the cost is one prop + a small render path. If the operator prefers velocity over fidelity here, (b) (relax §6.3/§10/AC#6 to "error toast," recorded) remains available — but (a) is applied.
- **Reviewer Observations (no action):** the two-same-named-buttons safety, Task 5 live-verify fallback grounding the FE contract, risk front-loading, serial parallelizability, recovery/kill-criteria under the failure-stop net, and "no scope creep" were all confirmed sound — no revisions needed.
