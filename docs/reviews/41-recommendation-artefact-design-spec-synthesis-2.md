---
synthesizes_review: docs/reviews/41-recommendation-artefact-design-spec-review-2-glm-5.2.md
artifact: specs/41-recommendation-artefact-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-23
round: 2
---

## Round Recommendation

no

Reason: Round 2 raised only 1 Low + 2 Nits; all agreed and revised this round (no Critical/High remain), and the reviewer confirms the spec is plan-ready — no round 3 needed before plan-writing.

## Agreed Findings

- **F1 [Low] — "Artifact" spelling convention applied inconsistently + relabel under-enumerated.** Verified the contradiction: AC#4 (L347) named the button "Save as Artefact" while §1/§3/D-7 say it relabels to "Artifact". Three revisions made: (a) AC#4 → "Save as Artifact" (Spec 38; relabelled from "Artefact" — copy only); (b) §1 L27, §3 L48, and D-7 L100 rephrased from present-tense "aligns" to an explicit copy **change** this feature makes (the existing button is "Artefact" today at `SignalCard.tsx:184`); (c) §13 now enumerates the relabel on both rows — SignalCard.tsx (button `:184`) and SignalsPage.tsx (toast `:536-538`). The pre-feature/current-state references at L9 and L23 (not flagged by the reviewer) correctly keep "Artefact" — they describe the as-shipped state on the other side of the change, now coherent with the explicit relabel narrative.
- **F2 [Nit] — §13 "parser unit test" stale vs the structured-JSON commitment.** Verified §13 L327 still said "parser unit test" while §7.3 (must be structured JSON) and §12 (structured-field extraction + malformed-JSON degradation) had moved on. Revised the §13 `backend/tests/` row to "structured-field extraction + malformed-JSON degradation test (per §7.3 / §12)".
- **F3 [Nit] — reusing `_claude_budget` inherits a hardcoded error label + a 429 not named in §10.** Verified both code claims directly: `_claude_budget.py:54-61` raises `BudgetExhaustedError({"error": "Token budget exceeded for signal_ask_claude", ...})` (hardcoded label) and `exceptions.py:11,136-138` maps it to HTTP 429. Two revisions: (a) §10 gains a budget-exhaustion (429) row stating the FE handles it like any backend error and the inherited `signal_ask_claude` label is cosmetic + never user-surfaced (accepted as-is, not generalised); (b) §7.1 D-3 now records the two accepted consequences of reusing the shared limiter — the shared 5-min token window with `signal_ask_claude`, and the inherited 429 label.

## Disagreed Findings

None. Both code-dependent claims (F1's existing button label/toast spelling; F3's hardcoded error string + 429 mapping) were checked against source and held.

## Deferred Findings

None. All three are cheap spec-text fixes addressed in this round.

## Severity Disagreements

None. F1 is correctly Low (a real internal contradiction + an under-enumerated affected change with mild plan-readiness impact, but trivial and non-design-blocking); F2 and F3 are correctly Nits.

## Open Questions

- **Shared budget pool (reviewer Observation, no action requested):** joining `_claude_budget` means playbook generations and `signal_ask_claude` recommendation answers share one 5-min token window, so heavy use of one can 429 the other. Accepted at MVP (0 users, generous window) and now recorded in §7.1 D-3 + §10; flagged only for awareness, no design change.
- **F11 label question (round 1) is now closed:** the operator chose "Save as Artifact" (American spelling, not "Save Playbook"); both buttons and the relabel are reconciled in the spec.
- **Proceed to plan-writing?** The reviewer states the spec is plan-ready and this synthesis recommends `no` further review. Whether to write `plans/41-recommendation-artefact.md` now (and whether to bump the spec's `Status: Draft (pre-review)` header) is the operator's call.
