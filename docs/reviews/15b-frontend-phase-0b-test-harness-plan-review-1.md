---
artifact: plans/15b-frontend-phase-0b-test-harness.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-26
round: 1
---

## Findings

### [High] MSW pipeline smoke test's unhandled-request assertion may be flaky

**Location:** Task 1 Step 7 — `msw-pipeline.test.ts`, second test case (`rejects an unhandled-path fetch`)

The test asserts `await expect(fetch('/api/this-path-is-not-handled')).rejects.toBeDefined()`. MSW's `onUnhandledRequest: 'error'` logs a console error and, in MSW v2 with `setupServer` (Node-side), the behavior for unhandled requests is to **log the error** but the request may still resolve (not reject) — the fetch proceeds to the actual network (which fails in jsdom since there's no real server), but the exact failure mode depends on jsdom's `fetch` implementation and whether it throws or returns a rejected promise for unresolvable hosts. The test assumes MSW causes the promise to reject, but MSW v2's `onUnhandledRequest: 'error'` throws an error *within the MSW interceptor layer*, not necessarily as a rejected fetch promise. This assertion could pass in some environments and fail in others (or under different MSW patch versions). A more robust approach: spy on `console.error` for MSW's unhandled-request warning, or assert that the fetch response is not 200. The plan's own Step 8 troubleshooting mentions "if the second assertion fails, `onUnhandledRequest: 'error'` isn't applied" — but the failure mode may be the test's assumption rather than a misconfiguration.

### [High] measure-baselines.sh full replacement is fragile — should be a diff edit

**Location:** Task 10 Step 1 — replaces entire `measure-baselines.sh` file

The plan provides the *entire* script content (~80 lines) as a replacement. If Phase 0a's actual merged script differs even slightly from what the plan author saw at plan-writing time (which is likely — the plan says "current script committed in Phase 0a"), the full replacement silently overwrites any 0a fixes or adjustments that happened between plan-writing and execution. This is a classic "plan-drift vs code-drift" risk. The task should instead provide a targeted diff (or at minimum state "append after the playwright measurement block and update the JSON write section"), keeping the 0a content as the base. The plan acknowledges the risk implicitly ("preserves all Phase 0a logic") but doesn't guard it structurally.

### [Medium] No regression gate between Task 1 and Tasks 2–6 for characterization test accuracy

**Location:** Tasks 2–6, each Step 2

Each characterization test task runs its test in isolation (`npm run test -- <file>`) and commits. But there's no step that runs the *full Vitest suite* (`npm run test`) between Tasks 2–6 to catch cross-test interference (e.g., a test file polluting the fake-timer state despite `afterEach` cleanup, or MSW handler pollution between test files if `resetHandlers` has a gap). The first time the full suite runs together is Task 9 Step 2 (preflight chain). If there's cross-file interference, it surfaces late — after 5 commits — requiring either fixup commits or rebasing. A single intermediate `npm run test` (full suite) after, say, Task 4 would catch this earlier.

### [Medium] Gap journey bug-handling decision tree could modify api-mocks.ts, creating a shared-file conflict for parallel execution

**Location:** Task 7 and Task 8 — bug-handling decision tree; "Parallelization opportunities" section

The plan correctly identifies that Tasks 2–8 are parallelizable and can run in separate worktrees. However, both Tasks 7 and 8 have a decision tree that may modify `frontend/e2e/fixtures/api-mocks.ts` — a single shared file. If both gap journeys discover a missing API mock and both subagents try to add entries to the same file in separate worktrees, the merge will conflict. The plan should either: (a) serialize Tasks 7 and 8, (b) state that api-mocks modifications must be coordinated, or (c) make one task responsible for api-mocks changes and the other depend on it.

### [Medium] Task 1 installs @testing-library/react but no component test uses it

**Location:** Task 1 Step 1 — installs `@testing-library/react@^16`; spec §3.1

RTL is installed as a dev dependency but Phase 0b's test scope is purely characterization tests against *utility functions* (no component rendering). The spec §3.1 lists RTL as a 0b install because it's part of the *harness* that future phases will use. This is spec-consistent but creates a situation where the harness ships an unused dependency. Not a bug, but the plan misses an opportunity to note this explicitly — an exec agent might question why RTL was installed if no test uses it. A brief note in Task 1 ("RTL is unused at 0b; Phases 5–10 component tests consume it") would preempt confusion.

### [Medium] Spec drift items are well-documented but no concrete follow-up action is specified

**Location:** "Spec adherence vs code reality" section (plan header), "Open Questions for Post-Merge Follow-Up"

Three spec drifts are identified (rateLimitManager 30 vs 4, utils.ts second export, marketScoreDescriptions lookup shape). Each is documented as "proposed post-merge follow-up." However, none have a concrete trigger or owner — they're listed as open questions but not tracked as TD-FE entries, spec-amendment tasks, or issues with a "who does this and when." For a spec-driven flow that emphasizes frozen records of intent, leaving these as free-floating "proposed" items risks them being lost. Adding a single TD-FE entry or a concrete "amend spec 15 §3.3 in a follow-up commit" with a trigger condition would close this gap.

### [Medium] Task 6 rateLimitManager test complexity may exceed characterization scope

**Location:** Task 6 — full test file (~230 lines)

The rateLimitManager characterization test is by far the most complex, with async fake-timer patterns, module resets, retry-path testing, error-classification fan-out, and clearQueue behavior. The spec §3.3 says characterization tests should cover "queuing, rolling-window cap, sliding-window release, and concurrent enqueues." The plan adds retry-path testing (`isRateLimitError` fan-out with 6 error phrases), `clearQueue` rejection, and the `executeWithRateLimit` helper-forward test — all reasonable but beyond what the spec scoped. This isn't harmful (more coverage is better), but it inflates Task 6's size relative to Tasks 2–5 and makes it the most likely task to hit the per-task abort budget. The plan could note that the retry/isRateLimitError tests are an explicit scope expansion beyond spec §3.3.

### [Low] Task 11 Step 4 expected file list has a duplicate entry

**Location:** Task 11 Step 4 — `git diff --name-status` expected output

The expected output lists `docs/audits/2026-05-26-frontend-nfr-baseline.json` twice — once as `A` and once as `M`. The inline comment acknowledges the ambiguity ("should be M, not A") but the expected output itself is contradictory. A single canonical expectation (`M` if 0a created it, which it did per spec §2.4) would be clearer.

### [Low] Task 0 Step 3 runs preflight on master, but the plan doesn't state what to do if preflight takes >2 minutes

**Location:** Task 0 Step 3

The plan says "Expected: typecheck + build + Playwright all green. Total wall time ~90–120s." If preflight takes significantly longer (e.g., due to a cold Vite cache or heavy system load), there's no guidance on whether to proceed or re-run. For a sanity baseline, this is minor, but the plan is meticulous about timing expectations elsewhere (Task 10's 12–25 minute window gets explicit treatment). A simple "if >180s, note the time but proceed if green" would be consistent.

### [Low] NFR JSON file path has a hardcoded date that may not match execution date

**Location:** Task 10, File Structure section — `docs/audits/2026-05-26-frontend-nfr-baseline.json`

The filename embeds `2026-05-26`. If Phase 0b executes on a different date, the file already exists from 0a with that name and the plan's Python script reads it correctly. But if someone later re-runs `measure-baselines.sh` on a different date expecting a fresh file, the hardcoded path in the script (`OUTPUT_FILE=...2026-05-26...`) will silently append to the old file rather than creating a date-appropriate one. This is an inherited 0a design decision, but worth noting.

### [Nit] vitest.config.ts uses `path.resolve(__dirname, ...)` but spec uses `path` import style

**Location:** Task 1 Step 3 vs spec §3.1

The plan's `vitest.config.ts` imports `path from 'node:path'` (Node protocol import), while the spec §3.1 shows `import path from 'path'` (bare specifier). Both work, but the deviation is unexplained. The Node protocol style is arguably better; just noting the plan intentionally improved on the spec here would help readers.

### [Nit] Commit message bodies reference "Spec 15" but the spec file is `15-frontend-phase-0-inventory-and-safety-net-design.md`

**Location:** All task commit messages

Each commit message ends with `Spec 15 §3.x`. This is unambiguous in context but slightly informal. A more precise reference (e.g., `Spec 15 (frontend-phase-0) §3.x`) would aid traceability in git log.

### [Nit] Task 9 discusses Vitest chain ordering at length but follows spec's "append" literally

**Location:** Task 9 — rationale paragraph

The plan spends a paragraph debating whether Vitest should go after `build` and before `test:e2e` (for fail-fast) vs at the end (per spec's "append" wording), then follows the spec literally. The debate is useful context but the decision was pre-determined by the spec. Not a problem — just noting the thoroughness.

---

## Checklist Coverage Summary

| Dimension | Assessment |
|---|---|
| **Sequencing and dependencies** | Correct. Task 0 → 1 → [2–8 parallel] → 9 → 10 → 11 is in dependency order. No forward references. |
| **Risk front-loading** | Good. The riskiest item (harness install + MSW proof) is Task 1. The stateful characterization (rateLimitManager) is Task 6, which surfaces timing issues before the preflight chain (Task 9). |
| **Decomposition for reviewability** | Strong. One commit per survivor file. Gap journeys are separate. Preflight chain extension is its own commit. NFR measurement is its own commit. |
| **Recovery strategy** | Good. Per-task STOP conditions, plan-level abort budgets (2 debug attempts per task, 3 preflight fix attempts), and escalation to operator. |
| **Kill criteria / abort conditions** | Present and explicit (plan-level Abort Criteria #1 and #2). Two-tier: per-task budget and preflight budget. |
| **Verification per step** | Strong. Every task has a "run the test" step and explicit expected output. Task 11 runs full preflight as a regression gate. The gap journeys include idempotency checks (re-run without `--update-snapshots`). |
| **Hidden prerequisites** | Node 22, npm 10, Phase 0a merged — all stated up front. Network access for npm install is implicit but standard. |
| **Drift from spec** | Three spec drifts identified and documented in plan header with proposed resolutions. Plan scope matches spec §3.7 done-when criteria 1-on-1 (verified via coverage map table). No scope creep beyond spec. |
| **Parallelizability** | Explicitly documented. Tasks 2–8 are parallel-safe after Task 1. Tasks 9–11 are correctly sequenced. |
| **Overengineering** | Minimal. The plan is thorough but not gold-plated. The most complex test (rateLimitManager) extends slightly beyond spec scope but is justified for a stateful singleton. |
