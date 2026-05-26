---
artifact: plans/15a-frontend-phase-0a-inventory.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-26
round: 1
---

## Findings

### [High] No plan-level abort / kill criteria

**Location:** Entire plan; absence of a dedicated section.

The plan has per-task STOP conditions (Task 0 dirty-tree, Task 2 >25% snapshot failure, Task 2 Step 5 suite-not-green, Task 6 `set -euo pipefail` bail) but no stated criteria for when the entire plan should be abandoned rather than debugged in-place. Concretely: if Task 9 (CI green) fails repeatedly — e.g., the Docker container `v1.59.1-jammy` has a broken Chromium, or `npm ci` fails on CI but not locally — there is no threshold or escalation path. The implicit path is "keep debugging until it works," which can burn unbounded time.

**Recommendation:** Add a short section (after the Architecture paragraph, before Task 0) defining global abort criteria. Example: "If any single task fails after two independent debug attempts, pause and report to the operator for a go/no-go decision. If Task 9 CI cannot go green within 3 pushes, log findings to `docs/TECH_DEBT.md` and report to operator."

### [High] Missing regression verification between package.json-mutating tasks

**Location:** Between Task 4 (knip install → modifies `package.json`/`package-lock.json`), Task 5 (gzip-size + tsx install → same), and Task 2 (Playwright threshold which runs the suite).

Task 2 runs the full Playwright suite and verifies it passes. Tasks 4 and 5 then modify `package.json` and `package-lock.json` (adding `knip`, `gzip-size`, `tsx`). There is no explicit re-run of `npm run test:e2e` after these installs to confirm the dependency additions didn't break anything. Task 6's NFR script incidentally runs Playwright 3 times, which provides de-facto regression coverage — but only because Task 6 is ordered after Tasks 4–5. If tasks were ever reordered (e.g., for parallelization), this implicit safety net vanishes.

**Recommendation:** Add a quick Playwright smoke check (`npx playwright test --reporter=line` or even just `npm run test:e2e`) as a sub-step after Task 5's npm install, or explicitly note that Task 6's Playwright runs serve as the regression gate for Tasks 4–5.

### [Medium] `time_dev_start` in NFR script has no timeout — can hang indefinitely

**Location:** Task 6, `frontend/scripts/measure-baselines.sh`, lines 620–641 (the `time_dev_start` function).

The function polls for "ready in" in a log file with `sleep 0.05` intervals and a `kill -0` check for vite dying. If vite stays alive but never prints "ready in" (e.g., it hangs on a module resolution error that doesn't crash the process), the loop runs forever. There is no wall-clock timeout on the poll.

**Recommendation:** Add a timeout counter (e.g., 60 seconds) inside the `while` loop that breaks with an error if exceeded. This prevents the 10–20 minute NFR run from becoming an indefinite hang.

### [Medium] `time_cmd` uses bash variable interpolation inside Python f-string — fragile

**Location:** Task 6, `frontend/scripts/measure-baselines.sh`, `time_cmd` function (lines 612–617) and `time_dev_start` (lines 636–641).

```bash
python3 -c "print(f'{${end} - ${start}:.3f}')"
```

Bash substitutes `${end}` and `${start}` before Python sees the code. This works as long as the variables contain only numeric strings, but if `python3 -c 'import time; print(time.time())'` ever produces scientific notation or an error message, the resulting Python code would be a syntax error. The pattern is duplicated in `time_dev_start`.

**Recommendation:** Pass the values as arguments to Python instead of interpolating:
```bash
python3 -c "import sys; print(f'{float(sys.argv[1]) - float(sys.argv[2]):.3f}')" "$end" "$start"
```

### [Medium] Fully serial when Tasks 5, 6 are independent of Tasks 3, 4

**Location:** Architecture paragraph (line 7); overall task ordering.

The dependency chain is:
- Task 0 → Task 1 → Task 2 (Playwright pin → threshold change)
- Task 2 → Task 3 → Task 4 → Task 7 (bun delete → knip → scorecard consumes knip JSON)
- Task 2 → Task 5 (bundle baseline, no dependency on 3/4)
- Task 2 → Task 6 (NFR baseline, no dependency on 3/4/5)
- Task 8 → Task 9 (CI → push + verify)

Tasks 5 and 6 could run in parallel with Tasks 3 and 4 after Task 2 completes. The plan doesn't call this out. For a single-agent execution this is a minor efficiency loss, but the plan's header explicitly recommends `subagent-driven-development` — parallelizable task groups should be identified for that mode.

**Recommendation:** Add a "Parallelization opportunities" note to the Architecture section identifying that Tasks 5+6 form an independent group from Tasks 3→4, and could be dispatched in parallel with Tasks 3→4 when using subagent-driven development.

### [Medium] No explicit recovery guidance for `npm run build` failure (Task 5 Step 3)

**Location:** Task 5, Step 3 (line 516–519).

Task 5 runs `npm run build` as a cold build (`rm -rf dist node_modules/.vite`). If the build fails, there is no STOP instruction or recovery guidance — unlike Task 2's explicit "STOP, do not commit; investigate" for test failures. The build could fail due to a TypeScript error, a missing dependency, or a Vite config issue introduced by earlier tasks.

**Recommendation:** Add an explicit "If build fails: STOP. Do not proceed to Step 4. Investigate the build error before continuing" after the build command.

### [Low] Architecture paragraph says "Nine commits" but actual count is 8

**Location:** Line 7 ("Nine commits on one branch").

Tasks 1 through 8 each produce one commit. Task 0 creates the branch but no commit. Task 9 is push/verify only, no commit. Task 9 Step 1 correctly expects "8 commits on the branch." The Architecture paragraph's "Nine commits" is wrong and could mislead an agent counting commits as a progress check.

**Recommendation:** Change "Nine commits" to "Eight commits" in the Architecture paragraph.

### [Low] Bundle baseline script includes `.html` and `.svg` beyond spec scope

**Location:** Task 5, `capture-bundle-baseline.ts`, line 464 — ` /\.(js|css|html|svg)$/`.

Spec §2.3 says the script uses gzip-size over "each `dist/**/*.js` and `dist/**/*.css` file." The plan's implementation also captures `.html` and `.svg`. This is more thorough but technically drifts from the spec. The `index.html` and any SVG assets in `dist/` would inflate the `total_size_bytes` relative to what the spec describes, and Phase 2c's bundle-budget script would need to account for this.

**Recommendation:** Either align with the spec (`.js` and `.css` only) or add a one-line note to the commit message acknowledging the extension. If including `.html`/`.svg` is intentional, update the spec to match.

### [Low] `countStaticRefs` is O(files²) — potentially slow at 75k LOC / hundreds of files

**Location:** Task 7, `build-audit-scorecard.ts`, the `countStaticRefs` function (lines 877–909).

The function shells out to ripgrep once per source file. For ~300+ `.ts`/`.tsx` files, this is 300+ ripgrep invocations, each scanning the entire `src/` and `e2e/` tree. At 75k LOC this could take several minutes. The result is correct, but the plan doesn't warn about expected runtime for Task 7.

**Recommendation:** Add a note to Task 7 Step 3 estimating runtime ("Expected: 2–5 minutes depending on file count and disk speed — the script runs ripgrep once per source file"). Consider batching: a single ripgrep pass extracting all `from '…'` lines, then computing per-file ref counts in-memory, would reduce ~300 process spawns to 1.

### [Nit] Comment block is 4 lines vs spec's "2-line comment block"

**Location:** Task 2, Step 1 (lines 179–191); spec §2.5 says "2-line comment block."

The plan writes a 4-line comment block (re-baseline command, macOS/Windows Docker note, and two command examples). The spec says 2 lines. The plan's version is more helpful, but strictly deviates.

### [Nit] Knip output: spec says `.txt` "or" `.json`; plan commits both formats

**Location:** Task 4; spec §2.2 says "knip.txt (or .json if knip's JSON reporter is used)."

The plan commits both `.txt` and `.json` (Tasks 4 Steps 4–5). The spec's "or" suggests one format, but having both is clearly better for Phase 1's triage. The File Structure section correctly lists both, so this is internally consistent even if it expands on the spec.

### [Nit] No `bun.lock`/`bun.lockb` existence check before Task 3

**Location:** Task 3, Step 1 actually does verify existence (`ls frontend/bun.lock frontend/bun.lockb`). This is handled correctly. Withdrawn.

### [Nit] Plan correctly references spec sections per task

**Location:** "Reference: spec sections by task" table at end of plan.

The mapping is accurate. Every spec §2 subsection has a corresponding task, and the done-when coverage map (lines 1455–1468) correctly traces each §2.9 bullet to its satisfying task(es). No orphaned spec requirements or plan-only scope creep beyond the items noted above.
