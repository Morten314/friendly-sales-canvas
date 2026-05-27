---
synthesizes_review: docs/reviews/15b-frontend-phase-0b-test-harness-plan-review-3.md
artifact: plans/15b-frontend-phase-0b-test-harness.md
artifact_type: plan
reactor_model: claude-opus-4-7
date: 2026-05-27
round: 3
---

## Round Recommendation

no

Reason: All findings are Low/Nit polish items (one wording correction, one missing assertion, one import-style reversion, one extra characterization assertion); reviewer's checklist coverage is unchanged from prior rounds with all Round 2 findings confirmed resolved.

## Agreed Findings

- **Low 1 ["Eleven commits" → "Ten commits"].** Verified: Tasks 1+2+3+4+5+6+7+8+9+10 = 10 commits, Task 11 is verification-only. Architecture header at line 7 is internally inconsistent with the Task 11 Step 1 verification block. Fix: change "Eleven commits on one branch" to "Ten commits on one branch."
- **Low 2 [Gap journeys missing explicit page-content visibility assertion per spec §3.4].** Verified: spec §3.4 says "assert the page heading or a recognizable element is visible." The plan's specs check `not.toHaveURL(/\/login/)` (auth proxy) then jump to `toHaveScreenshot` (visual proxy) — neither is the explicit behavioral assertion the spec requires. Fix: add `await expect(page.locator('h1, h2, h3, [role="heading"]').first()).toBeVisible({ timeout: 5000 });` between the URL check and the screenshot in both Task 7 and Task 8 spec files. The page-agnostic selector (any heading or ARIA heading role) avoids hardcoding a brittle text match while still satisfying the spec's "page heading or recognizable element" requirement. If the executing agent finds no matching element on first run, switch to a page-specific selector (e.g., `getByText('Customers', { exact: false })`) — comment to that effect added to the spec file.
- **Low 3 [`node:path` import deviates from spec §3.1].** Verified: spec writes `import path from 'path'`; plan writes `import path from 'node:path'`. Both behave identically. **Fix: revert to `import path from 'path'` in Task 1 Step 3's `vitest.config.ts` content** to match spec verbatim. Simpler than documenting a stylistic deviation; the `node:` prefix has no functional benefit here.
- **Nit 1 [`heatmapLeadFromUnknownRow` empty-row case misses score/rating field assertions].** Verified: the test case `heatmapLeadFromUnknownRow({ lead_id: 'lead_5' })` only asserts `company` and `name`. With no score fields, `num(undefined)` returns 0 (per source `marketScoresHeatmap.ts:26-29`), so the produced lead has `totalScore: 0` and all five ratings as `'Low'`. If a future refactor changes `num`'s fallback (e.g., `NaN` or throw), this branch wouldn't catch it. Fix: in Task 4 Step 1, extend the "returns '—' as company..." test case with two extra assertions — `expect(lead!.totalScore).toBe(0);` and `expect(lead!.ratings).toEqual({ 'market-size': 'Low', 'industry-trends': 'Low', 'competitor-landscape': 'Low', 'regulatory-compliance': 'Low', 'market-entry': 'Low' });` — locking the absent-score → 0 → Low rating chain.

## Disagreed Findings

N/A — all findings on the actual plan content are technically correct.

## Deferred Findings

N/A.

## Severity Disagreements

N/A.

## Open Questions

None remaining. The reviewer's checklist coverage summary marks every dimension unchanged from prior rounds; the four findings are surface polish, not structural concerns.
