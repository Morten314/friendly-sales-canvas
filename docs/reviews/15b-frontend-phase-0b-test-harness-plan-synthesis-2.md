---
synthesizes_review: docs/reviews/15b-frontend-phase-0b-test-harness-plan-review-2.md
artifact: plans/15b-frontend-phase-0b-test-harness.md
artifact_type: plan
reactor_model: claude-opus-4-7
date: 2026-05-27
round: 2
---

## Round Recommendation

no

Reason: All round-2 findings are surgical additions (6 string phrases, a JSON guard step, a temp-file rename, a time-budget paragraph, a redundant-call removal); the reviewer verified every characterization assertion against source and confirmed the plan's structural dimensions remain strong.

## Agreed Findings

- **Medium 1 [isRateLimitError covers only 6 of 12 phrases].** Verified against `frontend/src/lib/rateLimitManager.ts:124-143`: the source matches 12 distinct substrings; the plan's test covers 6. Fix to Task 6 Step 1: extend the `phrases` array in the "classifies common rate-limit error strings" test to include the missing 6 (`'model_rate_limit'`, `'deepseek-r1-distill-llama-70b-free'`, `'rate_limit_exceeded'`, `'api rate limit'`, `'request limit'`, `'model rate limit exceeded'`). Cost is ~6 array entries; locks the full classification surface so Phase 1+ refactors can't silently remove the DeepSeek-specific string.
- **Medium 2 [measure-baselines.sh Python read-modify-write loses 12–25min on JSON corruption].** Verified: the plan's Python heredoc runs only after all 5 measurements complete. If the existing JSON is corrupt (truncated, manually edited), `json.load` raises and `set -e` kills the script — all measurements discarded. Fix to Task 10 Step 1: prepend an integrity check before the measurements section — `python3 -c "import json, sys; sys.exit(0 if not __import__('os').path.exists('$OUTPUT_FILE') else json.load(open('$OUTPUT_FILE')) and 0)"` (allow missing file; fail fast on malformed). If the check fails, the script aborts in <1s rather than after 20min.
- **Low 1 [tmp logfile name divergence from Phase 0a].** Verified: Phase 0a uses `/tmp/phase-0a-vite-dev.$$.log`; plan's replacement uses `/tmp/phase-0-vite-dev.$$.log`. The rename was implicit (the script now serves both phases) but unexplained. Fix to Task 10 Step 1: revert the name to `/tmp/phase-0a-vite-dev.$$.log` — the script will continue to live at `frontend/scripts/measure-baselines.sh` regardless of which phase invokes it; backward-compat with 0a's tmp name is harmless.
- **Low 2 [No overall plan-level time budget].** Verified: the plan has per-task abort budgets (2 debug attempts) and the Task 11 preflight budget (3 fix attempts), but no plan-wide ceiling. Fix to plan-header "Abort criteria" section: append a 3rd plan-level escalation — "If total wall time (excluding Task 10's 12–25min measurement window) exceeds 90 minutes, report to the operator; cumulative ceremony usually indicates an environment issue worth escalating rather than continuing to patch."
- **Low 3 [Gap journeys' redundant `installApiMocks` + `installCatchAllApiMock` calls].** Verified: `loginAsTestUser` (frontend/e2e/helpers/login.ts:106) already calls `installApiMocks` internally; `installCatchAllApiMock` is documented as `@deprecated` no-op (frontend/e2e/fixtures/api-mocks.ts:88). Keeping the redundant calls "for symmetry with stubs" perpetuates a known-redundant pattern that the api-mocks.ts file itself marks for removal. Fix to Task 7 + Task 8 spec content: remove both `installApiMocks(page)` and `installCatchAllApiMock(page)` post-login calls; remove the corresponding `import { installApiMocks, installCatchAllApiMock }` line; replace the comment with: "`loginAsTestUser` installs Firebase + api mocks + a catch-all internally. Existing `e2e/stubs/*.spec.ts` make these calls redundantly — a minor smell flagged for Phase 1 cleanup. New journeys deliberately deviate to avoid propagating the smell."
- **Nit 1 [Redundant em-dash assertion].** Verified at Task 5 — the test asserts U+2014 twice with U+2013 between. Fix: replace the third (duplicate U+2014) assertion with one exercising U+2015 (horizontal bar) — `expect(sanitizeAnswerText('foo ― bar')).toBe('foo - bar')` — which is covered by the source's `[–—―]` regex (utils.ts:21) but not currently tested.

## Disagreed Findings

N/A — all findings on the actual plan content are technically correct and surgical.

## Deferred Findings

N/A.

## Severity Disagreements

N/A.

## Open Questions

- **Nit 2 [Round 1 finding #1 severity reassessment, [High] → [Medium]].** The reviewer self-corrects Round 1's MSW assertion as [Medium] rather than [High] after verifying MSW v2 `setupServer` + `onUnhandledRequest: 'error'` does reject the fetch promise in Node. No plan action required: the Round 1 synthesis already agreed with the substance and prescribed the `server.events.on('request:unhandled', ...)` event-listener fix (which is more robust than either the original assertion or what a [Medium] severity might have produced). Surfacing here so the operator can disregard the severity nit — the prescribed fix stands.
