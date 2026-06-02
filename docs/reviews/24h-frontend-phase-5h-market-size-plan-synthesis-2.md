---
synthesizes_review: docs/reviews/24h-frontend-phase-5h-market-size-plan-review-2.md
artifact: plans/24h-frontend-phase-5h-market-size.md
artifact_type: plan
reactor_model: claude-opus-4-8
date: 2026-06-02
round: 2
---

## Round Recommendation

no

Reason: R1's High is confirmed resolved; all four R2 findings are Low/Nit — one agreed (trivial test/gate symmetry, applied) and three genuinely not warranting change. Plan is at nit-or-below.

## Agreed Findings

- **[Low] Hook test gates empty `orgId` but not empty `userId`.** Agree — real asymmetry. `userId = currentUser?.uid` is `undefined` when `useAuth()` returns `currentUser: null`, and the reference hook passes `userId` straight to `useResearchComponent` with no gate; the backend trusts client-supplied IDs (CLAUDE.md "auth reality check"), so an empty `userId` would fire a malformed query rather than fail safe. The R1 revision added the `enabled` note for `orgId` only. **Revision made (Task 2 Step 1 + Step 3):** added a second test case `does not fetch when userId is empty`, broadened the Step-1 prose to "orgId **or** userId empty → query disabled", and changed the Step-3 `enabled` guidance to `enabled: !!orgId && !!userId`.

## Disagreed Findings

- **[Low] Task 3 per-carve test scope is narrow (sibling regressions delayed).** Disagree, consistent with R1 (round-1 synthesis, same finding). No new argument is presented and the review itself concedes "Risk is low (intra-section cut-lines)" and "The `tsc` + `lint` gate catches import-level breakage." The per-carve block runs `npm run lint` + `npx tsc -p tsconfig.app.json` **project-wide** (Task 3 "After each step", current lines 350–355), so the realistic failure mode — a broken shared type/import/re-export — is caught at every carve. The only residual the narrow Vitest scope misses is a *behavioral* change in a shared utility, but a Task 3 carve creates new files under `market-size/` and moves markup **verbatim** (R4) — it does not edit shared utilities, so that path is near-zero, not merely low. Task 4 (`vitest run src/features/market-research`) and Task 5 (full preflight) close the window. The executor may add a midpoint broader run at will (nothing forbids it); mandating it is marginal ceremony against the pre-launch velocity posture. Leaving as is.
- **[Low] Reference impl invites verbatim copy despite "illustrative" label.** Disagree — already mitigated in R1, and the finding itself states "Neither is a plan defect." The R1 revision added the "illustrative, not copy-paste" banner (Step 3, line 251) plus an explicit two-mismatch verification note (line 278). More importantly, the trap is **self-correcting by construction**: Steps 1–2 write the test and run it **red before** Step 3 implements, so a verbatim paste against a divergent 5b API surfaces as a failing test, not a silent defect. Replacing the reference body with a signature-only stub would trade real executor guidance for a trap the TDD ordering already neutralizes. The agreed finding-1 fix (more test cases) strengthens this net further. No further change.
- **[Nit] Self-review section restates body at length.** Disagree, consistent with R1. The redundancy is deliberate reviewer-facing scaffolding — it exists so a reviewer can check claims without reconstructing them from the body. Trimming trades a small scannability gain for a verification cost on the next reviewer. Nit; not acting.

## Deferred Findings

(None.)

## Severity Disagreements

(None. Low/Nit are accurate for all four findings.)

## Open Questions

(None. The R1 systemic-pattern open question — whether 5d–5g also skipped their `useMarketResearchData()` slice removals — remains a live item for the orchestrator but is out of scope for 5h's plan and was not re-raised this round.)
