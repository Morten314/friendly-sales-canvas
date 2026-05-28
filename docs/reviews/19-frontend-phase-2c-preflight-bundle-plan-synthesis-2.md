---
synthesizes_review: docs/reviews/19-frontend-phase-2c-preflight-bundle-plan-review-2.md
artifact: plans/19-frontend-phase-2c-preflight-bundle.md
artifact_type: plan
reactor_model: claude-opus-4-7
date: 2026-05-28
round: 2
---

## Round Recommendation

no

Reason: 4 Lows and 2 Nits agreed and revised in-plan; 1 Low disagreed on principled scope grounds (compareAndPrint golden-file regression guard). No Critical/High; all remaining items addressed.

## Agreed Findings

- **[L] Smoke test zero-delta template.** Task 7 Step 4's "Expected output (roughly)" block shows `+0 B (+0.00%)` for every delta, contradicting the surrounding prose ("deltas may be non-zero"). Replacing the zero values with `<delta>` placeholders so the template clearly conveys shape-not-values, eliminating the trap of an executing agent treating zeros as expected.
- **[L] No pre-check that `capture-bundle-baseline.ts` exists.** Adding a defensive `ls` check at Task 9 Step 1 (before adding the `bundle:rebaseline` script that delegates to it). A missing dependency produces a clearer diagnostic than the downstream npm script failure.
- **[L] `baseName` over-stripping limitation untested.** Adding one test case in Task 3 Step 1 that asserts the *current* (over-stripping) behavior with an explanatory comment — `expect(baseName("vendor/my-component.js")).toBe("my-*.js"); // documents known limitation per Risk R1`. This passes today; if Phase 3+ revisits and tightens the regex, this test signals the behavior change and forces an intentional update. Distinct from round 1 — that round I (correctly) rejected adding a test the implementation would fail; this round's framing is "document current behavior," which is a passing test.
- **[L] `bundle:rebaseline` writes to Phase 0 anchor before discarding.** Round 2's stronger framing: even with the git diff verification I added in round 1, running `bundle:rebaseline` overwrites the canonical baseline JSON, creating a window where a crashed/skipped discard contaminates the anchor. Revising Task 9 Step 2 to **not run `bundle:rebaseline` at all** during verification. Instead: confirm the npm script is defined (`npm run bundle:rebaseline --help` or equivalent dry inspection) and `frontend/scripts/capture-bundle-baseline.ts` exists. Phase 0 established the capture script's correctness; we don't need to re-prove it during Phase 2c.
- **[Nit] `pad` helper trivial indirection.** Inlining `.padEnd(width)` at the 7 call sites in `compareAndPrint`; removing the `function pad(...)` definition. No behavioral change; net –4 LOC.
- **[Nit] Task 9 Step 1 full scripts block.** Switching to an insert-only instruction (show the two new lines plus minimal surrounding context) rather than the full `scripts` object. Reduces the risk of an executing agent accidentally truncating a key that exists on the branch but wasn't shown in the plan.

## Disagreed Findings

- **[L] `compareAndPrint` output has no automated regression guard.** Reviewer suggests capturing stdout into a committed golden file under `__fixtures__/` for regression-anchor purposes. Disagree on adding it to Phase 2c, for three reasons:
  1. **Scope creep relative to Brewra's testing posture.** The plan's File Structure explicitly documents the IO/rendering smoke-test approach (see §File Structure note). The other `frontend/scripts/` files (`capture-bundle-baseline.ts`, `build-audit-scorecard.ts`, etc.) follow the same pattern — visual smoke + script-level confidence. Adding golden-file tests for `check-bundle-budget.ts` alone introduces a new pattern that future scripts would need to adopt for consistency.
  2. **Advisory output, low blast radius.** The comparator's output is advisory (per spec §1.3 resolution 1). Format drift produces "slightly worse advisory table" — not a correctness regression. The cost-of-broken vs cost-of-test ratio doesn't favor adding the test infrastructure for Phase 2c.
  3. **"Lightweight" undersells implementation cost.** A proper golden-file harness needs deterministic-output guarantees (no timestamps, no machine-specific paths), capture-stdout test infrastructure, an update workflow for intentional format changes, and a precedent decision for the other scripts. ~30–40 LOC of test infra plus future maintenance, not "lightweight."

  Visual inspection in Task 7 Step 4 catches major format breaks (table renders correctly, totals match). The risk this finding addresses is real but its severity is mismatched for Phase 2c's scope; if Phase 14 hardens the comparator to non-advisory mode, that's the natural moment to add the regression guard. Logged as a no-action item; not adding to TD-FE since the spec/plan already acknowledge the gap.

## Deferred Findings

None.

## Severity Disagreements

None — the reviewer's severities are appropriate for the findings.

## Open Questions

None surfaced during this round.
