---
artifact: plans/18-frontend-phase-2b-eslint-prettier.md
artifact_type: plan
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-05-28
round: 1
---

## Context

This review covers a 3,212-line plan for Phase 2b of the frontend refactoring effort. The paired spec (`specs/18-frontend-phase-2b-eslint-prettier-design.md`, 563 lines, round 3 clean) was read in full for drift comparison. The plan's predecessor (Plan 17 / Phase 2a) established the wave methodology precedent this plan inherits.

## Findings

### [High] Plan inlines ~310 lines of implementation code verbatim for `build-lint-probe.ts`

**Location:** Task 1.0b Step 1, lines 398–706

The plan writes the entire `build-lint-probe.ts` helper inline — complete with TypeScript interfaces, CLI arg parsing, area classification, ESLint/Prettier invocation, JSON roll-up, and artifact emission. This is implementation, not planning. The spec (§4 Step 0) says "Generate a `frontend/scripts/build-lint-probe.ts` helper" and describes what it should do, but does not prescribe the exact source code. If the inlined code has a bug (e.g., the `classifyArea` regex logic, the `execFileSync` error handling, the JSON roll-up aggregation), the plan has a bug — and the executor would follow the bug verbatim. Plans should specify behavior and constraints, not write source code.

The Phase 2a precedent (`build-strict-probe.ts`) was presumably also planned, but the appropriate response is to describe the helper's contract (inputs, outputs, error handling expectations) and let the executor implement it, not to pre-write it.

### [High] Wave B auto-fix strategy is unresolved — plan debates two approaches without making a binding decision

**Location:** Task 4.prep Step 2 (lines 1802–1834), Task 4.1 Step 2 (lines 1852–1881)

The plan identifies that ESLint v9's `--rule` flag for isolating per-rule `--fix` sweeps "can be finicky" and proposes a combined `eslint --fix` fallback. It then provides *both* per-rule and combined-commit templates (Task 4.1 Step 4, lines 1896–1933) without making a binding call. Spec §7.3 explicitly defers this to the plan stage: "Wave B batching decisions... Driven by Step 0 diff-size measurement." The plan's header "Plan-stage decisions" section (lines 119–128) resolves 8 questions but not this one — it describes the *decision procedure* (check if diff > 300 lines) but not the *default path*. The executor is left to choose at execution time, which is the kind of ambiguity a plan should resolve.

Recommendation: pick "combined `eslint --fix` as default, split only if total diff > 500 lines" as the binding default and remove the alternative paths from the task bodies.

### [Medium] Per-wave diff-stat gathering in scorecard task is stubbed

**Location:** Task 7.2 Step 1, lines 3011–3019

The scorecard data-gathering script includes:
```
# ... iterate per wave's commit range
```
This is a placeholder, not an executable command. The per-wave breakdown is a stated plan-stage decision (#7, line 127) and the scorecard template (lines 3128–3137) expects a per-wave table. The executor will need to improvise the git-range commands to extract per-wave stats. For a plan this detailed (3,212 lines), leaving the most complex data-gathering step as a comment stub is a gap.

### [Medium] Split-threshold interpretation contradicts the spec

**Location:** Task 3.prep Step 3, lines 1293–1303

The spec says (§4 Step 2): "if an area's `prettier --write` diff exceeds **250 line-changes**, split." The plan interprets this as: "interpret the spec's 250-line threshold as `min(insertions, deletions) * 2` or `(insertions + deletions) / 2`... For simplicity: split if `insertions + deletions > 500`." This doubles the effective threshold without justification. `git diff --shortstat` reports insertions + deletions separately; a "line-change" is ambiguous. The plan should either: (a) use the raw `insertions + deletions` total and apply the spec's 250 figure directly, or (b) acknowledge the reinterpretation explicitly and note why the spec's 250 was doubled.

### [Medium] Hardcoded dates in artifact filenames with incomplete multi-day remediation

**Location:** Throughout — artifact filenames use `2026-05-28` (e.g., lines 138, 139, 140, 141, 148, 715, 903–906, etc.)

The plan hardcodes `2026-05-28` in every artifact path. The `build-lint-probe.ts` helper accepts `--date` to override, but the plan's bash commands always pass `--date 2026-05-28`. If execution starts on 2026-05-29, every command needs manual date correction. The scorecard task (line 2992) notes a `git mv` for the final artifact, but none of the intermediate re-probe artifacts (`post-wave-a`, `post-wave-b`, `post-wave-c`) get a date-remediation step. Recommend using `$DATE` or `$(date +%Y-%m-%d)` throughout, or noting at the top that all dates are placeholder examples.

### [Medium] Wave B `eslint --fix` may re-format Prettier-formatted code, creating mixed-commit diffs

**Location:** Task 4.1–4.5, Wave B tasks

Wave A formats everything with Prettier. Wave B then runs `eslint --fix`, which may reformat import blocks (via `import-x/order`) and whitespace in ways that differ from Prettier's output on the same lines. The spec's posture rule 9 acknowledges: "Wave B's `--fix` diffs may include trivial whitespace changes on lines Prettier (Wave A) already moved — this is benign and expected." However, the plan doesn't note this interaction in the Wave B tasks themselves, and the per-commit "verify no non-formatting changes" spot-checks (e.g., Task 3.1 Step 2, line 1331) don't appear in Wave B tasks. An executor following the plan literally might be confused by the mixed-formatting diff. A one-line note in Task 4.prep would suffice.

### [Medium] ESLint v9 `--rule` flag syntax uncertainty is unresolved

**Location:** Task 4.prep Step 2, lines 1808–1809; Task 4.1 Step 2, lines 1854–1860

The plan attempts per-rule `eslint --fix` isolation with `--rule '@typescript-eslint/consistent-type-imports: error'` but acknowledges uncertainty about ESLint v9 flat-config compatibility ("v9 flat config supports --rule with this syntax (object form); the rule must already be defined in the active config"). This uncertainty propagates into three alternative approaches within the same task. The plan should either verify the syntax works (a pre-flight test command) or commit to the combined approach unconditionally.

### [Low] Pipe of `eslint --format json` non-zero exit may lose stderr

**Location:** Task 4.end Step 2, line 2201; also present in `build-lint-probe.ts` (handled there via try/catch)

```bash
npx eslint . --format json 2>/dev/null | python3 -c '...'
```

When ESLint exits non-zero (violations present), `2>/dev/null` suppresses any diagnostic stderr. The JSON itself should still flow through stdout, but if ESLint encounters a config error (not a lint error), the suppression hides the real problem. The `build-lint-probe.ts` helper handles this correctly with try/catch; the inline bash invocation doesn't.

### [Low] `classifyArea` assumes directory structure that may not match reality

**Location:** Task 1.0b Step 1, `classifyArea` function, lines 472–499

The function checks for `src/pages`, `src/lib`, `src/hooks`, `src/utils`, `src/services`, `src/contexts`, `src/styles`, and `src/components/<sub>`. It does not check for `src/types`, `src/constants`, or other directories that may exist. The `else` branch returns the raw top-level name, which is fine, but the function also checks for `components` (loose) and `e2e` — if the e2e directory has subdirectories, they'd all be "e2e" with no sub-area distinction. Minor: the probe is informational, not gate-enforcing.

### [Low] `rules-of-hooks` fix is separated from the Wave D loop without cross-reference

**Location:** Task 6.rules-of-hooks (lines 2789–2848) vs. Task 6.loop (lines 2726–2787)

The single `rules-of-hooks` violation gets its own task (6.rules-of-hooks) outside the Wave D per-file loop (6.loop). This is defensible (it may need component restructuring), but the loop task's Step 2 (line 2750) references it: "`rules-of-hooks` (1 error): see Task 6.rules-of-hooks below (separate task)." The executor must remember to run both. The ordering between the loop task and the separate task is unclear — should `rules-of-hooks` run first (structural, highest risk), last, or interleaved by area?

### [Low] `tsx` prerequisite assumed but not verified

**Location:** Task 1.0b Step 2 (line 715): `npx tsx scripts/build-lint-probe.ts`

The plan assumes `tsx` is installed and resolves. Phase 2a's precedent makes this likely (it's listed in the Tech Stack section, line 9), but there's no verification step. If `tsx` isn't available, the probe helper fails at execution time. A `npx tsx --version` check in Task 0a or 0b would catch this early.

### [Low] Task 3.7 Step 1 lists config files without existence check

**Location:** Task 3.7 Step 1, line 1610

The command lists `playwright.config.ts` and `vitest.config.ts` explicitly. If either doesn't exist (or uses a different extension like `.js`), the `prettier --write` call fails. Line 1614 partially addresses this ("if any of the root config files don't exist... drop them from the command"), but the command in Step 1 doesn't include the `ls *.config.*` pre-check suggested in Step 1's note — it's in the note but not as a required step.

### [Nit] Commands use relative `cd ..` instead of absolute paths

**Location:** Throughout (e.g., lines 1353, 1396, 1441, 1488, 1598, 1625, 1660, 1700, etc.)

Many task sequences start in `frontend/`, then use `cd ..` to return to the monorepo root for git operations. This assumes the CWD is always where the previous step left it. The plan's own bash commands include `cd /projects/Brewra/brewra-gtm-intelligence/frontend` at the start of some steps but not all. An executor who skips a step or runs out-of-order could be in the wrong directory.

### [Nit] Commit message body templates are verbose and partially redundant with task descriptions

**Location:** Throughout

Commit messages like the Task 1.0a Step 5 template (lines 357–374) include multi-paragraph bodies restating what the commit does, why, and the spec reference. The spec-reference line is useful; the full-paragraph justification restates the task description. Not wrong, but adds length without review value.

### [Nit] Self-review section is non-standard but not harmful

**Location:** Lines 3199–3211

The "Self-Review Notes" section maps plan tasks to spec sections. This is meta-commentary about the plan's own completeness rather than execution instructions. Not harmful, but also not something an executor would act on.
