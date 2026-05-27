---
synthesizes_review: docs/reviews/phase-0b-test-harness-impl-review-1.md
artifact: phase-0b-test-harness
artifact_type: impl
reactor_model: claude-opus-4-7
date: 2026-05-27
round: 1
---

## Round Recommendation

no

Reason: Reviewer's verdict is `clean`. All five findings are observations about pragmatic, already-resolved deviations — none block merge. One Medium finding is informational (timing measurement vs. plan estimate) and is properly deferred to Phase 2c, which is the spec-mandated home for preflight budgeting.

## Agreed Findings

- **[Low] `vitest.config.ts` `exclude` deviates from plan's "exact content."** Necessary fix — without `exclude: ['e2e/**', 'node_modules/**']`, Vitest's default include glob collects Playwright `e2e/**/*.spec.ts` files. The rationale is already inline-commented in `vitest.config.ts:15-17` and called out in the Task 1 commit body. No further action.
- **[Low] `rateLimitManager.test.ts` assertion ordering deviates from plan.** Reviewer explicitly calls this "a correct fix" / "improvement" — capturing the assertion before `vi.runAllTimersAsync()` avoids an unhandled-rejection warning. The rationale is comment-documented at the test site. No further action.

## Disagreed Findings

- **[Low] 11th commit outside plan scope.** The reconciliation commit (`7fbe56b`) was operator-directed after the per-task implementation cycle, with explicit pre-merge authorization (operator approved "Accept 30 as normative" in the spec-drift question). The plan's "10 commits" assertion in Task 11 Step 1 was an expected-output snapshot at the moment the plan was written; pre-merge operator-authorized amendments are not a violation of the spec-driven flow, they're its intended escape hatch ("specs and plans are a frozen record of intent" applies to post-merge drift, not pre-merge reconciliation under operator direction). Not actionable.

## Deferred Findings

- **[Medium] Vitest suite timing ~10x higher than plan estimate (33s actual vs. 2-4s estimated).** The 2-4s figures in plan §Task 1-6 reflected per-file solo runs without jsdom + plugin warm-up; the 33s NFR median is full-suite cold (6 files × ~5s jsdom spin-up + react-swc transform overhead). These measure different things, so they aren't strictly contradictory — but the reviewer is correct that downstream budgeting must use the actual 33s number, not the per-file figure.

  **Trigger to revisit:** Phase 2c is the spec-mandated home for `npm run preflight` budgeting against the fully-wired chain (master spec 14 §5.3). The `after_phase_0b` NFR JSON entry already captures the real measurement, so Phase 2c has the data it needs. The reviewer's specific suggestion — defer `@vitejs/plugin-react-swc` until component tests need it — is plausible micro-optimization but is a Phase 2c concern, not 0b, and might also break path-alias resolution depending on which plugin owns `tsconfig.json` paths handling.

- **[Nit] Plan's "10 commits" assertion in Task 11 Step 1 is stale.** Per CLAUDE.md "Spec-driven flow" — "specs and plans are a frozen record of intent... don't update specs/plans to reflect post-merge drift." Editing the plan to say "11 commits" right before merge creates a recursive count problem (the edit itself would be the 12th commit). The reviewer correctly tagged this as harmless. Leave as-is.

## Severity Disagreements

- **[Medium] → [Low] for the Vitest timing finding.** The reviewer's Medium rating is borderline for an informational observation that:
  1. Doesn't represent a defect (the suite runs correctly).
  2. Doesn't block any deliverable (the NFR JSON already captures the real number, which is the spec §3.6 deliverable).
  3. Has a tracked downstream home (Phase 2c budgeting per master spec 14 §5.3).
  
  In practice this reads more as a Low (informational, defer to designated downstream phase). Not load-bearing for the merge decision.

## Open Questions

None remain. All findings are either agreed-and-already-handled, disagreed-with-reasoning, deferred-with-trigger, or severity disputes. Branch is ready for merge.
