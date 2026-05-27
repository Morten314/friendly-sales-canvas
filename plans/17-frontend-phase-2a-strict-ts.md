# Phase 2a — Frontend Strict TS Turn-On Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute Spec 17's six-step methodology to turn strict TypeScript on across `frontend/src/`. End state: `frontend/tsconfig.app.json` has its five explicit strict-mode flags all `true`; `frontend/tsconfig.json` (composite root) no longer carries the four relaxing overrides; `frontend/package.json` `typecheck` script invokes `tsc --noEmit -p tsconfig.app.json` so the gate actually checks `src/`; `npm run typecheck` returns zero errors; the 15 dead shadcn primitives whose npm deps Phase 1 removed are deleted; `src/lib/types/escape-hatches.ts` is absent or holds entries each with the required `// TODO(phase-13):` comment, `Untyped*` type-name prefix, call-site reference, and one-line justification; `npm run preflight` green.

**Architecture:** Single short-lived branch (`phase-2a-strict-ts`) off `master`. Six deterministic steps mirroring Spec 17 §3. Step 0 captures an authoritative re-baseline (the spec's design-time number is 461 errors against a strict probe; execution-time may differ). Step 1 deletes the 15 dead-shadcn primitives in 3 batched commits via Phase 1's 6-check kit, then flips the strict flags + fixes the typecheck script + cleans the root config in one interlocked commit. Steps 2–4 are three wave-shaped fix passes: Wave A (`noUnused*` mechanical sweep, ~327 errors), Wave B (`noImplicitAny` annotations, ~83 errors), Wave C (semantic stragglers, ~36 errors). Each wave ends with an error-count + Vitest-unit-tests checkpoint. Step 5 runs the full done-when checklist and writes the scorecard. `tsc --noEmit` is red between Step 1b and the end of Step 4 — acceptable because `master` stays green; `vite build`, Vitest, and Playwright continue to pass mid-phase (esbuild transpiles without typechecking).

**Tech Stack:** Node 22 + npm 10 + TypeScript 5.5 + Vite 5 + Playwright 1.59.1 + Vitest 3.x + knip 5.x + tsx 4.x. **Python 3** is a prerequisite — verification, ordering, and delta-table scripts in this plan use `python3` for JSON parsing and dict aggregation (same convention Plan 16 uses; Brewra is a Python+TS polyglot repo and Python is universally present). No new npm deps in the expected case (the `typescript` package already at `^5.5.3`). **If Risk R10 triggers** (TS7016 "could not find declaration file" for a third-party package whose `@types/*` is missing), the executor installs the corresponding `@types/<pkg>` as a Wave-C-grain change; the dep addition rides in the same commit as the call-site fix (commit subject form: `chore(fe): add @types/<pkg> to resolve TS7016 in <file>`; commit body explains why no `@types/*` was already present and whether a local `.d.ts` shim under `src/types/` would have been a better fix). The new helper script `frontend/scripts/build-strict-probe.ts` runs under `tsx`, same as the existing `build-audit-scorecard.ts` and `capture-bundle-baseline.ts`.

**Spec:** `specs/17-frontend-phase-2a-strict-ts-design.md` (round 6 clean, plan-ready).

**Branch:** `phase-2a-strict-ts` off `master` (current HEAD at plan-writing time, 2026-05-27: `073bf50 docs(spec-17): apply synthesis-6 revisions`).

**Baseline (measured at plan-writing time, 2026-05-27):**
- Post-Phase-1 frontend tree: 67,469 LOC across 156 `.ts`/`.tsx` files under `frontend/src/` (per `docs/audits/2026-05-27-frontend-loc-pass-1.md`).
- Spec 17 §1.3 design-time strict-probe baseline: 461 errors. Error-code histogram: 315× TS6133 + 83× TS7006 + 15× TS2307 + 12× TS6192 + 8× TS2345 + 8× TS18046 + 7× TS2322 + 5× TS18047 + 4× TS2339 + 2× TS6196 + 2× TS18048.
- Existing inline `any` count: 238. Existing `@ts-*` suppression count: 5.
- Working-tree sanity (plan-writing time, 2026-05-27): `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` returns 28 errors against the **current non-strict** baseline. These are pre-existing errors that the non-strict `tsconfig.app.json` would surface today if the broken `npm run typecheck` script (which compiles the root `tsconfig.json` with `"files": []` and trivially exits 0) had been correct. The Step 0 strict probe will produce a strictly larger count (~461 design-time + the 28 already-present + or − drift). The 28 should be fully absorbed by Steps 2–4 (most likely TS6133 / TS7006 / TS6192 territory). No special handling — they are already part of the wave methodology.
- `master` is 14 commits ahead of `origin/master` at plan-writing time (recent commits are spec/review artifacts for Spec 17 rounds 5 and 6). Task 0a pushes these first so the branch's base is shared with origin.

**Why Phase 2a is single-branch (no sub-split):** 461 design-time errors is well under master spec §4 Phase 2a's 1,500 sub-decomposition threshold. The internal structure of Waves A/B/C provides commit cohesion. **If the Step 0 re-baseline finds >1,500 errors,** the executor halts and re-enters Spec 14 §4 sub-decomposition (file-folder split or category sub-phases) before continuing — see Task 1 Step 7.

**Commit-message convention:** `type(scope): <description>` per CLAUDE.md. Scope is `fe` for `frontend/` source/config edits, `audits` for `docs/audits/` writes, `docs` for `docs/TECH_DEBT.md` updates. **No `[N/M]` numbering** — Phase 2a is bounded by the error count, not a fixed task count. **No `Co-Authored-By` footer** (recorded user preference). Step 1a batch commits ship the 6-line per-file structured check-kit block in the body per Spec 16 §3 Step 4 (Spec 17 §2.1 reuses the kit). Wave A/B/C fix commits do not embed full diff details; commit bodies state the error categories addressed and any noteworthy structural choices.

**Greenness invariant — Phase 2a edition (deliberately weaker than Phase 1):**
Per Spec 17 §3 preamble, `tsc --noEmit -p tsconfig.app.json` is **expected red** between the end of Step 1b and the end of Step 4. The per-commit gate adapts per step:

| Step / wave | Per-commit gate |
|---|---|
| Step 0 (probe + artifacts) | full `npm run preflight` green |
| Step 1a (3 shadcn-delete commits) | full `npm run preflight` green (the `npm run typecheck` script is still vacuous pre-Step-1b, but `vite build` / Playwright / Vitest / knip all care about runtime state) |
| Step 1b (flag flip + script fix) | `vite build` + Vitest + Playwright — the one-time cliff-edge runtime confirmation. `npm run typecheck` is expected RED at this commit and documented in the commit body. |
| Waves A/B/C (per-commit) | `vite build` + Vitest. Playwright deferred to Step 5. |
| Wave-end checkpoints | `tsc -p tsconfig.app.json` error-count delta + Vitest. |
| Step 5 (binding pre-merge) | full `npm run preflight` green (the binding done-when gate). |

Rationale for the weaker mid-wave gate: Wave-B and Wave-C posture rules (Spec 17 §2.4 rule 4 — "behavior unchanged. Type-only edits") mean a wave commit cannot legitimately change runtime; Vitest catches accidental behavior drift; Playwright's runtime (Playwright + visual regression typically ~3–5 min per run) over ~30 wave commits doesn't pay for itself when the type changes are runtime-inert. The final Step-5 Playwright + visual-regression run is the safety net for any escapes.

**Per-commit-gate procedure during Waves A/B/C:**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build                                  # esbuild transpile — green even with strict-TS errors
npx vitest run                                  # unit tests must stay green
# Playwright NOT run mid-wave — see rationale above. Step 5's binding preflight runs it.
```

The error-count delta is the per-commit signal during waves — verified at wave end, not per commit (per-commit verification would slow execution without changing outcome).

**Wave-end checkpoint (between Waves):**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
node_modules/.bin/tsc -p tsconfig.app.json --noEmit 2>&1 | grep -c 'error TS' || echo 0
npx vitest run
```

Confirm the error-count delta is within the spec's ±tolerance for that wave (Wave A: ±30 from ~327; Wave B: ±15 from ~83; Wave C: target 0). Investigate either direction (short drop OR over-drop) before proceeding to the next wave.

**Step 5 done-when gate (binding):**
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight    # typecheck → vite build → playwright test → vitest run → knip --strict --no-progress
```

Must be green for merge. After the Step 1b script fix, `npm run typecheck` invokes `tsc --noEmit -p tsconfig.app.json` and is the binding strict-clean check.

**Post-commit rollback:** If a wave's per-commit gate (`vite build` / Vitest) is red after a commit, use `git reset --hard HEAD~N` to revert N commits, diagnose root cause, and re-attempt — never "fix forward" past a runtime regression. If a wave-end checkpoint shows error-count drift outside the tolerance, see the wave's investigation procedure (do not silently proceed).

**Wave B/C cascade recovery (specific case):** if a Wave B annotation or Wave C narrowing fix surfaces unexpected cascading errors in 3+ unrelated files (a "deeper than expected" cascade — see Spec 17 §2.3's note that type-level cascades are in-scope but the file-grain commit absorbs them), revert the offending commit and choose between:

- **(a) Tighter fix that doesn't change inferred types downstream.** Instead of broadening a return type, narrow at the assignment site. Instead of typing a parameter, type the call site that passes it. This often eliminates the cascade by keeping the type-inference graph local.
- **(b) Escape-hatch the original site to confine the cascade.** Apply the Wave B/C escape-hatches policy (Task 3 Step 2 / Task 4 Step 2) to the site where the cascade originated. The cascade evaporates because the source type stays `any`. Costs one escape-hatches entry and (if it triggers the 5-entry threshold) a TD-FE registration.
- **(c) Abort the file and defer to TD-FE.** Register a `TD-FE-<n>` capturing the structural problem (e.g., "function F's return type would need restructuring across 10 call sites — out of scope for Phase 2a"). The file's errors remain; Wave C end-of-wave checkpoint will surface them, and Step 5.1 verification will catch them at merge time. If genuinely required, abort the phase per Spec 14 §5.7.

Recovery is judgment, not a scripted recipe — but the three options above cover the common shapes. Choose (a) when the cascade reveals a tighter type was always available; (b) when the source type is genuinely opaque; (c) when the cascade reveals a structural design issue Phase 2a should not solve.

**Abort criterion:** If a single Wave-B or Wave-C fix cannot be made tight without an out-of-scope refactor across >2 unrelated files, apply Spec 17 §2.4 posture rule 3: either escape-hatch the immediate site, register a `TD-FE-<n>` deferral, or abort the phase per Spec 14 §5.7. If three distinct fix attempts on the same file all fail to make Vitest + `vite build` green, halt and surface to operator — likely a deeper structural problem the spec under-scoped.

**Per-task isolation:** Step 0, Step 1a (3 batches), Step 1b, Step 5.1 (verification), and Step 5.2 (scorecard) are single-commit gates. Steps 2/3/4 are per-area / per-file commit loops where one task's failure does not abort subsequent tasks within the wave, but the wave-end checkpoint blocks the next wave.

**TD-FE numbering:** Sequential from `max(existing TD-FE-* in docs/TECH_DEBT.md) + 1`. As of 2026-05-27 plan-writing time, **TD-FE-1 through TD-FE-8 exist** in `docs/TECH_DEBT.md` (Phase 1 created TD-FE-1 through TD-FE-7 for orphan-route + conservative-deferral defers; TD-FE-8 covers `knip ignoreDependencies` for two untraceable packages, added after Spec 17 was first drafted — Spec 17 §1.3's "next entry is TD-FE-8" line is therefore stale). **Phase 2a's first deferral is TD-FE-9.** The executor re-reads the current max immediately before each deferral commit (`grep -oE 'TD-FE-[0-9]+' docs/TECH_DEBT.md | sort -V | tail -1`).

**Numbering of plan/spec slot:** This plan and Spec 17 share NN=17 per CLAUDE.md spec-driven flow convention.

**Plan-stage decisions for Spec 17 §6 open questions:**

1. **Step 0 re-baseline numbers (§6.1):** captured at execution start by Task 1.4 — the plan describes the procedure, not the numbers.
2. **Wave A within-area file ordering (§6.2):** ascending error count from the Step 0 probe JSON; alphabetical tiebreak. The executor reads `errorsByFile` keys filtered to the area, sorts by count ascending, and processes in that order. See Task 2.prep.
3. **Wave B within-pages-group ordering for small pages (§6.3):** ascending error count; alphabetical tiebreak. Same procedure as Wave A. See Task 3.prep.
4. **Wave C clustering (§6.4):** **by file** (the spec's default). A single type-definition error producing multiple call-site errors is fixed in one commit when the call sites are in the same file; if call sites span multiple files, the fixing commit lands in the file that owns the type definition and downstream call-site touch-ups land in their respective files' commits.
5. **Diff size reporting depth (§6.5):** **broken down by wave** in the Step 5 scorecard. The aggregate `git diff --stat master..HEAD` is also reported. Per-wave breakdown: Step 0, Step 1a (3 shadcn batches summed), Step 1b, Wave A, Wave B, Wave C, Step 5.1 residual + Step 5.2 scorecard. See Task 5.2.
6. **`build-strict-probe.ts` location (§6.6):** **sibling script** under `frontend/scripts/build-strict-probe.ts` (not an extension of `build-audit-scorecard.ts`). Reason: distinct responsibility — the probe invokes `tsc` with a throwaway config, parses output, writes JSON + TXT. The audit-scorecard generator computes LOC roll-ups and renders Tier 1 / Tier 2 markdown. Mixing the two surfaces increases maintenance drag. The probe is implemented from scratch (no shared utilities needed beyond Node `fs`/`path`/`child_process`).

---

## File Structure

**Created:**
- `frontend/scripts/build-strict-probe.ts` — new helper that creates a throwaway `tsconfig.strict-probe.json`, runs `tsc --noEmit -p` against it, captures output, writes JSON + TXT artifacts, deletes the throwaway. Committed in Step 0. **Lifecycle: kept permanently as project tooling** (re-runnable before Phase 2b to verify strict-clean state, and as a baseline tool for future strict-mode work). Follows the precedent of `frontend/scripts/build-audit-scorecard.ts` (Phase 0a's similar helper that was kept post-merge). No cleanup required at Phase 2a merge.
- `docs/audits/2026-05-27-frontend-phase-2a-strict-probe.json` — Step 0 machine-readable per-file error list + error-code histogram + per-area roll-up.
- `docs/audits/2026-05-27-frontend-phase-2a-strict-probe.txt` — Step 0 raw `tsc --noEmit` output.
- `docs/audits/2026-05-27-post-wave-a-frontend-phase-2a-strict-probe.{json,txt}` — Task 2-checkpoint Step 3 inter-wave re-probe (input for Wave B's prep script).
- `docs/audits/2026-05-27-post-wave-b-frontend-phase-2a-strict-probe.{json,txt}` — Task 3-checkpoint Step 3 inter-wave re-probe (input for Wave C's prep script).
- `frontend/src/lib/types/escape-hatches.ts` — **conditional** (only created if at least one Wave B or Wave C error requires it). Each entry uses `export type UntypedX = any;` with mandatory `// TODO(phase-13):` comment and call-site reference. The 5th entry's commit body includes a `TD-FE-<n>` registration. See Task 3 / Task 4.
- `docs/audits/2026-05-27-frontend-phase-2a-strict-ts.md` — Step 5 final scorecard (re-dated to merge date if phase spans multiple days, via `git mv` immediately before the scorecard commit).

**Modified:**
- `frontend/tsconfig.app.json` — flip 5 strict-mode flags to `true` (Step 1b).
- `frontend/tsconfig.json` — remove 4 relaxing overrides (Step 1b housekeeping).
- `frontend/package.json` — change `typecheck` script to `tsc --noEmit -p tsconfig.app.json` (Step 1b).
- `docs/TECH_DEBT.md` — append `TD-FE-<n>` entries as deferrals are decided during Waves B/C; one additional entry if the escape-hatch file exists at phase-end (relocation to `src/shared/types/` is deferred to Phase 4).
- Variable additional source files under `frontend/src/` modified by Waves A/B/C to fix strict errors (per-area / per-file commit grain — exact list determined by Step 0 probe output).
- `specs/14-frontend-refactoring-master-plan-design.md` — `synthesize-impl-review` flips §4 Phase 2a status row to `done` at merge time per Spec 14 §5.5 (not authored by this plan).

**Deleted:**
- 15 dead shadcn primitives under `frontend/src/components/ui/` (Step 1a, 3 batched commits):
  - Batch i: `aspect-ratio.tsx`, `calendar.tsx`, `carousel.tsx`, `context-menu.tsx`, `form.tsx`
  - Batch ii: `hover-card.tsx`, `input-otp.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `radio-group.tsx`
  - Batch iii: `resizable.tsx`, `slider.tsx`, `switch.tsx`, `toggle.tsx`, `toggle-group.tsx`
- The throwaway `frontend/tsconfig.strict-probe.json` is created and removed by `build-strict-probe.ts`; **never committed** (it does not enter the working tree's tracked state).

---

## Pre-flight (no commit)

**Note on master advancing mid-phase:** Phase 2a expects a short-lived branch (1–2 days of execution). If `master` advances during execution (sync.sh propagates a Brewra-dev change, or another feature branch merges), the executor stops at the next natural commit boundary (wave end is ideal; per-task boundary is acceptable) and evaluates: (a) if the upstream change touches none of the Phase 2a target files (`tsconfig.app.json`, `tsconfig.json`, `package.json` typecheck-script, the 15 dead-shadcn files, or any file currently in a wave's queue), rebase onto the new master and continue; (b) if the upstream change touches any target file, abort the phase per Spec 14 §5.7, log discovery as a `TD-FE-<n>`, and re-plan after the upstream change settles. No mid-phase rebase strategy is codified beyond this — the branch is short-lived enough that the cost of "stop, decide, rebase or abort" is low.

### Task 0a — Verify clean master state, push pending commits, create the branch

**Files:** none (git operations only).

- [ ] **Step 1: Confirm working tree state**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git status
git rev-parse --abbrev-ref HEAD
git log --oneline -1
```

Expected:
- Branch: `master`
- HEAD: `073bf50 docs(spec-17): apply synthesis-6 revisions` (or a later master commit that doesn't conflict with Phase 2a scope — namely, no edits to `frontend/tsconfig.*.json`, `frontend/package.json` `typecheck` script, or the 15 dead-shadcn files).

If branch is not `master` or HEAD is at a commit that touched any Phase 2a target, STOP — verify whether the baseline drifted between plan-write and execution. Re-read Spec 17 §1.3 starting-state row and re-baseline expectations.

- [ ] **Step 2: Push the unpushed commits to origin/master**

```bash
git status -sb
```

If the first line reads `## master...origin/master [ahead N]` (N ≥ 1), push first:

```bash
git push origin master
git status -sb
```

Expected after push: `## master...origin/master` (no ahead/behind). This ensures the Phase 2a branch's base is shared with origin so the impl-review subagent can fetch it.

- [ ] **Step 3: Create and check out the Phase 2a branch**

```bash
git checkout -b phase-2a-strict-ts
git branch --show-current
```

Expected: `phase-2a-strict-ts`.

### Task 0b — Confirm baseline preflight green

**Files:** none (verification only).

- [ ] **Step 1: Run preflight on the unmodified branch**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: all five checks green (`typecheck → vite build → test:e2e → test → knip --strict --no-progress`). Runtime ~5–10 minutes depending on hardware.

Note: at this point `npm run typecheck` is still the broken `tsc --noEmit` (compiles the root config with `"files": []`, exits 0 vacuously). That is the design-time starting state — the Step 1b commit fixes the script.

If preflight is red on the unmodified branch: STOP — the baseline already fails. Diagnose before any Phase 2a work; the Step 5 binding gate requires preflight green at merge time, which is materially easier if it's green at the zeroth commit.

- [ ] **Step 2: Sanity-check the non-strict tsconfig.app.json baseline**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
node_modules/.bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c 'error TS' || echo 0
```

Expected: a small positive integer (28 at 2026-05-27 plan-writing time; may drift slightly). This is the non-strict baseline — already-present errors that the broken `npm run typecheck` script masks today. These will be subsumed by the Step 0 strict probe and absorbed by Waves A/B/C; no separate handling required.

If this returns 0, the typecheck surface is cleaner than expected at plan-writing time — note in the Step 5 scorecard and proceed.

If this returns a large number (>200), something unexpected has landed on master since plan-writing — investigate before continuing.

- [ ] **Step 3: Record the file/LOC baseline (anchor for scorecard's "before" column)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
find src -type f \( -name '*.ts' -o -name '*.tsx' \) | wc -l    # expected: 156
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec cat {} + | wc -l   # expected: ~67469
```

Note the actual numbers in working notes for the Step 5 scorecard. Significant drift (>5% delta from 156 / 67,469) is noted in the scorecard's "Delta vs spec baseline" line; proceed.

- [ ] **Step 4: Confirm the inline `any` and `@ts-*` baselines**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
rg -n ':\s*any\b|as\s+any\b|<any>' -g '*.ts' -g '*.tsx' src/ | wc -l    # expected: 238
rg -n '@ts-(ignore|expect-error|nocheck)' -g '*.ts' -g '*.tsx' src/ | wc -l    # expected: 5
```

Note the actual numbers. These are the design-time non-regression baselines for Step 5 done-when items 6 and 7 — the post-merge value must be ≤ what's recorded here.

---

## Step 0 — Re-baseline at execution start

Capture the authoritative strict-probe error landscape against the current branch state. This is the spec's official "before" anchor for all downstream waves and the Step 5 scorecard.

### Task 1 — Write `build-strict-probe.ts` and capture the re-baseline

**Files:**
- Create: `frontend/scripts/build-strict-probe.ts`
- Create: `docs/audits/2026-05-27-frontend-phase-2a-strict-probe.json`
- Create: `docs/audits/2026-05-27-frontend-phase-2a-strict-probe.txt`

Two artifacts plus the helper land in one commit. Rationale: the probe artifacts are inert outputs of the helper; the helper's correctness is implied by the artifacts' shape. Splitting into separate commits would create a no-value gap.

- [ ] **Step 1: Write `frontend/scripts/build-strict-probe.ts`**

Create the file with this exact content:

```typescript
#!/usr/bin/env tsx
/**
 * build-strict-probe.ts — Phase 2a strict-TS probe helper.
 *
 * Creates a throwaway tsconfig.strict-probe.json that extends tsconfig.app.json
 * with the five Phase 2a strict-mode flags forced to true, runs tsc --noEmit
 * against it, parses the diagnostic output, and writes two artifacts:
 *   - docs/audits/<date>-frontend-phase-2a-strict-probe.json (machine-readable)
 *   - docs/audits/<date>-frontend-phase-2a-strict-probe.txt  (raw tsc output)
 *
 * The throwaway probe config is deleted before exit; it never enters the
 * working tree's tracked state. Re-runnable: subsequent invocations overwrite
 * both artifacts.
 *
 * Usage (run from frontend/):
 *   npx tsx scripts/build-strict-probe.ts [--date YYYY-MM-DD]
 *
 * If --date is omitted, defaults to today's UTC date.
 *
 * Spec 17 §3 Step 0. Open question §6.6 — implemented as a sibling script.
 */

import { execFileSync } from "node:child_process";
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

function parseArgs(): { date: string } {
  const args = process.argv.slice(2);
  let date = todayUtc();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--date" && i + 1 < args.length) {
      date = args[i + 1];
      i++;
    }
  }
  return { date };
}

interface Diagnostic {
  file: string;
  line: number;
  col: number;
  code: string; // e.g. "TS6133"
  message: string;
}

function parseDiagnostics(raw: string): Diagnostic[] {
  // Format: <file>(<line>,<col>): error TS<code>: <message>
  const re = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.*)$/;
  const out: Diagnostic[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = re.exec(line);
    if (!m) continue;
    out.push({
      file: m[1].replace(/\\/g, "/"),
      line: parseInt(m[2], 10),
      col: parseInt(m[3], 10),
      code: m[4],
      message: m[5],
    });
  }
  return out;
}

function classifyArea(file: string): string {
  // file is relative to frontend/ (e.g. "src/components/market-research/Foo.tsx")
  const m = file.match(/^src\/([^/]+)(?:\/([^/]+))?/);
  if (!m) return "other";
  const top = m[1];
  const sub = m[2];
  if (top === "pages") return "pages";
  if (top === "lib") return "lib";
  if (top === "hooks") return "hooks";
  if (top === "utils") return "utils";
  if (top === "services") return "services";
  if (top === "contexts") return "contexts";
  if (top === "components") {
    if (!sub) return "components (loose)";
    return `components/${sub}`;
  }
  return top;
}

function main(): void {
  const { date } = parseArgs();
  const probePath = resolve(FRONTEND_DIR, "tsconfig.strict-probe.json");
  const jsonOut = resolve(
    REPO_DIR,
    "docs",
    "audits",
    `${date}-frontend-phase-2a-strict-probe.json`
  );
  const txtOut = resolve(
    REPO_DIR,
    "docs",
    "audits",
    `${date}-frontend-phase-2a-strict-probe.txt`
  );

  // 1) Write the throwaway probe config.
  const probeConfig = {
    extends: "./tsconfig.app.json",
    compilerOptions: {
      strict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noFallthroughCasesInSwitch: true,
    },
  };
  writeFileSync(probePath, JSON.stringify(probeConfig, null, 2) + "\n", "utf-8");

  // 2) Run tsc --noEmit -p tsconfig.strict-probe.json. Non-zero exit is the
  //    expected case (errors present); we still want stdout.
  let raw = "";
  try {
    raw = execFileSync(
      resolve(FRONTEND_DIR, "node_modules", ".bin", "tsc"),
      ["--noEmit", "-p", "tsconfig.strict-probe.json"],
      { cwd: FRONTEND_DIR, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
    );
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    raw = (e.stdout ?? "") + (e.stderr ?? "");
  }

  // 3) Delete the throwaway config before doing anything else (so even a parse
  //    failure below doesn't leak it into the working tree).
  rmSync(probePath, { force: true });

  // 4) Write raw output.
  mkdirSync(dirname(txtOut), { recursive: true });
  writeFileSync(txtOut, raw, "utf-8");

  // 5) Parse + classify.
  const diags = parseDiagnostics(raw);

  const errorsByFile: Record<string, number> = {};
  const errorsByArea: Record<string, number> = {};
  const errorsByCode: Record<string, number> = {};
  const detailsByFile: Record<string, Diagnostic[]> = {};

  for (const d of diags) {
    errorsByFile[d.file] = (errorsByFile[d.file] ?? 0) + 1;
    const area = classifyArea(d.file);
    errorsByArea[area] = (errorsByArea[area] ?? 0) + 1;
    errorsByCode[d.code] = (errorsByCode[d.code] ?? 0) + 1;
    (detailsByFile[d.file] ??= []).push(d);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    date,
    totalErrors: diags.length,
    errorsByCode,
    errorsByArea,
    errorsByFile,
    detailsByFile,
  };

  writeFileSync(jsonOut, JSON.stringify(report, null, 2) + "\n", "utf-8");

  // 6) Console summary.
  console.log(`Total errors: ${diags.length}`);
  console.log("By code:", errorsByCode);
  console.log("By area:", errorsByArea);
  console.log(`Wrote ${jsonOut}`);
  console.log(`Wrote ${txtOut}`);
}

main();
```

This file is ~150 lines. It uses only Node built-ins (`fs`, `path`, `child_process`) and the global `__dirname` provided by `tsx`'s CommonJS-compat layer (consistent with `build-audit-scorecard.ts`'s usage pattern).

- [ ] **Step 2: Verify the helper executes cleanly**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx tsx scripts/build-strict-probe.ts --date 2026-05-27
```

Expected: prints `Total errors: <N>`, `By code: { ... }`, `By area: { ... }`, and the two artifact paths.

Expected `<N>` range: roughly 461 ± drift (the spec's design-time number). If `<N>` is materially smaller (e.g., <300), an upstream Phase-1 follow-up may have reduced the surface — verify the probe ran against `tsconfig.app.json`'s `"include": ["src"]` and produced a non-trivial output. If `<N>` is materially larger (>1,500), apply Spec 14 §4 sub-decomposition (see Step 7 below).

Confirm the throwaway config was cleaned up:

```bash
ls frontend/tsconfig.strict-probe.json 2>&1
```

Expected: `ls: cannot access ... : No such file or directory`.

- [ ] **Step 3: Verify the JSON artifact is parseable and well-shaped**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
python3 <<'PY'
import json
d = json.load(open("docs/audits/2026-05-27-frontend-phase-2a-strict-probe.json"))
print("totalErrors:", d["totalErrors"])
print("errorsByCode keys:", sorted(d["errorsByCode"].keys()))
print("errorsByArea keys:", sorted(d["errorsByArea"].keys()))
print("errorsByFile count:", len(d["errorsByFile"]))
print("detailsByFile count:", len(d["detailsByFile"]))
# Spot-check top-5 files by error count:
top = sorted(d["errorsByFile"].items(), key=lambda kv: -kv[1])[:5]
print("Top 5 files:", top)
PY
```

Expected: `totalErrors` matches Step 2's printed `<N>`; `errorsByCode` contains entries like `TS6133`, `TS7006`, etc.; top-5 files likely lead with `pages/MarketResearch.tsx` and `pages/MissionControl.tsx` (per Spec 17 §1.3 concentration row).

- [ ] **Step 4: Verify the TXT artifact contains raw `tsc` output**

```bash
head -20 docs/audits/2026-05-27-frontend-phase-2a-strict-probe.txt
wc -l docs/audits/2026-05-27-frontend-phase-2a-strict-probe.txt
```

Expected: lines like `src/components/market-research/Foo.tsx(123,4): error TS6133: ...`. Total line count typically exceeds error count (multi-line error messages are common with `strictNullChecks`).

- [ ] **Step 5: Record the re-baseline numbers in working notes for downstream tasks**

Capture these numbers from Step 3's output into a working-notes file (NOT committed):

```bash
mkdir -p /tmp/phase-2a-notes
python3 <<'PY' > /tmp/phase-2a-notes/baseline.txt
import json
d = json.load(open("/projects/Brewra/brewra-gtm-intelligence/docs/audits/2026-05-27-frontend-phase-2a-strict-probe.json"))
print(f"Step 0 re-baseline (execution time)")
print(f"  totalErrors: {d['totalErrors']}")
print(f"  errorsByCode: {d['errorsByCode']}")
print(f"  errorsByArea: {d['errorsByArea']}")
print()
print(f"Design-time delta:")
spec_total = 461
spec_by_code = {"TS6133": 315, "TS7006": 83, "TS2307": 15, "TS6192": 12, "TS2345": 8, "TS18046": 8, "TS2322": 7, "TS18047": 5, "TS2339": 4, "TS6196": 2, "TS18048": 2}
print(f"  spec total: {spec_total}  re-baseline total: {d['totalErrors']}  delta: {d['totalErrors'] - spec_total:+d}")
for code, n_spec in sorted(spec_by_code.items(), key=lambda kv: -kv[1]):
    n_rb = d['errorsByCode'].get(code, 0)
    print(f"  {code}: spec {n_spec}  re-baseline {n_rb}  delta {n_rb - n_spec:+d}")
# Codes absent from the spec list but present at re-baseline:
new_codes = sorted(set(d['errorsByCode'].keys()) - set(spec_by_code.keys()))
if new_codes:
    print(f"  New error codes (not in spec baseline): {new_codes}")
PY
cat /tmp/phase-2a-notes/baseline.txt
```

Expected: prints a delta table. Codes with positive delta (more errors than spec) or codes absent from the spec list (like `TS7016` "could not find declaration file" — Risk R10) get noted for plan-stage awareness.

- [ ] **Step 6: Verify the per-area decomposition aligns with the spec's Wave-A ordering**

Spec 17 §3 Step 2 lists six area-groups in commit order. Confirm the Step 0 JSON's areas map onto them:

```bash
python3 <<'PY'
import json
d = json.load(open("/projects/Brewra/brewra-gtm-intelligence/docs/audits/2026-05-27-frontend-phase-2a-strict-probe.json"))
groups = {
    "Group 1 (lib/hooks/utils/services/contexts)": ["lib", "hooks", "utils", "services", "contexts"],
    "Group 2 (components/ui)":                      ["components/ui"],
    "Group 3 (components — non-research, non-mc)":  ["components/layout", "components/signals", "components/strategist", "components/settings", "components/customers"],
    "Group 4 (components/market-research)":         ["components/market-research"],
    "Group 5 (components/mission-control)":         ["components/mission-control"],
    "Group 6 (pages)":                               ["pages"],
}
for label, areas in groups.items():
    total = sum(d['errorsByArea'].get(a, 0) for a in areas)
    print(f"  {label}: {total}")
# Loose components and "other" buckets — these need a manual decision per file
loose = d['errorsByArea'].get("components (loose)", 0)
other_keys = set(d['errorsByArea'].keys()) - {a for areas in groups.values() for a in areas} - {"components (loose)"}
print(f"  components (loose): {loose}  — process in Group 3 by default")
print(f"  Other unaccounted areas: {sorted(other_keys)}")
PY
```

Expected: prints per-group totals. If "Other unaccounted areas" is non-empty (a new top-level dir landed on master between Phase 1 merge and execution), the executor decides which Wave-A group absorbs it — typically the group with the broadest blast radius (Group 1).

- [ ] **Step 7: Decide on sub-decomposition (if Step 0 returned >1,500 errors)**

If Step 2's `<N>` exceeded 1,500, apply Spec 14 §4 sub-decomposition trigger:
- Option (a): file-folder split — Phase 2a-i for `lib/hooks/utils/services/contexts/components` and Phase 2a-ii for `pages/`.
- Option (b): category split — Phase 2a-i mechanical (Wave A), Phase 2a-ii implicit-any (Wave B), Phase 2a-iii semantic (Wave C).

The plan stops here, halts execution, and surfaces to operator for the sub-decomposition decision. Do not proceed to Step 8 (the commit) without operator confirmation that the single-branch plan still applies.

Expected case: `<N>` is in the 400–700 range; single-branch continues.

- [ ] **Step 8: Run preflight + commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: green (the helper is unreferenced by `src/`; the audit artifacts are in `docs/`; nothing in the build/test path).

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/scripts/build-strict-probe.ts \
        docs/audits/2026-05-27-frontend-phase-2a-strict-probe.json \
        docs/audits/2026-05-27-frontend-phase-2a-strict-probe.txt
git commit -m "$(cat <<'EOF'
chore(audits): phase 2a strict ts re-baseline

Captures the authoritative strict-TS probe baseline against the current
master tree. JSON artifact contains per-file, per-area, and per-code
error counts; TXT artifact preserves the raw tsc --noEmit output.

The probe runs tsc against a throwaway tsconfig.strict-probe.json that
extends tsconfig.app.json with the five Phase 2a strict-mode flags
forced to true (strict, noUnusedLocals, noUnusedParameters,
noFallthroughCasesInSwitch — noImplicitAny is part of the strict
umbrella). The throwaway is deleted by the helper before exit and
never enters the tracked working tree.

These artifacts are the spec's official "before" anchor for Waves
A/B/C and the Step 5 scorecard. Spec 17 §3 Step 0.
EOF
)"
```

---

## Step 1 — Dead-shadcn deletion + strict-flag flip

Order: deletes (Step 1a, three commits) before flag flip (Step 1b, one commit). Rationale per Spec 17 §3 Step 1: each dead-shadcn delete is a Phase-1-followup whose 6-check kit reads "before" against a known-clean compile; the flag flip is the cliff edge after which `tsc --noEmit -p tsconfig.app.json` is expected red.

### Task 1a-i — Delete dead shadcn primitives: batch i (aspect-ratio, calendar, carousel, context-menu, form)

**Files:**
- Delete: `frontend/src/components/ui/aspect-ratio.tsx`
- Delete: `frontend/src/components/ui/calendar.tsx`
- Delete: `frontend/src/components/ui/carousel.tsx`
- Delete: `frontend/src/components/ui/context-menu.tsx`
- Delete: `frontend/src/components/ui/form.tsx`

Five files = one commit. Per Spec 17 §2.1, these are Phase-1-followup cleanup (npm deps removed in Phase 1 left the .tsx files with TS2307 missing-module errors and zero inbound). The 6-check kit per Spec 16 §3 Step 4 verifies zero inbound before each delete.

- [ ] **Step 1: Confirm each file currently has the expected TS2307 surface (sanity)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
for f in aspect-ratio calendar carousel context-menu form; do
  echo "=== $f.tsx ==="
  test -f "src/components/ui/$f.tsx" && echo "EXISTS" || echo "MISSING (already deleted upstream?)"
done
```

Expected: all five print `EXISTS`. If any prints `MISSING`, that file was already deleted upstream — exclude it from this commit's `git rm` list but keep the others. Note in the commit body.

- [ ] **Step 2: Apply the 6-check kit to each file**

For each of the 5 files, run the 6-check kit (Spec 16 §3 Step 4) and record per-file results. The check structure:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
for BASE in aspect-ratio calendar carousel context-menu form; do
  echo "=================================================================="
  echo "FILE: $BASE.tsx"
  echo "=================================================================="
  echo "--- Check 1: rg-basename (any reference) ---"
  rg -n "$BASE" src/ e2e/ | grep -v "src/components/ui/$BASE.tsx:" || echo "  (no hits outside the file itself)"
  echo "--- Check 2: rg-dynamic-import ---"
  rg -n "import\([^)]*$BASE" src/ e2e/ || echo "  (no hits)"
  echo "--- Check 3: rg-reexport ---"
  rg -n "export.*from.*$BASE" src/ e2e/ || echo "  (no hits)"
  echo "--- Check 4: rg-plain-text (same as Check 1 here; documented for kit completeness) ---"
  rg -n "\"$BASE\"|'$BASE'" src/ e2e/ || echo "  (no hits)"
  echo "--- Check 5: route walk (App.tsx) ---"
  rg -n "$BASE" src/App.tsx || echo "  (no hits)"
  echo "--- Check 6: test/e2e imports ---"
  rg -n "$BASE" src/ e2e/ 2>/dev/null | grep -E "(__tests__|\.test\.|\.spec\.|^e2e/)" || echo "  (no hits)"
done
```

Expected: every check on every file returns "no hits" (or, for Check 1, only the file's own self-reference). If any check returns a hit:

**Surprise-inbound procedure (Spec 17 §3 Step 1a):**
1. **Exclude that file from this batch's `git rm`** — the other 4 still ship.
2. Decide on the surviving file via one of:
   - **(b) — default if the refactor is genuinely trivial:** a single import-statement change at one call site (e.g., swap `import { Calendar } from '@/components/ui/calendar'` for a native `<input type="date">`). Document the swap in the commit body and ship a follow-up commit immediately after this batch.
   - **(c) — default otherwise:** register a `TD-FE-<n>` entry deferring the delete. Use the next TD-FE number (`grep -oE 'TD-FE-[0-9]+' docs/TECH_DEBT.md | sort -V | tail -1` + 1). Add a minimal local shim under `frontend/src/types/` if the file's TS2307 needs suppressing until the inbound is removed.
   - **(a) — last resort:** restore the dep in `package.json` (rolls back part of Phase 1, requires user checkpoint).

- [ ] **Step 3: Delete the 5 files via `git rm`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git rm frontend/src/components/ui/aspect-ratio.tsx \
       frontend/src/components/ui/calendar.tsx \
       frontend/src/components/ui/carousel.tsx \
       frontend/src/components/ui/context-menu.tsx \
       frontend/src/components/ui/form.tsx
```

Expected: five `rm 'frontend/src/components/ui/<name>.tsx'` lines.

- [ ] **Step 4: Run preflight**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: green. The five files had no inbound and were not compiling against the non-strict baseline anyway (their npm deps were removed in Phase 1), so removing them strictly *improves* `tsc --noEmit -p tsconfig.app.json`'s output count.

If preflight goes red on this commit, the 6-check kit missed something. Diagnose via the error message; revert with `git checkout HEAD frontend/src/components/ui/<file>.tsx` and re-run the kit per surprise-inbound procedure.

- [ ] **Step 5: Commit**

Compose the per-file 6-check kit block in the commit body:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git commit -m "$(cat <<'EOF'
chore(fe): remove dead shadcn primitives (batch i)

Phase-1-followup cleanup: these 5 shadcn .tsx files were left
syntactically broken (TS2307 missing-module errors) when Phase 1
removed their npm dependencies. Zero inbound per the 6-check kit.

aspect-ratio.tsx:
  rg-basename: 0
  rg-dynamic-import: 0
  rg-reexport: 0
  rg-plain-text: 0
  route-walk: none
  test-imports: none

calendar.tsx:
  rg-basename: 0
  rg-dynamic-import: 0
  rg-reexport: 0
  rg-plain-text: 0
  route-walk: none
  test-imports: none

carousel.tsx:
  rg-basename: 0
  rg-dynamic-import: 0
  rg-reexport: 0
  rg-plain-text: 0
  route-walk: none
  test-imports: none

context-menu.tsx:
  rg-basename: 0
  rg-dynamic-import: 0
  rg-reexport: 0
  rg-plain-text: 0
  route-walk: none
  test-imports: none

form.tsx:
  rg-basename: 0
  rg-dynamic-import: 0
  rg-reexport: 0
  rg-plain-text: 0
  route-walk: none
  test-imports: none

Spec 17 §2.1 / §3 Step 1a, Batch i.
EOF
)"
```

(If Step 2 surfaced a non-zero count for any check, replace that `0` with the actual count; if a file was excluded from the batch per the surprise-inbound procedure, drop its block from the commit body.)

### Task 1a-ii — Delete dead shadcn primitives: batch ii (hover-card, input-otp, menubar, navigation-menu, radio-group)

**Files:**
- Delete: `frontend/src/components/ui/hover-card.tsx`
- Delete: `frontend/src/components/ui/input-otp.tsx`
- Delete: `frontend/src/components/ui/menubar.tsx`
- Delete: `frontend/src/components/ui/navigation-menu.tsx`
- Delete: `frontend/src/components/ui/radio-group.tsx`

Same procedure as Task 1a-i; substitute basenames. The 5-line commit body uses the same per-file structure.

- [ ] **Step 1: Confirm each file currently exists**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
for f in hover-card input-otp menubar navigation-menu radio-group; do
  echo "=== $f.tsx ==="
  test -f "src/components/ui/$f.tsx" && echo "EXISTS" || echo "MISSING (already deleted upstream?)"
done
```

- [ ] **Step 2: Apply the 6-check kit to each file**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
for BASE in hover-card input-otp menubar navigation-menu radio-group; do
  echo "=================================================================="
  echo "FILE: $BASE.tsx"
  echo "=================================================================="
  echo "--- Check 1: rg-basename ---"
  rg -n "$BASE" src/ e2e/ | grep -v "src/components/ui/$BASE.tsx:" || echo "  (no hits outside the file itself)"
  echo "--- Check 2: rg-dynamic-import ---"
  rg -n "import\([^)]*$BASE" src/ e2e/ || echo "  (no hits)"
  echo "--- Check 3: rg-reexport ---"
  rg -n "export.*from.*$BASE" src/ e2e/ || echo "  (no hits)"
  echo "--- Check 4: rg-plain-text ---"
  rg -n "\"$BASE\"|'$BASE'" src/ e2e/ || echo "  (no hits)"
  echo "--- Check 5: route walk ---"
  rg -n "$BASE" src/App.tsx || echo "  (no hits)"
  echo "--- Check 6: test/e2e imports ---"
  rg -n "$BASE" src/ e2e/ 2>/dev/null | grep -E "(__tests__|\.test\.|\.spec\.|^e2e/)" || echo "  (no hits)"
done
```

Apply the surprise-inbound procedure (Task 1a-i Step 2) if any check returns a hit. Note for `input-otp` specifically: the basename contains a hyphen and is somewhat distinctive — if it appears in any plain-text context, it's almost certainly a hit worth investigating.

- [ ] **Step 3: Delete via `git rm`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git rm frontend/src/components/ui/hover-card.tsx \
       frontend/src/components/ui/input-otp.tsx \
       frontend/src/components/ui/menubar.tsx \
       frontend/src/components/ui/navigation-menu.tsx \
       frontend/src/components/ui/radio-group.tsx
```

- [ ] **Step 4: Run preflight**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git commit -m "$(cat <<'EOF'
chore(fe): remove dead shadcn primitives (batch ii)

Phase-1-followup cleanup: TS2307-broken files with zero inbound.

hover-card.tsx:
  rg-basename: 0
  rg-dynamic-import: 0
  rg-reexport: 0
  rg-plain-text: 0
  route-walk: none
  test-imports: none

input-otp.tsx:
  rg-basename: 0
  rg-dynamic-import: 0
  rg-reexport: 0
  rg-plain-text: 0
  route-walk: none
  test-imports: none

menubar.tsx:
  rg-basename: 0
  rg-dynamic-import: 0
  rg-reexport: 0
  rg-plain-text: 0
  route-walk: none
  test-imports: none

navigation-menu.tsx:
  rg-basename: 0
  rg-dynamic-import: 0
  rg-reexport: 0
  rg-plain-text: 0
  route-walk: none
  test-imports: none

radio-group.tsx:
  rg-basename: 0
  rg-dynamic-import: 0
  rg-reexport: 0
  rg-plain-text: 0
  route-walk: none
  test-imports: none

Spec 17 §2.1 / §3 Step 1a, Batch ii.
EOF
)"
```

### Task 1a-iii — Delete dead shadcn primitives: batch iii (resizable, slider, switch, toggle, toggle-group)

**Files:**
- Delete: `frontend/src/components/ui/resizable.tsx`
- Delete: `frontend/src/components/ui/slider.tsx`
- Delete: `frontend/src/components/ui/switch.tsx`
- Delete: `frontend/src/components/ui/toggle.tsx`
- Delete: `frontend/src/components/ui/toggle-group.tsx`

Same procedure. `switch` is a JavaScript keyword and a common ripgrep noise source — Check 1's grep filter must include the `.tsx:` suffix to avoid false positives from comments containing `switch (foo)`.

- [ ] **Step 1: Confirm each file currently exists**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
for f in resizable slider switch toggle toggle-group; do
  echo "=== $f.tsx ==="
  test -f "src/components/ui/$f.tsx" && echo "EXISTS" || echo "MISSING"
done
```

- [ ] **Step 2: Apply the 6-check kit (with `switch` noise-handling)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
for BASE in resizable slider toggle toggle-group; do
  echo "=================================================================="
  echo "FILE: $BASE.tsx"
  echo "=================================================================="
  echo "--- Check 1: rg-basename ---"
  rg -n "$BASE" src/ e2e/ | grep -v "src/components/ui/$BASE.tsx:" || echo "  (no hits outside the file itself)"
  echo "--- Check 2: rg-dynamic-import ---"
  rg -n "import\([^)]*$BASE" src/ e2e/ || echo "  (no hits)"
  echo "--- Check 3: rg-reexport ---"
  rg -n "export.*from.*$BASE" src/ e2e/ || echo "  (no hits)"
  echo "--- Check 4: rg-plain-text ---"
  rg -n "\"$BASE\"|'$BASE'" src/ e2e/ || echo "  (no hits)"
  echo "--- Check 5: route walk ---"
  rg -n "$BASE" src/App.tsx || echo "  (no hits)"
  echo "--- Check 6: test/e2e imports ---"
  rg -n "$BASE" src/ e2e/ 2>/dev/null | grep -E "(__tests__|\.test\.|\.spec\.|^e2e/)" || echo "  (no hits)"
done

# Special handling for 'switch' — restrict to import-path / from-clause contexts only
echo "=================================================================="
echo "FILE: switch.tsx (specialized matching to filter keyword noise)"
echo "=================================================================="
echo "--- Check 1: import/export references to ui/switch ---"
rg -n "['\"][^'\"]*ui/switch['\"]" src/ e2e/ || echo "  (no hits)"
echo "--- Check 2: dynamic-import to ui/switch ---"
rg -n "import\([^)]*ui/switch" src/ e2e/ || echo "  (no hits)"
echo "--- Check 3: re-export of ui/switch ---"
rg -n "export.*from.*['\"][^'\"]*ui/switch['\"]" src/ e2e/ || echo "  (no hits)"
echo "--- Check 4: shadcn 'Switch' component identifier (the typical shadcn JSX name) ---"
rg -n "\\bSwitch\\b" src/ e2e/ | grep -v "src/components/ui/switch.tsx:" || echo "  (no hits outside the file itself)"
echo "--- Check 5: route walk ---"
rg -n "['\"][^'\"]*ui/switch['\"]" src/App.tsx || echo "  (no hits)"
echo "--- Check 6: test/e2e imports of ui/switch ---"
rg -n "['\"][^'\"]*ui/switch['\"]" src/ e2e/ 2>/dev/null | grep -E "(__tests__|\.test\.|\.spec\.|^e2e/)" || echo "  (no hits)"
```

The specialized `switch` matching looks at import-path contexts (`from '@/components/ui/switch'` style) and the `Switch` PascalCase identifier, both of which avoid keyword-noise. If Check 4 surfaces a `<Switch />` JSX or `import { Switch } from ...`, apply the surprise-inbound procedure.

- [ ] **Step 3: Delete via `git rm`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git rm frontend/src/components/ui/resizable.tsx \
       frontend/src/components/ui/slider.tsx \
       frontend/src/components/ui/switch.tsx \
       frontend/src/components/ui/toggle.tsx \
       frontend/src/components/ui/toggle-group.tsx
```

- [ ] **Step 4: Run preflight**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git commit -m "$(cat <<'EOF'
chore(fe): remove dead shadcn primitives (batch iii)

Phase-1-followup cleanup: TS2307-broken files with zero inbound.
switch.tsx uses specialized import-path / Switch-identifier matching
to filter JavaScript-keyword noise from the 6-check kit.

resizable.tsx:
  rg-basename: 0
  rg-dynamic-import: 0
  rg-reexport: 0
  rg-plain-text: 0
  route-walk: none
  test-imports: none

slider.tsx:
  rg-basename: 0
  rg-dynamic-import: 0
  rg-reexport: 0
  rg-plain-text: 0
  route-walk: none
  test-imports: none

switch.tsx:
  rg-import-path: 0
  rg-dynamic-import: 0
  rg-reexport: 0
  Switch-identifier: 0
  route-walk: none
  test-imports: none

toggle.tsx:
  rg-basename: 0
  rg-dynamic-import: 0
  rg-reexport: 0
  rg-plain-text: 0
  route-walk: none
  test-imports: none

toggle-group.tsx:
  rg-basename: 0
  rg-dynamic-import: 0
  rg-reexport: 0
  rg-plain-text: 0
  route-walk: none
  test-imports: none

After this commit the 15 TS2307 errors from the Step 0 probe drop to 0.
Spec 17 §2.1 / §3 Step 1a, Batch iii.
EOF
)"
```

### Task 1b — Flip strict flags + fix typecheck script + clean root config

**Files:**
- Modify: `frontend/tsconfig.app.json` (5 explicit flag flips, false → true)
- Modify: `frontend/tsconfig.json` (remove 4 relaxing overrides)
- Modify: `frontend/package.json` (`typecheck` script change)

Three edits in one commit. Per Spec 17 §3 Step 1b: the flag flip (edit 1) and the script fix (edit 2) are functionally interlocked; the root-config cleanup (edit 3) is housekeeping but rides along for atomicity (all three configure the same typecheck surface).

- [ ] **Step 1: Apply the `tsconfig.app.json` flag flip**

The current file at plan-writing time:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitAny": false,
    "noFallthroughCasesInSwitch": false,

    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

Change the five `Linting` block entries from `false` to `true`. Final state:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitAny": true,
    "noFallthroughCasesInSwitch": true,

    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

Note: `strict: true` is the umbrella that transitively enables eight sub-flags (per Spec 17 §1.3 sub-flag composition row); `noImplicitAny` is explicit alongside the umbrella as defensive redundancy and is left in place (the spec doesn't strip it). `skipLibCheck: true` is untouched per Spec 17 §1.3.

- [ ] **Step 2: Apply the `tsconfig.json` root-config cleanup**

The current file:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "noImplicitAny": false,
    "noUnusedParameters": false,
    "skipLibCheck": true,
    "allowJs": true,
    "noUnusedLocals": false,
    "strictNullChecks": false
  }
}
```

Remove the 4 relaxing overrides (`noImplicitAny`, `noUnusedParameters`, `noUnusedLocals`, `strictNullChecks`). Keep `baseUrl`, `paths`, `skipLibCheck`, `allowJs`. Final state:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "skipLibCheck": true,
    "allowJs": true
  }
}
```

Per Spec 17 §2.1: `tsconfig.app.json` is standalone (no `"extends"` of the root) and the root's `"files": []` puts zero files under its compilerOptions; removing the 4 overrides has no functional effect on the typecheck gate or IDE behavior for `src/` files. The change is IDE-alignment housekeeping that prevents a future reader (or a future referenced project that does extend the root) from being confused by settings that contradict the strict app config.

- [ ] **Step 3: Apply the `package.json` typecheck-script fix**

Current `scripts` block:

```json
"scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "lint": "eslint .",
    "preflight": "npm run typecheck && npm run build && npm run test:e2e && npm run test && npx knip --strict --no-progress",
    "preview": "vite preview",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:update-snapshots": "playwright test --update-snapshots",
    "test:e2e:ui": "playwright test --ui",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
```

Change the `typecheck` line from `"typecheck": "tsc --noEmit"` to `"typecheck": "tsc --noEmit -p tsconfig.app.json"`. Final:

```json
"scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "lint": "eslint .",
    "preflight": "npm run typecheck && npm run build && npm run test:e2e && npm run test && npx knip --strict --no-progress",
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
```

This is the binding change that makes every done-when gate functional. Before this edit, `npm run typecheck` invokes `tsc --noEmit` which compiles the root config (`"files": []`, zero files) and exits 0 unconditionally — the strict-flag flip in Step 1 has no enforcement surface.

- [ ] **Step 4: Verify the configs parse cleanly**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
python3 -c "import json; json.load(open('tsconfig.app.json')); print('tsconfig.app.json parses OK')"
python3 -c "import json; json.load(open('tsconfig.json'));    print('tsconfig.json parses OK')"
python3 -c "import json; d=json.load(open('package.json'));   print('typecheck script:', d['scripts']['typecheck'])"
```

Note: `tsconfig.*.json` files include `/* comments */` which break strict JSON parsing. The above commands will fail at the parsing step — use a JSONC-tolerant approach instead:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
node -e "
const fs = require('fs');
function stripJsonc(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''); }
console.log('app:',  JSON.parse(stripJsonc(fs.readFileSync('tsconfig.app.json', 'utf-8'))).compilerOptions.strict);
console.log('root:', JSON.parse(stripJsonc(fs.readFileSync('tsconfig.json', 'utf-8'))).compilerOptions);
console.log('typecheck:', JSON.parse(fs.readFileSync('package.json', 'utf-8')).scripts.typecheck);
"
```

Expected:
```
app: true
root: { baseUrl: '.', paths: { '@/*': [ './src/*' ] }, skipLibCheck: true, allowJs: true }
typecheck: tsc --noEmit -p tsconfig.app.json
```

- [ ] **Step 5: Run the per-commit gate (NOT full preflight — preflight will fail by design)**

`npm run preflight` will be red after this commit because `npm run typecheck` now correctly invokes `tsc --noEmit -p tsconfig.app.json` against strict-mode flags, surfacing all the Wave A/B/C errors. That is the expected, designed state per Spec 17 §3 preamble.

Verify the *runtime* surface is still green:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build
npx vitest run
```

Expected: both green. `vite build` transpiles with esbuild (no typechecking); Vitest's tests are unchanged.

Optional (slower) confirm Playwright still runs:

```bash
npx playwright test
```

Expected: green. Skip this confirmation only if Step 1a's three commits already passed it (the changes since are config-only — they cannot affect Playwright behavior).

- [ ] **Step 6: Confirm the typecheck IS red (sanity for the surface)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
node_modules/.bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c 'error TS' || echo 0
```

Expected: a non-trivial integer close to the Step 0 re-baseline number minus 15 (the TS2307 errors removed by Step 1a). If the count matches `<Step 0 total> - <TS2307 count>` ± a small margin (≤5 for inferred-type drift), Step 1b worked as designed. Otherwise investigate before proceeding.

- [ ] **Step 7: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/tsconfig.app.json frontend/tsconfig.json frontend/package.json
git commit -m "$(cat <<'EOF'
chore(fe): enable strict typescript flags

Three interlocked config edits that flip Phase 2a's typecheck surface
from non-strict-and-broken to strict-and-functional:

1. tsconfig.app.json — flip 5 explicit strict-mode compiler flags
   false → true: strict, noUnusedLocals, noUnusedParameters,
   noImplicitAny, noFallthroughCasesInSwitch. strict:true transitively
   enables 8 sub-flags (strictNullChecks, strictFunctionTypes,
   strictBindCallApply, strictPropertyInitialization, noImplicitThis,
   alwaysStrict, useUnknownInCatchVariables, noImplicitAny).

2. package.json — change typecheck script from `tsc --noEmit` to
   `tsc --noEmit -p tsconfig.app.json`. Before this fix, the script
   compiled the root tsconfig.json (which has "files": []) and
   exited 0 unconditionally — making the strict flag flip a no-op
   for npm run typecheck / npm run preflight. After this fix, the
   gate enforces the strict config against src/.

3. tsconfig.json (root composite) — remove 4 relaxing overrides
   (noImplicitAny, noUnusedParameters, noUnusedLocals,
   strictNullChecks). The root has "files": [] and tsconfig.app.json
   is standalone (no "extends" of the root), so these overrides
   have no functional effect today; removal is IDE-alignment
   housekeeping that prevents future readers (or future referenced
   projects) from being confused by settings contradicting
   tsconfig.app.json.

Post-commit state: `tsc --noEmit -p tsconfig.app.json` and `npm run
typecheck` are RED (expected — Waves A/B/C drive to zero); `vite
build`, Vitest, Playwright continue green. Spec 17 §3 Step 1b.
EOF
)"
```

---

## Step 2 — Wave A: noUnused* sweep (~327 errors)

Targets TS6133 (unused locals/params, 315) + TS6192 (all-imports-unused, 12). Mechanical: delete unused imports, declarations, destructured fields; `_argName` prefix for unused-but-interface-required params.

### Task 2.prep — Extract per-area / per-file ordering from Step 0 probe

**Files:** working notes only (`/tmp/phase-2a-notes/wave-a-order.txt`); not committed.

- [ ] **Step 1: Generate the per-area / per-file ordering for Wave A**

```bash
mkdir -p /tmp/phase-2a-notes
python3 <<'PY' > /tmp/phase-2a-notes/wave-a-order.txt
"""Wave A ordering: by area-group per Spec 17 §3 Step 2, within each
area ascending error count (open question §6.2 decision).

Filter Step 0 probe to Wave A's two error codes (TS6133, TS6192).
"""
import json
d = json.load(open("/projects/Brewra/brewra-gtm-intelligence/docs/audits/2026-05-27-frontend-phase-2a-strict-probe.json"))

WAVE_A_CODES = {"TS6133", "TS6192"}

# Filter detailsByFile to Wave A only, recompute per-file counts
wave_a_per_file = {}
for path, diags in d["detailsByFile"].items():
    count = sum(1 for diag in diags if diag["code"] in WAVE_A_CODES)
    if count > 0:
        wave_a_per_file[path] = count

print(f"# Wave A files: {len(wave_a_per_file)}; total errors: {sum(wave_a_per_file.values())}")
print()

# Bucket by Spec 17 §3 Step 2 ordering
GROUPS = [
    ("Group 1: lib/hooks/utils/services/contexts", ["src/lib/", "src/hooks/", "src/utils/", "src/services/", "src/contexts/"]),
    ("Group 2: components/ui",                     ["src/components/ui/"]),
    ("Group 3: components — non-research, non-mc", ["src/components/layout/", "src/components/signals/", "src/components/strategist/", "src/components/settings/", "src/components/customers/"]),
    ("Group 4: components/market-research",        ["src/components/market-research/"]),
    ("Group 5: components/mission-control",        ["src/components/mission-control/"]),
    ("Group 6: pages",                             ["src/pages/"]),
]
# Loose components (directly under src/components/, not in a named subfolder) -> Group 3 by default
def loose_components(path):
    parts = path.split("/")
    return len(parts) >= 3 and parts[1] == "components" and parts[2].endswith((".ts", ".tsx"))

seen = set()
for label, prefixes in GROUPS:
    files_in_group = []
    for path, count in wave_a_per_file.items():
        if any(path.startswith(p) for p in prefixes) or (label.startswith("Group 3") and loose_components(path)):
            files_in_group.append((path, count))
            seen.add(path)
    files_in_group.sort(key=lambda kv: (kv[1], kv[0]))  # ascending count, alpha tiebreak
    total = sum(c for _, c in files_in_group)
    print(f"## {label} — {len(files_in_group)} files, {total} errors")
    for path, count in files_in_group:
        print(f"  {count:4d}  {path}")
    print()

unseen = sorted(set(wave_a_per_file.keys()) - seen)
if unseen:
    print(f"## UNCATEGORIZED ({len(unseen)} files) — manual assignment required")
    for path in unseen:
        print(f"  {wave_a_per_file[path]:4d}  {path}")
PY
wc -l /tmp/phase-2a-notes/wave-a-order.txt
head -20 /tmp/phase-2a-notes/wave-a-order.txt
```

Expected: a working-notes file at `/tmp/phase-2a-notes/wave-a-order.txt` listing each Wave-A-affected file grouped by Spec 17's 6 area-groups, ascending error count within each group. Per-group totals roughly map to: Group 1 ~5, Group 2 ~18 (after Step 1a deletes mostly applies to TS6133/6192 residue), Group 3 ~40–60, Group 4 ~80–100, Group 5 ~15–20, Group 6 ~170+ (mostly the two big pages).

If any files appear under `UNCATEGORIZED`, decide group assignment manually (most likely they're loose under `src/` or in a new dir) — typically assign to Group 1.

- [ ] **Step 2: Apply the split-threshold rule (Spec 17 §3 Step 2)**

For each group, if the area's `git diff --stat` after the area's mechanical fixes would exceed **60 line-deletions**, split into sub-area commits. The split decision is made *during* the area's edit pass, not pre-computed — for groups with high file counts (4 and 6), expect to split.

Rule of thumb from `wave-a-order.txt`:
- Groups with ≤5 files / ≤30 errors → single commit.
- Groups with 6–15 files / 30–60 errors → likely single commit; verify diff size with `git diff --stat` before committing.
- Groups with >15 files / >60 errors → likely split by sub-area (e.g., Group 4 split by `market-research/<sub-folder>` if such sub-folders exist; Group 6 split by `pages/<page>.tsx` cohorts).

For Group 6 specifically (`src/pages/`), if the spec's design-time concentration holds (`MarketResearch.tsx` 144, `MissionControl.tsx` 80, plus small pages), expect to split into at least 3 commits: small pages bundled, `MissionControl.tsx` alone, `MarketResearch.tsx` alone. The exact split is determined by the Step 0 numbers — note in working notes which file ranges land in which commit.

### Task 2.1 — Group 1: `src/lib/`, `src/hooks/`, `src/utils/`, `src/services/`, `src/contexts/`

**Files:** variable, listed in `/tmp/phase-2a-notes/wave-a-order.txt` under Group 1 header. Expected ~5 errors total at design time.

- [ ] **Step 1: Process each file in Group 1's ascending-error order**

For each file `<path>` (lowest-count first), open the file and apply Wave A fix rules per Spec 17 §3 Step 2 fix-rules:

- **Unused import (TS6192 = entire import statement unused):** delete the whole `import ...` line.
- **Unused named import (TS6133 on imported name):** delete that name from the import list. If it's the only name, delete the whole import line. For `import { A, B } from 'foo'` where only `B` is unused, leave `import { A } from 'foo'`.
- **Unused local variable / const / let / type alias (TS6133):** delete the declaration. For destructuring like `const { a, b } = obj` where only `b` is unused, drop `b` from the pattern: `const { a } = obj`.
- **Unused function/method parameter required for interface compliance (TS6133):** rename to `_<originalName>` (preserves what the parameter would have been called). Per Spec 17 §2.4 posture rule 5: never use bare `_`, always `_argName`. **Pre-existing bare `_` parameters are NOT retroactively renamed.**
- **Unused destructured prop in a React component:** delete from destructuring; if all become unused, simplify the component signature (drop the parameter or rename to `_props`).

**Public-export protection (Spec 17 §2.3 / R3):** if removing an "unused" symbol would remove a *public export* of `src/lib/`, `src/hooks/`, `src/utils/`, or `src/contexts/`, do NOT delete. Apply `_` prefix to the parameter, or restructure locally if the symbol is a const/function. Cross-check by searching for inbound imports from test files and e2e files (these may import symbols flagged as unused in src/):

```bash
# Before deleting an "unused" export from src/lib/foo.ts:
grep -rn "from ['\"][^'\"]*lib/foo['\"]" src/**/__tests__ src/**/*.test.* src/**/*.spec.* e2e/ 2>/dev/null
```

If a test or e2e import exists, treat as "interface-compliance" — keep the symbol, prefix parameters with `_`, or otherwise preserve the export signature.

- [ ] **Step 2: Verify the area's typecheck error drop**

After editing all Group 1 files:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
node_modules/.bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c 'error TS' || echo 0
```

Expected: error count drops by approximately Group 1's `wave-a-order.txt` total (~5 errors).

- [ ] **Step 3: Run the per-commit gate**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build
npx vitest run
```

Expected: both green. If Vitest fails (a test consumed a deleted symbol), revert with `git restore` and apply public-export protection — likely a symbol that should have been preserved.

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/lib frontend/src/hooks frontend/src/utils frontend/src/services frontend/src/contexts
git diff --cached --stat
git commit -m "$(cat <<'EOF'
refactor(fe): remove unused symbols in lib/hooks/utils/services/contexts

Wave A (Phase 2a strict-TS) — TS6133 + TS6192 fixes in Group 1.
Public exports of src/lib/, src/hooks/, src/utils/, src/contexts/
preserved per spec 17 §2.3 frozen-interface rule; bare `_` parameters
not retroactively renamed (spec 17 §2.4 posture rule 5 note).

Spec 17 §3 Step 2, Group 1.
EOF
)"
```

(If the diff stat shows >60 line-deletions, the commit is unexpectedly large for Group 1 — verify no files were over-edited beyond the noUnused* fix grain. Group 1's design-time error budget is ~5, so >60 deletions suggests scope creep.)

### Task 2.2 — Group 2: `src/components/ui/`

**Files:** variable, listed in `/tmp/phase-2a-notes/wave-a-order.txt` under Group 2 header. Expected ~18 errors at design time, but Step 1a's 15 file deletions remove the bulk; the residue is likely much smaller (TS6133 unused-import errors inside the surviving shadcn primitives that were imported from now-deleted siblings).

- [ ] **Step 1: Process each surviving Group 2 file in ascending-error order**

Apply the same Wave A fix rules as Task 2.1. **Special caution for `src/components/ui/`:** Spec 16 §2.2 locked this directory from Phase 1's cleanup; the Phase 4 lock is now expressed as `"ignore": ["src/components/ui/**"]` in `frontend/knip.json`. **Spec 17 §2.1's dead-shadcn deletions in Step 1a (15 files) are an explicit exception to the lock** (those files were broken, not refactored). For Wave A fixes, treat unused imports / params inside surviving shadcn primitives like any other Wave A fix — `noUnused*` errors here are not Phase 4 territory; they're Phase 2a typecheck residue.

If an unused import in a shadcn primitive refers to a now-deleted sibling (e.g., `import { CalendarProps } from './calendar'` where `calendar.tsx` was just deleted), the import is genuinely unused — delete it.

- [ ] **Step 2: Verify the area's typecheck error drop**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
node_modules/.bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c 'error TS' || echo 0
```

Expected: drop by Group 2's `wave-a-order.txt` total.

- [ ] **Step 3: Per-commit gate**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build
npx vitest run
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/components/ui
git diff --cached --stat
git commit -m "refactor(fe): remove unused symbols in components/ui"
```

(Body optional; if the change is mechanically obvious from the diff, the subject alone suffices.)

### Task 2.3 — Group 3: `src/components/layout/`, `signals/`, `strategist/`, `settings/`, `customers/` (+ loose components)

**Files:** variable. Expected ~40–60 errors at design time (layout 24 + customers 18 + smaller).

- [ ] **Step 1: Decide whether to split**

Read `/tmp/phase-2a-notes/wave-a-order.txt` Group 3 section. If the total deletion surface across all 5 sub-areas would exceed 60 lines, split into sub-commits per sub-area:

- `src/components/layout/`
- `src/components/signals/`
- `src/components/strategist/`
- `src/components/settings/`
- `src/components/customers/`
- Loose components directly under `src/components/`

Use one commit per sub-area when splitting. Single combined commit otherwise.

- [ ] **Step 2: Process each file in ascending order**

Apply Wave A fix rules. React component patterns common in this group:

- **Unused JSX props in destructuring:**
  ```tsx
  // Before:
  function Foo({ a, b, c }: FooProps) { return <div>{a}</div>; }
  // After (if b, c unused):
  function Foo({ a }: FooProps) { return <div>{a}</div>; }
  ```
  Do NOT change `FooProps` — only the destructuring inside the component body.
- **Unused React event handler param:**
  ```tsx
  // Before:
  <button onClick={(e) => doSomething()}>X</button>
  // After (if e unused — but typically just drop the param entirely):
  <button onClick={() => doSomething()}>X</button>
  ```
- **Unused `useEffect` deps in non-callback contexts:** delete the unused name from the dep list.

- [ ] **Step 3: Verify the area's typecheck error drop, per-commit gate, commit**

(Combined for brevity since the procedure is identical to Task 2.1 Steps 2–4.)

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
node_modules/.bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c 'error TS' || echo 0
npx vite build
npx vitest run
```

```bash
cd /projects/Brewra/brewra-gtm-intelligence
# For single combined commit:
git add frontend/src/components/layout frontend/src/components/signals frontend/src/components/strategist frontend/src/components/settings frontend/src/components/customers
# (Adjust paths if loose-component files are also in scope.)
git diff --cached --stat
git commit -m "refactor(fe): remove unused symbols in components/{layout,signals,strategist,settings,customers}"
# OR if splitting:
# git add frontend/src/components/layout && git commit -m "refactor(fe): remove unused symbols in components/layout"
# git add frontend/src/components/signals && git commit -m "refactor(fe): remove unused symbols in components/signals"
# ... etc.
```

### Task 2.4 — Group 4: `src/components/market-research/`

**Files:** variable. Expected ~80–100 errors at design time (RegulatoryComplianceSection 25 + MarketEntrySection 22 + CompetitorLandscapeSection 18 + others). High likelihood of split.

- [ ] **Step 1: Decide split structure**

Read Group 4's `wave-a-order.txt` block. If total exceeds 60 line-deletions, split by sub-folder (if `market-research/` has sub-folders) or by file-cohort (e.g., 3 commits: low-count files / mid-count files / RegulatoryComplianceSection alone or similar).

- [ ] **Step 2: Process files in ascending order, one or more commits**

Apply Wave A fix rules. The market-research section files are large feature components; expect heavy destructuring patterns and prop drilling that surface lots of TS6133 / TS6192.

Per-commit gate + commit after each split unit:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build && npx vitest run
```

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/components/market-research/<sub-area-or-files>
git diff --cached --stat
git commit -m "refactor(fe): remove unused symbols in components/market-research<sub-area>"
```

### Task 2.5 — Group 5: `src/components/mission-control/`

**Files:** variable. Expected ~15–20 errors at design time (ICPManager 17 + others).

Same procedure as Task 2.3 (single commit unless diff exceeds 60 deletions).

- [ ] **Step 1: Process files, verify, commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
# (Edit each file in ascending error order per /tmp/phase-2a-notes/wave-a-order.txt.)
npx vite build && npx vitest run
```

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/components/mission-control
git diff --cached --stat
git commit -m "refactor(fe): remove unused symbols in components/mission-control"
```

### Task 2.6 — Group 6: `src/pages/`

**Files:** `src/pages/*.tsx`. Expected ~170+ errors (MarketResearch 144 + MissionControl 80 + small pages ~25 total). Highly likely to split.

- [ ] **Step 1: Split strategy**

Spec 17 §3 Step 2 prescribes "MissionControl before MarketResearch, both last after smaller pages." Concrete plan:
- **Commit 2.6a:** small pages bundled (Settings, TenantSelection, Login, Calendar, Reports, Artifacts, Signals, Deals, Insights, NotFound, and any others). Typical bundle size: ~25 errors / ~30 line-deletions. Single commit even if at the 60-deletion threshold (the bundle is internally cohesive).
- **Commit 2.6b:** `MissionControl.tsx` alone (~80 errors at design time; the file is large but the diff is mechanical).
- **Commit 2.6c:** `MarketResearch.tsx` alone (~144 errors at design time; the largest single file in Wave A).

Adjust split based on actual Step 0 numbers.

- [ ] **Step 2: Process Commit 2.6a — small pages**

For each small page (ascending error count per `wave-a-order.txt`), apply Wave A fix rules.

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build && npx vitest run
```

```bash
cd /projects/Brewra/brewra-gtm-intelligence
# Add each small-page file by name, not the entire pages/ dir (preserves the split):
git add frontend/src/pages/Settings.tsx \
        frontend/src/pages/TenantSelection.tsx \
        frontend/src/pages/Login.tsx \
        # ... (add each file in the small-page bundle, omitting MissionControl.tsx and MarketResearch.tsx)
git diff --cached --stat
git commit -m "refactor(fe): remove unused symbols in pages/<small pages bundle>"
```

(Adapt the file list to match Step 0's actual small-page set.)

- [ ] **Step 3: Process Commit 2.6b — MissionControl.tsx**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
# Apply Wave A fixes throughout MissionControl.tsx.
npx vite build && npx vitest run
```

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/pages/MissionControl.tsx
git diff --cached --stat
git commit -m "refactor(fe): remove unused symbols in pages/MissionControl.tsx"
```

- [ ] **Step 4: Process Commit 2.6c — MarketResearch.tsx**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
# Apply Wave A fixes throughout MarketResearch.tsx.
npx vite build && npx vitest run
```

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/pages/MarketResearch.tsx
git diff --cached --stat
git commit -m "refactor(fe): remove unused symbols in pages/MarketResearch.tsx"
```

### Task 2-checkpoint — Wave A end-of-wave verification

**Files:** none (verification only).

- [ ] **Step 1: Error-count verification**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
node_modules/.bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c 'error TS' || echo 0
```

Expected: post-Wave-A count = (Step 0 total − TS2307 count − Wave A target). Per spec 17 §3 Step 2 wave-end checkpoint, the *drop* between post-Step-1b and post-Wave-A should be within ±30 of the Wave A target (~327 at design time).

Compute the drop:
```bash
python3 <<'PY'
import json
d = json.load(open("/projects/Brewra/brewra-gtm-intelligence/docs/audits/2026-05-27-frontend-phase-2a-strict-probe.json"))
# Wave A targets these codes
wave_a_codes = {"TS6133", "TS6192"}
wave_a_target = sum(d["errorsByCode"].get(c, 0) for c in wave_a_codes)
print(f"Wave A design-time target (Step 0): {wave_a_target}")
PY
```

Read the actual post-Wave-A count from the `tsc` invocation above. Compute `drop = (Step 0 total - 15 TS2307) - post_wave_a_count`. Verify `abs(drop - wave_a_target) <= 30`.

**If drop < target - 30 (materially short):** cascades from narrowing in Wave A's deletions OR missed errors. Pause to investigate before Wave B. Possible causes:
- A deletion left a now-unused identifier in a downstream file (cascading TS6133 — should land in a follow-up Wave A commit, not Wave B).
- A file in `wave-a-order.txt` was skipped or under-processed.

**If drop > target + 30 (materially exceeding):** Wave A's deletions unintentionally resolved Wave-B-or-C errors. Pause to re-categorize before Wave C. Possible causes:
- Deletion of an unused parameter changed the type-inference cascade enough to resolve a TS7006 or TS2345 downstream.
- This is OK in outcome (fewer errors) but it means the Wave B and Wave C targets need to be adjusted before starting Wave B.

In either case, the investigation produces working notes (not a commit). Wave B starts with a refreshed understanding of what remains.

- [ ] **Step 2: Unit-test health**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vitest run
```

Expected: green. The §2.3 public-export protection covers `lib/`, `hooks/`, `utils/`, `contexts/` but not `components/`, `pages/`, `services/` — a Wave A deletion of an internal symbol used by a co-located test would surface here. If red, identify which test broke and either restore the deleted symbol (commit a fix in Wave A's grain — `refactor(fe): restore <symbol> in <file> — used by <test>`) or update the test to not reference it (only if the test is itself stale).

Playwright is deferred to Step 5's binding gate (its runtime is too high per wave).

- [ ] **Step 3: Re-probe and commit the post-Wave-A artifact (Wave B input)**

Always re-probe between waves so Wave B's prep script reads from a fresh, per-file/per-code-accurate JSON instead of stale Step 0 data. The cost is a single ~30–60s `tsc` invocation; the benefit is that Wave A cascades (Spec 17 §2.3 in-scope type-level cascades, plus the drift the wave-end checkpoint may have surfaced) are correctly reflected in Wave B's queue.

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx tsx scripts/build-strict-probe.ts --date 2026-05-27-post-wave-a
```

This produces:
- `docs/audits/2026-05-27-post-wave-a-frontend-phase-2a-strict-probe.json`
- `docs/audits/2026-05-27-post-wave-a-frontend-phase-2a-strict-probe.txt`

(The helper's `--date` flag stitches the literal value into the filename, so `2026-05-27-post-wave-a` produces a clearly-labeled artifact that sorts with the Step 0 audit. No code change to `build-strict-probe.ts` required.)

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add docs/audits/2026-05-27-post-wave-a-frontend-phase-2a-strict-probe.json \
        docs/audits/2026-05-27-post-wave-a-frontend-phase-2a-strict-probe.txt
git commit -m "$(cat <<'EOF'
chore(audits): phase 2a post-wave-a re-baseline

Re-probe after Wave A's noUnused* sweep. JSON artifact is the
authoritative input for Wave B's per-file ordering. Captures any
Wave-A→Wave-B cascade that surfaced in the wave-end checkpoint.

Spec 17 §3 Step 2 wave-end checkpoint (extended by plan
synthesis-1 to add an explicit re-probe between waves).
EOF
)"
```

Expected: green preflight (`vite build` + Vitest still pass; the new audit files don't enter the build/test path).

Verify the artifact's shape mirrors Step 0:
```bash
python3 <<'PY'
import json
d = json.load(open("/projects/Brewra/brewra-gtm-intelligence/docs/audits/2026-05-27-post-wave-a-frontend-phase-2a-strict-probe.json"))
print("totalErrors:", d["totalErrors"])
print("errorsByCode:", d["errorsByCode"])
PY
```

Expected: `totalErrors` matches the count from Step 1 of this checkpoint (the `grep -c 'error TS'` output). `errorsByCode` shows zero or near-zero `TS6133` / `TS6192` (Wave A's targets — they should be 0 if Wave A landed clean).

---

## Step 3 — Wave B: noImplicitAny annotations (~83 errors)

Targets TS7006 (parameter implicitly has 'any' type). File-by-file with ≤3-error batching. Per Spec 17 §3 Step 3: per-error uncertainty is materially higher than Wave A or C.

### Task 3.prep — Extract per-file ordering for Wave B

**Files:** working notes only.

- [ ] **Step 1: Generate Wave B's ordering**

Reads from the post-Wave-A artifact committed by Task 2-checkpoint Step 3 (not the Step 0 probe — Wave A cascades shift the per-file landscape).

```bash
python3 <<'PY' > /tmp/phase-2a-notes/wave-b-order.txt
"""Wave B ordering: file-by-file with ≤3-error batching (spec 17 §3 Step 3).
Within an area, ascending error count; alpha tiebreak. Reads from the
post-Wave-A re-probe (Task 2-checkpoint Step 3) for accuracy under
cascades.
"""
import json
d = json.load(open("/projects/Brewra/brewra-gtm-intelligence/docs/audits/2026-05-27-post-wave-a-frontend-phase-2a-strict-probe.json"))

WAVE_B_CODES = {"TS7006"}
wave_b_per_file = {}
for path, diags in d["detailsByFile"].items():
    c = sum(1 for diag in diags if diag["code"] in WAVE_B_CODES)
    if c > 0:
        wave_b_per_file[path] = c

print(f"# Wave B files: {len(wave_b_per_file)}; total errors: {sum(wave_b_per_file.values())}")
print()

# Same area-group ordering as Wave A
GROUPS = [
    ("Group 1: lib/hooks/utils/services/contexts", ["src/lib/", "src/hooks/", "src/utils/", "src/services/", "src/contexts/"]),
    ("Group 2: small components",                  ["src/components/signals/", "src/components/strategist/", "src/components/settings/", "src/components/layout/"]),
    ("Group 3: larger components",                 ["src/components/customers/", "src/components/market-research/", "src/components/mission-control/", "src/components/ui/"]),
    ("Group 4: small pages",                       ["src/pages/"]),  # filter MissionControl + MarketResearch out below
    ("Group 5: MissionControl.tsx",                ["src/pages/MissionControl.tsx"]),
    ("Group 6: MarketResearch.tsx",                ["src/pages/MarketResearch.tsx"]),
]

seen = set()
for label, prefixes in GROUPS:
    files_in_group = []
    for path, count in wave_b_per_file.items():
        if label.startswith("Group 4"):
            if path.startswith("src/pages/") and path not in ("src/pages/MissionControl.tsx", "src/pages/MarketResearch.tsx"):
                files_in_group.append((path, count))
                seen.add(path)
        else:
            if any(path == p or path.startswith(p) for p in prefixes):
                files_in_group.append((path, count))
                seen.add(path)
    files_in_group.sort(key=lambda kv: (kv[1], kv[0]))
    total = sum(c for _, c in files_in_group)
    # Apply the ≤3-error batching: mark each file's commit boundary
    print(f"## {label} — {len(files_in_group)} files, {total} errors")
    batch = []
    batch_total = 0
    for path, count in files_in_group:
        if count > 3:
            if batch:
                print(f"  [BATCH] {batch_total} errors across {len(batch)} files: {batch}")
                batch, batch_total = [], 0
            print(f"  [INDIV] {count} errors: {path}")
        else:
            # Same-area batching only — flush batch when crossing area boundaries (handled outside loop)
            batch.append(path)
            batch_total += count
    if batch:
        print(f"  [BATCH] {batch_total} errors across {len(batch)} files: {batch}")
    print()

unseen = sorted(set(wave_b_per_file.keys()) - seen)
if unseen:
    print(f"## UNCATEGORIZED ({len(unseen)} files)")
    for path in unseen:
        print(f"  {wave_b_per_file[path]:4d}  {path}")
PY
wc -l /tmp/phase-2a-notes/wave-b-order.txt
```

Expected: a per-group, per-file or per-batch list with commit-boundary markers. `[INDIV]` files get their own commit; `[BATCH]` files are bundled (≤3 errors each, same area).

### Task 3 — Process each Wave B file/batch in order

**Files:** variable.

- [ ] **Step 1: For each entry in `/tmp/phase-2a-notes/wave-b-order.txt`, apply Wave B fix rules**

For each `[INDIV]` or `[BATCH]` entry, open the file(s) and fix each TS7006 by applying Spec 17 §3 Step 3 fix rules:

**React event handlers:** annotate with the built-in event types.
```tsx
// Before:
const onChange = (e) => setValue(e.target.value);
// After:
const onChange = (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value);
```
Common mappings:
- `<input onChange>` → `React.ChangeEvent<HTMLInputElement>`
- `<button onClick>` → `React.MouseEvent<HTMLButtonElement>`
- `<form onSubmit>` → `React.FormEvent<HTMLFormElement>`
- `<div onKeyDown>` → `React.KeyboardEvent<HTMLDivElement>`
- `<textarea onChange>` → `React.ChangeEvent<HTMLTextAreaElement>`
- `<select onChange>` → `React.ChangeEvent<HTMLSelectElement>`

**Array callbacks (`.map`, `.filter`, `.reduce`):** usually inferable once the source is properly typed. If the source is `any`-typed, fix the source first within the same Wave-B commit.
```tsx
// Before — TS7006 on `lead`:
leads.map((lead) => <LeadCard data={lead} />)
// If `leads` is typed: no annotation needed — TS infers.
// If `leads: any`: type the source first.
```

**Object destructuring on weakly-typed data:** type the parameter with a local `interface` or `type` if the shape is non-trivial.
```tsx
// Before — TS7006 on the param:
const handleResponse = ({ data, status }) => { ... }
// After:
interface ApiResponse { data: SomeData; status: number; }
const handleResponse = ({ data, status }: ApiResponse) => { ... }
// Or inline if simple:
const handleResponse = ({ data, status }: { data: SomeData; status: number }) => { ... }
```

**Async/await return types:** annotate the surrounding function when inferred collapse to `any` is the root cause.
```tsx
// Before — TS7006 cascading from an inferred-any return:
async function fetchLead(id) { ... return data; }
// After:
async function fetchLead(id: string): Promise<Lead> { ... return data; }
```

**Type imports for non-circular type narrowing:** use `import type { ... }`.
```tsx
import type { LeadFilter } from "@/types/filters";
```
The `import type` form is erased at compile time and doesn't contribute to runtime circular dependencies. If a type import is still circular even with `import type`, inline the type locally instead.

**Generics for genuinely polymorphic helpers:**
```tsx
// Before:
function sortBy(items, key) { ... }
// After:
function sortBy<T, K extends keyof T>(items: T[], key: K): T[] { ... }
```

**Escape-hatch only as last resort.** Apply the Wave B escape-hatches policy (next step).

- [ ] **Step 2: Apply the escape-hatches policy when a proper type is genuinely unreasonable**

Per Spec 17 §3 Step 3 escape-hatches policy:

- **Default state.** `src/lib/types/escape-hatches.ts` is absent until the first entry is needed. The first Wave-B-or-Wave-C entry to require it creates the file.
- **File location: `src/lib/types/escape-hatches.ts`** (interim — per Spec 17 §2.1, Phase 4 will relocate to `src/shared/types/escape-hatches.ts` when `src/shared/` is created).
- **Each entry format:**

  ```ts
  // src/lib/types/escape-hatches.ts
  /**
   * Phase 2a strict-TS escape hatches.
   *
   * Each entry must:
   *  1. Have a `// TODO(phase-13):` comment (greppable marker for the phase-13 audit).
   *  2. Cite the call site (file:line) where the escape is consumed.
   *  3. Provide a one-line justification for why proper typing was unreasonable
   *     during phase 2a (do NOT pin a specific future phase as the owner — the
   *     TODO marker is enough).
   *  4. Use the `Untyped*` type-name prefix.
   *
   * Spec 17 §3 Step 3 escape-hatches policy.
   */

  // TODO(phase-13): replace with proper type once the upstream data contract is defined.
  // src/components/customers/SuggestedICPCards.tsx:142 — leadFilter parameter is shaped by
  // a backend response whose contract types haven't been written yet.
  export type UntypedLeadFilter = any;
  ```

- **TD-FE registration at the 5th entry.** When the file accumulates its 5th entry, the commit body that adds that 5th entry includes a `TD-FE-<n>` registration line (next number from `grep -oE 'TD-FE-[0-9]+' docs/TECH_DEBT.md | sort -V | tail -1` + 1; **as of plan-writing time the next number is TD-FE-9**). The TD-FE captures: which 5 sites used escape hatches, the pattern they share (if any), and the trigger.

  TD-FE format (append to `docs/TECH_DEBT.md`):

  ```markdown
  ## TD-FE-9 — Phase 2a escape-hatches threshold reached (5 entries)

  **Date logged:** <YYYY-MM-DD>
  **Origin:** Spec 17 Phase 2a (plans/17-frontend-phase-2a-strict-ts.md), Step 3/4.

  **Current state:**
  `src/lib/types/escape-hatches.ts` has accumulated 5 entries during Waves B/C:
    - UntypedLeadFilter (src/components/customers/SuggestedICPCards.tsx:142)
    - UntypedX (...)
    - ... (list each)

  **Pattern:** <one-line description — e.g., "backend response shapes consumed by FE before contracts are written">

  **Why deferred:**
  Spec 17 §2.4 posture rule 3 — out-of-scope refactor would touch >2 unrelated files.

  **Pull-forward trigger:**
  Phase 13's audit re-evaluates per master spec line 298.

  **Owner:** TBD.
  ```

- **Beyond 5 entries.** No additional TD-FE registrations. Entries past the 5th are logged in the file with the mandatory comment + prefix + justification only.

- **Materially high count (~15+).** No automatic trigger, but the implementer raises the pattern to the user as a judgment call (not a hard rule).

- [ ] **Step 3: Per-file (or per-batch) per-commit gate**

After each `[INDIV]` file's edits, or after each `[BATCH]` bundle's edits:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build
npx vitest run
```

Expected: both green. If Vitest fails, a type annotation introduced a runtime conflict (rare but possible if the annotation revealed a genuine bug masked by `any`) — apply Spec 17 §2.4 posture rule 4 (behavior unchanged). If the rewrite would change runtime behavior, revert and escape-hatch instead.

- [ ] **Step 4: Per-file (or per-batch) commit**

```bash
# Single file:
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/<path>
git commit -m "refactor(fe): type <filename>"

# Batched (≤3 errors per file, same area):
git add frontend/src/<file-1> frontend/src/<file-2> frontend/src/<file-3>
git commit -m "refactor(fe): type <area> (small files)"
```

(For the 5th escape-hatch entry, append the TD-FE registration to `docs/TECH_DEBT.md` in the same commit and reference it in the commit body.)

### Task 3-checkpoint — Wave B end-of-wave verification

**Files:** none (verification only).

- [ ] **Step 1: Error-count verification**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
node_modules/.bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c 'error TS' || echo 0
```

Expected: drop from post-Wave-A count by approximately Wave B's target (~83 at design time, ±15 tolerance).

**If drop < target − 15 (materially short):** unresolved cascades. Pause to investigate which TS7006 errors did not resolve and whether any newly surfaced (Wave B type-annotations can change inferred types at downstream sites — Spec 17 §2.3 makes type-level cascades explicitly in-scope).

**If drop > target + 15 (materially exceeding):** Wave B's annotations resolved Wave-C-or-cascade errors. Pause and re-categorize before Wave C. The remaining surface for Wave C may be smaller than the spec's ~36 estimate.

- [ ] **Step 2: Unit-test health**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vitest run
```

Expected: green. Wave B's annotations can change inferred types at consumer sites — catching test breaks here keeps Step 5's residual-fix surface clean.

- [ ] **Step 3: Re-probe and commit the post-Wave-B artifact (Wave C input)**

Same pattern as Task 2-checkpoint Step 3 — always re-probe between waves so Wave C's prep reads accurate per-file data. Wave B's annotations can resolve Wave-C-or-cascade errors (see "materially exceeding" branch of Step 1's verification); a fresh probe captures that.

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx tsx scripts/build-strict-probe.ts --date 2026-05-27-post-wave-b
```

This produces:
- `docs/audits/2026-05-27-post-wave-b-frontend-phase-2a-strict-probe.json`
- `docs/audits/2026-05-27-post-wave-b-frontend-phase-2a-strict-probe.txt`

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add docs/audits/2026-05-27-post-wave-b-frontend-phase-2a-strict-probe.json \
        docs/audits/2026-05-27-post-wave-b-frontend-phase-2a-strict-probe.txt
git commit -m "$(cat <<'EOF'
chore(audits): phase 2a post-wave-b re-baseline

Re-probe after Wave B's noImplicitAny annotations. JSON artifact is
the authoritative input for Wave C's per-file ordering and the
TS2307 sanity check (Task 4.prep Step 1).

Spec 17 §3 Step 3 wave-end checkpoint (extended by plan
synthesis-1 to add an explicit re-probe between waves).
EOF
)"
```

Verify shape:
```bash
python3 <<'PY'
import json
d = json.load(open("/projects/Brewra/brewra-gtm-intelligence/docs/audits/2026-05-27-post-wave-b-frontend-phase-2a-strict-probe.json"))
print("totalErrors:", d["totalErrors"])
print("errorsByCode:", d["errorsByCode"])
PY
```

Expected: `totalErrors` close to Wave C's design-time target (~36), with `errorsByCode` showing the Wave C codes (TS2345, TS2322, TS18046, TS18047, TS18048, TS2339, TS6196). Zero or near-zero TS7006 (Wave B's target). Zero TS6133/TS6192 (Wave A residue).

---

## Step 4 — Wave C: semantic stragglers (~36 errors)

Targets TS2345 (8), TS2322 (7), TS18046 (8), TS18047 (5), TS18048 (2), TS2339 (4), TS6196 (2). **Plus a re-verification** on the first commit that TS2307 residue is 0 (Step 1a should have eliminated all 15).

### Task 4.prep — Extract Wave C ordering + TS2307 sanity

**Files:** working notes only.

- [ ] **Step 1: Verify TS2307 residue is 0**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
node_modules/.bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep "error TS2307" | wc -l
```

Expected: 0. Step 1a's three batches should have eliminated all 15 TS2307 errors (the 15 dead shadcn primitive deletions).

**If TS2307 residue > 0:** apply Spec 17 §3 Step 4 remediation:
- Identify the surviving TS2307 file(s) (`tsc --noEmit -p tsconfig.app.json 2>&1 | grep "error TS2307"`).
- For each, either (a) complete the deletion in a fresh commit if the inbound was a stale reference now resolvable; (b) refactor the single inbound to remove the dep (Step 1a's default-(b) trivial-refactor path); or (c) register a `TD-FE-<n>` deferring the delete + add a minimal local shim under `src/types/` to suppress the TS2307 until the inbound is removed.
- Do NOT treat TS2307 as a Wave C semantic error — the underlying cause is a dead-import, not a type-narrowing problem; treating it under Wave C would obscure the diagnosis.

Each TS2307 residue fix lands as its own commit before proceeding to Wave C semantic fixes:
```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add <fix-files>
git commit -m "chore(fe): resolve TS2307 residue for <basename> (Step 1a follow-up)"
```

- [ ] **Step 2: Generate Wave C ordering**

Reads from the post-Wave-B artifact committed by Task 3-checkpoint Step 3 (not the Step 0 probe).

```bash
python3 <<'PY' > /tmp/phase-2a-notes/wave-c-order.txt
import json
d = json.load(open("/projects/Brewra/brewra-gtm-intelligence/docs/audits/2026-05-27-post-wave-b-frontend-phase-2a-strict-probe.json"))

WAVE_C_CODES = {"TS2345", "TS2322", "TS18046", "TS18047", "TS18048", "TS2339", "TS6196"}
wave_c_per_file = {}
for path, diags in d["detailsByFile"].items():
    by_code = {}
    for diag in diags:
        if diag["code"] in WAVE_C_CODES:
            by_code[diag["code"]] = by_code.get(diag["code"], 0) + 1
    if by_code:
        wave_c_per_file[path] = by_code

print(f"# Wave C files: {len(wave_c_per_file)}; total errors: {sum(sum(v.values()) for v in wave_c_per_file.values())}")
print()
print("# By code:")
agg = {}
for path, by_code in wave_c_per_file.items():
    for c, n in by_code.items():
        agg[c] = agg.get(c, 0) + n
for code in sorted(agg.keys()):
    print(f"  {code}: {agg[code]}")
print()
print("# File ordering (ascending total, alpha tiebreak):")
ordered = sorted(wave_c_per_file.items(), key=lambda kv: (sum(kv[1].values()), kv[0]))
for path, by_code in ordered:
    total = sum(by_code.values())
    breakdown = ", ".join(f"{c}×{n}" for c, n in sorted(by_code.items()))
    print(f"  {total:4d}  {path}  [{breakdown}]")
PY
wc -l /tmp/phase-2a-notes/wave-c-order.txt
```

Expected: ascending list of ~10–20 files (most Wave-C-affected files have only 1–2 errors; semantic clusters are rare).

### Task 4 — Process each Wave C file in order

**Files:** variable.

- [ ] **Step 1: Per-file fix loop**

For each file in `/tmp/phase-2a-notes/wave-c-order.txt`, apply Wave C fix rules per Spec 17 §3 Step 4:

**`possibly null` / `possibly undefined` (TS18047, TS18048):**
```tsx
// Before:
const lead = leads.find(l => l.id === id);
return lead.name;  // TS18047 (possibly undefined)
// After (preferred — guard):
const lead = leads.find(l => l.id === id);
if (lead == null) return null;  // or appropriate fallback
return lead.name;
// Alternative (only for demonstrably-non-null values):
const lead = leads.find(l => l.id === id)!;
return lead.name;
```
**The common `useRef<T>(null)` pattern:** guard with `if (ref.current != null)` before access; use `.current!` only when the component lifecycle guarantees non-null at the access site (e.g., inside an `onClick` that's only attached after the ref-setting render). When in doubt, guard rather than assert.

**`unknown` type access (TS18046):** narrow with `typeof`, `in`, or a user-defined type guard.
```tsx
// Before:
function handle(err: unknown) {
  console.log(err.message);  // TS18046
}
// After:
function handle(err: unknown) {
  if (err instanceof Error) console.log(err.message);
  else console.log(String(err));
}
// Or with a type guard:
function isErrorWithMessage(e: unknown): e is { message: string } {
  return typeof e === "object" && e != null && "message" in e && typeof (e as { message: unknown }).message === "string";
}
```
**Do not cast `unknown` to `any` to silence TS18046.** That's an escape-hatch entry if the value is genuinely opaque — apply the escape-hatches policy.

**Property does not exist (TS2339):** the underlying type is wrong. Broaden, narrow, or add the property to the type definition.
```tsx
// Before — TS2339 on `customField`:
interface User { name: string; }
const u: User = ...;
u.customField;
// After (if `customField` should be part of the type):
interface User { name: string; customField?: string; }
// After (if `u` is actually a wider type at the assignment site):
interface ExtendedUser extends User { customField: string; }
```

**Argument / type assignment mismatches (TS2345, TS2322):** fix the type on the assigning side first; only adjust the callee signature if the callee is genuinely too narrow.

**`Class declared but never used` (TS6196):** treat as Wave A residue — delete or `_` prefix. If it's a type-import alias, prune.

- [ ] **Step 2: Escape-hatches policy applies cumulatively**

Per Spec 17 §3 Step 4: the escape-hatches count is *global* to Phase 2a. Entries added during Wave B count toward the 5-entry threshold during Wave C. If the 5th entry lands in Wave C, the TD-FE-9 registration described in Task 3 Step 2 happens here instead.

- [ ] **Step 3: Per-file per-commit gate**

After each file's edits:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vite build
npx vitest run
```

Expected: green. Wave C narrowing fixes can change inferred types in subtle ways; if a test fails it usually means the narrowing was wrong (e.g., a guard that returns the wrong fallback value).

- [ ] **Step 4: Per-file commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/<path>
git commit -m "refactor(fe): tighten types in <filename>"
```

(The commit body is optional unless the fix involved a non-obvious choice — e.g., adding a property to a widely-used type, or introducing a user-defined type guard.)

### Task 4-checkpoint — Wave C end-of-wave verification

**Files:** none (verification only).

- [ ] **Step 1: Error-count verification — target is 0**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
node_modules/.bin/tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c 'error TS' || echo 0
```

Expected: **0**. This is the Wave C target.

If non-zero, the residuals are within Wave C's grain — fix them as additional per-file commits before proceeding to Step 5. If the residuals are unexpectedly outside Wave C's error codes (e.g., a TS7006 surfaced from a Wave B annotation cascade), fix in the appropriate Wave's grain (a stray TS7006 lands as a Wave B-style commit; a stray TS6133 from a cascade lands as a Wave A-style commit).

- [ ] **Step 2: Unit-test health**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx vitest run
```

Expected: green.

---

## Step 5 — Verify done-when and write scorecard

### Task 5.1 — Run the done-when verification checklist

**Files:** none if checklist passes clean (residuals get their own commits if needed).

- [ ] **Step 1: Run each done-when check from Spec 17 §4**

Check 1 — `npm run typecheck` green:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run typecheck
echo "exit: $?"
```
Expected: prints no errors, `exit: 0`. (After Step 1b's script fix, this invokes `tsc --noEmit -p tsconfig.app.json`.)

Check 2 — escape-hatches file shape:
```bash
test -f /projects/Brewra/brewra-gtm-intelligence/frontend/src/lib/types/escape-hatches.ts && {
  echo "FILE EXISTS — verify format:"
  # Every entry must have the TODO(phase-13) comment and the Untyped* prefix:
  grep -c "// TODO(phase-13):" /projects/Brewra/brewra-gtm-intelligence/frontend/src/lib/types/escape-hatches.ts
  grep -c "^export type Untyped" /projects/Brewra/brewra-gtm-intelligence/frontend/src/lib/types/escape-hatches.ts
  echo "(counts should be equal)"
} || echo "FILE ABSENT — escape-hatches policy not triggered (acceptable)"
```
If the file exists, the TODO comment count must equal the `export type Untyped*` count (one comment per entry).

Check 3 — inline-any non-regression:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
rg -n ':\s*any\b|as\s+any\b|<any>' -g '*.ts' -g '*.tsx' src/ | wc -l
```
Expected: ≤238 (the design-time baseline). The escape-hatches file uses `= any` syntax which is *not* matched by this regex, so the file's entries don't inflate the count.

If the count exceeds 238: a Wave B or Wave C fix introduced a new `any`. Identify and fix in a residual commit. Do not proceed to scorecard until the count is ≤238.

Check 4 — `@ts-*` suppression non-regression:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
rg -n '@ts-(ignore|expect-error|nocheck)' -g '*.ts' -g '*.tsx' src/ | wc -l
```
Expected: ≤5 (the design-time baseline). Spec 17 §2.4 posture rule 7 prohibits adding new `@ts-*` suppressions during Phase 2a.

If the count exceeds 5: a fix introduced a new suppression. Remove it (replace with an escape-hatches entry, or fix the underlying type issue properly).

Check 5 — full preflight:
```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```
Expected: all five checks green (`typecheck → vite build → test:e2e → test → knip --strict --no-progress`).

If any check fails, the residual-fix commit handles it.

- [ ] **Step 2: Residual-fix commit (only if any check fails)**

If Step 1 surfaced residuals, fix each in the appropriate wave's grain. Bundle related fixes into a single commit if mechanically minor; split into multiple commits if structurally distinct.

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add <residual-fix-files>
git commit -m "fix(fe): residual phase 2a verification fixes"
```

Re-run the Step 1 checklist after each residual-fix commit. Loop until all checks pass clean.

### Task 5.2 — Write the scorecard

**Files:**
- Create: `docs/audits/<YYYY-MM-DD>-frontend-phase-2a-strict-ts.md` (`<YYYY-MM-DD>` = merge date)

The scorecard is always written, even if Task 5.1 passed clean on first try. It's the post-hoc record of what Phase 2a accomplished.

- [ ] **Step 1: Choose the scorecard's date suffix**

```bash
date -u +%Y-%m-%d
```

Use today's UTC date for the filename. If Phase 2a execution spans multiple days, the filename should reflect the *merge* date — verify before writing.

- [ ] **Step 2: Compose the scorecard**

Write `docs/audits/<YYYY-MM-DD>-frontend-phase-2a-strict-ts.md` with this structure:

```markdown
# Frontend Phase 2a — Strict TS Turn-On Scorecard

**Phase:** Spec 17 / plans/17-frontend-phase-2a-strict-ts.md
**Branch:** `phase-2a-strict-ts` (merged <YYYY-MM-DD>)
**Spec baseline:** Spec 17 §1.3 design-time figures (461 errors at 2026-05-27)
**Step 0 re-baseline:** `docs/audits/2026-05-27-frontend-phase-2a-strict-probe.json`

## 1. Error count

| | Step 0 re-baseline | Phase end |
|---|---:|---:|
| Total `tsc --noEmit -p tsconfig.app.json` errors | <N from Step 0> | 0 |

Per-code delta and per-area delta cite `docs/audits/2026-05-27-frontend-phase-2a-strict-probe.json` (committed Step 0) — the scorecard does not duplicate the table.

Delta vs spec design-time:
- Spec design-time total: 461
- Step 0 re-baseline total: <actual>
- Delta: <signed integer> (<explanation if material>)

## 2. Files deleted

15 dead shadcn primitives (Step 1a — three batched commits):
- Batch i (commit `<sha>`): aspect-ratio.tsx, calendar.tsx, carousel.tsx, context-menu.tsx, form.tsx
- Batch ii (commit `<sha>`): hover-card.tsx, input-otp.tsx, menubar.tsx, navigation-menu.tsx, radio-group.tsx
- Batch iii (commit `<sha>`): resizable.tsx, slider.tsx, switch.tsx, toggle.tsx, toggle-group.tsx

LOC delta from deletions: <git diff stat for Step 1a's 3 commits>

(If any file was deferred per surprise-inbound procedure, list it here with its `TD-FE-<n>` reference.)

## 3. Escape hatches

Location: `src/lib/types/escape-hatches.ts` (interim — Spec 17 §2.1; relocates to `src/shared/types/escape-hatches.ts` in Phase 4)

- **If the file exists:** list each entry with its `Untyped*` name, call-site reference, and one-line justification. If the 5th-entry TD-FE landed during the phase, cite it here (TD-FE-9).
- **If the file is absent:** "Phase 2a completed without requiring escape hatches."

If the file exists, a separate `TD-FE-<n>` is registered for the relocation deferral:
- **TD-FE-<n+1>** — Escape-hatch file at interim path `src/lib/types/escape-hatches.ts`; relocate to `src/shared/types/escape-hatches.ts` when Phase 4 creates `src/shared/`.

## 4. TD-FE entries created during the phase

(List each `TD-FE-<n>` and one-line summary. If none, "No new TD-FE entries.")

## 5. Commit summary

<one-paragraph narrative: how the phase progressed wave-by-wave, any notable cascades or surprises>

```
git log --oneline master..HEAD
```
(Output of the command above, verbatim.)

## 6. Diff size

Aggregate:
```
git diff --stat master..HEAD | tail -1
```

Per-wave breakdown:
- Step 0 (probe helper + artifacts): <additions/deletions>
- Step 1a (3 shadcn batches): <additions/deletions>
- Step 1b (flag flip + script fix + root cleanup): <additions/deletions>
- Wave A (noUnused* sweep, ~6 commits): <additions/deletions>
- Wave B (noImplicitAny annotations): <additions/deletions>
- Wave C (semantic stragglers): <additions/deletions>
- Step 5.1 residual fixes + Step 5.2 scorecard: <additions/deletions>

The 15 dead-shadcn deletions are called out separately so the reviewable-code surface is visible without arithmetic. No target, no gate — just reporting for impl-review's context per Spec 17 §3 Step 5.

## 7. Verification

All Step 5.1 done-when checks pass:
- [x] `npm run typecheck` → 0 errors
- [x] escape-hatches.ts shape (or absent)
- [x] inline `any` count ≤238
- [x] `@ts-*` suppression count ≤5
- [x] `npm run preflight` green
```

Fill in the placeholders by running the commands they describe. The `git log --oneline master..HEAD` and `git diff --stat master..HEAD | tail -1` outputs are captured verbatim and pasted into the scorecard.

For the per-wave diff breakdown, use `git diff --stat <baseline>..<wave-end>` between consecutive wave-end commits. The baseline for Step 0 is `master`; for Step 1a is post-Step-0; for Step 1b is post-Step-1a; for Wave A is post-Step-1b; etc. Compute each with:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
# Identify wave-end commit SHAs by subject:
git log --oneline master..HEAD --pretty='%h %s' | grep -E "phase 2a strict ts re-baseline|enable strict typescript flags|^\w+ refactor\(fe\): remove unused symbols in pages/MarketResearch.tsx|^\w+ refactor\(fe\): tighten types"
# Then per-wave:
git diff --stat <baseline-sha>..<wave-end-sha> | tail -1
```

- [ ] **Step 3: Run preflight one more time and commit the scorecard**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: green (the scorecard is a markdown file in `docs/`; nothing in the build/test path).

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add docs/audits/<YYYY-MM-DD>-frontend-phase-2a-strict-ts.md
git commit -m "$(cat <<'EOF'
docs(audits): phase 2a strict ts scorecard

End-of-phase scorecard summarizing the strict-TS turn-on:
- Total errors: <N> → 0
- 15 dead shadcn primitives deleted (3 batched commits via 6-check kit)
- Escape hatches: <count> (or "none created")
- Inline any count: <N_pre> → <N_post> (≤238 design-time baseline)
- @ts-* suppression count: <N_pre> → <N_post> (≤5 design-time baseline)
- npm run preflight: green at merge

Spec 17 §3 Step 5; §4 done-when checklist satisfied.
EOF
)"
```

---

## Post-merge handling (controller-driven, not authored by this plan)

Per Spec 14 §5.6, the controller agent runs `npm run preflight` from `frontend/` immediately before the user-approved merge step:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
# Green → user-approved merge:
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master
git merge phase-2a-strict-ts --no-ff
git push origin master
git branch -d phase-2a-strict-ts        # short-lived branch per Spec 14 §5.1
```

Per Spec 14 §5.5, `synthesize-impl-review` flips Spec 14 §4's Phase 2a status row to `done` with the merge date in a separate commit on master. This plan does NOT author that change.

---

## Companion documents

- `specs/17-frontend-phase-2a-strict-ts-design.md` — Phase 2a spec (round 6, plan-paired)
- `specs/14-frontend-refactoring-master-plan-design.md` — master plan (§4 Phase 2a row; §5 process; §6 done-when)
- `specs/15-frontend-phase-0-inventory-and-safety-net-design.md` — Phase 0 spec (the safety net Phase 2a relies on)
- `specs/16-frontend-phase-1-loc-reduction-design.md` — Phase 1 spec (the §2.2 ui/-lock context; the 6-check-kit template Step 1a reuses; the TD-FE numbering convention)
- `plans/16-frontend-phase-1-loc-reduction.md` — Phase 1 plan (format reference)
- `docs/audits/2026-05-27-frontend-loc-pass-1.md` — Phase 1 scorecard (the 67,469-LOC / 156-file post-Phase-1 anchor; the 15 dead-shadcn primitives identified)
- `docs/audits/2026-05-27-frontend-phase-2a-strict-probe.json` + `.txt` — Step 0 re-baseline artifacts (committed in Task 1)
- `docs/TECH_DEBT.md` — TD-FE register (gains TD-FE-9 if escape-hatches reach 5 entries; gains a relocation TD-FE if `src/lib/types/escape-hatches.ts` exists at phase-end)
- Backend Spec 5 / Spec 12 — adjacent precedent for category-wave methodology in foundation phases
