# Phase 2b — Frontend ESLint Type-Aware + Prettier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute Spec 18's six-step methodology to land ESLint type-aware rules + Prettier across the frontend. End state: `frontend/eslint.config.js` enables the five mandated rules + `import-x/order` + `eslint-config-prettier` (applied last) + type-aware parser config + override zones; `frontend/.prettierrc` and `frontend/.prettierignore` exist with §3.1 / §4-Step-1 contents; `brewra-gtm-intelligence/.git-blame-ignore-revs` (at monorepo root) contains every Wave A commit SHA; `frontend/package.json` has `"lint": "eslint . --max-warnings 0"`, `"format": "prettier --write ."`, `"format:check": "prettier --check ."`, and `preflight` extended to include lint + format:check; `npm run preflight` green end-to-end; all 233 `no-explicit-any` violations + 103 errors from rules outside the 5 mandated + 56 warnings (35 exhaustive-deps + 13 unused directives + 8 only-export-components) all resolved per the per-rule disposition in Spec 18 §2.1.

**Architecture:** Single short-lived branch (`phase-2b-eslint-prettier`) off `master`. Six deterministic steps mirroring Spec 18 §4. Step 0 captures the authoritative re-baseline (the spec's design-time numbers are 392 problems / 336 errors / 56 warnings against a throwaway probe config; execution-time may differ slightly). Step 1 lands all tool config in one atomic commit (eslint + prettier + .prettierignore + .git-blame-ignore-revs scaffold + package.json scripts). Steps 2–5 are four wave-shaped fix passes: Wave A (Prettier per-area mass-format, ~10–14 commits), Wave B (mechanical lint fixes — auto-fix + manual residue, ~6–10 commits), Wave C (per-site type fixes for `no-explicit-any` + `no-unsafe-*` cascade, ~30–60 commits), Wave D (per-site semantic fixes for `no-floating-promises` + `no-misused-promises` + `react-hooks/exhaustive-deps` + `rules-of-hooks`). Each wave ends with an error-count + Vitest checkpoint. Step 6 runs the full done-when checklist and writes the scorecard. `npm run lint` is red between Step 1 and the end of Wave D; `npm run format:check` is red between Step 1 and the end of Wave A; `npm run typecheck` (Phase 2a's gate) stays green throughout; `vite build`, Vitest, and Playwright continue to pass mid-phase.

**Tech Stack:** Node 22 + npm 10 + TypeScript 5.5 + Vite 5 + ESLint 9 + typescript-eslint 8 + Playwright 1.59.1 + Vitest 3.x + knip 5.x + tsx 4.x. **New npm devDependencies:** `prettier` (latest 3.x), `eslint-plugin-import-x` (latest 4.x; flat-config-native fork per Spec 18 §3.1.5), `eslint-config-prettier` (latest 10.x; disables ESLint stylistic rules conflicting with Prettier). **Python 3** is a prerequisite for probe-artifact analysis scripts (same convention as Plan 17). The new helper script `frontend/scripts/build-lint-probe.ts` runs under `tsx`, sibling to Phase 2a's `build-strict-probe.ts`. The throwaway `frontend/eslint.probe.config.js` is created and removed by the helper; never committed.

**Spec:** `specs/18-frontend-phase-2b-eslint-prettier-design.md` (round 3 clean, plan-ready; reviews 1 and 2 synthesized at `docs/reviews/18-…-spec-synthesis-1.md` and `…-synthesis-2.md`).

**Branch:** `phase-2b-eslint-prettier` (already created off `master` at the post-Phase-2a-merge commit; current branch HEAD at plan-writing time, 2026-05-28: `612089e docs(specs): spec 18 phase 2b round 3 revisions per synthesis-2`). The plan-writing commit lands on this same branch.

**Baseline (measured at plan-writing time, 2026-05-28, against `master` HEAD `ce08615`):**
- Post-Phase-2a frontend tree: 59,651 LOC across 142 `.ts`/`.tsx` files under `frontend/src/` (per Phase 2a's `docs/audits/2026-05-28-frontend-phase-2a-strict-ts.md`).
- Spec 18 §1.3 design-time lint-probe baseline: **392 problems** (336 errors, 56 warnings).
- Per-rule error breakdown (verified empirically by running `eslint . --format json` at commit `80860ba`):
  - `@typescript-eslint/no-explicit-any` 233
  - `no-empty` 46
  - `no-useless-escape` 16
  - `@typescript-eslint/ban-types` 11
  - `@typescript-eslint/no-unsafe-assignment` 9
  - `@typescript-eslint/no-unsafe-return` 6
  - `@typescript-eslint/no-unsafe-member-access` 3
  - `@typescript-eslint/no-empty-object-type` 3
  - `@typescript-eslint/no-unused-expressions` 2
  - `no-control-regex` 2
  - `@typescript-eslint/ban-ts-comment` 2
  - `react-hooks/rules-of-hooks` 1
  - `no-case-declarations` 1
  - `@typescript-eslint/no-require-imports` 1 (`tailwind.config.ts`)
- Per-rule warning breakdown: `react-hooks/exhaustive-deps` 35, unused `eslint-disable` directives 13, `react-refresh/only-export-components` 8.
- Existing inline `any` count: **224** (`rg -n ':\s*any\b|as\s+any\b|<any>' -g '*.ts' -g '*.tsx' src/`). The ESLint `no-explicit-any` rule reports 233 (9 more than the regex) — the regex excludes multi-argument generics and other positions.
- Existing `@ts-*` suppression count: **5** (unchanged from Phase 2a baseline).
- `src/lib/types/escape-hatches.ts` present with **6 entries** from Phase 2a Wave B. Next TD-FE: **TD-FE-10** (Phase 2a's last was TD-FE-9 per `docs/TECH_DEBT.md`).
- Current `eslint .` invocation: `eslint .` (no `--max-warnings` flag — Phase 2b tightens to `--max-warnings 0`).
- Current `npm run typecheck`: `tsc --noEmit -p tsconfig.app.json` (Phase 2a's fix). Returns 0 errors against strict-clean tree.
- Current `npm run preflight` chain: `typecheck && build && test:e2e && test && knip --strict --no-progress`. Phase 2b inserts `lint && format:check` immediately after `typecheck`.

**Why Phase 2b is single-branch (no sub-split):** 392 design-time problems against 4 distinctly-shaped fix categories (Prettier mechanical / auto-fix-mechanical / per-site type / per-site semantic) is well under master spec §4 Phase 2b's 1,500 sub-decomposition threshold. The internal Wave A/B/C/D structure provides commit cohesion. **If Step 0 re-baseline finds >1,500 problems, or threshold gates fire (Spec 18 §1.5):** the executor halts and re-enters Spec 14 §4 sub-decomposition before continuing — see Task 1 Step 7. The two gates:
- `no-floating-promises` + `no-misused-promises` + `react-hooks/exhaustive-deps` combined count > **300** → Wave D sub-decomposition (D-i / D-ii by rule or by area).
- Rule categories not enumerated in Spec 18 §1.3 contributing ≥**20 violations** collectively → halt + scope decision.

**Commit-message convention:** `type(scope): <description>` per CLAUDE.md.
- Scope `fe` for `frontend/` source/config edits, `audits` for `docs/audits/` writes, `docs` for `docs/TECH_DEBT.md` updates, `reviews` for review artifacts (none expected from this plan).
- **No `[N/M]` numbering** — Phase 2b is bounded by the violation count, not a fixed task count.
- **No `Co-Authored-By` footer** (recorded user preference).
- Wave A commits: `style(fe): prettier format <area>`.
- Wave B auto-fix commits: `refactor(fe): apply <rule> --fix` (e.g., `apply consistent-type-imports --fix`).
- Wave B manual residue commits: `refactor(fe): fix <rule-list> in <area>` (e.g., `fix no-empty + no-useless-escape in src/components/customers`).
- Wave C commits: `refactor(fe): type <file>` (or `type <area>` when bundled per the ≤3/>3 batching rule).
- Wave D commits: `fix(fe): resolve floating/misused promises in <file>`, `fix(fe): resolve exhaustive-deps in <file>`, `fix(fe): resolve rules-of-hooks in <component>`.

**Greenness invariant — Phase 2b edition:** Per Spec 18 §4 preamble:
- `npm run typecheck` is expected **green** throughout (Phase 2a's gate is not regressed).
- `npm run lint` is expected **red** between Step 1 and the end of Wave D.
- `npm run format:check` is expected **red** between Step 1 and the end of Wave A.
- `npx vite build` + `npx vitest run` + Playwright stay **green** mid-phase (esbuild transpiles without linting; tests don't lint; Prettier reformatting JSX is rendering-equivalent — visual regression at maxDiffPixelRatio 0.01 backstops this).

Per-commit gate matrix:

| Step / wave | Per-commit gate |
|---|---|
| Step 0 commit 0a (npm install) | `npm install` exits clean; `npx vitest run` green; `vite build` green |
| Step 0 commit 0b (probe artifacts) | `npx vitest run` green; `vite build` green (the probe config is throwaway and deleted) |
| Step 1 (config land) | `vite build` + Vitest green. `npm run lint` and `npm run format:check` expected RED at this commit and documented in the commit body. `npm run typecheck` stays green. |
| Wave A (Prettier per-area) | `npx vitest run` green per commit. `vite build` green. `npm run typecheck` green. `npm run format:check` becomes green progressively as areas land. |
| Wave A end-of-wave | `npm run format:check` green; Vitest green; `.git-blame-ignore-revs` aggregation commit lands. |
| Wave B (mechanical) | `vite build` + Vitest green per commit. `npm run typecheck` green. Lint error-count strictly decreases. |
| Wave B end-of-wave | Lint residual errors should match per-site type/semantic rules only; Vitest green. |
| Wave C (per-site type) | `vite build` + Vitest green per commit. `npm run typecheck` green. Lint `no-explicit-any` count strictly decreases. |
| Wave C end-of-wave | `npm run lint` reports 0 `no-explicit-any` and 0 `no-unsafe-*` outside test paths; Vitest green. |
| Wave D (per-site semantic) | `vite build` + Vitest green per commit. `npm run typecheck` green. Affected component(s) verified via Vitest + visual regression for `rules-of-hooks` fix. |
| Wave D end-of-wave | `npm run lint` (= `eslint . --max-warnings 0`) returns 0; Vitest green. |
| Step 6 (binding pre-merge) | Full `npm run preflight` green (the binding done-when gate). |

Rationale for the mid-wave gates (matches Phase 2a §3 preamble): Wave A is pure formatting (posture rule 8 — `prettier --write` and nothing else); Wave B auto-fix and manual residue are mechanical (posture rule 9 — `eslint --fix` output verbatim or small per-site mechanical fixes); Wave C/D are type/import/format-only or per-site semantic fixes (posture rule 4 — "behavior unchanged"). Vitest catches accidental runtime drift; Playwright + visual regression is the Step 6 safety net. Mid-wave Playwright runs cost ~3–5 min each over 50+ commits without changing outcome.

**Per-commit-gate procedure during waves:**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build                                  # esbuild transpile — green even with lint errors
npx vitest run                                  # unit tests must stay green
# Playwright NOT run mid-wave — Step 6's binding preflight runs it.
```

**Wave-end checkpoint (between Waves):**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint . 2>&1 | tail -5                     # human-readable summary; the spec's residual-rule check
npx vitest run
# For Wave A specifically: prettier --check . should be green; for Wave C: no-explicit-any count = 0.
```

**Step 6 done-when gate (binding):**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight    # typecheck → lint → format:check → build → playwright → vitest → knip --strict
```

Must be green for merge.

**Post-commit rollback:** If a wave's per-commit gate (`vite build` / Vitest) is red after a commit, use `git reset --hard HEAD~N` to revert N commits, diagnose root cause, and re-attempt — never "fix forward" past a runtime regression. If a wave-end checkpoint shows error-count drift outside the wave's expectation (e.g., Wave A introduces Vitest failures), see the wave's investigation procedure.

**Wave-C cascade recovery (specific case):** if a Wave C narrowing fix surfaces unexpected cascading errors in 3+ unrelated files (a "deeper than expected" cascade — see Spec 18 §2.3's note that type-level cascades are in-scope but the file-grain commit absorbs them), revert and choose between:
- **(a) Tighter fix that doesn't change inferred types downstream.** Narrow at the assignment site instead of broadening a return type.
- **(b) Escape-hatch the original site to confine the cascade.** Apply the Wave C escape-hatches policy. Costs one entry and (if it triggers the 5-new-entry threshold) a TD-FE-10 registration.
- **(c) Abort the file and defer to TD-FE.** Register `TD-FE-<n>` capturing the structural problem.

**Abort criterion:** If a single Wave-B/C/D fix cannot be made tight without an out-of-scope refactor across >2 unrelated files, apply Spec 18 §2.4 posture rule 3: escape-hatch, register TD-FE, or abort per Spec 14 §5.7. If three distinct fix attempts on the same file all fail to make Vitest + `vite build` green, halt and surface to operator — likely a deeper structural problem the spec under-scoped.

**Per-task isolation:** Step 0 (2 commits), Step 1 (1 commit), Wave A's end-of-wave aggregation commit, Wave B's discrete auto-fix and manual-residue commits, Wave D's `rules-of-hooks` commit, and Step 6's verification + scorecard commits are single-commit gates. Wave A area commits, Wave B per-area manual residue commits, and Waves C/D per-file commits are per-area / per-file loops where one commit's failure does not abort subsequent commits within the wave, but the wave-end checkpoint blocks the next wave.

**TD-FE numbering:** Sequential from `max(existing TD-FE-* in docs/TECH_DEBT.md) + 1`. As of 2026-05-28 plan-writing time, **TD-FE-1 through TD-FE-9 exist**. **Phase 2b's first deferral is TD-FE-10.** The executor re-reads the current max immediately before each deferral commit (`grep -oE 'TD-FE-[0-9]+' docs/TECH_DEBT.md | sort -V | tail -1`).

**Numbering of plan/spec slot:** This plan and Spec 18 share NN=18 per CLAUDE.md spec-driven flow convention.

**Plan-stage decisions for Spec 18 §7 open questions:**

1. **Step 0 re-baseline numbers (§7.1):** captured at execution start by Task 1 — the plan describes the procedure, not the numbers.
2. **Wave A split decisions per area (§7.2):** ascending file-count within an area; if `prettier --write <area>` produces a diff >250 line-changes, split by sub-folder (next directory level down) or by file group (≤30 files per sub-commit). See Task 3.prep.
3. **Wave B batching decisions (§7.3):** auto-fix runs as **one combined `eslint --fix` sweep** producing a single commit, *unless* the total diff exceeds 500 line-changes (`insertions + deletions`), in which case the executor splits per-rule by reverting and re-applying with `--rule '<rule>: error'` per rule. Default is combined; split is the exception. This sidesteps ESLint v9 flat-config `--rule` flag uncertainty for the common case. Manual mechanical residue commits **group by area** (not by rule) following Wave A's order. See Task 4.prep.
4. **Wave C within-pages ordering (§7.4):** ascending error count from the Step 0 probe JSON; alphabetical tiebreak. See Task 5.prep.
5. **Wave D `checksVoidReturn` decision (§7.5):** **defer to Step 0 probe count**. If Step 0 surfaces ≥10 `no-misused-promises` violations in JSX-attribute contexts (counted as violations where the diagnostic message mentions `JSX attribute` or the location is a JSX attribute), Wave D's first commit (`Task 6.JSX-decision`) edits the `eslint.config.js` to add `"@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }]`. Otherwise the rule stays at default. Decision is recorded in the Step 6 scorecard.
6. **`build-lint-probe.ts` location (§7.6):** **sibling script** under `frontend/scripts/build-lint-probe.ts` (not an extension of `build-strict-probe.ts`). Reason: distinct responsibility — the lint probe invokes `eslint`, `prettier`, and `find`, parses JSON output, writes 4 artifacts. Mixing surfaces with the strict-TS probe increases maintenance drag. The probe is implemented from scratch (no shared utilities needed beyond Node `fs`/`path`/`child_process`). Lifecycle: **kept permanently** as project tooling (re-runnable for future ESLint config audits), same precedent as Phase 2a's `build-strict-probe.ts`.
7. **Diff size reporting depth (§7.7):** **broken down by wave** in the Step 6 scorecard. The aggregate `git diff --stat master..HEAD` is also reported. Per-wave breakdown: Step 0 (0a + 0b), Step 1, Wave A (summed), Wave B (per-rule sub-totals), Wave C (summed), Wave D (per-rule sub-totals), Step 6.
8. **TD-FE numbering (§7.8):** continues from TD-FE-10 (current next slot per `docs/TECH_DEBT.md`).

**Node version for `import.meta.dirname` (Spec 18 §3.2 round-2 finding):** Project runtime is Node v22.13.0 (verified). `import.meta.dirname` requires Node ≥21.2.0. The plan **keeps `tsconfigRootDir: import.meta.dirname`** and adds an `engines.node` field to `frontend/package.json` documenting the requirement (see Task 2 Step 4). Rationale: cleaner config, current runtime supports it, and the `engines` declaration prevents future Node-20-LTS load-time errors. The alternative (`fileURLToPath(new URL('.', import.meta.url))`) would require an additional import and reads less idiomatically.

---

## File Structure

**Date convention for artifact filenames:** every `2026-05-28` reference in this plan anchors to the plan-writing date. If execution starts on a later date, the executor keeps the original `2026-05-28` anchor for all probe and re-probe artifacts (so cross-referencing during waves stays consistent). Only the final Step 6 scorecard file is renamed to the merge date via `git mv` (see Task 7.2).

**Created:**
- `frontend/scripts/build-lint-probe.ts` — new helper that creates a throwaway `eslint.probe.config.js`, runs `eslint . --max-warnings 0 --format json/text` + `prettier --check .` + `find` for area-tree, captures 4 artifacts, deletes the throwaway. Committed in Step 0 commit 0b. **Lifecycle: kept permanently as project tooling** (re-runnable for future ESLint config audits).
- `docs/audits/2026-05-28-frontend-phase-2b-lint-probe.json` — Step 0 machine-readable per-rule × per-area roll-up + per-file violation list.
- `docs/audits/2026-05-28-frontend-phase-2b-lint-probe.txt` — Step 0 raw `eslint .` output.
- `docs/audits/2026-05-28-frontend-phase-2b-prettier-probe.txt` — Step 0 `prettier --check .` output.
- `docs/audits/2026-05-28-frontend-phase-2b-area-tree.txt` — Step 0 directory enumeration (input for Wave C ordering validation).
- `docs/audits/2026-05-28-post-wave-a-frontend-phase-2b-lint-probe.{json,txt}` — Task 3.end inter-wave re-probe (sanity check; Wave A is pure formatting so the eslint surface should be ~unchanged).
- `docs/audits/2026-05-28-post-wave-b-frontend-phase-2b-lint-probe.{json,txt}` — Task 4.end inter-wave re-probe (input for Wave C's prep script — drives per-file ordering for `no-explicit-any` + `no-unsafe-*`).
- `docs/audits/2026-05-28-post-wave-c-frontend-phase-2b-lint-probe.{json,txt}` — Task 5.end inter-wave re-probe (input for Wave D's prep script — drives per-file ordering for `no-floating-promises`, `no-misused-promises`, `exhaustive-deps`).
- `frontend/.prettierrc` — Prettier config per Spec 18 §3.1.
- `frontend/.prettierignore` — Prettier ignore patterns per Spec 18 §4 Step 1.
- `brewra-gtm-intelligence/.git-blame-ignore-revs` — at the **monorepo root** (where `.git/` is), initialized empty + header comment in Step 1, appended with Wave A SHAs in Task 3.end.
- `docs/audits/2026-05-28-frontend-phase-2b-eslint-prettier.md` — Step 6 final scorecard (re-dated to merge date if phase spans multiple days, via `git mv` immediately before the scorecard commit).

**Modified:**
- `frontend/eslint.config.js` — restructured to:
  - Import + register `eslint-plugin-import-x` and `eslint-config-prettier`.
  - Add five new/re-enabled rules + `import-x/order` configuration.
  - Add `languageOptions.parserOptions.projectService: true` + `tsconfigRootDir`.
  - Apply `eslintConfigPrettier` as the LAST config in the export array.
  - Add three override zones (shadcn ui, root configs, test files) per Spec 18 §3.3.
- `frontend/package.json` — script edits + new devDependencies:
  - `"lint": "eslint . --max-warnings 0"` (tightens existing).
  - `"format": "prettier --write ."` (new).
  - `"format:check": "prettier --check ."` (new).
  - `"preflight": "npm run typecheck && npm run lint && npm run format:check && npm run build && npm run test:e2e && npm run test && npx knip --strict --no-progress"` (extends existing).
  - `"engines": { "node": ">=21.2.0" }` (new, documents `import.meta.dirname` requirement).
  - devDependencies: add `prettier`, `eslint-plugin-import-x`, `eslint-config-prettier`.
- `frontend/package-lock.json` — auto-updated by `npm install`.
- `frontend/src/lib/types/escape-hatches.ts` — conditional; Phase 2b appends entries if Wave C/D needs them. Phase 2a's 6 entries are preserved unchanged.
- `docs/TECH_DEBT.md` — append `TD-FE-10` (and beyond) as deferrals are decided during Waves C/D; one entry if Phase 2b adds ≥5 new escape-hatches entries.
- Variable additional source files under `frontend/src/`, `e2e/`, `scripts/`, and root configs (`vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`) modified by Waves A/B/C/D (per-area / per-file commit grain — exact list determined by Step 0 probe output).
- `specs/14-frontend-refactoring-master-plan-design.md` — `synthesize-impl-review` flips §4 Phase 2b status row to `done` at merge time per Spec 14 §5.5 (not authored by this plan).

**Deleted:**
- The throwaway `frontend/eslint.probe.config.js` is created and removed by `build-lint-probe.ts`; **never committed** (it does not enter the working tree's tracked state).

---

## Pre-flight (no commit)

**Note on master advancing mid-phase:** Phase 2b expects a short-lived branch (2–4 days of execution due to higher commit count than Phase 2a). If `master` advances during execution (sync.sh propagates a Brewra-dev change, or another feature branch merges), the executor stops at the next natural commit boundary (wave end ideal; per-task acceptable) and evaluates: (a) if upstream touches none of Phase 2b's target files (`frontend/eslint.config.js`, `frontend/package.json`, `frontend/.prettierrc*`, `.git-blame-ignore-revs`, or any file currently in a wave's queue), rebase onto the new master and continue; (b) if upstream touches any target file, abort per Spec 14 §5.7, log discovery as a `TD-FE-<n>`, and re-plan after the upstream change settles.

### Task 0a — Verify branch state, confirm Phase 2b branch is current

**Files:** none (git operations only).

- [ ] **Step 1: Confirm branch and HEAD**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git status
git rev-parse --abbrev-ref HEAD
git log --oneline -3
```

Expected:
- Branch: `phase-2b-eslint-prettier`
- HEAD: `612089e docs(specs): spec 18 phase 2b round 3 revisions per synthesis-2` (or a later commit on the same branch if this plan's own writing commit lands first).
- Recent log shows the round-2/round-3 spec revisions and the synthesis-2 review.

If branch is not `phase-2b-eslint-prettier`, switch to it: `git checkout phase-2b-eslint-prettier`. If the branch doesn't exist, STOP — Spec 18's branch was supposed to be created during brainstorming.

- [ ] **Step 2: Confirm working tree is clean**

```bash
git status -sb
```

Expected: `## phase-2b-eslint-prettier` with no `M`, `??`, or `A` lines (clean working tree).

If untracked or modified files are present that aren't part of the in-flight plan-writing commit, stash or commit them before proceeding.

- [ ] **Step 3: Confirm master sync is current**

```bash
git fetch origin
git log --oneline master..HEAD
git log --oneline HEAD..origin/master | head -5
```

Expected: `master..HEAD` shows the spec/review commits already on `phase-2b-eslint-prettier` (currently 5 commits: round 1 spec, review-1+synthesis-1, round 2 revisions, review-2+synthesis-2, round 3 revisions). `HEAD..origin/master` should be empty (no upstream drift since branch creation).

If `origin/master` has advanced and the new commits touch Phase 2b target files, see "master advancing mid-phase" note above.

### Task 0b — Confirm baseline preflight green

**Files:** none (verification only).

- [ ] **Step 1: Verify required CLI tools resolve**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
node --version          # expected: v22.x or v21.2+
npm --version           # expected: 10.x
npx tsx --version       # expected: 4.x.x (tsx 4.22.3+ per package.json)
```

Expected: all three print version strings. `tsx` is required for `build-lint-probe.ts` and any other helper scripts; if missing, `npm install` resolves it (it's a devDependency at `^4.22.3`).

- [ ] **Step 2: Run preflight on the current branch state**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: all five checks green (`typecheck → vite build → test:e2e → test → knip --strict --no-progress`). Runtime ~5–10 minutes.

Note: `npm run lint` is `eslint .` (no `--max-warnings 0` yet), so it would surface the 392 problems if invoked — but the existing preflight chain doesn't include `lint`, so preflight stays green despite the violations.

If preflight is red on the unmodified branch: STOP — the baseline already fails. Diagnose before any Phase 2b work; the Step 6 binding gate requires preflight green at merge time.

- [ ] **Step 3: Confirm the design-time lint/prettier baseline**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint . 2>&1 | tail -3
```

Expected: a summary line matching `392 problems (336 errors, 56 warnings)` or close to it (drift within ±5% is acceptable; >5% drift is noted and re-baselined by Step 0).

```bash
# Prettier not yet installed — this will fail with "command not found":
npx prettier --check . 2>&1 | head -5 || echo "Expected: prettier not installed at baseline"
```

Expected: `command not found` or `Cannot find module 'prettier'` — Prettier installs in Step 0 commit 0a.

- [ ] **Step 4: Record the file/LOC baseline (anchor for scorecard's "before" column)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
find src -type f \( -name '*.ts' -o -name '*.tsx' \) | wc -l    # expected: 142
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec cat {} + | wc -l   # expected: ~59651
```

Note actual numbers for the Step 6 scorecard. Significant drift (>5% delta from 142 / 59,651) is noted in scorecard's "Delta vs spec baseline" line; proceed.

- [ ] **Step 5: Confirm the inline `any` and `@ts-*` baselines**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
rg -n ':\s*any\b|as\s+any\b|<any>' -g '*.ts' -g '*.tsx' src/ | wc -l    # expected: 224
rg -n '@ts-(ignore|expect-error|nocheck)' -g '*.ts' -g '*.tsx' src/ | wc -l    # expected: 5
```

These are the design-time non-regression baselines for Step 6 done-when items 7 and 9. Post-merge `@ts-*` count must be ≤5; post-merge inline `any` count is expected near zero in production paths (some allowed in test files per §3.3 override zone).

- [ ] **Step 6: Confirm the existing escape-hatches state**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
cat src/lib/types/escape-hatches.ts | grep -c '^export type Untyped'   # expected: 6
```

Phase 2a left 6 `Untyped*` entries. Phase 2b appends; does not remove or rename existing entries.

---

## Step 0 — Re-baseline at execution start (two commits)

Capture the authoritative lint + prettier landscape against the current branch state. This is the spec's official "before" anchor for all downstream waves and the Step 6 scorecard.

### Task 1.0a — Install npm devDependencies (commit 0a)

**Files:**
- Modify: `frontend/package.json` (devDependencies only — no script edits yet)
- Modify: `frontend/package-lock.json` (auto-updated)

One commit per Spec 18 §4 Step 0. Rationale: the probe (commit 0b) needs Prettier and the new ESLint plugins installed to run; co-committing the install with the probe artifacts would mix dependency state with audit output. Two commits preserve cohesion.

- [ ] **Step 1: Install the three new devDependencies**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm install --save-dev prettier eslint-plugin-import-x eslint-config-prettier
```

Expected output: npm adds three packages and updates `package-lock.json`. Approximate versions at plan-writing time: `prettier@^3.x`, `eslint-plugin-import-x@^4.x`, `eslint-config-prettier@^10.x`. Pin exact versions as resolved (npm writes to package.json with `^` prefix; that's expected).

- [ ] **Step 2: Verify package.json reflects the three new entries**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -A1 '"devDependencies"' package.json | head -2
node -e "const p=require('./package.json'); for (const k of ['prettier','eslint-plugin-import-x','eslint-config-prettier']) console.log(k, p.devDependencies[k]||'MISSING');"
```

Expected: all three print with version strings (no `MISSING`).

- [ ] **Step 3: Verify the binaries resolve**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx prettier --version
node -e "console.log(require.resolve('eslint-plugin-import-x'))"
node -e "console.log(require.resolve('eslint-config-prettier'))"
```

Expected: prettier version (e.g., `3.x.x`), and two resolved paths inside `node_modules/`.

- [ ] **Step 4: Run preflight (existing chain — does NOT include lint or format:check yet)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: green. The new devDependencies are installed but not yet wired into any script; the existing `preflight` runs `typecheck → build → test:e2e → test → knip --strict --no-progress`. Knip should not flag the new deps as unused at this point because `knip --strict` checks against the production config (which Step 1 wires); Step 0 commits intentionally leave the deps unreferenced.

**Knip note:** If `knip --strict --no-progress` flags `prettier`, `eslint-plugin-import-x`, or `eslint-config-prettier` as unused at commit 0a, that's expected — they're not yet referenced by any source file or config script. **Knip's `--strict` mode treats unused deps as errors**, so this would fail preflight. Two options:

- **(a) Preferred:** add the three new deps to `frontend/knip.json` `ignoreDependencies` for this single commit only. Step 1 removes them from `ignoreDependencies` when wiring the actual usage.
- **(b) Alternative:** combine commits 0a and 0b into a single commit (still atomic for the install + probe) — knip then sees the probe config referencing the deps. Spec 18 §4 Step 0 mandates two commits for cohesion; (a) preserves that.

Apply option (a):

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
# Inspect current knip.json:
cat knip.json
```

If `ignoreDependencies` array exists, add the three new deps to it. If absent, add the array. Use the Edit tool to make the change idempotent. After the edit, re-run `npm run preflight` — expected green.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/package.json frontend/package-lock.json frontend/knip.json
git status
git commit -m "$(cat <<'EOF'
chore(fe): install prettier + eslint-plugin-import-x + eslint-config-prettier

Adds the three devDependencies needed for Phase 2b:
- prettier: codebase formatter (config wired in Step 1).
- eslint-plugin-import-x: flat-config-native fork of eslint-plugin-import
  (Spec 18 §3.1.5 rationale; provides import-x/order rule).
- eslint-config-prettier: disables ESLint stylistic rules that conflict
  with Prettier (applied last in extends chain in Step 1).

knip.json temporarily lists the three packages in ignoreDependencies;
Step 1 removes them when wiring the actual usage. Preflight stays green
because the existing chain runs typecheck/build/test/knip — none of
which require the new packages until Step 1's script edits.

Spec 18 §4 Step 0, commit 0a.
EOF
)"
```

Verify commit landed:

```bash
git log --oneline -1
```

### Task 1.0b — Write `build-lint-probe.ts` + run probe + capture artifacts (commit 0b)

**Files:**
- Create: `frontend/scripts/build-lint-probe.ts`
- Create: `docs/audits/2026-05-28-frontend-phase-2b-lint-probe.json`
- Create: `docs/audits/2026-05-28-frontend-phase-2b-lint-probe.txt`
- Create: `docs/audits/2026-05-28-frontend-phase-2b-prettier-probe.txt`
- Create: `docs/audits/2026-05-28-frontend-phase-2b-area-tree.txt`

Five artifacts plus the helper land in one commit. Rationale: probe artifacts are inert outputs of the helper; the helper's correctness is implied by the artifact shapes. Splitting would create a no-value gap.

- [ ] **Step 1: Write `frontend/scripts/build-lint-probe.ts`**

Create the file with this exact content:

```typescript
#!/usr/bin/env tsx
/**
 * build-lint-probe.ts — Phase 2b lint+prettier probe helper.
 *
 * Creates a throwaway eslint.probe.config.js that extends the current
 * eslint.config.js shape with the Phase 2b rule additions + override
 * zones, runs `eslint . --max-warnings 0 --format json|text` and
 * `prettier --check .`, captures four artifacts, then deletes the
 * throwaway config. Sibling to scripts/build-strict-probe.ts (Phase 2a).
 *
 * Artifacts:
 *   - docs/audits/<date>-frontend-phase-2b-lint-probe.json
 *   - docs/audits/<date>-frontend-phase-2b-lint-probe.txt
 *   - docs/audits/<date>-frontend-phase-2b-prettier-probe.txt
 *   - docs/audits/<date>-frontend-phase-2b-area-tree.txt
 *
 * Re-runnable: subsequent invocations overwrite all four artifacts.
 *
 * Usage (run from frontend/):
 *   npx tsx scripts/build-lint-probe.ts [--date YYYY-MM-DD] [--prefix LABEL]
 *
 * --prefix is used by inter-wave re-probes (e.g., --prefix post-wave-a).
 * If --date is omitted, defaults to today's UTC date.
 *
 * Spec 18 §4 Step 0 / Task 3.end / Task 4.end / Task 5.end.
 */

import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const FRONTEND_DIR = resolve(__dirname, "..");
const REPO_DIR = resolve(FRONTEND_DIR, "..");

function todayUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseArgs(): { date: string; prefix: string } {
  const args = process.argv.slice(2);
  let date = todayUtc();
  let prefix = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--date" && i + 1 < args.length) {
      date = args[i + 1];
      i++;
    } else if (args[i] === "--prefix" && i + 1 < args.length) {
      prefix = args[i + 1] + "-";
      i++;
    }
  }
  return { date, prefix };
}

interface EslintMessage {
  ruleId: string | null;
  severity: number;
  message: string;
  line: number;
  column: number;
}

interface EslintFileResult {
  filePath: string;
  messages: EslintMessage[];
  errorCount: number;
  warningCount: number;
}

function classifyArea(absPath: string): string {
  const rel = absPath.replace(FRONTEND_DIR + "/", "").replace(/\\/g, "/");
  // Match top-level + first sub-folder
  if (rel.startsWith("src/")) {
    const m = rel.match(/^src\/([^/]+)(?:\/([^/]+))?/);
    if (!m) return "src (loose)";
    const top = m[1];
    const sub = m[2];
    if (top === "pages") return "pages";
    if (top === "lib") return "lib";
    if (top === "hooks") return "hooks";
    if (top === "utils") return "utils";
    if (top === "services") return "services";
    if (top === "contexts") return "contexts";
    if (top === "styles") return "styles";
    if (top === "components") {
      if (!sub) return "components (loose)";
      return `components/${sub}`;
    }
    // Fallback: return raw top-level dir name (e.g., src/types, src/constants).
    // Probe is informational, not gate-enforcing, so an unknown sub-tree is fine.
    return top;
  }
  if (rel.startsWith("e2e/")) return "e2e";
  if (rel.startsWith("scripts/")) return "scripts";
  if (rel.match(/^(vite|tailwind|postcss|playwright)\.config\.(ts|js)$/)) {
    return "root-config";
  }
  return "other";
}

function writeProbeConfig(probePath: string): void {
  // The probe extends the production-state Step 1 config shape. We write
  // it inline rather than dynamically extending eslint.config.js because
  // the probe runs BEFORE Step 1 has edited that file.
  const content = `// Throwaway probe config — deleted by build-lint-probe.ts before exit.
// Mirrors the Step 1 production config shape so the probe surface
// matches what Step 1 will land.
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import importX from "eslint-plugin-import-x";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "import-x": importX,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "import-x/order": ["error", {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true },
      }],
    },
  },
  // Override zones (Spec 18 §3.3)
  { files: ["src/components/ui/**"], rules: {
    "react-refresh/only-export-components": "off",
  } },
  { files: ["tailwind.config.ts", "postcss.config.js", "vite.config.ts"], rules: {
    "@typescript-eslint/no-require-imports": "off",
  } },
  { files: ["src/**/__tests__/**", "src/**/*.{test,spec}.{ts,tsx}", "e2e/**"], rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-floating-promises": "off",
  } },
  // eslint-config-prettier must come LAST
  eslintConfigPrettier
);
`;
  writeFileSync(probePath, content, "utf-8");
}

function main(): void {
  const { date, prefix } = parseArgs();
  const probePath = resolve(FRONTEND_DIR, "eslint.probe.config.js");
  const auditDir = resolve(REPO_DIR, "docs", "audits");
  mkdirSync(auditDir, { recursive: true });

  const jsonOut = resolve(auditDir, `${date}-${prefix}frontend-phase-2b-lint-probe.json`);
  const txtOut = resolve(auditDir, `${date}-${prefix}frontend-phase-2b-lint-probe.txt`);
  const prettierOut = resolve(auditDir, `${date}-${prefix}frontend-phase-2b-prettier-probe.txt`);
  const areaTreeOut = resolve(auditDir, `${date}-${prefix}frontend-phase-2b-area-tree.txt`);

  // 1) Write the throwaway probe config.
  writeProbeConfig(probePath);

  // 2) Run eslint --format json. Non-zero exit is the expected case
  //    (violations present); we still want stdout.
  let rawJson = "";
  try {
    rawJson = execFileSync(
      resolve(FRONTEND_DIR, "node_modules", ".bin", "eslint"),
      [".", "--config", "eslint.probe.config.js", "--format", "json"],
      { cwd: FRONTEND_DIR, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }
    );
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    rawJson = (e.stdout ?? "");
    if (!rawJson) {
      // ESLint sometimes fails before producing JSON (e.g., config syntax error).
      // Surface stderr to the human runner.
      console.error("ESLint JSON probe produced no stdout. stderr:");
      console.error(e.stderr ?? "(no stderr)");
      throw err;
    }
  }

  // 3) Run eslint --format text (human-readable summary in the .txt artifact).
  let rawText = "";
  try {
    rawText = execFileSync(
      resolve(FRONTEND_DIR, "node_modules", ".bin", "eslint"),
      [".", "--config", "eslint.probe.config.js"],
      { cwd: FRONTEND_DIR, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }
    );
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    rawText = (e.stdout ?? "") + (e.stderr ?? "");
  }

  // 4) Run prettier --check .
  let prettierRaw = "";
  try {
    prettierRaw = execFileSync(
      resolve(FRONTEND_DIR, "node_modules", ".bin", "prettier"),
      ["--check", "."],
      { cwd: FRONTEND_DIR, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }
    );
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    prettierRaw = (e.stdout ?? "") + (e.stderr ?? "");
  }

  // 5) Capture area tree.
  const areaTree = execSync(
    `find src components pages -maxdepth 2 -type d 2>/dev/null | sort`,
    { cwd: FRONTEND_DIR, encoding: "utf-8" }
  );

  // 6) Delete throwaway probe config.
  rmSync(probePath, { force: true });

  // 7) Write artifacts.
  writeFileSync(txtOut, rawText, "utf-8");
  writeFileSync(prettierOut, prettierRaw, "utf-8");
  writeFileSync(areaTreeOut, areaTree, "utf-8");

  // 8) Parse JSON + roll up.
  const results = JSON.parse(rawJson) as EslintFileResult[];

  const errorsByRule: Record<string, number> = {};
  const warningsByRule: Record<string, number> = {};
  const errorsByArea: Record<string, number> = {};
  const warningsByArea: Record<string, number> = {};
  const errorsByFile: Record<string, number> = {};
  const warningsByFile: Record<string, number> = {};
  const rulesByFile: Record<string, Record<string, number>> = {};
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const file of results) {
    const area = classifyArea(file.filePath);
    const relFile = file.filePath.replace(FRONTEND_DIR + "/", "");
    if (file.errorCount) errorsByFile[relFile] = file.errorCount;
    if (file.warningCount) warningsByFile[relFile] = file.warningCount;
    totalErrors += file.errorCount;
    totalWarnings += file.warningCount;
    for (const m of file.messages) {
      const rule = m.ruleId ?? "(no-rule-id)";
      if (m.severity === 2) {
        errorsByRule[rule] = (errorsByRule[rule] ?? 0) + 1;
        errorsByArea[area] = (errorsByArea[area] ?? 0) + 1;
      } else if (m.severity === 1) {
        warningsByRule[rule] = (warningsByRule[rule] ?? 0) + 1;
        warningsByArea[area] = (warningsByArea[area] ?? 0) + 1;
      }
      (rulesByFile[relFile] ??= {})[rule] = (rulesByFile[relFile]?.[rule] ?? 0) + 1;
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    date,
    prefix: prefix ? prefix.slice(0, -1) : null,
    totals: { errors: totalErrors, warnings: totalWarnings, problems: totalErrors + totalWarnings },
    errorsByRule,
    warningsByRule,
    errorsByArea,
    warningsByArea,
    errorsByFile,
    warningsByFile,
    rulesByFile,
  };

  writeFileSync(jsonOut, JSON.stringify(report, null, 2) + "\n", "utf-8");

  // 9) Console summary.
  console.log(`Total problems: ${totalErrors + totalWarnings} (${totalErrors} errors, ${totalWarnings} warnings)`);
  console.log("Errors by rule:", errorsByRule);
  console.log("Warnings by rule:", warningsByRule);
  console.log("Errors by area:", errorsByArea);
  console.log(`Wrote ${jsonOut}`);
  console.log(`Wrote ${txtOut}`);
  console.log(`Wrote ${prettierOut}`);
  console.log(`Wrote ${areaTreeOut}`);
}

main();
```

This file is ~220 lines. It uses Node built-ins + `execFileSync`/`execSync`/`tsx`'s CommonJS-compat `__dirname` (same pattern as Phase 2a's `build-strict-probe.ts`).

- [ ] **Step 2: Verify the helper executes cleanly**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx tsx scripts/build-lint-probe.ts --date 2026-05-28
```

Expected: prints `Total problems: <N>`, errors/warnings by rule, errors by area, and four artifact paths.

Expected `<N>` range: ~392 ± drift. The per-rule breakdown should be close to Spec 18 §1.3's verified counts: 233 `@typescript-eslint/no-explicit-any` (errors), 46 `no-empty` (errors), 35 `react-hooks/exhaustive-deps` (warnings), etc.

**The probe runs the production-shape config**, which includes the override zones — so `react-refresh/only-export-components` warnings under `src/components/ui/**` and the `no-require-imports` error in root configs should be filtered out. If the probe shows those, the override zones in `writeProbeConfig` are mis-shaped — diagnose before continuing.

Confirm the throwaway config was cleaned up:

```bash
ls frontend/eslint.probe.config.js 2>&1
```

Expected: `ls: cannot access ... : No such file or directory`.

- [ ] **Step 3: Verify the JSON artifact is parseable and well-shaped**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
python3 <<'PY'
import json
d = json.load(open("docs/audits/2026-05-28-frontend-phase-2b-lint-probe.json"))
t = d["totals"]
print(f"totals: errors={t['errors']} warnings={t['warnings']} problems={t['problems']}")
print(f"errorsByRule keys: {sorted(d['errorsByRule'].keys())}")
print(f"warningsByRule keys: {sorted(d['warningsByRule'].keys())}")
print(f"errorsByArea keys: {sorted(d['errorsByArea'].keys())}")
print(f"errorsByFile count: {len(d['errorsByFile'])}")
# Top 10 files by error count:
top = sorted(d["errorsByFile"].items(), key=lambda kv: -kv[1])[:10]
print("Top 10 files by errors:")
for f, n in top:
    print(f"  {n:4d}  {f}")
PY
```

Expected: `errorsByRule` includes `@typescript-eslint/no-explicit-any` (~233), `no-empty` (~46), `@typescript-eslint/ban-types` (~11), etc. Top files likely include `pages/MarketResearch.tsx`, `pages/MissionControl.tsx`, large `components/mission-control/*` files.

- [ ] **Step 4: Verify the TXT artifact contains raw `eslint` output + prettier output**

```bash
head -30 docs/audits/2026-05-28-frontend-phase-2b-lint-probe.txt
wc -l docs/audits/2026-05-28-frontend-phase-2b-lint-probe.txt
head -20 docs/audits/2026-05-28-frontend-phase-2b-prettier-probe.txt
wc -l docs/audits/2026-05-28-frontend-phase-2b-prettier-probe.txt
```

Expected: lint txt contains lines like `src/pages/MarketResearch.tsx`, then `  123:4  error  Unexpected any.  @typescript-eslint/no-explicit-any`. Prettier txt contains `[warn] Code style issues found in N files. Run Prettier with --write to fix.` plus per-file warning lines.

- [ ] **Step 5: Verify the area-tree artifact**

```bash
head -30 docs/audits/2026-05-28-frontend-phase-2b-area-tree.txt
```

Expected: directories like `src/components/customers`, `src/components/market-research`, `src/components/mission-control`, `src/components/ui`, etc. The Wave A area order in Task 3.prep cross-checks against this list.

- [ ] **Step 6: Record re-baseline numbers in working notes**

```bash
mkdir -p /tmp/phase-2b-notes
python3 <<'PY' > /tmp/phase-2b-notes/baseline.txt
import json
d = json.load(open("/projects/Brewra/brewra-gtm-intelligence/docs/audits/2026-05-28-frontend-phase-2b-lint-probe.json"))
t = d["totals"]
print(f"Step 0 re-baseline (execution time)")
print(f"  totalProblems: {t['problems']} (errors={t['errors']} warnings={t['warnings']})")
print()
print("Errors by rule (re-baseline vs spec §1.3):")
spec_errors = {
    "@typescript-eslint/no-explicit-any": 233,
    "no-empty": 46,
    "no-useless-escape": 16,
    "@typescript-eslint/ban-types": 11,
    "@typescript-eslint/no-unsafe-assignment": 9,
    "@typescript-eslint/no-unsafe-return": 6,
    "@typescript-eslint/no-unsafe-member-access": 3,
    "@typescript-eslint/no-empty-object-type": 3,
    "@typescript-eslint/no-unused-expressions": 2,
    "no-control-regex": 2,
    "@typescript-eslint/ban-ts-comment": 2,
    "react-hooks/rules-of-hooks": 1,
    "no-case-declarations": 1,
    "@typescript-eslint/no-require-imports": 1,
}
for rule, n_spec in sorted(spec_errors.items(), key=lambda kv: -kv[1]):
    n_rb = d["errorsByRule"].get(rule, 0)
    print(f"  {rule}: spec {n_spec}  re-baseline {n_rb}  delta {n_rb - n_spec:+d}")
new_rules = sorted(set(d["errorsByRule"].keys()) - set(spec_errors.keys()))
if new_rules:
    print(f"  NEW error rules (not in spec): {[(r, d['errorsByRule'][r]) for r in new_rules]}")
print()
print("Warnings by rule:")
spec_warnings = {
    "react-hooks/exhaustive-deps": 35,
    "(unused-directive)": 13,
    "react-refresh/only-export-components": 8,
}
for rule, n_spec in sorted(spec_warnings.items(), key=lambda kv: -kv[1]):
    n_rb = d["warningsByRule"].get(rule, 0)
    print(f"  {rule}: spec {n_spec}  re-baseline {n_rb}  delta {n_rb - n_spec:+d}")
new_w = sorted(set(d["warningsByRule"].keys()) - set(spec_warnings.keys()))
if new_w:
    print(f"  NEW warning rules (not in spec): {[(r, d['warningsByRule'][r]) for r in new_w]}")
PY
cat /tmp/phase-2b-notes/baseline.txt
```

Expected: a delta table. Codes with positive delta or codes absent from the spec list get noted for plan-stage awareness.

- [ ] **Step 7: Apply Spec 18 §1.5 / §4 Step 0 threshold gates**

Gate 1: `no-floating-promises` + `no-misused-promises` + `react-hooks/exhaustive-deps` combined count.

```bash
python3 <<'PY'
import json
d = json.load(open("/projects/Brewra/brewra-gtm-intelligence/docs/audits/2026-05-28-frontend-phase-2b-lint-probe.json"))
e = d["errorsByRule"]
w = d["warningsByRule"]
combined = (e.get("@typescript-eslint/no-floating-promises", 0)
            + e.get("@typescript-eslint/no-misused-promises", 0)
            + w.get("react-hooks/exhaustive-deps", 0))
print(f"Combined floating + misused + exhaustive-deps: {combined}")
if combined > 300:
    print("THRESHOLD BREACH: Wave D sub-decomposition required (§4 Step 0 gate).")
    print("Halt and re-enter scope decision before continuing to Task 2.")
else:
    print(f"OK: {combined} ≤ 300; Wave D single-pass.")
PY
```

Expected case: combined count well under 300 (design-time numbers suggest ~35 exhaustive-deps + small-but-unknown floating/misused = likely 50–100 total). If breach: STOP, surface to operator, re-enter scope decision per Spec 14 §4.

Gate 2: rule categories not in §1.3 contributing ≥20 violations.

```bash
python3 <<'PY'
import json
d = json.load(open("/projects/Brewra/brewra-gtm-intelligence/docs/audits/2026-05-28-frontend-phase-2b-lint-probe.json"))
spec_rules = {
    "@typescript-eslint/no-explicit-any", "no-empty", "no-useless-escape",
    "@typescript-eslint/ban-types", "@typescript-eslint/no-unsafe-assignment",
    "@typescript-eslint/no-unsafe-return", "@typescript-eslint/no-unsafe-member-access",
    "@typescript-eslint/no-empty-object-type", "@typescript-eslint/no-unused-expressions",
    "no-control-regex", "@typescript-eslint/ban-ts-comment", "react-hooks/rules-of-hooks",
    "no-case-declarations", "@typescript-eslint/no-require-imports",
    "react-hooks/exhaustive-deps", "react-refresh/only-export-components",
    "@typescript-eslint/no-unused-vars",  # newly re-enabled; expected ≤5
    "@typescript-eslint/consistent-type-imports",  # newly enabled; expected nonzero
    "import-x/order",  # newly enabled; expected nonzero
    "@typescript-eslint/no-floating-promises",  # newly enabled; expected nonzero
    "@typescript-eslint/no-misused-promises",  # newly enabled; expected nonzero
}
unanticipated = {}
for rule, n in {**d["errorsByRule"], **d["warningsByRule"]}.items():
    if rule not in spec_rules:
        unanticipated[rule] = unanticipated.get(rule, 0) + n
total = sum(unanticipated.values())
print(f"Unanticipated rule violations: {total}")
for rule, n in sorted(unanticipated.items(), key=lambda kv: -kv[1]):
    print(f"  {rule}: {n}")
if total >= 20:
    print("THRESHOLD BREACH: rule categories beyond spec §1.3 contribute ≥20 violations.")
    print("Halt and re-enter scope decision before continuing to Task 2.")
else:
    print(f"OK: {total} < 20; spec §1.3 rule set is comprehensive.")
PY
```

If breach: STOP, surface to operator, re-enter scope decision.

- [ ] **Step 8: Verify preflight stays green (probe artifacts are inert)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: green. The helper script is unreferenced by any build path; the audit artifacts are in `docs/`.

- [ ] **Step 9: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/scripts/build-lint-probe.ts \
        docs/audits/2026-05-28-frontend-phase-2b-lint-probe.json \
        docs/audits/2026-05-28-frontend-phase-2b-lint-probe.txt \
        docs/audits/2026-05-28-frontend-phase-2b-prettier-probe.txt \
        docs/audits/2026-05-28-frontend-phase-2b-area-tree.txt
git commit -m "$(cat <<'EOF'
chore(audits): phase 2b lint+prettier re-baseline

Captures the authoritative ESLint + Prettier probe baseline against the
current branch state. Four artifacts:

- lint-probe.json: per-file, per-area, per-rule violation counts +
  details. Machine-readable input for Wave C/D ordering scripts.
- lint-probe.txt: raw eslint stdout (human-readable).
- prettier-probe.txt: raw `prettier --check .` output (which files
  would change under Wave A's mass-format).
- area-tree.txt: directory enumeration under src/ (input for Wave A
  area-group validation; see plan Task 3.prep).

The probe runs a throwaway eslint.probe.config.js that mirrors the
Step 1 production config shape (5 new rules + import-x/order +
override zones + eslint-config-prettier last). The throwaway is
deleted before exit; never enters the tracked working tree.

Re-baseline output is the spec's official "before" anchor for all
downstream waves and the Step 6 scorecard. Spec 18 §4 Step 0,
commit 0b.
EOF
)"
```

Verify commit landed:

```bash
git log --oneline -1
git status
```

---

## Step 1 — Tool config + format infra (one commit)

Land the production config in one atomic commit. After this commit, `npm run lint` and `npm run format:check` are both red; `npm run typecheck` stays green.

### Task 2 — Wire ESLint type-aware + Prettier config + scripts + `.git-blame-ignore-revs` scaffold

**Files:**
- Modify: `frontend/eslint.config.js`
- Create: `frontend/.prettierrc`
- Create: `frontend/.prettierignore`
- Modify: `frontend/package.json` (scripts + engines)
- Modify: `frontend/knip.json` (remove `ignoreDependencies` for the three new deps)
- Create: `brewra-gtm-intelligence/.git-blame-ignore-revs` (at monorepo root)

Six edits in one commit. All configure the lint/format surface; splitting would create a partial-config state where `npm run lint` references rules whose packages aren't wired into `eslint.config.js`.

- [ ] **Step 1: Rewrite `frontend/eslint.config.js`**

Replace the current 29-line file with the full Phase 2b config. Final content:

```js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import importX from "eslint-plugin-import-x";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "import-x": importX,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "import-x/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
    },
  },
  // Override zone: shadcn primitives — locked from Phase 4.
  {
    files: ["src/components/ui/**"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  // Override zone: root config files using CommonJS require().
  {
    files: ["tailwind.config.ts", "postcss.config.js", "vite.config.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override zone: test files — relaxed for mock typing and intentional fire-and-forget.
  {
    files: ["src/**/__tests__/**", "src/**/*.{test,spec}.{ts,tsx}", "e2e/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
  // eslint-config-prettier MUST come last to disable conflicting stylistic rules.
  eslintConfigPrettier
);
```

- [ ] **Step 2: Create `frontend/.prettierrc`**

```jsonc
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

- [ ] **Step 3: Create `frontend/.prettierignore`**

```
dist
dev-dist
node_modules
playwright-report
coverage
e2e/**/*-snapshots/**
package-lock.json
```

- [ ] **Step 4: Edit `frontend/package.json` — scripts + engines + remove knip ignores**

Use Edit tool to make four changes:

1. Change `"lint": "eslint ."` → `"lint": "eslint . --max-warnings 0"`.
2. Add `"format": "prettier --write ."` and `"format:check": "prettier --check ."` after the `lint` script.
3. Change `"preflight": "npm run typecheck && npm run build && ..."` → `"preflight": "npm run typecheck && npm run lint && npm run format:check && npm run build && npm run test:e2e && npm run test && npx knip --strict --no-progress"`.
4. Add `"engines": { "node": ">=21.2.0" }` after the `scripts` block.

Final `scripts` block:

```jsonc
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "build:dev": "vite build --mode development",
  "lint": "eslint . --max-warnings 0",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "preflight": "npm run typecheck && npm run lint && npm run format:check && npm run build && npm run test:e2e && npm run test && npx knip --strict --no-progress",
  "preview": "vite preview",
  "test": "vitest run",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test",
  "test:e2e:headed": "playwright test --headed",
  "test:e2e:update-snapshots": "playwright test --update-snapshots",
  "test:e2e:ui": "playwright test --ui",
  "test:watch": "vitest",
  "typecheck": "tsc --noEmit -p tsconfig.app.json"
},
"engines": {
  "node": ">=21.2.0"
},
```

- [ ] **Step 5: Edit `frontend/knip.json` — remove the three temporary ignoreDependencies entries**

Read the current `frontend/knip.json` (was edited in Task 1.0a Step 4). Remove `prettier`, `eslint-plugin-import-x`, `eslint-config-prettier` from the `ignoreDependencies` array (or remove the array entirely if those were its only entries). Knip now sees them referenced by `eslint.config.js` (eslint-plugin-import-x, eslint-config-prettier) and by `package.json` scripts (prettier).

Verify: `npx knip --strict --no-progress` should not flag any of the three as unused.

- [ ] **Step 6: Create `brewra-gtm-intelligence/.git-blame-ignore-revs` at the monorepo root**

```
# Pure-formatting commits to ignore in git blame.
# See https://git-scm.com/docs/git-config#Documentation/git-config.txt-blameignoreRevsFile
# Locally: git config blame.ignoreRevsFile .git-blame-ignore-revs
# GitHub honors this file automatically.
```

This file lives at the **monorepo root** (`brewra-gtm-intelligence/.git-blame-ignore-revs`), not inside `frontend/`. GitHub's blame UI only checks the repo root.

- [ ] **Step 7: Run `vite build` + Vitest to confirm runtime is intact**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build
npx vitest run
```

Expected: both green. The config change is type/import-resolution-only at build time; no runtime impact.

- [ ] **Step 8: Confirm `npm run typecheck` still green**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run typecheck
```

Expected: 0 errors. Phase 2a's gate is preserved.

- [ ] **Step 9: Confirm `npm run lint` and `npm run format:check` are now red (expected)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run lint 2>&1 | tail -3
npm run format:check 2>&1 | tail -3
```

Expected:
- Lint: `392 problems (336 errors, 56 warnings)` or close, plus the `--max-warnings 0` exit code 1.
- Format:check: `[warn] Code style issues found in N files. Run Prettier with --write to fix.`

These reds are the design state — Waves A and B/C/D drive them to green.

- [ ] **Step 10: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/eslint.config.js \
        frontend/.prettierrc \
        frontend/.prettierignore \
        frontend/package.json \
        frontend/knip.json \
        .git-blame-ignore-revs
git status
git commit -m "$(cat <<'EOF'
chore(fe): wire eslint type-aware rules + prettier config

Lands the Phase 2b config target in one atomic commit:

eslint.config.js:
- Five mandated rules: no-explicit-any (error), no-unused-vars (error
  with ^_ ignore patterns), consistent-type-imports (error),
  no-floating-promises (error), no-misused-promises (error).
- import-x/order configured per spec §3 (groups + newlines + alpha).
- languageOptions.parserOptions.projectService: true (typescript-eslint
  v8 lazy-loaded type-aware parser); tsconfigRootDir: import.meta.dirname
  (requires Node ≥21.2; package.json engines field documents this).
- Three override zones: shadcn ui/ (only-export-components off), root
  configs (no-require-imports off), test files (no-explicit-any warn,
  no-floating-promises off).
- eslint-config-prettier applied LAST to disable conflicting stylistic
  rules.

.prettierrc: semi true, singleQuote false (matches shadcn convention),
trailingComma all, printWidth 100, tabWidth 2, arrowParens always,
endOfLine lf.

.prettierignore: build artifacts + snapshots + lock files.

.git-blame-ignore-revs at monorepo root: empty scaffold; Wave A's
end-of-wave commit appends the per-area mass-format SHAs. Lives at
repo root so GitHub blame UI honors it automatically.

package.json:
- lint script: --max-warnings 0 (tightens the existing eslint .).
- format + format:check scripts added.
- preflight extended to include lint + format:check.
- engines.node >=21.2.0 documents the import.meta.dirname requirement.

knip.json: removed the three temporary ignoreDependencies entries
from Task 1.0a — knip now sees the deps referenced by eslint.config.js
and the format scripts.

Post-commit state:
- npm run typecheck: green (Phase 2a's gate preserved).
- npm run lint: RED (~392 problems, drives to 0 over Waves A–D).
- npm run format:check: RED (drives to green at end of Wave A).
- npm run preflight: would fail at lint step — not a regression
  because Step 0b's preflight didn't run lint either; the new failure
  is the design state.

Spec 18 §4 Step 1.
EOF
)"
```

Verify:

```bash
git log --oneline -1
git status
```

---

## Step 2 — Wave A: Prettier per-area mass-format

Apply `prettier --write` per area, low-impact areas first. Each commit contains only formatting changes (Spec 18 §2.4 posture rule 8). After Wave A, `npm run format:check` is green; `npm run lint` is still red (rule fixes happen in Waves B–D).

### Task 3.prep — Read probe artifacts, derive area splits

**Files:** none (analysis only).

- [ ] **Step 1: Read the prettier-probe artifact to estimate per-area diff sizes**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
# Identify which files Prettier would change, grouped by area:
python3 <<'PY'
import re
with open("docs/audits/2026-05-28-frontend-phase-2b-prettier-probe.txt") as f:
    lines = f.read().splitlines()
# Prettier emits lines like "[warn] src/path/to/file.tsx" for files needing format.
files = []
for line in lines:
    m = re.match(r"^\[warn\]\s+(\S+\.(?:ts|tsx|json|jsonc|md|js|mjs|cjs|css))$", line)
    if m:
        files.append(m.group(1))
print(f"Total files needing format: {len(files)}")
# Group by area (top-level + first sub-folder):
from collections import defaultdict
groups = defaultdict(list)
for f in files:
    if f.startswith("src/"):
        parts = f.split("/")
        if len(parts) >= 3 and parts[1] == "components":
            area = f"src/components/{parts[2]}"
        else:
            area = f"src/{parts[1]}"
    elif f.startswith("e2e/"):
        area = "e2e"
    elif f.startswith("scripts/"):
        area = "scripts"
    elif "/" not in f:
        area = "root-config"
    else:
        area = f.split("/")[0]
    groups[area].append(f)
for area in sorted(groups.keys()):
    print(f"  {area}: {len(groups[area])} files")
PY
```

Expected: groups like `src/components/customers`, `src/components/market-research`, `src/components/mission-control`, `src/components/ui`, `src/pages`, `e2e`, `scripts`, `root-config`. The per-area file counts inform whether to split a single `prettier --write <area>` into sub-commits.

- [ ] **Step 2: Plan the Wave A commit order**

The spec mandates this group order (Spec 18 §4 Step 2). Confirm against the prettier-probe file list:

1. **Group 1:** `src/lib/`, `src/hooks/`, `src/utils/`, `src/services/`, `src/contexts/`, `src/styles/` (light counts, broad blast radius — format first to validate Prettier behavior).
2. **Group 2:** `src/components/ui/` (shadcn primitives; conservative count; preserves shadcn formatting style with `singleQuote: false` per §3.1).
3. **Group 3:** `src/components/layout/`, `src/components/signals/`, `src/components/strategist/`, `src/components/settings/`, `src/components/customers/` (mid-size component areas).
4. **Group 4:** `src/components/market-research/` (large area; may need sub-area splits).
5. **Group 5:** `src/components/mission-control/` (largest component area; may need sub-area splits).
6. **Group 6:** `src/pages/` — small pages first (Settings, TenantSelection, Login, Calendar, Reports, Artifacts, Signals, Deals, Insights, NotFound), then `MissionControl.tsx`, then `MarketResearch.tsx` last (largest file).
7. **Group 7:** `e2e/`, `scripts/`, root configs (`vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `playwright.config.ts`, `vitest.config.ts`).

The default is one commit per group. **Split threshold:** if a single area's `prettier --write` diff exceeds **250 line-changes** (`git diff --shortstat` after running prettier), split into sub-area commits by next-directory-level subfolder, or by file group (≤30 files per sub-commit) if the area is flat.

- [ ] **Step 3: Dry-run a single area to validate the threshold**

Pick a known-large area (likely `src/components/mission-control/`) and dry-run:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx prettier --write src/components/mission-control/
git diff --shortstat src/components/mission-control/
# Reset for the real Wave A commits:
git checkout -- src/components/mission-control/
```

Expected: diff stat shows e.g. `12 files changed, 234 insertions(+), 198 deletions(-)`. Apply the spec's 250-line threshold directly to `insertions + deletions`: if the sum exceeds **250**, split into sub-area commits. Example: `234 + 198 = 432` → split. The spec's threshold is intentional (low enough to preserve commit-level bisection granularity across Wave A's mechanical reformat).

For each area that needs splitting, the executor records the sub-area boundary decision in working notes (committed in Step 6 scorecard as the §7.2 plan-stage resolution).

### Task 3.1 — Format Group 1 (lib + hooks + utils + services + contexts + styles)

**Files:** Variable; see Step 1.

- [ ] **Step 1: Apply Prettier to Group 1**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx prettier --write src/lib/ src/hooks/ src/utils/ src/services/ src/contexts/ src/styles/
```

Expected: prints reformatted file paths. Confirm:

```bash
git status -sb
git diff --shortstat src/lib/ src/hooks/ src/utils/ src/services/ src/contexts/ src/styles/
```

If diff exceeds the split threshold (>250 lines total per spec §4 Step 2), split into per-subfolder commits (one per: lib, hooks, utils, services, contexts, styles). Otherwise one combined commit.

- [ ] **Step 2: Verify no non-formatting changes were introduced**

Spot-check the diff to confirm it's pure whitespace/quote/comma changes:

```bash
git diff src/lib/ src/hooks/ | head -50
```

Expected: changes are limited to: indentation, line-wrap at column 100, comma placement (`trailingComma: "all"`), quote style (none should flip; the codebase already uses doubles), and `arrowParens: always` (`x =>` becomes `(x) =>`). If logic changes appear, abort the commit and reset (`git checkout -- <files>`) — Prettier should never change semantics.

- [ ] **Step 3: Run gate checks**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build
npx vitest run
npm run typecheck
```

Expected: all green. Prettier's reformatting is rendering-equivalent.

If Vitest fails, the most likely cause is template literal whitespace inside test assertions (Prettier normalizes some whitespace in template literals). Reset the offending file and either skip it (add to `.prettierignore`) or fix the test to be whitespace-insensitive — record the decision in working notes.

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/lib/ frontend/src/hooks/ frontend/src/utils/ frontend/src/services/ frontend/src/contexts/ frontend/src/styles/
git status
git commit -m "$(cat <<'EOF'
style(fe): prettier format src/lib + src/hooks + src/utils + src/services + src/contexts + src/styles

Wave A Group 1 mass-format. Pure-formatting commit (no rule fixes,
no logic changes — Spec 18 §2.4 posture rule 8). Pre-Phase-2b style:
mixed line wrap, sometimes single quotes, inconsistent trailing
commas. Post-format: column 100 wrap, double quotes (matches
shadcn), trailing-comma all.

This commit's SHA will be appended to .git-blame-ignore-revs in the
Wave A end-of-wave aggregation commit.

Spec 18 §4 Step 2.
EOF
)"
git log --oneline -1
```

Record the commit SHA for the Wave A aggregation (Task 3.end).

### Task 3.2 — Format Group 2 (`src/components/ui/`)

**Files:** Variable; ~40 shadcn primitive files.

- [ ] **Step 1: Apply Prettier**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx prettier --write src/components/ui/
git diff --shortstat src/components/ui/
```

Expected: small diff (shadcn was already mostly Prettier-compliant from upstream). If diff < 50 lines, this is a quick commit. If unexpectedly large, investigate — may indicate a previously-untouched shadcn file.

- [ ] **Step 2: Run gate checks + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build && npx vitest run && npm run typecheck
cd ..
git add frontend/src/components/ui/
git commit -m "$(cat <<'EOF'
style(fe): prettier format src/components/ui

Wave A Group 2 mass-format. Shadcn primitives. Pure formatting,
no rule fixes. Spec 18 §4 Step 2.
EOF
)"
git log --oneline -1
```

### Task 3.3 — Format Group 3 (components — non-research, non-mc)

**Files:** Variable; `src/components/{layout,signals,strategist,settings,customers}/`.

- [ ] **Step 1: Apply Prettier per-area; check split threshold for each**

For each subfolder in `layout`, `signals`, `strategist`, `settings`, `customers`:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
for area in layout signals strategist settings customers; do
  echo "=== $area ==="
  npx prettier --write "src/components/$area/"
  git diff --shortstat "src/components/$area/"
done
```

Expected: each subfolder's diff is moderate (50–250 lines). If any single subfolder exceeds 250 lines (spec §4 Step 2 threshold), split that subfolder into per-file or per-component commits. Otherwise bundle into a single Group 3 commit.

- [ ] **Step 2: Run gate checks**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build && npx vitest run && npm run typecheck
```

Expected: green.

- [ ] **Step 3: Commit (one combined commit per default, or per-subfolder if split)**

Default (combined):

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/components/layout/ frontend/src/components/signals/ frontend/src/components/strategist/ frontend/src/components/settings/ frontend/src/components/customers/
git commit -m "$(cat <<'EOF'
style(fe): prettier format src/components (layout + signals + strategist + settings + customers)

Wave A Group 3 mass-format. Mid-size component areas. Pure
formatting, no rule fixes. Spec 18 §4 Step 2.
EOF
)"
```

Split alternative (one commit per subfolder): use `style(fe): prettier format src/components/<subfolder>` subject for each.

### Task 3.4 — Format Group 4 (`src/components/market-research/`)

**Files:** Variable; large area.

- [ ] **Step 1: Apply Prettier; expect split**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx prettier --write src/components/market-research/
git diff --shortstat src/components/market-research/
```

Expected: large diff (likely >250 lines, the spec §4 Step 2 split threshold). Split by sub-folder if `market-research/` has structured subfolders (e.g., `sections/`, `cards/`); otherwise split by file groups of ≤30 files each.

```bash
# If sub-folders exist:
ls src/components/market-research/
# If flat with many files:
ls src/components/market-research/ | wc -l
```

- [ ] **Step 2: For each sub-commit, apply + gate-check + commit**

If sub-folder split:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
# Reset and apply per sub-folder:
git checkout -- src/components/market-research/
for sub in <enumerated sub-folders>; do
  npx prettier --write "src/components/market-research/$sub/"
  npx vite build && npx vitest run
  cd ..
  git add "frontend/src/components/market-research/$sub/"
  git commit -m "style(fe): prettier format src/components/market-research/$sub"
  cd frontend
done
```

If flat-file split: process in batches of 30 files alphabetically, each batch one commit.

- [ ] **Step 3: Verify all files formatted**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx prettier --check src/components/market-research/
```

Expected: `All matched files use Prettier code style!`.

### Task 3.5 — Format Group 5 (`src/components/mission-control/`)

**Files:** Variable; expected largest area.

- [ ] **Step 1: Apply Prettier; expect split**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx prettier --write src/components/mission-control/
git diff --shortstat src/components/mission-control/
```

Same split logic as Task 3.4.

- [ ] **Step 2: Sub-commit loop (same pattern as Task 3.4 Step 2)**

For each sub-folder or file batch: format → gate-check → commit with `style(fe): prettier format src/components/mission-control/<sub>` subject.

- [ ] **Step 3: Verify**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx prettier --check src/components/mission-control/
```

Expected: clean.

### Task 3.6 — Format Group 6 (`src/pages/`)

**Files:** Variable; small pages first, large pages last.

- [ ] **Step 1: Identify page-file sizes for ordering**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
ls -la src/pages/*.tsx | awk '{print $5, $9}' | sort -n
```

Expected: ascending byte size. The smallest pages (NotFound, Login, TenantSelection, Settings) format first; `MissionControl.tsx` and `MarketResearch.tsx` (likely 100KB+) format last.

- [ ] **Step 2: Format small pages in one commit**

Define "small" as pages ≤30KB:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
# List small pages:
find src/pages -maxdepth 1 -name '*.tsx' -size -30k | sort
# Apply:
npx prettier --write $(find src/pages -maxdepth 1 -name '*.tsx' -size -30k | sort | tr '\n' ' ')
git diff --shortstat src/pages/
npx vite build && npx vitest run
cd ..
git add frontend/src/pages/
git commit -m "$(cat <<'EOF'
style(fe): prettier format src/pages (small pages)

Wave A Group 6 mass-format, sub-commit 1: pages ≤30KB. Pure
formatting. Spec 18 §4 Step 2.
EOF
)"
```

- [ ] **Step 3: Format `MissionControl.tsx`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx prettier --write src/pages/MissionControl.tsx
git diff --shortstat src/pages/MissionControl.tsx
npx vite build && npx vitest run
cd ..
git add frontend/src/pages/MissionControl.tsx
git commit -m "$(cat <<'EOF'
style(fe): prettier format src/pages/MissionControl.tsx

Wave A Group 6 mass-format, sub-commit 2: large page commit.
Pure formatting. Spec 18 §4 Step 2.
EOF
)"
```

- [ ] **Step 4: Format `MarketResearch.tsx`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx prettier --write src/pages/MarketResearch.tsx
git diff --shortstat src/pages/MarketResearch.tsx
npx vite build && npx vitest run
cd ..
git add frontend/src/pages/MarketResearch.tsx
git commit -m "$(cat <<'EOF'
style(fe): prettier format src/pages/MarketResearch.tsx

Wave A Group 6 mass-format, sub-commit 3: largest single-file
format commit. Pure formatting. Spec 18 §4 Step 2.
EOF
)"
```

### Task 3.7 — Format Group 7 (e2e + scripts + root configs)

**Files:** `e2e/**/*.ts`, `scripts/**/*.ts`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `playwright.config.ts`, `vitest.config.ts`.

- [ ] **Step 1: Enumerate existing config files (root-config existence pre-check)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
ls *.config.* 2>/dev/null
```

Expected: a subset of `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `playwright.config.ts`, `vitest.config.ts`. Capture the actual list — that's what gets fed to `prettier --write`. If any expected file is missing or has a different extension (e.g., `.js` instead of `.ts`), use the actual filename in Step 2.

- [ ] **Step 2: Apply Prettier**

Substitute the actual config file list from Step 1 into the command:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
# Replace <config-files> with the actual list from Step 1, e.g.:
#   vite.config.ts tailwind.config.ts postcss.config.js playwright.config.ts vitest.config.ts
npx prettier --write e2e/ scripts/ <config-files>
git diff --shortstat
```

- [ ] **Step 3: Gate checks + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build && npx vitest run && npm run typecheck
cd ..
git add frontend/e2e/ frontend/scripts/ frontend/*.config.*
git commit -m "$(cat <<'EOF'
style(fe): prettier format e2e + scripts + root configs

Wave A Group 7 mass-format. e2e/ Playwright tests, scripts/ helpers,
and root config files (vite/tailwind/postcss/playwright/vitest). Pure
formatting, no rule fixes. Spec 18 §4 Step 2.
EOF
)"
```

### Task 3.end — Aggregate Wave A SHAs into `.git-blame-ignore-revs` + wave-end checkpoint

**Files:**
- Modify: `brewra-gtm-intelligence/.git-blame-ignore-revs` (append all Wave A SHAs)
- Create: `docs/audits/2026-05-28-post-wave-a-frontend-phase-2b-lint-probe.{json,txt}` (sanity re-probe)
- Create: `docs/audits/2026-05-28-post-wave-a-frontend-phase-2b-prettier-probe.txt`

Two commits: (1) `.git-blame-ignore-revs` aggregation, (2) post-Wave-A re-probe artifacts.

- [ ] **Step 1: Collect Wave A SHAs**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
# Step 1 commit was the config land; Wave A starts after that.
# Find the first Wave A commit (subject starts with "style(fe): prettier format"):
WAVE_A_START=$(git log --reverse --format='%H %s' master..HEAD | grep -m1 "^[a-f0-9]* style(fe): prettier format" | awk '{print $1}')
echo "Wave A first commit: $WAVE_A_START"
# All Wave A commits in chronological order:
git log --reverse --format='%H %s' "${WAVE_A_START}^..HEAD" | grep "style(fe): prettier format"
```

Expected: 7–14 commits, all subjects beginning with `style(fe): prettier format`.

- [ ] **Step 2: Append SHAs to `.git-blame-ignore-revs`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
WAVE_A_SHAS=$(git log --reverse --format='%H %s' master..HEAD | grep "^[a-f0-9]* style(fe): prettier format" | awk '{print $1}')
{
  echo ""
  echo "# Phase 2b Wave A — Prettier mass-format commits (2026-05-28)"
  for sha in $WAVE_A_SHAS; do
    SUBJECT=$(git log -1 --format='%s' "$sha")
    echo "$sha  # $SUBJECT"
  done
} >> .git-blame-ignore-revs

cat .git-blame-ignore-revs
```

Expected: file contains the header comment + the Wave A SHAs with their subjects appended.

- [ ] **Step 3: Verify `npm run format:check` is green**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run format:check
```

Expected: `All matched files use Prettier code style!`. If red, a file was missed in Wave A — diagnose and add a residual Wave A commit before proceeding.

- [ ] **Step 4: Run wave-end gate checks**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build
npx vitest run
npm run typecheck
```

Expected: all green. Lint (`npm run lint`) remains red — that's Waves B–D's domain.

- [ ] **Step 5: Commit the `.git-blame-ignore-revs` aggregation**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add .git-blame-ignore-revs
git commit -m "$(cat <<'EOF'
chore(fe): add Wave A prettier commits to git blame ignore-revs

Aggregates all Phase 2b Wave A per-area mass-format commit SHAs into
.git-blame-ignore-revs at the monorepo root. GitHub blame UI and
local `git blame` (with `blame.ignoreRevsFile` configured) will skip
these commits, preserving authorship history through the mechanical
reformat.

Contributors who want local `git blame` to honor this file:
  git config blame.ignoreRevsFile .git-blame-ignore-revs

GitHub honors the file automatically.

Spec 18 §4 Step 2 end-of-wave.
EOF
)"
```

- [ ] **Step 6: Run post-Wave-A re-probe (sanity check; informational)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx tsx scripts/build-lint-probe.ts --date 2026-05-28 --prefix post-wave-a
```

Expected: total problems should be ~unchanged from Step 0 (Prettier reformatting shouldn't move ESLint counts much; some `import-x/order` violations may resolve if Prettier reordered imports). Note any movement.

- [ ] **Step 7: Commit the re-probe artifacts**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add docs/audits/2026-05-28-post-wave-a-frontend-phase-2b-lint-probe.json \
        docs/audits/2026-05-28-post-wave-a-frontend-phase-2b-lint-probe.txt \
        docs/audits/2026-05-28-post-wave-a-frontend-phase-2b-prettier-probe.txt
git commit -m "$(cat <<'EOF'
chore(audits): phase 2b post-Wave-A lint re-probe

Captures the post-formatting lint surface for Wave B planning. The
prettier-probe artifact should show zero remaining format violations
(Wave A end-of-wave verified format:check green); the lint-probe
captures whether Prettier's reformatting incidentally resolved any
ESLint violations (e.g., import-x/order if Prettier reordered).

Spec 18 §4 Step 2 end-of-wave.
EOF
)"
```

---

## Step 3 — Wave B: Mechanical lint fixes (auto-fix + manual residue)

Apply all mechanical lint fixes — both auto-fixable (`eslint --fix`) and small manual ones. Each commit contains only the rule's targeted output (Spec 18 §2.4 posture rule 9). Per-site type fixes go to Wave C; per-site semantic fixes go to Wave D.

### Task 4.prep — Read post-Wave-A re-probe, plan Wave B sub-commits

**Files:** none (analysis only).

- [ ] **Step 1: Identify which rules will be addressed in Wave B**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
python3 <<'PY'
import json
d = json.load(open("docs/audits/2026-05-28-post-wave-a-frontend-phase-2b-lint-probe.json"))
# Wave B targets:
wave_b_auto_fix = {
    "@typescript-eslint/consistent-type-imports",
    "import-x/order",
    "@typescript-eslint/ban-types",
    "@typescript-eslint/no-empty-object-type",
    "@typescript-eslint/no-unused-vars",
}
wave_b_manual = {
    "no-empty",
    "no-useless-escape",
    "no-control-regex",
    "@typescript-eslint/no-unused-expressions",
    "no-case-declarations",
    "@typescript-eslint/ban-ts-comment",
}
print("Wave B auto-fix targets:")
for rule in sorted(wave_b_auto_fix):
    n = d["errorsByRule"].get(rule, 0)
    print(f"  {rule}: {n}")
print("Wave B manual residue targets:")
for rule in sorted(wave_b_manual):
    n = d["errorsByRule"].get(rule, 0)
    print(f"  {rule}: {n}")
unused_directives = d["warningsByRule"].get("(no-rule-id)", 0)  # unused directives often have null ruleId
# Or eslint may use a specific name; check both:
unused_directives_alt = d["warningsByRule"].get("eslint-comments/no-unused-disable", 0)
print(f"\nUnused eslint-disable directives (warning): {unused_directives} (alt name: {unused_directives_alt})")
PY
```

Expected: counts close to Spec 18 §1.3 (e.g., `ban-types` ~11, `no-empty` ~46, `no-useless-escape` ~16). Wave B's commit count should be: 5 auto-fix sweeps + ~3–5 per-area manual residue + 1 unused-directives commit = ~9–11 commits.

- [ ] **Step 2: Measure the combined `eslint --fix` diff size (decides combined vs split)**

Per the header's plan-stage decision #3, the binding default is **one combined `eslint --fix` sweep**, with per-rule split only when the combined diff exceeds 500 line-changes.

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint . --fix 2>&1 | tail -3
git diff --shortstat
```

Read the `insertions + deletions` total from `--shortstat`.

- **If sum ≤ 500:** ship as one combined commit (Task 4.1 below). Skip Tasks 4.2 and 4.3 (per-rule fallback paths).
- **If sum > 500:** reset, then execute Tasks 4.1, 4.2, 4.3 individually with `--rule '<rule>: error'`. The `--rule` flag does work in ESLint v9 flat config when the rule is already declared in the active config (verified by the post-Step-1 state).

After measuring, reset the working tree before Task 4.1 applies it for real:

```bash
git checkout -- .
git status   # expected: clean
```

**Wave B / Prettier whitespace interaction note (Spec 18 §2.4 posture rule 9):** Wave B's `--fix` output may include trivial whitespace deltas on lines Prettier (Wave A) already moved. This is benign and expected — `import-x/order`'s sort can re-arrange blocks whose individual lines are Prettier-formatted, producing diffs where unchanged lines appear because their line numbers shifted. The posture-rule-9 purity check is "no non-rule-targeted code changes," not "no whitespace changes." Do not treat these as posture violations.

### Task 4.1 — Combined `eslint --fix` sweep (default path)

This is the binding default per header plan-stage decision #3. Tasks 4.2 and 4.3 are the per-rule fallback paths, executed only if Task 4.prep Step 2 measured >500 line-changes.

**Files:** Variable; all files with auto-fixable lint violations.

- [ ] **Step 1: Apply combined `eslint --fix`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint . --fix 2>&1 | tail -5
git diff --shortstat
```

Expected: violations from `consistent-type-imports`, `import-x/order`, `ban-types`, `no-empty-object-type`, and any other auto-fixable rules are all resolved in one sweep. The shortstat shows the total diff (which Task 4.prep already measured ≤500 if this default path applies).

- [ ] **Step 2: Spot-check the diff is rule-targeted (no logic edits)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
git diff --stat | head -20
git diff src/lib/ | head -50   # sample area; verify changes are import/type-syntax only
```

Expected: changes are `import X` → `import type X`, import-block reorderings, `{}` → `object` substitutions, and similar mechanical transforms. No identifier renames, no expression edits, no JSX changes. If logic edits appear, abort the commit and reset (`git checkout -- .`) — `eslint --fix` should never change semantics.

- [ ] **Step 3: Gate checks**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build
npx vitest run
npm run typecheck
```

Expected: all green. Auto-fixes are import/type-syntax-only.

- [ ] **Step 4: Commit (combined)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A
git commit -m "$(cat <<'EOF'
refactor(fe): apply eslint --fix (Wave B auto-fix sweep)

Combined Wave B auto-fix sweep, covering all auto-fixable rules in
one commit (default path per plan stage decision #3):
- @typescript-eslint/consistent-type-imports: import → import type
- import-x/order: import-block reordering and grouping
- @typescript-eslint/ban-types (~11): {} → object, Function → specific
  per context, Boolean/Number/String/Object → lowercase primitives
- @typescript-eslint/no-empty-object-type (~3 auto-fixable; manual
  residue handled by Task 4.4)

Pure mechanical transform (ESLint --fix output verbatim, no manual
edits — Spec 18 §2.4 posture rule 9). No runtime change.

Spec 18 §4 Step 3 Wave B.
EOF
)"
git log --oneline -1
```

**If Task 4.prep Step 2 measured >500 lines (split path):** skip this combined-commit Step 4 and execute Tasks 4.2 + 4.3 individually instead. Reset (`git checkout -- .`) before starting Task 4.2.

Split-path per-rule sequence (in order, one commit each):
1. `consistent-type-imports` (covered as Task 4.2 Step 1's first command — see Task 4.2 note below; this rule runs first because it often resolves downstream `import-x/order` flags as side effect)
2. `import-x/order` (Task 4.2's main sweep)
3. `ban-types` (Task 4.3)
4. `no-empty-object-type` auto-fix (covered by Task 4.4 Step 1's recheck)

Each `--rule '<name>: error'` per-rule sweep uses the production config's rule definition (no temporary config needed in ESLint v9 flat config when the rule is already declared, as it is post-Step-1).

### Task 4.2 — Split-path: `consistent-type-imports` + `import-x/order` (skip in default path)

**Only run this task if Task 4.prep Step 2 chose the split path.** If Task 4.1 was a combined commit, **skip this task**. Otherwise two commits (one per rule), in this order:

**Files:** Variable; most files with import blocks.

- [ ] **Step 1: Apply `consistent-type-imports --fix` first**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint . --fix --rule '@typescript-eslint/consistent-type-imports: error' 2>&1 | tail -3
git diff --shortstat
npx vite build && npx vitest run && npm run typecheck
cd ..
git add -A
git commit -m "refactor(fe): apply consistent-type-imports --fix"
cd frontend
```

Run first because the rule's transform (`import { Foo }` → `import type { Foo }`) can affect which import lines `import-x/order` re-positions.

- [ ] **Step 2: Apply `import-x/order --fix` second**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint . --fix --rule 'import-x/order: error' 2>&1 | tail -3
git diff --shortstat
npx vite build && npx vitest run && npm run typecheck
cd ..
git add -A
git commit -m "refactor(fe): apply import-x/order --fix"
```

### Task 4.3 — Split-path: `@typescript-eslint/ban-types` (skip in default path)

**Only run this task if Task 4.prep Step 2 chose the split path.** If Task 4.1 was combined, **skip**. Otherwise:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint . --fix --rule '@typescript-eslint/ban-types: error' 2>&1 | tail -3
git diff --shortstat
npx vite build && npx vitest run && npm run typecheck
cd ..
git add -A
git commit -m "refactor(fe): apply ban-types --fix"
```

The rule converts deprecated type aliases (`{}` → `object`, `Function` → `(...args: unknown[]) => unknown` or context-specific replacement, `Boolean`/`Number`/`String`/`Object` → lowercase primitives).

### Task 4.4 — Auto-fix sweep + manual residue: `@typescript-eslint/no-empty-object-type`

If Task 4.1 was combined and addressed `no-empty-object-type` via `--fix`, the auto-fix portion is done. Some `no-empty-object-type` cases need manual fix (the rule's auto-fix has limited coverage). Check residual:

- [ ] **Step 1: Check post-Task-4.1 residual**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint . 2>&1 | grep no-empty-object-type | wc -l
```

Expected: 0 if `--fix` covered all 3; 1–3 if manual fix needed.

- [ ] **Step 2: For each manual case, apply per-site fix**

The pattern is usually `interface X {}` or `type X = {}` (empty object type). Replace with `interface X extends Y` or `type X = object` or `type X = Record<string, unknown>` depending on intent.

For each surviving violation, read the file, decide the right replacement type, edit, gate-check, commit:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint . 2>&1 | grep no-empty-object-type
# For each <file>:<line>:<col>, open the file and replace the empty object type
# with the appropriate concrete type based on usage context.
```

- [ ] **Step 3: Commit (combined if all manual fixes in one area; per-file otherwise)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A
git commit -m "refactor(fe): resolve no-empty-object-type residue"
```

### Task 4.5 — `@typescript-eslint/no-unused-vars` residue

Spec 18 §2.1 expects ≤5 new violations after Phase 2a's `noUnusedLocals` cleanup.

- [ ] **Step 1: Check current count**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint . 2>&1 | grep no-unused-vars | wc -l
```

Expected: 0–5. If 0, **skip this task**. If 1–5, proceed.

- [ ] **Step 2: Apply per-site fix for each violation**

For each unused variable: either prefix with `_` (if intended unused) or remove entirely. Honor the `^_` argsIgnorePattern from §3.4 — `_argName` is preferred for new fixes.

- [ ] **Step 3: Gate checks + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build && npx vitest run && npm run typecheck
cd ..
git add -A
git commit -m "$(cat <<'EOF'
refactor(fe): resolve no-unused-vars residue

Wave B residue commit: <N> unused-vars surfaced after re-enabling
@typescript-eslint/no-unused-vars. Each site either prefixed with _
(intentional) or removed.

Spec 18 §4 Step 3 Wave B.
EOF
)"
```

### Task 4.6 — Manual mechanical residue (per area)

**Rules:** `no-empty`, `no-useless-escape`, `no-control-regex`, `no-unused-expressions`, `no-case-declarations`, `@typescript-eslint/ban-ts-comment` — total ~69 fixes.

Group by area following Wave A's order. Expected 3–5 commits.

- [ ] **Step 1: Enumerate violations by area**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint . 2>&1 | grep -E "(no-empty|no-useless-escape|no-control-regex|no-unused-expressions|no-case-declarations|ban-ts-comment)" > /tmp/phase-2b-notes/wave-b-residue.txt
wc -l /tmp/phase-2b-notes/wave-b-residue.txt
# Group by area (parse file path prefixes):
python3 <<'PY'
from collections import defaultdict
groups = defaultdict(list)
with open("/tmp/phase-2b-notes/wave-b-residue.txt") as f:
    for line in f:
        line = line.strip()
        if not line: continue
        # Format: <file>:<line>:<col>  <severity>  <message>  <rule>
        # Or eslint stylish format with file headers
        parts = line.split()
        if not parts: continue
        # Find the file path: it's the first thing that looks like a path
        for p in parts:
            if "/" in p and (p.endswith(".ts") or p.endswith(".tsx") or ":" in p):
                file = p.split(":")[0]
                break
        else:
            continue
        if file.startswith("src/components/"):
            area = "src/components/" + file.split("/")[2]
        elif file.startswith("src/"):
            area = "src/" + file.split("/")[1]
        else:
            area = file.split("/")[0]
        groups[area].append(line)
for area, viols in sorted(groups.items()):
    print(f"{area}: {len(viols)} violations")
PY
```

Expected: distribution across `src/lib`, `src/hooks`, several `src/components/*` areas, and `src/pages`.

- [ ] **Step 2: For each area, fix all manual residue violations in one commit**

The fix patterns:
- `no-empty` (46): add a `// intentional` comment to genuinely-empty blocks; restructure if the empty body indicates dead code.
- `no-useless-escape` (16): remove unnecessary backslash escapes in regex/strings.
- `no-control-regex` (2): escape control characters properly or document the intentional use with a `// eslint-disable-next-line no-control-regex` and one-line justification.
- `no-unused-expressions` (2): fix the expression (likely typos like `foo === bar` instead of `foo = bar`) or remove.
- `no-case-declarations` (1): wrap case body in braces (`case X: { const foo = ...; }`).
- `@typescript-eslint/ban-ts-comment` (2): replace `@ts-ignore` with `@ts-expect-error: description`. This is reshaping existing suppressions, NOT adding new ones — `@ts-*` count stays at 5.

Loop per area:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
# Pick an area (e.g., src/components/customers):
AREA=src/components/customers
# Fix all manual residue violations in $AREA — edit files using Edit tool.
# After all fixes in this area:
npx vite build && npx vitest run && npm run typecheck
cd ..
git add -A
git commit -m "$(cat <<'EOF'
refactor(fe): fix no-empty + no-useless-escape + ban-ts-comment in src/components/customers

Wave B manual mechanical residue for src/components/customers area:
- no-empty (N): added // intentional comments to empty catch blocks
- no-useless-escape (M): removed unnecessary backslash escapes in regex
- ban-ts-comment (K): converted @ts-ignore → @ts-expect-error with rationale

Spec 18 §4 Step 3 Wave B manual residue.
EOF
)"
```

Repeat for each area until all 69 manual residue violations are addressed.

- [ ] **Step 3: Verify all manual residue cleared**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint . 2>&1 | grep -E "(no-empty|no-useless-escape|no-control-regex|no-unused-expressions|no-case-declarations|ban-ts-comment)" | wc -l
```

Expected: 0.

### Task 4.7 — Remove unused `eslint-disable` directives

**Files:** Variable; 13 sites per Spec 18 §1.3.

- [ ] **Step 1: List unused-directive sites**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint . 2>&1 | grep -E "(Unused eslint-disable|unused-disable)" | wc -l
```

Expected: ~13.

- [ ] **Step 2: For each site, remove the directive comment**

Use `grep -rn "eslint-disable"` to enumerate; for each unused one (ESLint's warning identifies it), remove the directive line or in-line `// eslint-disable-next-line`. ESLint's `--fix` does **not** auto-remove unused directives by default; the `--report-unused-disable-directives` flag turns them into errors which `--fix` can then handle. Try:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint . --report-unused-disable-directives --fix 2>&1 | tail -3
git diff --shortstat
```

If this works and the diff matches the 13 expected sites, ship it as one auto-fix-style commit:

- [ ] **Step 3: Gate checks + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build && npx vitest run && npm run typecheck
cd ..
git add -A
git commit -m "$(cat <<'EOF'
refactor(fe): remove unused eslint-disable directives

Wave B residue: 13 eslint-disable directives that no longer suppress
any violation (the underlying rule fixes either landed in earlier
Wave B commits or the offending code path was deleted in Phase 1/2a).

Spec 18 §4 Step 3 Wave B.
EOF
)"
```

### Task 4.end — Wave B end-of-wave checkpoint

**Files:**
- Create: `docs/audits/2026-05-28-post-wave-b-frontend-phase-2b-lint-probe.{json,txt}`
- Create: `docs/audits/2026-05-28-post-wave-b-frontend-phase-2b-prettier-probe.txt`

- [ ] **Step 1: Run wave-end gate checks**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build
npx vitest run
npm run typecheck
```

Expected: all green.

- [ ] **Step 2: Verify residual error categories match Wave C/D rules only**

ESLint emits the JSON report to stdout and diagnostic messages (config errors, parser failures) to stderr. The pipe below captures stderr to `/tmp/eslint-stderr.log` so a config error doesn't silently corrupt the JSON parse. If the python script fails with `json.JSONDecodeError`, inspect `/tmp/eslint-stderr.log` for the root cause before re-running.

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint . 2>&1 | tail -3
npx eslint . --format json 2>/tmp/eslint-stderr.log | python3 -c '
import json, sys
data = json.load(sys.stdin)
from collections import defaultdict
errors = defaultdict(int)
warnings = defaultdict(int)
for f in data:
    for m in f["messages"]:
        if m["severity"] == 2: errors[m["ruleId"]] += 1
        elif m["severity"] == 1: warnings[m["ruleId"]] += 1
print("Residual errors by rule:")
for r, n in sorted(errors.items(), key=lambda kv: -kv[1]):
    print(f"  {r}: {n}")
print("Residual warnings by rule:")
for r, n in sorted(warnings.items(), key=lambda kv: -kv[1]):
    print(f"  {r}: {n}")
'
```

Expected residual rules:
- Errors: `@typescript-eslint/no-explicit-any` (~233), `@typescript-eslint/no-unsafe-assignment/return/member-access` (~18 combined), `@typescript-eslint/no-floating-promises` (count from Step 0), `@typescript-eslint/no-misused-promises` (count from Step 0).
- Warnings: `react-hooks/exhaustive-deps` (~35), `react-hooks/rules-of-hooks` (1 error if it's still error severity, not warning).

If any Wave B rule still surfaces (auto-fix or manual residue), it was missed — diagnose before continuing.

- [ ] **Step 3: Run post-Wave-B re-probe**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx tsx scripts/build-lint-probe.ts --date 2026-05-28 --prefix post-wave-b
```

- [ ] **Step 4: Commit the re-probe artifacts**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add docs/audits/2026-05-28-post-wave-b-frontend-phase-2b-lint-probe.json \
        docs/audits/2026-05-28-post-wave-b-frontend-phase-2b-lint-probe.txt \
        docs/audits/2026-05-28-post-wave-b-frontend-phase-2b-prettier-probe.txt
git commit -m "$(cat <<'EOF'
chore(audits): phase 2b post-Wave-B lint re-probe

Post-mechanical-fix lint surface. Residual violations should be limited
to per-site type rules (no-explicit-any, no-unsafe-*) and per-site
semantic rules (no-floating-promises, no-misused-promises,
exhaustive-deps, rules-of-hooks).

Input for Wave C's per-file ordering (Task 5.prep).

Spec 18 §4 Step 3 end-of-wave.
EOF
)"
```

---

## Step 4 — Wave C: Per-site type fixes

Targets `@typescript-eslint/no-explicit-any` (233 sites verified) and the `no-unsafe-*` cascade family (`no-unsafe-assignment` 9, `no-unsafe-return` 6, `no-unsafe-member-access` 3 = 18 total). The cascade family largely resolves as side-effect of `no-explicit-any` fixes — when an `any` value is typed at the upstream, downstream usages narrow.

### Task 5.prep — Read post-Wave-B re-probe, derive per-file ordering

**Files:** none (analysis only; produces working-notes file).

- [ ] **Step 1: Generate ordered file list for Wave C**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
python3 <<'PY' > /tmp/phase-2b-notes/wave-c-order.txt
import json
d = json.load(open("docs/audits/2026-05-28-post-wave-b-frontend-phase-2b-lint-probe.json"))
# Wave C targets these rules:
wave_c_rules = {
    "@typescript-eslint/no-explicit-any",
    "@typescript-eslint/no-unsafe-assignment",
    "@typescript-eslint/no-unsafe-return",
    "@typescript-eslint/no-unsafe-member-access",
}
# Per-file Wave-C-applicable error count:
per_file = {}
for file, rule_counts in d["rulesByFile"].items():
    c_count = sum(n for rule, n in rule_counts.items() if rule in wave_c_rules)
    if c_count > 0:
        per_file[file] = c_count
print(f"Files with Wave C violations: {len(per_file)}")
# Group by area:
from collections import defaultdict
by_area = defaultdict(list)
for file, n in per_file.items():
    if file.startswith("src/components/"):
        area = "src/components/" + file.split("/")[2]
    elif file.startswith("src/"):
        area = "src/" + file.split("/")[1]
    else:
        area = file.split("/")[0]
    by_area[area].append((file, n))
# Output ordered: areas in Spec 18 §4 Step 4 order, files within area ascending by count
spec_area_order = [
    "src/lib", "src/hooks", "src/utils", "src/services", "src/contexts",
    "src/components/signals", "src/components/strategist", "src/components/settings",
    "src/components/layout", "src/components/customers",
    "src/components/market-research", "src/components/mission-control",
    "src/components/ui",  # rare; included for completeness
    "src/pages",
]
covered = set()
for area in spec_area_order:
    if area in by_area:
        files = sorted(by_area[area], key=lambda fn: (fn[1], fn[0]))  # ascending count, alpha tiebreak
        print(f"\n# {area} ({sum(n for _, n in files)} errors across {len(files)} files)")
        for f, n in files:
            print(f"  {n:4d}  {f}")
        covered.add(area)
# Any area not in the spec order goes last:
for area in sorted(by_area.keys()):
    if area not in covered:
        files = sorted(by_area[area], key=lambda fn: (fn[1], fn[0]))
        print(f"\n# {area} (UNCATEGORIZED — {sum(n for _, n in files)} errors)")
        for f, n in files:
            print(f"  {n:4d}  {f}")
PY
cat /tmp/phase-2b-notes/wave-c-order.txt | head -50
wc -l /tmp/phase-2b-notes/wave-c-order.txt
```

Expected: ordered list of ~70–120 files with Wave C violations, grouped by area in Spec 18 §4 Step 4's order.

- [ ] **Step 2: Plan commit batching**

The spec mandates ≤3/>3 batching: files with ≤3 errors in the same area may bundle into one commit; files with >3 errors get individual commits.

```bash
cd /projects/Brewra/brewra-gtm-intelligence
python3 <<'PY'
import re
from collections import defaultdict
with open("/tmp/phase-2b-notes/wave-c-order.txt") as f:
    lines = f.readlines()
# Parse: area headers start with "#", file lines have format "  <count>  <path>"
area = None
batches = defaultdict(list)
for line in lines:
    if line.startswith("# "):
        area = line[2:].split(" (")[0].strip()
        continue
    m = re.match(r"\s+(\d+)\s+(\S+)", line)
    if not m: continue
    count, file = int(m.group(1)), m.group(2)
    if count > 3:
        batches[area].append([(file, count)])  # singleton batch
    else:
        # Append to last open batch in this area:
        if batches[area] and len(batches[area][-1]) < 5 and sum(c for _, c in batches[area][-1]) + count <= 8:
            batches[area][-1].append((file, count))
        else:
            batches[area].append([(file, count)])
total_commits = sum(len(b) for b in batches.values())
print(f"Estimated Wave C commit count: {total_commits}")
print(f"Areas: {len(batches)}")
for area, area_batches in sorted(batches.items()):
    big = sum(1 for b in area_batches if len(b) == 1 and b[0][1] > 3)
    small = len(area_batches) - big
    print(f"  {area}: {big} individual + {small} bundled = {len(area_batches)} commits")
PY
```

Expected: total commit count in the 30–60 range. If much higher (>80), batching is too aggressive — re-tune the bundling to allow larger groups. If lower (<25), increase per-file commits.

### Task 5.loop — Per-file fix loop

**This is a loop task.** The executor iterates per-file (or per-batch) following the order from Task 5.prep. For each iteration:

- [ ] **Step 1: Read the next file's Wave C violations**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
FILE=<next file from Task 5.prep ordered list>
npx eslint "$FILE" 2>&1 | grep -E "(no-explicit-any|no-unsafe-)"
```

Expected: violations with line/column references.

- [ ] **Step 2: Apply per-site fix per Spec 18 §2.4 posture rules + §4 Step 4 fix rules**

Read the file to understand context. For each violation, apply the appropriate fix:

- **React event handlers:** `React.ChangeEvent<HTMLInputElement>`, `React.MouseEvent<HTMLButtonElement>`, `React.FormEvent<HTMLFormElement>`, etc.
- **Array callbacks (`.map`, `.filter`, `.reduce`):** propagate source element type. The callback parameter type is `(item: SourceElementType, index: number, array: SourceElementType[]) => ...`.
- **Object destructuring on weakly-typed data:** type the parameter; create a local `interface` or `type` if non-trivial. **Do not** create centralized API contract types (Phase 3's domain).
- **Catch blocks:** `catch (e: any)` → `catch (e: unknown)` + narrowing (`if (e instanceof Error)`).
- **Generic placeholders (`Promise<any>`, `useState<any>`, `Array<any>`):** concrete type or `unknown`.
- **Multi-argument generics (`Record<string, any>`, `Map<string, any>`):** swap `any` for `unknown` if value is genuinely opaque; concrete type otherwise.
- **`no-unsafe-*` family violations:** most resolve automatically when the upstream `any` is typed. Residual cases (the rule's count after the file's `no-explicit-any` fixes) need per-site narrowing — usually a type guard or `as <Concrete>` cast where the runtime shape is provable from context.
- **Last resort — escape-hatch via `src/lib/types/escape-hatches.ts`:** add a new `export type Untyped<Slug> = any;` entry with mandatory `// TODO(phase-13):`, call-site reference, and one-line justification.

Use the Edit tool for each fix. **Do not** opportunistically refactor — apply the smallest viable type fix per posture rule 1.

- [ ] **Step 3: Gate checks**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build
npx vitest run
npm run typecheck
```

Expected: all green. If `vite build` or Vitest fails, the type fix likely changed runtime behavior — revert and apply a tighter fix (see "Wave C cascade recovery" in plan header).

Also confirm the file's violations are gone:

```bash
npx eslint "$FILE" 2>&1 | grep -E "(no-explicit-any|no-unsafe-)" | wc -l
```

Expected: 0 (or the count of remaining test-file `eslint-disable-next-line` exemptions if any).

- [ ] **Step 4: Check escape-hatches entry-count trigger**

If this iteration added an entry to `escape-hatches.ts`, check the new total:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -c '^export type Untyped' src/lib/types/escape-hatches.ts
# Phase 2a baseline: 6 entries. Trigger: 5 NEW entries (Phase 2b's own count, not total) → register TD-FE-10.
```

If Phase 2b has added 5 new entries (i.e., total is now 11), register `TD-FE-10` in the SAME commit as this fix:

Edit `docs/TECH_DEBT.md` to append:

```markdown
### TD-FE-10 — Phase 2b new escape-hatches entries (no-explicit-any structural cases)

**Status:** Open. Created 2026-05-28 during Phase 2b Wave C.
**Current state:** N new `Untyped*` entries in `src/lib/types/escape-hatches.ts` (Phase 2b's own additions; Phase 2a left 6 entries).
**Target state:** Audit and tighten or relocate each entry. Master spec §4 Phase 13 owns the audit; Phase 4 may relocate the file to `src/shared/types/`.
**Why deferred:** Each entry passed the §2.4 posture rule 3 in-the-moment — opportunistic refactor was rejected; the underlying restructure is beyond Phase 2b scope.
**Trigger to revisit:** Phase 4 (relocation) and Phase 13 (audit).
```

This embedded TD-FE registration counts toward this Wave C commit's body, not a separate commit. Subsequent escape-hatches additions in Wave C (beyond the 5th) do **not** create more TD-FE entries — TD-FE-10 covers the pattern.

- [ ] **Step 5: Commit**

For an individual-file commit (>3 errors):

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/...  # the specific file(s) edited
# If escape-hatches.ts was touched:
git add frontend/src/lib/types/escape-hatches.ts
# If TD-FE-10 was registered this commit:
git add docs/TECH_DEBT.md
git commit -m "$(cat <<'EOF'
refactor(fe): type src/components/foo/Bar.tsx

Wave C per-site type fix: N no-explicit-any + M no-unsafe-* resolved.

Fixes:
- onClick handler: param typed as React.MouseEvent<HTMLButtonElement>
- .map callback: param typed from source array element type
- catch block: any → unknown + instanceof Error narrowing
- (additional fix descriptions as applicable)

Escape-hatches added (if any):
- UntypedSlug: <one-line justification>

Spec 18 §4 Step 4 Wave C.
EOF
)"
```

For a bundled commit (≤3 errors across multiple files in the same area):

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/lib/  # or whatever the area is
git commit -m "$(cat <<'EOF'
refactor(fe): type src/lib (utility functions)

Wave C per-site type fix for src/lib bundled commit: N no-explicit-any
resolved across <K> files.

Files touched: <list>

Spec 18 §4 Step 4 Wave C.
EOF
)"
```

- [ ] **Step 6: Repeat Steps 1–5 until all files in the Wave C ordered list are processed**

Track progress against the Task 5.prep ordered list. Approximate cadence: 4–8 minutes per individual-file commit, 6–12 minutes per bundled commit.

After every ~10 commits, run `npm run lint 2>&1 | grep -E '(no-explicit-any|no-unsafe-)' | wc -l` to confirm the count is decreasing monotonically.

### Task 5.end — Wave C end-of-wave checkpoint

**Files:**
- Create: `docs/audits/2026-05-28-post-wave-c-frontend-phase-2b-lint-probe.{json,txt}`
- Create: `docs/audits/2026-05-28-post-wave-c-frontend-phase-2b-prettier-probe.txt`

- [ ] **Step 1: Verify `no-explicit-any` and `no-unsafe-*` are zero outside test paths**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint . 2>&1 | grep -E "(no-explicit-any|no-unsafe-)" | grep -v -E "(__tests__|\.test\.|\.spec\.|^e2e/)" | wc -l
```

Expected: 0. If non-zero, there are production-path violations not yet addressed — go back to Task 5.loop for the residual files.

- [ ] **Step 2: Verify test-file `eslint-disable-next-line` are confined to test paths**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
rg -n 'eslint-disable.*no-explicit-any' -g '*.ts' -g '*.tsx' src/
```

Expected output: only files matching `__tests__/` or `*.test.ts*` or `*.spec.ts*`. Any production-path hit is a posture-rule-10 violation — refactor that site to use escape-hatches instead.

- [ ] **Step 3: Run wave-end gate checks**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build
npx vitest run
npm run typecheck
```

Expected: all green.

- [ ] **Step 4: Run post-Wave-C re-probe**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx tsx scripts/build-lint-probe.ts --date 2026-05-28 --prefix post-wave-c
```

- [ ] **Step 5: Confirm residual is Wave D rules only**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
python3 <<'PY'
import json
d = json.load(open("docs/audits/2026-05-28-post-wave-c-frontend-phase-2b-lint-probe.json"))
print("Residual errors by rule (should be Wave D rules):")
for rule, n in sorted(d["errorsByRule"].items(), key=lambda kv: -kv[1]):
    print(f"  {rule}: {n}")
print("Residual warnings by rule:")
for rule, n in sorted(d["warningsByRule"].items(), key=lambda kv: -kv[1]):
    print(f"  {rule}: {n}")
PY
```

Expected residual:
- Errors: `@typescript-eslint/no-floating-promises` (count from Step 0), `@typescript-eslint/no-misused-promises` (count from Step 0), `react-hooks/rules-of-hooks` (1).
- Warnings: `react-hooks/exhaustive-deps` (35).

If any Wave A/B/C rules still surface, they were missed — diagnose before continuing.

- [ ] **Step 6: Commit the re-probe artifacts**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add docs/audits/2026-05-28-post-wave-c-frontend-phase-2b-lint-probe.json \
        docs/audits/2026-05-28-post-wave-c-frontend-phase-2b-lint-probe.txt \
        docs/audits/2026-05-28-post-wave-c-frontend-phase-2b-prettier-probe.txt
git commit -m "$(cat <<'EOF'
chore(audits): phase 2b post-Wave-C lint re-probe

Post-no-explicit-any-cleanup lint surface. Residual violations should
be limited to per-site semantic rules: no-floating-promises,
no-misused-promises, react-hooks/exhaustive-deps, rules-of-hooks.

Input for Wave D's per-file ordering (Task 6.prep).

Spec 18 §4 Step 4 end-of-wave.
EOF
)"
```

---

## Step 5 — Wave D: Per-site semantic fixes

Targets type-aware semantic rules: `no-floating-promises`, `no-misused-promises`, `react-hooks/exhaustive-deps` (35 warnings), and `react-hooks/rules-of-hooks` (1 error).

### Task 6.prep — Read post-Wave-C re-probe; decide `checksVoidReturn` config

**Files:** none (analysis only).

- [ ] **Step 1: Generate ordered file list for Wave D**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
python3 <<'PY' > /tmp/phase-2b-notes/wave-d-order.txt
import json
d = json.load(open("docs/audits/2026-05-28-post-wave-c-frontend-phase-2b-lint-probe.json"))
wave_d_rules = {
    "@typescript-eslint/no-floating-promises",
    "@typescript-eslint/no-misused-promises",
    "react-hooks/exhaustive-deps",
    "react-hooks/rules-of-hooks",
}
per_file = {}
for file, rule_counts in d["rulesByFile"].items():
    d_count = sum(n for rule, n in rule_counts.items() if rule in wave_d_rules)
    if d_count > 0:
        per_file[file] = (d_count, {r: n for r, n in rule_counts.items() if r in wave_d_rules})
print(f"Files with Wave D violations: {len(per_file)}")
print()
# Order by area, then ascending count:
from collections import defaultdict
by_area = defaultdict(list)
for file, (n, rule_breakdown) in per_file.items():
    if file.startswith("src/components/"):
        area = "src/components/" + file.split("/")[2]
    elif file.startswith("src/"):
        area = "src/" + file.split("/")[1]
    else:
        area = file.split("/")[0]
    by_area[area].append((file, n, rule_breakdown))
for area in sorted(by_area.keys()):
    files = sorted(by_area[area], key=lambda x: (x[1], x[0]))
    print(f"# {area}")
    for f, n, breakdown in files:
        bd = ", ".join(f"{r.split('/')[-1]}={n}" for r, n in sorted(breakdown.items()))
        print(f"  {n:3d}  {f}  [{bd}]")
PY
cat /tmp/phase-2b-notes/wave-d-order.txt | head -30
```

Expected: 30–60 files with Wave D violations, mostly clustered in component areas (exhaustive-deps fires in functional components with hooks).

- [ ] **Step 2: Count JSX-attribute `no-misused-promises` violations**

This decides the `checksVoidReturn` spec §7.5 question.

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
# no-misused-promises messages mentioning JSX attribute contexts:
npx eslint . 2>&1 | grep "no-misused-promises" | head -20
# More precisely:
npx eslint . --format json 2>/tmp/eslint-stderr.log | python3 -c '
import json, sys
data = json.load(sys.stdin)
jsx_attr_count = 0
other_count = 0
for f in data:
    for m in f["messages"]:
        if m.get("ruleId") == "@typescript-eslint/no-misused-promises":
            msg = m.get("message", "")
            # JSX attribute contexts surface messages like:
            #   "Promise-returning function provided to attribute where a void return was expected."
            if "attribute" in msg.lower() or "JSX" in msg:
                jsx_attr_count += 1
            else:
                other_count += 1
print(f"no-misused-promises JSX-attribute sites: {jsx_attr_count}")
print(f"no-misused-promises other sites: {other_count}")
'
```

- [ ] **Step 3: Apply `checksVoidReturn` decision**

Per Spec §7.5 / Plan-stage decision #5: if JSX-attribute count ≥10, configure `checksVoidReturn: { attributes: false }` in `eslint.config.js`; otherwise leave default.

**If ≥10:** Task 6.JSX-decision below edits the config in a small dedicated commit BEFORE the Wave D per-site fix loop.

**If <10:** skip Task 6.JSX-decision; proceed straight to Task 6.loop with per-site `void`-wrapper fixes.

Document the decision in working notes for the Step 6 scorecard.

### Task 6.JSX-decision — Configure `checksVoidReturn` (conditional)

**Files:** `frontend/eslint.config.js`

**Only run this task if Task 6.prep Step 3 decided "configure"**. Otherwise skip.

- [ ] **Step 1: Edit `eslint.config.js`**

Change the `no-misused-promises` rule from:
```js
"@typescript-eslint/no-misused-promises": "error",
```
to:
```js
"@typescript-eslint/no-misused-promises": ["error", {
  checksVoidReturn: { attributes: false },
}],
```

- [ ] **Step 2: Verify the residual count drops**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint . 2>&1 | grep "no-misused-promises" | wc -l
```

Expected: dropped by the JSX-attribute count from Task 6.prep Step 2.

- [ ] **Step 3: Gate checks + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build && npx vitest run && npm run typecheck
cd ..
git add frontend/eslint.config.js
git commit -m "$(cat <<'EOF'
chore(fe): relax no-misused-promises for JSX attributes

Wave D config refinement: configures @typescript-eslint/no-misused-promises
with checksVoidReturn.attributes=false. JSX attribute contexts (e.g.,
<button onClick={asyncSubmit}>) are runtime-safe in React despite the
type-level mismatch.

Decision driven by Step 0 probe: N JSX-attribute sites out of M total
no-misused-promises violations (threshold ≥10 per Spec 18 §7.5
plan-stage decision #5).

Spec 18 §3.3 / §7.5.
EOF
)"
```

### Task 6.loop — Per-site semantic fix loop

**This is a loop task** like Wave C. Iterate per-file following the order from Task 6.prep. For each file:

- [ ] **Step 1: Read the file's Wave D violations**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
FILE=<next file from Task 6.prep>
npx eslint "$FILE" 2>&1 | grep -E "(no-floating-promises|no-misused-promises|exhaustive-deps|rules-of-hooks)"
```

- [ ] **Step 2: Apply per-site fix per Spec 18 §4 Step 5 fix rules**

- **`no-floating-promises`:**
  - Async call in async context → `await` it.
  - Fire-and-forget intentional → prefix with `void` (e.g., `void doSomethingAsync()`).
  - Effect cleanup or unmount handler → use `.catch(handleError)` or extract a named async wrapper.
- **`no-misused-promises`:**
  - Promise passed to a non-promise-expecting context (e.g., `setTimeout(asyncFn, ...)`) → extract a named wrapper: `const wrapped = () => { void asyncFn(); };` then `setTimeout(wrapped, ...)`. Inline `() => { void asyncFn(); }` is acceptable for one-off cases.
  - JSX attribute (if `checksVoidReturn.attributes: false` wasn't applied): same wrapper pattern.
- **`react-hooks/exhaustive-deps` (warnings):**
  - Missing dependency → add it to the deps array.
  - Dependency intentionally omitted → restructure with `useCallback`/`useMemo`, use a ref for non-reactive values, or `// eslint-disable-next-line react-hooks/exhaustive-deps` with a one-line justification (this rule is the documented exception per Spec 18 §2.4 posture rule 10).
- **`react-hooks/rules-of-hooks` (1 error):** see Task 6.rules-of-hooks below (separate task).

Use Edit tool for each fix. The Wave D fixes can change runtime semantics — type-aware rules find legitimate bugs (e.g., a `useEffect` with a missing dep that causes stale-closure behavior). The gate-checks in Step 3 catch most issues; the Step 6 scorecard's full preflight catches the rest.

- [ ] **Step 3: Gate checks**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build
npx vitest run
npm run typecheck
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/...  # the file(s) edited
git commit -m "$(cat <<'EOF'
fix(fe): resolve exhaustive-deps + floating-promises in src/components/foo/Bar.tsx

Wave D per-site semantic fix: N exhaustive-deps + M floating-promises resolved.

Fixes:
- useEffect deps: added missing `userId` to deps array
- Async submit handler: prefixed fire-and-forget call with `void`
- (additional fix descriptions as applicable)

Spec 18 §4 Step 5 Wave D.
EOF
)"
```

- [ ] **Step 5: Repeat Steps 1–4 until all Wave D files are processed**

Approximate cadence: 5–10 minutes per file (semantic fixes need more thought than Wave C's mechanical type annotations).

### Task 6.rules-of-hooks — Fix the single `rules-of-hooks` violation

**Order:** runs **last in Wave D**, after Task 6.loop's per-file fixes complete. Reason: this is the highest-risk Wave D edit because hooks restructuring can change rendering behavior (a hook moved out of a conditional now runs every render); finishing the lower-risk per-site fixes first ensures the runtime is otherwise stable when this commit lands, isolating any regression to the rules-of-hooks restructure.

**Files:** Variable; the one component with the `rules-of-hooks` violation.

- [ ] **Step 1: Identify the site**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx eslint . 2>&1 | grep "rules-of-hooks"
```

Expected: one violation with file path and line.

- [ ] **Step 2: Read the file and diagnose the structural issue**

Read the affected component. Common patterns:
- Hook called inside a conditional → lift to top of component
- Hook called inside a loop → extract a child component that's rendered per-iteration
- Hook called after early return → restructure to put hooks before any conditional return

- [ ] **Step 3: Apply the restructure**

Use Edit tool. **This is the only Wave D fix that may meaningfully restructure component code** — Spec 18 §2.1 calls it out as potentially needing component split or hook lifting.

- [ ] **Step 4: Verify behavior unchanged via Vitest + visual regression**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vitest run
npm run typecheck
npx vite build
# Visual regression for the affected component is part of Playwright;
# only run if the component is e2e-covered AND a baseline image exists:
# npx playwright test --grep "<test name covering the component>"
# Mid-wave Playwright is normally deferred to Step 6 (per the per-commit-gate
# matrix in the plan header). Run it here only because rules-of-hooks fixes
# can restructure rendering — explicit safety check.
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/...
git commit -m "$(cat <<'EOF'
fix(fe): resolve rules-of-hooks in <Component>

Wave D per-site semantic fix: react-hooks/rules-of-hooks violation
resolved via <restructure description — e.g., "lifted useState above
conditional return" or "split inner conditional into child component">.

Behavior verified unchanged: Vitest green, visual regression green
(if applicable), typecheck green, build green.

Spec 18 §4 Step 5 Wave D.
EOF
)"
```

### Task 6.end — Wave D end-of-wave checkpoint

- [ ] **Step 1: Run full lint verification — the binding gate**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run lint
echo "Exit code: $?"
```

Expected: exit code 0 ("All files pass linting and there are no warnings").

If non-zero, the lint surface is not green — residual violations remain. The output identifies which rules/files still need attention. **Do not** ship a Wave-D-end commit until lint is green.

- [ ] **Step 2: Run `npm run format:check`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run format:check
```

Expected: green (Wave D's per-site fixes are import/type/logic edits — Prettier-formatted source stays formatted under per-site edits if the executor doesn't introduce new long lines). If red, run `npm run format` and ship a small residual format commit BEFORE proceeding to Step 6.

- [ ] **Step 3: Gate checks**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build
npx vitest run
npm run typecheck
```

Expected: all green.

---

## Step 6 — Verify done-when and write scorecard

### Task 7.1 — Final verification checklist

**Files:** none (verification only). If any check fails, a residual-fix commit lands first (single commit `fix(fe): residual phase 2b verification fixes`).

- [ ] **Step 1: Run the full preflight chain**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: all checks green (typecheck → lint → format:check → build → playwright → vitest → knip). Runtime ~10–15 minutes.

If any check fails:
- **Lint or format:check red:** a Wave A/B/C/D commit missed a violation. Open the offending file, fix, commit as `fix(fe): residual phase 2b verification fixes`.
- **Playwright red:** a Wave C type fix or Wave D semantic fix changed runtime behavior in a way that broke an e2e journey. Revert the offending commit OR fix the test to match new behavior (only if the new behavior is intended — per posture rule 4, lint fixes shouldn't change behavior; investigate first).
- **Visual regression red:** a Wave A reformat changed JSX output meaningfully (rare; Prettier is rendering-equivalent). Revert the offending Wave A commit and investigate.
- **Vitest red:** Wave C/D fix broke a unit test. Same triage.
- **knip red:** an unused dep crept in. Investigate.

- [ ] **Step 2: Verify Step 6 done-when items individually**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend

# Item 1: eslint.config.js has the five rules + import-x/order + eslint-config-prettier
grep -E "(no-explicit-any|no-unused-vars|consistent-type-imports|no-floating-promises|no-misused-promises|import-x/order)" eslint.config.js | head -10
grep "eslint-config-prettier" eslint.config.js

# Item 2: .prettierrc + .prettierignore + .git-blame-ignore-revs present
ls .prettierrc .prettierignore
ls ../.git-blame-ignore-revs
wc -l ../.git-blame-ignore-revs   # should contain header + Wave A SHAs

# Item 3: lint green (already verified in Step 1)
npm run lint && echo "Item 3 OK"

# Item 4: format:check green (already verified)
npm run format:check && echo "Item 4 OK"

# Item 5: typecheck still green
npm run typecheck && echo "Item 5 OK"

# Item 6: preflight green end-to-end (already verified)
echo "Item 6 OK (verified by Step 1)"

# Item 7: 0 no-explicit-any and 0 no-unsafe-* in production paths
PROD_ANY=$(npx eslint . 2>&1 | grep -E "(no-explicit-any|no-unsafe-)" | grep -v -E "(__tests__|\.test\.|\.spec\.|^e2e/)" | wc -l)
echo "Item 7: production no-explicit-any + no-unsafe-*: $PROD_ANY (expected 0)"

# Item 8: no eslint-disable-next-line no-explicit-any in production paths
PROD_DISABLE=$(rg -n 'eslint-disable.*no-explicit-any' -g '*.ts' -g '*.tsx' src/ | grep -v -E "(__tests__|\.test\.|\.spec\.)" | wc -l)
echo "Item 8: production eslint-disable for no-explicit-any: $PROD_DISABLE (expected 0)"

# Item 9: @ts-* count ≤5
TS_SUPPRESS=$(rg -n '@ts-(ignore|expect-error|nocheck)' -g '*.ts' -g '*.tsx' src/ | wc -l)
echo "Item 9: @ts-* count: $TS_SUPPRESS (expected ≤5)"

# Item 10: escape-hatches entries each have TODO + Untyped + justification
ESC_COUNT=$(grep -c '^export type Untyped' src/lib/types/escape-hatches.ts)
ESC_TODO=$(grep -c 'TODO(phase-13)' src/lib/types/escape-hatches.ts)
echo "Item 10: escape-hatches entries: $ESC_COUNT  with phase-13 TODOs: $ESC_TODO (should match)"

# Item 11: .git-blame-ignore-revs contains every Wave A commit SHA
WAVE_A_SHAS=$(cd .. && git log --reverse --format='%H' master..HEAD | while read sha; do
  if git log -1 --format='%s' "$sha" | grep -q "^style(fe): prettier format"; then echo "$sha"; fi
done)
MISSING=0
for sha in $WAVE_A_SHAS; do
  if ! grep -q "$sha" ../.git-blame-ignore-revs; then
    echo "MISSING: $sha"
    MISSING=$((MISSING+1))
  fi
done
echo "Item 11: Wave A SHAs missing from .git-blame-ignore-revs: $MISSING (expected 0)"
```

Each item should print OK / 0 / matching counts.

- [ ] **Step 3: If residual fixes needed, land them in one commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add -A  # whatever fixes were needed
git commit -m "$(cat <<'EOF'
fix(fe): residual phase 2b verification fixes

Step 6 verification surfaced N residual issues:
- <description per failure>

After this commit, all done-when items pass.

Spec 18 §4 Step 6 / §5.
EOF
)"
# Re-run the full checklist:
cd frontend && npm run preflight
```

### Task 7.2 — Write the Step 6 scorecard

**Files:**
- Create: `docs/audits/2026-05-28-frontend-phase-2b-eslint-prettier.md`

If the phase has spanned multiple days, re-date the file to merge-date via `git mv` after writing.

- [ ] **Step 1: Gather scorecard data**

```bash
cd /projects/Brewra/brewra-gtm-intelligence

# Probe baseline vs final:
python3 <<'PY' > /tmp/phase-2b-notes/scorecard-data.txt
import json
b = json.load(open("docs/audits/2026-05-28-frontend-phase-2b-lint-probe.json"))
print(f"BASELINE (Step 0):")
print(f"  Total problems: {b['totals']['problems']} ({b['totals']['errors']} errors, {b['totals']['warnings']} warnings)")
print(f"  By rule (errors): {b['errorsByRule']}")
print(f"  By rule (warnings): {b['warningsByRule']}")
PY
cat /tmp/phase-2b-notes/scorecard-data.txt

# Diff stats per wave — explicit commit-range identification per wave by
# matching commit subjects, then aggregating with `git diff --stat`.

range_stats () {
  # $1 = start ref (exclusive), $2 = end ref (inclusive), $3 = label
  if [ -z "$1" ] || [ -z "$2" ]; then echo "$3: (no commits in range)"; return; fi
  echo "=== $3 ==="
  git diff --shortstat "$1".."$2"
}

first_sha_matching () {
  # First commit on master..HEAD whose subject matches the pattern
  git log --reverse --format='%H %s' master..HEAD | grep -m1 -E "$1" | awk '{print $1}'
}
last_sha_matching () {
  git log --format='%H %s' master..HEAD | grep -m1 -E "$1" | awk '{print $1}'
}

# Step 0: install + probe (two commits, identified by their subjects)
STEP0_START=$(first_sha_matching "^[a-f0-9]+ chore\(fe\): install prettier")
STEP0_END=$(first_sha_matching "^[a-f0-9]+ chore\(audits\): phase 2b lint\+prettier re-baseline")
range_stats "$STEP0_START~" "$STEP0_END" "Step 0"

# Step 1: single commit
STEP1=$(first_sha_matching "^[a-f0-9]+ chore\(fe\): wire eslint type-aware rules \+ prettier config")
range_stats "$STEP1~" "$STEP1" "Step 1"

# Wave A: first 'style(fe): prettier format' through the '.git-blame-ignore-revs' aggregation commit
WAVE_A_START=$(first_sha_matching "^[a-f0-9]+ style\(fe\): prettier format")
WAVE_A_END=$(first_sha_matching "^[a-f0-9]+ chore\(fe\): add Wave A prettier commits to git blame ignore-revs")
range_stats "$WAVE_A_START~" "$WAVE_A_END" "Wave A"

# Wave A re-probe: post-Wave-A audits commit
WAVE_A_PROBE=$(first_sha_matching "^[a-f0-9]+ chore\(audits\): phase 2b post-Wave-A lint re-probe")
range_stats "$WAVE_A_PROBE~" "$WAVE_A_PROBE" "Wave A re-probe"

# Wave B: first refactor(fe) commit after Wave A probe; spans through post-Wave-B re-probe
WAVE_B_END=$(first_sha_matching "^[a-f0-9]+ chore\(audits\): phase 2b post-Wave-B lint re-probe")
WAVE_B_START=$(git log --reverse --format='%H %s' "$WAVE_A_PROBE..$WAVE_B_END" | head -1 | awk '{print $1}')
range_stats "$WAVE_B_START~" "$WAVE_B_END" "Wave B (incl. post-Wave-B probe)"

# Wave C: from after Wave B probe through post-Wave-C re-probe
WAVE_C_END=$(first_sha_matching "^[a-f0-9]+ chore\(audits\): phase 2b post-Wave-C lint re-probe")
WAVE_C_START=$(git log --reverse --format='%H %s' "$WAVE_B_END..$WAVE_C_END" | head -1 | awk '{print $1}')
range_stats "$WAVE_C_START~" "$WAVE_C_END" "Wave C (incl. post-Wave-C probe)"

# Wave D: from after Wave C probe up to (but not including) Step 6's scorecard commit
SCORECARD=$(last_sha_matching "^[a-f0-9]+ docs\(audits\): phase 2b eslint\+prettier scorecard")
# If scorecard not yet committed (we're in the middle of writing it), use HEAD
if [ -z "$SCORECARD" ]; then SCORECARD=HEAD; fi
WAVE_D_START=$(git log --reverse --format='%H %s' "$WAVE_C_END..$SCORECARD" | head -1 | awk '{print $1}')
# Wave D ends just before any residual-fix or scorecard commit
WAVE_D_END=$(git log --reverse --format='%H %s' "$WAVE_C_END..HEAD" | grep -v -E "(residual phase 2b|eslint\+prettier scorecard)" | tail -1 | awk '{print $1}')
range_stats "$WAVE_D_START~" "$WAVE_D_END" "Wave D"

# Step 6: residual fixes (if any) + scorecard
STEP6_START=$(first_sha_matching "^[a-f0-9]+ (fix\(fe\): residual phase 2b|docs\(audits\): phase 2b eslint\+prettier scorecard)")
if [ -n "$STEP6_START" ]; then
  range_stats "$STEP6_START~" "$SCORECARD" "Step 6"
fi

# Full Phase 2b diff:
echo "=== Full Phase 2b ==="
git diff --shortstat master..HEAD

# Escape-hatches delta:
PRE=$(git show master:frontend/src/lib/types/escape-hatches.ts 2>/dev/null | grep -c '^export type Untyped' || echo 0)
POST=$(grep -c '^export type Untyped' frontend/src/lib/types/escape-hatches.ts)
echo "Escape-hatches: pre $PRE, post $POST, added $((POST - PRE))"

# New TD-FE entries:
git diff master..HEAD docs/TECH_DEBT.md | grep -E '^\+### TD-FE-' || echo "No new TD-FE entries"

# Commit count:
git log --oneline master..HEAD | wc -l
```

- [ ] **Step 2: Write the scorecard markdown**

Use Write tool to create `docs/audits/2026-05-28-frontend-phase-2b-eslint-prettier.md`:

```markdown
# Phase 2b — Frontend ESLint Type-Aware + Prettier Scorecard

**Branch:** `phase-2b-eslint-prettier`
**Merged into:** `master` on <merge-date>
**Spec:** `specs/18-frontend-phase-2b-eslint-prettier-design.md`
**Plan:** `plans/18-frontend-phase-2b-eslint-prettier.md`

## Baseline (Step 0) → Final

| Metric | Baseline | Final | Delta |
|---|---|---|---|
| `eslint .` problems | <X> (Y errors, Z warnings) | 0 (0 errors, 0 warnings) | -X |
| `prettier --check .` files needing format | <N> | 0 | -N |
| Inline `any` (regex count) | 224 | <final> | <delta> |
| `no-explicit-any` violations | 233 | 0 (production) | -233 |
| `@ts-*` suppressions | 5 | <final ≤5> | <delta ≤0> |
| Escape-hatches entries | 6 (from Phase 2a) | <final> | +<N> |

## Per-Rule Disposition

| Rule | Baseline | Final | Disposition |
|---|---|---|---|
| `@typescript-eslint/no-explicit-any` | 233 | 0 | Wave C per-site (escape-hatches for K cases) |
| `no-empty` | 46 | 0 | Wave B manual residue |
| `react-hooks/exhaustive-deps` | 35 (warn) | 0 | Wave D per-site |
| ... | | | |

## Files Touched per Wave

- **Wave A (Prettier):** N files reformatted across M commits. Diff: +X / -Y lines (pure formatting; SHAs in `.git-blame-ignore-revs`).
- **Wave B (Mechanical lint):** K commits (5 auto-fix + L manual residue + 1 unused-directives).
- **Wave C (Per-site types):** P commits across Q files.
- **Wave D (Per-site semantic):** R commits across S files.

## Escape-Hatches Delta

Pre-Phase-2b: 6 entries (Phase 2a baseline).
Post-Phase-2b: N entries (Phase 2b added M).

New `Untyped*` entries:
- `UntypedSlug1` — <call site> — <justification>
- ...

## TD-FE Entries Created

- **TD-FE-10** — <if 5+ new escape-hatches entries> — Phase 2b structural `any` cases for Phase 13 audit.
- (any additional TD-FE entries)

## Plan-Stage Decisions

Per Spec 18 §7 open questions:

1. **Step 0 re-baseline (§7.1):** <actual numbers vs spec design-time>.
2. **Wave A split decisions (§7.2):** <list of areas that needed sub-area splits>.
3. **Wave B batching (§7.3):** <combined vs per-rule auto-fix; per-area manual residue>.
4. **Wave C within-pages ordering (§7.4):** ascending error count; alphabetical tiebreak (resolved per plan-stage decision #4).
5. **Wave D `checksVoidReturn` (§7.5):** <"applied" or "skipped"> based on <N> JSX-attribute violations.
6. **`build-lint-probe.ts` location (§7.6):** `frontend/scripts/build-lint-probe.ts` (sibling to `build-strict-probe.ts`).
7. **Diff size reporting (§7.7):** broken down by wave (this scorecard).
8. **TD-FE numbering (§7.8):** continued from TD-FE-10.

## Commit Summary

<N> commits on `phase-2b-eslint-prettier` branch.

Wave-by-wave narrative:
- Step 0 (2 commits): install deps + lint+prettier probe baseline.
- Step 1 (1 commit): wire eslint type-aware rules + prettier config + scripts + .git-blame-ignore-revs scaffold.
- Wave A (<M> commits): Prettier per-area mass-format + .git-blame-ignore-revs aggregation + post-Wave-A re-probe.
- Wave B (<K> commits): auto-fix sweeps + manual mechanical residue per area + unused-directives + post-Wave-B re-probe.
- Wave C (<P> commits): per-file `no-explicit-any` + `no-unsafe-*` cascade fixes + post-Wave-C re-probe.
- Wave D (<R> commits): per-file semantic fixes + 1 rules-of-hooks restructure.
- Step 6 (1–2 commits): residual fixes (if any) + this scorecard.

Full `git log --oneline master..HEAD`:

```
<paste output here>
```

## Diff Size

Aggregate `git diff --stat master..HEAD`:

```
<paste output here — the last "X files changed, Y insertions(+), Z deletions(-)" line>
```

Per-wave breakdown:

| Wave | Commits | Files | Insertions | Deletions |
|---|---|---|---|---|
| Step 0 | 2 | <n> | <i> | <d> |
| Step 1 | 1 | <n> | <i> | <d> |
| Wave A | <n> | <n> | <i> | <d> |
| Wave B | <n> | <n> | <i> | <d> |
| Wave C | <n> | <n> | <i> | <d> |
| Wave D | <n> | <n> | <i> | <d> |
| Step 6 | 1–2 | <n> | <i> | <d> |

Wave A's diff dominates (mechanical formatting). The `.git-blame-ignore-revs` aggregation makes Wave A's diff effectively invisible to future blame.

## Verification

All Spec 18 §5 done-when items verified at HEAD before merge:

1. ✅ `frontend/eslint.config.js` enables the five mandated rules + `import-x/order` + `eslint-config-prettier` (last). Type-aware parser config wired. Override zones present.
2. ✅ `frontend/.prettierrc`, `frontend/.prettierignore` present. `.git-blame-ignore-revs` at monorepo root contains every Wave A commit SHA.
3. ✅ `npm run lint` (= `eslint . --max-warnings 0`) returns 0 errors and 0 warnings.
4. ✅ `npm run format:check` (= `prettier --check .`) green.
5. ✅ `npm run typecheck` still green (Phase 2a's gate not regressed).
6. ✅ `npm run preflight` extended to include lint + format:check, green end-to-end.
7. ✅ 0 `no-explicit-any` and 0 `no-unsafe-*` violations in production code paths.
8. ✅ 0 `eslint-disable-next-line @typescript-eslint/no-explicit-any` outside test paths.
9. ✅ `@ts-*` suppression count ≤5 (Phase 2a baseline preserved).
10. ✅ New escape-hatches entries (if any) carry `// TODO(phase-13):`, `Untyped*` prefix, call-site reference, justification.
11. ✅ Scorecard merged at this path.
```

- [ ] **Step 3: Commit the scorecard**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add docs/audits/2026-05-28-frontend-phase-2b-eslint-prettier.md
git commit -m "$(cat <<'EOF'
docs(audits): phase 2b eslint+prettier scorecard

Final scorecard for Phase 2b. Covers:
- Baseline → final per-rule disposition
- Files touched per wave
- Escape-hatches delta (Phase 2a 6 → Phase 2b N)
- TD-FE entries created
- Plan-stage decisions for Spec 18 §7 open questions
- Commit summary + per-wave diff stat
- All §5 done-when items verified.

Spec 18 §4 Step 6 / §5.
EOF
)"
```

- [ ] **Step 4: Final preflight before handing off for impl-review**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: green. The branch is now ready for `/review-impl` per the spec → plan → impl pipeline.

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git log --oneline master..HEAD | wc -l
git log --oneline master..HEAD | head -20
```

Note the total commit count and recent commits — input for the impl-review and the eventual merge ceremony.
