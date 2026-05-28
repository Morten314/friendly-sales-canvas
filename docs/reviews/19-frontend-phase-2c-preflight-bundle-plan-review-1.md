---
artifact: plans/19-frontend-phase-2c-preflight-bundle.md
artifact_type: plan
verdict: clean
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-28
round: 1
---

## Context

Reviewed against companion spec `specs/19-frontend-phase-2c-preflight-bundle-design.md` (round 2). Verified devDependency claims (`gzip-size` line 77, `tsx` line 84 of `frontend/package.json`), baseline JSON existence and shape at `docs/audits/2026-05-26-frontend-bundle-baseline.json`, `vitest.config.ts` include/exclude behavior, and `playwright.config.ts` current `maxDiffPixelRatio: 0.01`.

## Findings

### [Low] `bundle:rebaseline` verification writes to the Phase 0 anchor and relies on post-hoc discard

**Location:** Task 9 Step 2

Task 9 Step 2 verifies `bundle:rebaseline` by running it, which overwrites `docs/audits/2026-05-26-frontend-bundle-baseline.json`. The plan then discards via `git checkout` and verifies emptiness with `git diff`. The mitigation is present and explicit, but the Phase 0 anchor is the most sensitive artifact this phase touches — a momentary overwrite is an unnecessary risk. A safer alternative: run the rebaseline with `BUNDLE_BASELINE_PATH` pointed to a temp file, or simply verify `bundle:rebaseline` by confirming the script exits 0 and then immediately discard without inspecting the diff (the capture script's correctness is a Phase 0 concern, not Phase 2c's). The current sequence works but adds an avoidable failure mode if the executing agent skips the discard step.

### [Low] `compareAndPrint` output format has no automated regression test

**Location:** Task 6, Task 7 Step 4

The table rendering logic in `compareAndPrint` (~90 LOC with alignment, padding, per-chunk matching, added/removed detection, and ambiguity fallback) is verified only by visual inspection in Task 7 Step 4. The plan explicitly documents this as a design choice (File Structure section: "No tests added for IO functions"). This is defensible for Phase 2c's scope, but any future refactor of the output format (column widths, sort order, delta sign conventions) will have no automated guard. Consider capturing stdout in Task 7 Step 4 into a committed golden file under `__fixtures__/` as a lightweight regression anchor — not a unit test, just a `diff` checkpoint.

### [Low] Vitest global `setupFiles` applies to `scripts/` tests without a stated fallback

**Location:** Task 2 Step 3, `frontend/vitest.config.ts`

`vitest.config.ts` sets `setupFiles: ["./src/test/setup.ts"]` and `environment: "jsdom"` globally. Task 2 Step 3's discovery smoke test catches the case where Vitest doesn't find the test file at all (abort trigger #2), but it doesn't test whether the setup file's imports (likely `@testing-library/jest-dom` or similar DOM globals) cause runtime interference for pure utility tests under `scripts/`. If `setup.ts` does something environment-specific that breaks outside `src/`, the failure surfaces at Task 3 Step 2 — not catastrophic, but the abort trigger's coverage is narrower than stated. The plan is resilient enough (the failure would be caught early), but the trigger description could be more precise: "Vitest does not discover or cannot execute test files under `scripts/`."

### [Nit] Commands use `cd frontend` pattern contrary to AGENTS.md guidance

**Location:** Multiple tasks (Task 2 Steps 2–4, Task 3 Steps 2–5, Task 4 Step 2, Task 5 Steps 3–5, Task 6 Steps 2–3, Task 7 Steps 2–5, Task 8 Steps 1–3, Task 9 Step 2, Task 10 Step 2, Task 11 Steps 2–3, Task 12 Step 2, Task 14 Step 1)

AGENTS.md recommends using the `workdir` parameter instead of `cd <directory> && <command>`. The plan's code blocks use standalone `cd frontend` (not `&&` chains, so it's technically compliant with the literal rule). An executing agent using the bash tool with `workdir` would handle this correctly regardless. No functional impact — purely a style note.

### [Nit] Task 9 Step 1 shows full `scripts` block, risking accidental replacement

**Location:** Task 9 Step 1

The plan renders the entire `scripts` block and instructs "Preserve any keys that exist that aren't shown here." If a new script entry is added between plan writing and execution, the executing agent must merge rather than replace. The surrounding text says "add two entries" which is unambiguous, so the risk is low. A more defensive approach: show only the two new lines to add, without the full block.

### [Nit] Task 12 can run in parallel with Task 9 but references commands defined in Task 9

**Location:** §0 Parallelism guidance, Task 12

The plan states Tasks 11 and 12 are "independent of Tasks 9–10." Task 12's README content references `npm run bundle:check` and `npm run bundle:rebaseline` (added in Task 9) and `check-bundle-budget.ts` (created in Task 2). If Task 12 is committed before Task 9, an intermediate commit references commands that don't yet exist. This is cosmetically odd on the feature branch but functionally harmless since the branch merges atomically. No action needed.
