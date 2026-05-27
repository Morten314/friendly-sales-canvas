---
artifact: phase-0b-test-harness
artifact_type: impl
verdict: clean
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-27
round: 1
base_ref: master
spec_loaded: true
plan_loaded: true
---

## Context

Branch has 11 commits; plan specified 10. The extra commit (`docs(spec+plan): reconcile Phase 0b spec drifts pre-merge`) reconciles three spec drifts (rateLimitManager 30 vs 4 cap, utils.ts second export, marketScoreDescriptions lookup shape) that the plan's Open Questions section originally deferred to post-merge. Reconciling pre-merge is cleaner and the deviation is well-motivated.

The actual `vitest.config.ts` adds `exclude: ['e2e/**', 'node_modules/**']` not present in the plan's "write this exact content" block — a necessary addition preventing Vitest from collecting Playwright spec files.

The rateLimitManager "rejects non-rate-limit errors immediately" test reorders the assertion capture (`expect(p).rejects.toThrow(...)`) before `vi.runAllTimersAsync()` with an explanatory comment, avoiding unhandled rejection warnings. The plan's version asserted after timer advancement. This is a correct improvement.

## Findings

### [Medium] Vitest suite timing ~10x higher than plan estimate

**Location:** `docs/audits/2026-05-26-frontend-nfr-baseline.json:62` (vitest_full_suite_seconds median: 33.448s)

The plan repeatedly estimates Vitest wall time at "~2-4s" (Tasks 1, 2, 3, 5, 6). The actual NFR measurement shows 33.4s median — roughly 10x the estimate. The primary cause is jsdom environment spin-up per test file (~5s each × 6 files) plus `@vitejs/plugin-react-swc` transform overhead in the Vite pipeline. Not a correctness issue, but it means:

1. The preflight chain is now ~165s total (typecheck ~0.4s + build ~37s + playwright ~72s + vitest ~33s), higher than the plan's "~100-130s" estimate.
2. Phase 2c's budgeting must account for the actual 33s baseline, not the plan's 2-4s estimate.

The test files themselves are fast; the overhead is infrastructure (jsdom + react-swc plugin). Future phases adding component tests will see similar per-file overhead. Consider whether the `react()` plugin can be deferred until component tests actually need it (no Phase 0b test renders a component).

### [Low] 11th commit outside plan scope

**Location:** commit `7fbe56b docs(spec+plan): reconcile Phase 0b spec drifts pre-merge`

The plan specified 10 commits (Tasks 1-10) plus a no-commit Task 11. The branch ships 11 commits because the spec/plan reconciliation was landed as a discrete commit rather than as post-merge follow-up. The plan's original Open Questions section proposed adding a TD-FE entry post-merge for the rateLimitManager cap discrepancy; the actual implementation amended the spec directly and reconciled all three drifts. This is arguably better than the plan's approach (no stale TD-FE entry needed), but it does mean the spec was modified on the feature branch after the spec review cycle completed — a minor process note for future phases.

### [Low] `vitest.config.ts` `exclude` line not in plan's exact content

**Location:** `frontend/vitest.config.ts:17`

The plan's Task 1 Step 3 says "Write this exact content" and provides a `vitest.config.ts` without an `exclude` field. The actual file adds `exclude: ['e2e/**', 'node_modules/**']`. This is necessary — without it, Vitest collects `e2e/**/*.spec.ts` files (which use `@playwright/test`'s `test()` function) and fails. Correct pragmatic fix, but the plan's "exact content" instruction was not followed verbatim.

### [Low] `rateLimitManager.test.ts` assertion ordering deviates from plan

**Location:** `frontend/src/lib/__tests__/rateLimitManager.test.ts:120-125`

The plan's "rejects non-rate-limit errors immediately" test runs `vi.runAllTimersAsync()` first, then asserts `await expect(p).rejects.toThrow(...)`. The actual code captures `const assertion = expect(p).rejects.toThrow(...)` before timer advancement, then awaits it after. The in-line comment explains: "avoids unhandled rejection warning from the timing gap between reject() and await." This is a correct fix — the plan's version would produce an unhandled rejection warning in some Vitest/jsdom configurations. The deviation is an improvement.

### [Nit] Plan's "10 commits" assertion in Task 11 Step 1 is now stale

**Location:** `plans/15b-frontend-phase-0b-test-harness.md:2084-2097` (Task 11 Step 1 expected output)

Task 11 Step 1 lists exactly 10 expected commits. With the reconciliation commit, the actual count is 11. Not a code issue — the plan file itself is now slightly out of date relative to the branch state. Harmless since the plan is a frozen record of intent per CLAUDE.md, but a future operator running Task 11's verification checklist will see a count mismatch.
