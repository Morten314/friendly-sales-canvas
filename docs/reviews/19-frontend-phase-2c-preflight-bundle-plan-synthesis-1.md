---
synthesizes_review: docs/reviews/19-frontend-phase-2c-preflight-bundle-plan-review-1.md
artifact: plans/19-frontend-phase-2c-preflight-bundle.md
artifact_type: plan
reactor_model: claude-opus-4-7
date: 2026-05-28
round: 1
---

## Round Recommendation

no

Reason: 3 Mediums, 5 Lows, and 1 Nit agreed and revised in-plan; 1 Low (spec §7 Q3 consistency) also revises the paired spec; 2 Nits disagreed with reasoning. No Critical/High in the review; nothing remains to re-review.

## Agreed Findings

- **[M] No abort conditions stated.** Adding a new §0 "Execution conventions" block at the top of the plan covering recovery policy, parallelism guidance, and abort triggers. Defers phase-level abort criteria to master Spec 14 §5.7 (the existing Abort and revert protocol) and names three Phase-2c-specific triggers: (a) Phase 0 baseline JSON shape has drifted such that `capture-bundle-baseline.ts` no longer produces the comparator's expected schema, (b) Vitest fails to discover `frontend/scripts/check-bundle-budget.test.ts` and the discovery cannot be made to work without configuration changes outside Phase 2c's scope, (c) Playwright VR tests fail at the new 2% threshold against unchanged code (suggests a pre-existing Phase 0 snapshot integrity problem, not a 2c bug).
- **[M] No explicit recovery strategy.** The same new §0 block adds a global recovery policy: on any step failure, the agent stops and reports to the human, unless the failure is a trivial typo or path correction (in which case fix locally and retry once). No silent fixing of substantive issues.
- **[M] Hidden prerequisite: Vitest discovery for `frontend/scripts/`.** Adding a verification step at the end of Task 2 (before the commit) that runs `npx vitest list scripts/check-bundle-budget.test.ts` (or equivalent) to confirm Vitest's default include glob picks up the new test file. If discovery fails, the agent stops per the abort policy from M1 — this is exactly an abort trigger (b).
- **[L] `baseName` regex over-strips non-Vite-hashed filenames.** Adding a code comment in Task 3's `baseName` implementation documenting the assumption "all hyphenated filenames in `dist/` are Vite-hashed; falls down for `my-component.js`-style names if Vite emits them in future." Adding a test case in Task 3 Step 1 — `baseName("vendor/my-component.js")` → `"my-component.js"` — that the current regex would fail and that the engineer must therefore implement with awareness of the assumption. (Test passes only if the implementation does NOT over-strip; if the simple regex is used, this test fails, which is the signal.) Actually — given the simple regex DOES over-strip, this test would fail; including it is contradictory. **Resolved:** add only the code comment (documents the assumption). Skip the negative test — including a test that the implementation would fail would block the plan. If the assumption breaks in a future phase (chunk splitting, e.g.), Phase 3+ revisits per Risk R1.
- **[L] Task 7 missing Vitest regression check.** Inserting a new step between current Steps 1 and 2 that runs `npm run test -- check-bundle-budget` after `main()` is appended, before the smoke test, confirming the helper tests still pass. Cheap insurance against side-effect imports in `main()`.
- **[L] Tasks 11–12 parallelizable.** Covered by the §0 "Execution conventions" block's parallelism guidance: Tasks 1–8 are sequential; Task 9 must precede Task 10 (Task 10's preflight references Task 9's `bundle:check`); Tasks 11 and 12 are independent of A/B/C groups and can run in parallel with Tasks 9–10 in a subagent-driven model. Tasks 13–14 sequential at the end.
- **[L] Task 9 Step 2 baseline discard not verified.** Adding a `git diff docs/audits/2026-05-26-frontend-bundle-baseline.json` verification step after the `git checkout`, expected empty output. Catches silent checkout failures.
- **[L] Spec §7 Q3 resolution differs from plan implementation.** This is a real spec-vs-plan consistency issue. The plan's threshold-based suppression (`largeMatched.length > 0`) is more useful than the spec's "suppress when only one chunk" literal text. Updating spec 19 §7 Q3 wording to reflect threshold-based suppression (no plan change). This is a small spec amendment, separate from Task 13's master-Spec-14 amendments. The spec edit lands in this synthesis turn.
- **[Nit] LOC estimates exceed spec §3.5.** Aligning the plan's "File Structure" header estimates to spec values: `check-bundle-budget.ts` ~150 LOC (was ~180), README ~50 LOC (was ~60). These are estimates either way; the spec's numbers are the more recent commitment.

## Disagreed Findings

- **[Nit] `pad` could use `padStart` for numeric columns.** Disagree on changing. The spec §3.1 output sketch shows left-aligned values in the Baseline/Current columns. Using `padEnd` (left-align) preserves consistency with the spec's documented output shape. Switching to `padStart` (right-align) would diverge from the spec sketch — that's a spec change, not a plan-level call. The aesthetic preference is reasonable but should originate in spec revisions if at all.
- **[Nit] `bundle:rebaseline` redundant rebuild.** Disagree on changing. The script must be self-contained — calling it without a prior build would fail; calling it after a build does waste ~35s but produces a correct baseline. Optimizing the script to skip a redundant build introduces a stale-`dist/` failure mode that's more expensive to debug than the 35s it saves. The double-build is an acceptable cost of self-containment.

## Deferred Findings

None.

## Severity Disagreements

None.

## Open Questions

None surfaced during this round.
