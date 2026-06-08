---
artifact: plans/34-frontend-v1-v2-api-migration.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-08
round: 1
---

## Context

Plan reviewed alongside its companion spec (`specs/34-frontend-v1-v2-api-migration-design.md`). The plan is unusually thorough — full code snippets, expected test output, and a self-review mapping each spec requirement to tasks. This made drift detection straightforward. Findings below are structural/process gaps rather than technical errors.

## Findings

### [Medium] No abort or recovery strategy in the plan body

**Location:** Plan conventions section (lines 11) and all six tasks.

The spec defines clear abort criteria in §10 ("if migrating a read forces a consumer-code change … stop and re-scope"), but the plan never restates or references them. An executing agent following only the plan would encounter a failing step and have no explicit instruction beyond "run tests and verify they pass." There is no "report to human and wait" fallback for any task, and no stated condition under which the plan is abandoned entirely.

Every task follows a test→implement→verify loop, which is good for green-path execution, but the red-path is silent. Adding a one-liner to the conventions section (e.g., "If a step cannot be made green without modifying consumer code not listed in the task's files list, stop and report to the operator") would close this gap.

### [Medium] Tasks 2–4 are parallelizable after Task 1 but presented as strictly serial

**Location:** Tasks 2, 3, 4 (lines 122–531).

After Task 1 commits the shared `pagination.ts` module, Tasks 2 (`fetchDataSources`), 3 (`fetchSignals`), and 4 (`fetchSuggestedIcps`) have zero file overlap — each modifies its own service file, its own test file, and (for 3 and 4) shared MSW handlers at different lines. The plan presents them as a serial sequence with no note that they are independent.

For the recommended subagent-driven-development execution model, this parallelizability is the primary opportunity to reduce wall-clock time. A note like "Tasks 2–4 may be dispatched in parallel after Task 1 is committed" would be sufficient.

### [Low] Conditional dead-schema deletion relies on grep without guarding against dynamic references

**Location:** Task 2 Step 5 (lines 207–212) and Task 3 Step 3 (lines 325–346).

Both steps conditionally delete Zod schemas (`DataSourceListSchema`, `FetchSignalsResponseSchema`) based on a `grep -rn` result. The grep is text-based and would miss dynamic property access (e.g., `contracts["FetchSignalsResponse" + "Schema"]`). This is unlikely in this codebase but is a structural gap in the approach — a safer pattern would be to rename the export first, run typecheck, and delete only if the rename causes no errors.

### [Low] Intentional transport asymmetry between Task 3 and Task 4 is not called out

**Location:** Task 3 Step 3 (lines 293–316) and Task 4 Step 3 (lines 441–484).

`fetchSignals` (Task 3) uses raw `fetch()` with a hardcoded `/api/v2/…` path, while `fetchSuggestedIcps` (Task 4) uses `buildApiUrl()`. This asymmetry is deliberate (spec N9: "transport unification is out of scope"), but the plan never states it. An executing agent may be tempted to "fix" this inconsistency by refactoring Task 3 to also use `buildApiUrl()`, which would be scope creep. A brief note in Task 3 acknowledging the preserved raw-fetch transport would prevent this.

### [Low] Task 4 Step 4 deletion scope could break if shared MSW handler imports `BACKEND_BASE_URL` for other handlers

**Location:** Task 4 Step 5 (lines 500–516).

The plan says "If `BACKEND_BASE_URL` is now unused in `handlers.ts`, remove it from that file's import." The check is `grep -n "BACKEND_BASE_URL" src/test/msw/handlers.ts`. This is correct, but the plan should note that the pre-existing direct-host `/icp` handler is the only user of `BACKEND_BASE_URL` in that file — if other handlers were added between plan authoring and execution that also use it, removing the import would break them. The grep guard is sufficient to catch this, but an explicit "verify no other handler uses it" instruction would be clearer.

### [Nit] Line-number references will drift if files change before execution

**Location:** Task 3 Step 4 ("~line 233"), Task 4 Step 1 ("line 12"), Task 4 Step 5 ("~line 216"), Task 6 Step 1 ("lines ~150 and ~215").

All use approximate line numbers as navigation aids. The code snippets provided alongside them make the intent clear enough that an executor can match on content rather than line number, so this is a minor ergonomics issue rather than a correctness risk.

### [Nit] Task 2 Step 7 includes a file that may not have been modified

**Location:** Task 2 Step 7 (lines 220–228).

The `git add` command lists `contracts.ts`, with a parenthetical "(If `contracts.ts` was not modified in Step 5, omit it from the `git add`)." An agent that blindly copies the command will stage an unmodified file. This is harmless (git creates a no-op commit for that path) but is slightly sloppy. The plan could use a conditional instruction inline with the command rather than a parenthetical after it.
