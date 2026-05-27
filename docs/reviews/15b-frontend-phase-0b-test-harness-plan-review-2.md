---
artifact: plans/15b-frontend-phase-0b-test-harness.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-26
round: 2
---

## Context

This round verified every characterization-test assertion against the current source files on `master` (timestampUtils.ts, utils.ts, marketScoreDescriptions.ts, marketScoresHeatmap.ts, rateLimitManager.ts). All assertions in the plan's test files match current code behavior. This review focuses on findings beyond what Round 1 identified.

## Findings

### [Medium] `isRateLimitError` characterization covers only half the error classification surface

**Location:** Task 6 Step 1 — `rateLimitManager.test.ts`, test case "classifies common rate-limit error strings"

The source `isRateLimitError` method (rateLimitManager.ts:124-143) matches 12 distinct error substrings. The characterization test exercises only 6: `'rate limit'`, `'429'`, `'too many requests'`, `'quota exceeded'`, `'throttled'`, `'concurrent request limit'`. Untested: `'model_rate_limit'`, `'deepseek-r1-distill-llama-70b-free'`, `'rate_limit_exceeded'`, `'api rate limit'`, `'request limit'`, `'model rate limit exceeded'`. Since `isRateLimitError` is private and only tested indirectly through the retry path, a Phase 1+ refactor that removes any of the untested phrases (notably the DeepSeek-specific string) would pass the characterization suite undetected. The plan doesn't acknowledge this gap. Adding the remaining 6 phrases is low effort (same test pattern) and would lock the full classification surface before refactoring.

### [Medium] measure-baselines.sh Python write crashes on malformed existing JSON, losing all measurements

**Location:** Task 10 Step 1 — `measure-baselines.sh` replacement, Python heredoc (lines ~1861–1902 of the plan)

The Phase 0a script (current file, 143 lines) writes JSON via a bash heredoc — no read-modify-write. The 0b replacement reads the existing JSON file with `json.load(f)` to preserve the 0a anchor, then merges in `after_phase_0b`. If the existing JSON is malformed (truncated by a killed 0a run, or manually edited with a syntax error), `json.load` raises `json.JSONDecodeError`, the script exits (`set -e`), and **all 12–25 minutes of completed measurements are lost** — the script writes JSON only at the very end. Adding a pre-flight integrity check (`python3 -c "import json; json.load(open('$OUTPUT_FILE'))"`) before starting measurements would guard against this. Round 1 flagged the full-file replacement as fragile (Round 1 finding #2); this is a specific failure mode that compounds the risk.

### [Low] measure-baselines.sh temp logfile name diverges from Phase 0a without explanation

**Location:** Task 10 Step 1 — `measure-baselines.sh` replacement, `time_dev_start()` function

The Phase 0a script uses `/tmp/phase-0a-vite-dev.$$.log` (current file, line 36). The plan's replacement uses `/tmp/phase-0-vite-dev.$$.log`. This unexplained name change means an orphan logfile from a killed 0a run at the old path won't be cleaned up by the new script's `rm -f "$logfile"` on success. Harmless (it's `/tmp`), but an unnecessary divergence with no stated rationale.

### [Low] No overall time budget for the plan

**Location:** Plan header — "Abort criteria" section

The plan specifies per-task debug attempt budgets (2 attempts per task, 3 preflight fix attempts) and Task 10 notes a 12–25 minute wall time for measurements. But there's no plan-level time budget. If multiple tasks hit their debug limits and Task 10 needs re-runs, the total execution time could reach 2+ hours. A simple "if total wall time exceeds 90 minutes (excluding measure-baselines), report to the operator" would provide a ceiling. Not critical for a pre-launch codebase, but the plan is otherwise meticulous about thresholds and this gap is conspicuous.

### [Low] The gap journeys' `installApiMocks` + `installCatchAllApiMock` calls are self-described as redundant

**Location:** Task 7 Step 1 and Task 8 Step 1 — spec file content, comments at lines 1489–1491

Both gap journey specs call `installApiMocks(page)` and `installCatchAllApiMock(page)` after `loginAsTestUser(page)`, with a comment: "The two below are redundant with loginAsTestUser... Kept for symmetry with the existing stubs pattern." This means every gap journey makes three mock-installation passes. If `loginAsTestUser` already installs all mocks, the extra calls are wasted work that could mask a future breakage (e.g., if `installCatchAllApiMock` becomes non-trivial and is called twice with conflicting state). A cleaner approach: either remove the redundant calls and note the deviation from the stubs pattern, or confirm `loginAsTestUser` does NOT install them and remove the misleading comment.

### [Nit] Redundant em-dash assertion in sanitizeAnswerText characterization

**Location:** Task 5 Step 1 — `utils.test.ts`, test case "normalizes em-dash and en-dash to ' - '" (plan lines 1095–1096)

Three assertions test: em-dash (U+2014), en-dash (U+2013), then em-dash (U+2014 again). The third assertion adds no coverage. It could test U+2015 (horizontal bar) instead, which is covered by the source's second regex (utils.ts:21) but not explicitly tested. Alternatively, remove the third assertion.

### [Nit] Round 1 finding #1 severity assessment

**Location:** Task 1 Step 7 — `msw-pipeline.test.ts`, second test case

Round 1 rated the unhandled-request assertion as [High]. Having verified the MSW v2 `setupServer` + `onUnhandledRequest: 'error'` behavior: in MSW v2, unhandled requests with `'error'` mode cause the interceptor to throw, which rejects the fetch promise in Node.js environments. The assertion `await expect(fetch(...)).rejects.toBeDefined()` is reasonable for this setup. The risk is environment-specific (jsdom's fetch polyfill behavior), not a fundamental test design flaw. [Medium] is a more appropriate severity.

---

## Checklist Coverage Summary

| Dimension | Assessment | Delta from Round 1 |
|---|---|---|
| **Sequencing and dependencies** | Correct. Task 0→1→[2–8]→9→10→11. No forward references. Verified: Task 9 needs Tasks 2–6 output (test files) but not Tasks 7–8 output (E2E journeys) — the preflight chain runs Vitest and Playwright sequentially, so gap journeys can be incomplete when Task 9 commits. | No change. |
| **Risk front-loading** | Good. Riskiest item (harness install + MSW proof) is Task 1. Stateful characterization (rateLimitManager) is Task 6, before preflight chain (Task 9). | No change. |
| **Decomposition for reviewability** | Strong. One commit per survivor file. Gap journeys separate. Preflight chain extension separate. NFR measurement separate. | No change. |
| **Recovery strategy** | Good. Per-task STOP, plan-level abort budgets, operator escalation. | No change. |
| **Kill criteria / abort conditions** | Present and explicit. Missing an overall time budget (noted above). | Minor gap added. |
| **Verification per step** | Strong. Every task runs its test. Task 11 runs full preflight. Gap journeys have idempotency checks. Code-verified: all characterization assertions match current source. | Confirmed via source verification. |
| **Hidden prerequisites** | Node 22, npm 10, Phase 0a merged, Playwright browsers — all stated. Python 3 (for measure-baselines.sh) is implicit but standard. `@vitejs/plugin-react-swc` (needed by vitest.config.ts) confirmed present in package.json. | Confirmed via source verification. |
| **Drift from spec** | Three spec drifts documented with proposed resolutions. Coverage map table matches spec §3.7 done-when 1-on-1. No scope creep beyond spec. | No change. |
| **Parallelizability** | Explicitly documented. Tasks 2–8 parallel-safe after Task 1. Round 1 flagged api-mocks.ts conflict for Tasks 7–8 (valid). | No change. |
| **Overengineering** | Minimal. Thorough but proportional. `logTimestampComparison` no-op test is defensible for characterization scope. | No change. |
