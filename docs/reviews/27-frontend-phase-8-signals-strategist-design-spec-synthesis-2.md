---
synthesizes_review: docs/reviews/27-frontend-phase-8-signals-strategist-design-spec-review-2.md
artifact: specs/27-frontend-phase-8-signals-strategist-design.md
artifact_type: spec
reactor_model: claude-opus-4-8
date: 2026-06-04
round: 2
---

## Round Recommendation

no

Reason: Round 2 confirms round-1 Highs/Mediums resolved; residuals are Medium/Low clarifications, all revised in-spec or deferred with reasoning. No Critical/High remains; no new design surface opened.

## Agreed Findings

- **RM1 (8a test must survive 8c's migration)** — §7 8a/8c: state the 8a substrate test is written against the **public surface** (render/props/behavior via MSW-mocked `signal_Ask`/`signal_action` endpoints) so it survives 8c's raw-fetch→TanStack migration; 8c explicitly adds the `QueryClientProvider` harness and adjusts loading/error assertions. (Correcting the review's framing: MSW intercepts at the *network* boundary, so the handlers are unchanged across the migration — only the test harness + assertions change, not the mocking approach.)
- **RM2 (divergence fallback criterion)** — §4: add a tiebreaker — default to one *parameterized* hook when the page/substrate call shapes differ only in flags/options; *split* into specialized hooks only when the request/response *bodies* differ structurally.
- **RM3 (dual-gate partial-pass semantics)** — §7 finalize: state both gates must be green in one pre-merge pass; a failure in either (smoke or preflight) sends the branch to fix-and-re-run **both**, or abort, per Spec 14 §5.3 — explicitly distinct from the intra-phase `git reset` used for a failed 8a–8d stage checkpoint. (See Disagreed for the premise correction.)
- **RL1 (`verify` undefined)** — §7 8a checkpoint: define `verify` inline (typecheck + lint + change-scoped Vitest per root CLAUDE.md / Spec 14; the full Vitest suite runs only in `preflight`).
- **RL2 (per-component Vitest vs single `__tests__/`)** — §2.1: reference the Phase 5–7 co-located `__tests__/` convention (one test file per component in the nearest `__tests__/`; the §3 tree shows directories, not a one-dir-per-component mandate).
- **RL3 (dedup-handoff doc implicit in finalize)** — §7 finalize: explicitly call out the §5 dedup-handoff substrate documentation within the README finalize step.
- **RL5 (§3.3 ambiguity)** — §3.1: disambiguate the two bare `§3.3` references as `Spec 14 §3.3`.

## Disagreed Findings

- **RM3 premise (git reset on preflight failure)** — The review reasons that "a preflight failure after a passed smoke would indeed require a reset, re-fix, and re-run." That is incorrect: Spec 14 §5.3 defines the merge-gate remediation as *fix-on-branch + re-run (or abort)*, **not** a `git reset`. The `git reset --hard` mechanism (§7 intro) applies to a failed *intra-phase* 8a–8d stage checkpoint, not to the final merge gate. The finding's underlying ask (define partial-pass semantics) is valid and agreed; only its proposed remediation is rejected, and the revision states the correct path.

## Deferred Findings

- **RL4 (rename `SignalsContextChat` to a generic name)** — Deferred to Phase 9. Renaming now would pre-empt Phase 9, which owns the deduped shared chat primitive's final shape, and risks a Phase-8-then-Phase-9 double rename; keeping `SignalsContextChat` / `SignalsChatContext` through Phase 8 preserves move-traceability (file relocates, name unchanged). The review's alternative ("or state it's preserved for parity") is adopted: §5 gains an explicit name-deferral note. Trigger: Phase 9's wrapper dedup / shared-chat-surface finalization.

## Severity Disagreements

- **RM2 → Low (not Medium).** The missing tiebreaker governs an *unlikely contingency* — both call sites hit the same endpoint, so divergence is the exception, not the expected case. A missing tiebreaker for a contingency path is Low-weight. (Revised anyway, since the fix is one sentence.)
- **RM3 → Low (not Medium).** The remediation is already defined upstream (Spec 14 §5.3); the residual gap is one-line explicitness in this spec, and the review's reset premise was incorrect.

## Open Questions

- **One residual underlies RM1 + RM2:** whether the page and substrate truly share a single `signal_Ask`/`signal_action` call shape (hence one hook) is unverified until the plan inspects the live call sites. The spec now de-risks this from both directions — the public-surface test posture (RM1) means the test survives whichever way it lands, and the parameterize-vs-split tiebreaker (RM2) predetermines the structural choice. Resolved at plan/impl, not at spec stage.
