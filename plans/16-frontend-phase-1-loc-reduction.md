# Phase 1 — Frontend LOC Reduction (Pass #1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute Spec 16's seven-step audit-execute pass across `frontend/src/`. End state: knip config has zero hints, `knip --strict --no-progress` is wired into `npm run preflight` as a merge gate, every knip-flagged dead file from the original baseline plus the Step 3 re-baseline has a documented verdict (`remove` / `keep` / `defer-TD-FE-<n>`), Lovable artifacts are gone, unresolved imports fixed, duplicate default export trimmed, and any byte-identical inline-data-munging blocks (≥3 occurrences, self-contained) extracted to helpers in `src/lib/`. No behavior changes; per-commit Playwright + visual regression at `maxDiffPixelRatio 0.01`.

**Architecture:** Single-branch, audit-execute methodology mirrored from backend Phase L. Seven steps inside one branch (`phase-1-loc-reduction`), each shipping as per-file commits in the order defined by Spec 16 §3. Two knip runs frame the work: Step 1 refines the config and produces an authoritative re-baseline; Step 3 re-runs against the post-mechanical-wins tree to feed the manual investigation pass. The plan's only structural choices over the spec are: (a) **custom TypeScript compiler API script** for the Step 6a byte-identical block scan (chosen over `jscpd` for precise control over the spec's strict block definition — same nesting level, no control-flow boundary, no JSX return, self-containment requirement), and (b) **`scripts/*.ts` to entry + drop `scripts/**/*.{ts,sh}` from project** for the knip Step 1 item 3 hint (the four TS scripts in `frontend/scripts/` are standalone entry points run via `tsx`, not imports).

**Tech Stack:** Node 22 + npm 10 + TypeScript 5.5 + Vite 5 + Playwright 1.59.1 + Vitest 1.x + knip 5.x + tsx 4.x (run TS scripts). New dev-only dep added in Step 6a: none — the inline-block scan script uses the `typescript` package already present as a transitive dep (re-exported from `node_modules/typescript`). If absent at run time, the script's first step verifies and adds it as a direct devDep.

**Spec:** `specs/16-frontend-phase-1-loc-reduction-design.md` (round 3 clean, plan-ready).

**Branch:** `phase-1-loc-reduction` off `master` (current HEAD at plan-writing time: `5099110 docs(reviews): add Spec 16 reviews + syntheses (rounds 1-3)`).

**Baseline (measured at plan-writing time, 2026-05-27):**
- 76,052 LOC across 158 `.ts`/`.tsx` files under `frontend/src/`
- Knip findings (per `docs/audits/2026-05-26-frontend-deadcode-knip.json`): 32 dead files · 20 unused deps · 1 unused devDep · 62 unused exports · 16 unused exported types · 1 duplicate export (`SuggestedICPCards|default`) · 2 unresolved imports
- 8 knip configuration hints
- `frontend/scripts/preflight.sh` and `npm run preflight` (`typecheck → vite build → test:e2e → test`) both green on master
- Working tree: 2 commits ahead of `origin/master`; one untracked file (`docs/parallel-sandbox-development.md`) — see Task 0a for handling

**Target:** No LOC delta target (per Spec 16 §1.1 — "Final LOC reflects what was safely removable without behavior change — no hard target"). The phase succeeds when Spec 16 §5 done-when checklist passes; the LOC delta is whatever follows safely from the audit.

**Date convention for audit artifacts:** Use `2026-05-27` for all audit artifacts produced during this phase (Step 1 refined knip, Step 3 mid-phase knip, Step 6a inline-block scan, Step 7 final scorecard). If Phase 1 execution spans multiple days, the Step 7 task explicitly re-dates the final scorecard to the merge date via a single `git mv` before the final commit; the other artifacts stay at `2026-05-27` because they were produced on that date.

**Commit-message convention:** `type(scope): <description>` per CLAUDE.md. Scope is `fe` for frontend source/config edits, `audit` for `docs/audits/` writes, `docs` for `docs/TECH_DEBT.md` updates, `chore` for tooling installs. **No `[N/M]` numbering** — Phase 1 is bounded by knip output, not a fixed task count. **No `Co-Authored-By` footer** (recorded user preference). Step 4 removal commits ship the 6-line structured check-kit block in the body per Spec 16 §3 Step 4.

**Greenness invariant:** Every commit ends with `cd frontend && npm run preflight` clean. No "fix in next commit" exceptions. If preflight goes red during a task: do not commit. Revert the working-tree change (`git restore .` or `git checkout -- <file>` for tracked files; `git clean -f <newfile>` for new files), diagnose root cause, and either fix the approach or apply Spec 16 §6 abort-and-revert protocol (revert the offending change, log discovery as `TD-FE-<n>`).

**Post-commit rollback:** If preflight regression surfaces *after* a commit (e.g., during a later task's verification), use `git reset --hard HEAD~N` to revert the last N commits, or `git reset --hard master` to scrap the entire Phase 1 branch. Diagnose root cause before re-attempting — never "fix forward" past a committed regression.

**Abort criterion:** If any single task's preflight cannot be made green within 3 distinct fix attempts (not retries of the same approach), halt and surface to operator. Spec 16 §6 applies: revert the offending change, log as `TD-FE-<n>`, decide go/no-go.

**Per-task isolation:** Steps 2, 4, 5, and 6 are per-file (or per-pattern) commit loops where one task's failure does not abort subsequent tasks. Steps 1, 3, and 7 are single-commit gates that block downstream work if they fail. The order within Step 2 matters for Step 2.5 (deps removal) because `vite build` is the regression detector — if it fails, the per-dep diff in the single commit identifies the culprit.

**TD-FE numbering:** Sequential from `max(existing TD-FE-* in docs/TECH_DEBT.md) + 1`. As of 2026-05-27, zero `TD-FE-*` entries exist (`docs/TECH_DEBT.md` contains only `TD-004`, `TD-005`, `TD-010`), so Phase 1's first deferral is `TD-FE-1`. The executor reads the current max immediately before each deferral commit (`grep -oE 'TD-FE-[0-9]+' docs/TECH_DEBT.md | sort -V | tail -1`).

---

## File Structure

**Created:**
- `docs/audits/2026-05-27-frontend-deadcode-knip-refined.json` + `.txt` — Step 1 re-baseline (authoritative input for Steps 2–6)
- `docs/audits/2026-05-27-frontend-deadcode-knip-mid-phase.json` + `.txt` — Step 3 re-baseline (authoritative input for Step 4)
- `docs/audits/2026-05-27-frontend-inline-block-scan.json` — Step 6a scan output (may be empty `{ "groups": [] }`)
- `docs/audits/2026-05-27-frontend-loc-pass-1.md` — Step 7 final scorecard (re-dated to merge date if phase spans days)
- `frontend/scripts/scan-inline-blocks.ts` — custom TypeScript compiler API script implementing the Spec 16 §3 Step 6a block definition
- `frontend/src/lib/<helper>.ts` — zero or more helper modules extracted in Step 6b (count and names depend on Step 6a output)

**Modified:**
- `frontend/knip.json` — resolve 8 config hints (Step 1)
- `frontend/vite.config.ts` — remove `lovable-tagger` import + plugin (Step 2.1)
- `frontend/package.json` — remove `lovable-tagger` from devDependencies (Step 2.1), remove 20 unused deps + 1 unused devDep (Step 2.5), append `knip --strict --no-progress` to `preflight` script (Step 7.2)
- `frontend/package-lock.json` — regenerated by Steps 2.1, 2.5
- `frontend/README.md` — remove Lovable boilerplate (Step 2.1), update preflight-chain comment to add `→ knip --strict` (Step 7.2)
- `frontend/src/App.tsx` — remove unresolved `./pages/AgentHub` import on line 21 (Step 2.3)
- `frontend/src/pages/MarketResearch.tsx` — remove unresolved `@/components/market-research/MarketRankings` import on line 58 (Step 2.4)
- `frontend/src/components/customers/SuggestedICPCards.tsx` — remove unused `export default SuggestedICPCards` at line 2280 (Step 2.7)
- Variable additional source files modified by Steps 4 (dead-file removals beyond the obvious targets), 5 (dead-export trims), 6b (inline-block call-site rewrites)
- `docs/TECH_DEBT.md` — append `TD-FE-<n>` entries incrementally as deferrals are decided in Steps 4 and 5
- `specs/14-frontend-refactoring-master-plan-design.md` — flip §4 Phase 1 status row to `done` at merge time (Step 7.3)

**Deleted:**
- `frontend/src/pages/_restore_test.txt` (Step 2.2)
- `frontend/src/components/market-research/LeadStream.tsx` (empty vestige, 0 LOC; Step 2.6)
- `frontend/src/components/customers/ICPSummaryOpportunity.tsx` (6,925 LOC monster, knip-confirmed dead; Step 4)
- Variable additional dead files from Steps 4 (per knip Step 3 re-baseline)

---

## Pre-flight (no commit)

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
- HEAD: `5099110 docs(reviews): add Spec 16 reviews + syntheses (rounds 1-3)`
- `git status` shows one untracked file `docs/parallel-sandbox-development.md` and (possibly) "ahead 2" — both expected per plan-writing baseline

If branch is not `master` or HEAD is not at `5099110` (or a later commit on master that doesn't conflict with Phase 1 scope), STOP — verify whether the baseline drifted between plan-write and execution. Re-read Spec 16 §1.3 starting state.

- [ ] **Step 2: Handle the untracked file (operator decision)**

```bash
ls docs/parallel-sandbox-development.md 2>&1
```

If present: this is a working note unrelated to Phase 1. Operator choice:
- (a) Leave untracked — `git status` will show it for the duration of Phase 1; harmless.
- (b) Move it out of the working tree: `mv docs/parallel-sandbox-development.md /tmp/` (preserved out-of-tree; can be restored after merge).

Recommended: (a). The file is in `docs/`, not `frontend/`, and won't interfere with any Phase 1 verification.

- [ ] **Step 3: Push the 2 unpushed commits to origin/master**

```bash
git status -sb
```

If the first line reads `## master...origin/master [ahead 2]` (or any non-zero "ahead"), push first:

```bash
git push origin master
git status -sb
```

Expected after push: `## master...origin/master` (no ahead/behind). This ensures the Phase 1 branch's base is shared with origin so the impl-review subagent can fetch it.

- [ ] **Step 4: Create and check out the Phase 1 branch**

```bash
git checkout -b phase-1-loc-reduction
git branch --show-current
```

Expected: `phase-1-loc-reduction`.

### Task 0b — Confirm baseline preflight green

**Files:** none (verification only).

- [ ] **Step 1: Run preflight on the unmodified branch**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: all four checks green (`typecheck`, `vite build`, `test:e2e`, `test`). Runtime ~3–8 minutes depending on hardware.

If preflight is red on the unmodified branch: STOP — the baseline already fails. Diagnose before any Phase 1 work; the Greenness invariant requires preflight green at every commit, which means it must be green at the *zeroth* commit.

- [ ] **Step 2: Record the LOC and file-count baseline**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
find src -type f \( -name '*.ts' -o -name '*.tsx' \) | wc -l    # expected: 158
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec cat {} + | wc -l   # expected: 76052
```

If file count or LOC differs significantly from the Spec 16 §1.3 numbers (158 / 76,052), the working surface has drifted since spec-write. Document in the Step 7 scorecard's "Delta vs spec baseline" line; proceed.

- [ ] **Step 3: Sanity-check that the existing knip baseline is parseable**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
python3 -c "import json; d=json.load(open('docs/audits/2026-05-26-frontend-deadcode-knip.json')); print('keys:', sorted(d.keys())); print('files len:', len(d.get('files', []))); print('issues len:', len(d.get('issues', [])))"
```

Expected: prints `keys:` listing including `files` and `issues`. If parse fails, the Step 1 re-baseline still proceeds (it produces its own JSON); but if the existing baseline is corrupt, flag in the Step 7 scorecard.

- [ ] **Step 4: Verify Phase 0a's baseline has a Tier 1 per-area table (needed for scorecard §1 in Task 7.1)**

The Step 7 scorecard's per-area LOC delta table (Task 7.1 Step 2) reads the "before" column from Phase 0a's audit. Phase 0a's `build-audit-scorecard.ts` script was supposed to produce a Tier 1 table with one row per feature area. Confirm now so a missing table doesn't block Task 7.1 hours later.

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -A3 "Tier 1 — Feature-area summary" docs/audits/2026-05-26-frontend-baseline.md | head -10
```

Expected: prints the Tier 1 heading + the table header row `| Area | Files | Total LOC | ...`. If the heading exists and the table follows, scorecard §1 has its "before" data — proceed.

If the heading is missing or the table is empty: the fallback is to check out Phase 0a's baseline commit and re-run Task 7.1 Step 2's per-area script against that tree to reconstruct the "before" column.

```bash
# Fallback (run only if the grep above returns no Tier 1 heading):
git log --diff-filter=A --format='%H %s' -- docs/audits/2026-05-26-frontend-baseline.md | head -1
# Note the SHA. Task 7.1 Step 2 has a documented fallback that checks out this SHA, runs the per-area aggregation script, then returns to phase-1-loc-reduction.
```

Record the verification result (pass / fail-with-fallback-SHA) in your working notes for Task 7.1.

---

## Step 1 — Knip Config Refinement

Resolves the 8 config hints in `frontend/knip.json` and produces the authoritative re-baseline. Ships as one commit (config edit + re-baseline artifacts in a single commit to keep the before/after diff atomic).

### Task 1 — Refine `frontend/knip.json` and capture the re-baseline

**Files:**
- Modify: `frontend/knip.json`
- Create: `docs/audits/2026-05-27-frontend-deadcode-knip-refined.json`
- Create: `docs/audits/2026-05-27-frontend-deadcode-knip-refined.txt`

- [ ] **Step 1: Verify zero `React.lazy()` / `lazy()` route loaders exist (re-confirm round 2 review finding)**

Per Spec 16 §3 Step 1 item 4 and §1.3 round-2 verification, the codebase had zero matches at 2026-05-27 plan-write time.

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
rg -n "React\.lazy\(" src/ e2e/
rg -n "\blazy\(" src/ e2e/
```

Expected: both ripgreps return no output (exit code 1, "no matches").

If matches appear (i.e., new lazy-loaded routes landed since spec round 2):
- Note the file:line of each match in the Step 7 scorecard's "Knip config drift" note
- Add an `entry` pattern in Step 2 for the file(s) containing the `lazy()` import target so knip can trace through them

If no matches (expected case), proceed.

- [ ] **Step 2: Replace `frontend/knip.json` with the refined config**

Overwrite the file with this exact content:

```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": [
    "e2e/**/*.spec.ts",
    "scripts/*.ts",
    "src/**/__tests__/**/*.test.{ts,tsx}",
    "src/**/*.{test,spec}.{ts,tsx}"
  ],
  "project": [
    "src/**/*.{ts,tsx}",
    "e2e/**/*.ts"
  ]
}
```

Resolution of all 8 hints:
1. **`dev-dist/**` / `node_modules/**` / `dist/**` removed from `ignore`** — already in `.gitignore`; knip honors `.gitignore` by default.
2. **`src/main.tsx`, `vite.config.ts`, `playwright.config.ts` removed from `entry`** — knip auto-detects these (Vite/Playwright plugins).
3. **`scripts/**/*.{ts,sh}` removed from `project`; `scripts/*.ts` added to `entry`** — per spec §3 Step 1 item 3 path-pick: the four TS scripts in `frontend/scripts/` (`capture-bundle-baseline.ts`, `build-audit-scorecard.ts`, plus this phase's new `scan-inline-blocks.ts` in Step 6a, plus Phase 0a's `measure-baselines.sh` which knip can't analyze anyway) are standalone entry points. The `.sh` files exit the knip surface.
4. **(Verification only, Step 1 item 4 above)** — no lazy loaders, so no entry pattern added.
5. **`e2e/**/*.spec.ts` retained in `entry`** — explicit per spec §3 Step 1 item 5.
6. **Vitest test files added to `entry`** — `src/**/__tests__/**/*.test.{ts,tsx}` and `src/**/*.{test,spec}.{ts,tsx}` per spec §3 Step 1 item 6. Phase 0b characterization tests import `rateLimitManager` etc. via dynamic `import()`; this prevents knip flagging test-only exports as unused.

- [ ] **Step 3: Run knip in text and JSON reporters against the refined config**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx knip --no-progress > ../docs/audits/2026-05-27-frontend-deadcode-knip-refined.txt 2>&1 || true
npx knip --reporter json --no-progress > ../docs/audits/2026-05-27-frontend-deadcode-knip-refined.json 2>/dev/null || true
```

The `|| true` is intentional — knip exits non-zero on findings, which is the normal case. The output files are the deliverable.

- [ ] **Step 4: Verify zero configuration hints**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -c "Configuration hint" docs/audits/2026-05-27-frontend-deadcode-knip-refined.txt || echo "0 hints"
```

Expected: prints `0 hints` (the grep finds nothing).

If hints remain: the refined config didn't resolve all 8. Read the text output's "Configuration hints" section, adjust `frontend/knip.json`, re-run Steps 3–4. Do NOT proceed to Step 5 until hint count is 0 — Spec 16 §5 done-when item 3 requires this.

- [ ] **Step 5: Verify the JSON shape is parseable**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
python3 -c "
import json
d = json.load(open('docs/audits/2026-05-27-frontend-deadcode-knip-refined.json'))
print('keys:', sorted(d.keys()))
print('files (dead):', len(d.get('files', [])))
print('issues:', len(d.get('issues', [])))
"
```

Expected: prints the same key shape as Task 0b Step 3. The dead-file count may have *increased* (test-entry additions can newly classify some non-test exports as unused if a test was previously their only consumer) or *decreased* (if test-entry additions saved them) — either is fine. Phase 1 works against this refined count.

- [ ] **Step 6: Run preflight**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: green (Step 1 edits only `frontend/knip.json` and creates artifact files; nothing in the build/test path).

- [ ] **Step 7: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/knip.json docs/audits/2026-05-27-frontend-deadcode-knip-refined.json docs/audits/2026-05-27-frontend-deadcode-knip-refined.txt
git commit -m "$(cat <<'EOF'
chore(fe): refine knip.json (resolve 8 config hints) + capture re-baseline

Resolves all 8 configuration hints flagged by knip:
- Drop dev-dist/**, node_modules/**, dist/** from ignore (already in .gitignore)
- Drop redundant entry patterns for src/main.tsx, vite.config.ts, playwright.config.ts (knip auto-detects)
- Replace scripts/**/*.{ts,sh} project pattern with scripts/*.ts entry (the TS scripts are standalone entry points; .sh files exit the knip surface)
- Add Vitest test files to entry so test-only imports of rateLimitManager etc. are not flagged unused

Re-baseline committed alongside as the authoritative input for Steps 2-6.
Spec 16 §3 Step 1.
EOF
)"
```

---

## Step 2 — Mechanical Wins (per-file commits)

Seven tasks, each its own commit, in the order defined by Spec 16 §3 Step 2. Preflight green between every commit.

### Task 2.1 — Remove `lovable-tagger` and Lovable README boilerplate

**Files:**
- Modify: `frontend/vite.config.ts` (drop import on line 4, drop `componentTagger()` from plugins)
- Modify: `frontend/package.json` (drop `lovable-tagger` line 96)
- Modify: `frontend/package-lock.json` (regenerated)
- Modify: `frontend/README.md` (drop Lovable boilerplate)

Single conceptual change spanning 2–3 files; ships as one commit per Spec 16 §3 Step 2 item 1.

- [ ] **Step 1: Inspect current `vite.config.ts` usage**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -n "lovable-tagger\|componentTagger" vite.config.ts
```

Expected: 2 matches — the `import { componentTagger } from "lovable-tagger";` line and a `componentTagger()` plugin call (typically inside a `mode === "development"` conditional).

- [ ] **Step 2: Edit `frontend/vite.config.ts`**

Remove the `import { componentTagger } from "lovable-tagger";` line entirely.

Remove the `componentTagger()` invocation from the `plugins:` array. If it sits inside a conditional like `...(mode === 'development' ? [componentTagger()] : [])` then remove the entire conditional expression from the array. If the conditional becomes an empty `...[]` spread, remove the spread as well.

After editing, verify zero remaining references:

```bash
grep -n "lovable-tagger\|componentTagger" vite.config.ts
```

Expected: no output.

- [ ] **Step 3: Remove `lovable-tagger` from `frontend/package.json`**

Edit `frontend/package.json`: delete the line `"lovable-tagger": "^1.1.7",` from `devDependencies`. Take care not to leave a trailing comma on the previous line if `lovable-tagger` was the last entry (it isn't currently — the entry before it is on line 95).

- [ ] **Step 4: Regenerate the lockfile and uninstall the package**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm install
```

Expected: npm removes `lovable-tagger` from `node_modules/` and updates `package-lock.json`. No peer-dep warnings beyond pre-existing baseline.

- [ ] **Step 5: Remove Lovable boilerplate from `frontend/README.md`**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
head -60 README.md
```

Identify Lovable-specific sections — typically headings like "Project info", "How can I edit this code?", "What technologies are used for this project?", "How can I deploy this project?", "I want to use a custom domain" — and links pointing to `lovable.dev`.

Replace the README with a minimal stub appropriate for Brewra's frontend:

```markdown
# Brewra Frontend (PWA)

React 18 + Vite + TypeScript + Tailwind + shadcn-ui PWA for the Brewra GTM intelligence product.

See repo root `CLAUDE.md` and `AGENTS.md` for architecture, branch model, and gotchas.

## Local dev

```bash
npm install
npm run dev          # vite dev server on :5173, proxies /api/* to production backend
```

## Tests and pre-merge gate

```bash
npm run preflight    # typecheck → build → test:e2e → test
```

The wrapper at `scripts/preflight.sh` runs the same chain with section headers and timing.

(Phase 1 appends `knip --strict` to this chain in its final commit; if you're reading this README in a tree after that lands, the chain ends with `→ knip --strict`.)
```

(If the existing README has Brewra-specific content beyond the Lovable boilerplate — e.g., setup notes the Brewra devs added — preserve those sections and remove only the Lovable parts. Read the full file first.)

- [ ] **Step 6: Run preflight**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: green. The `vite build` step is the key gate — if `componentTagger` was actually referenced somewhere we missed, the build will fail with an undefined-symbol error.

- [ ] **Step 7: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/vite.config.ts frontend/package.json frontend/package-lock.json frontend/README.md
git commit -m "$(cat <<'EOF'
chore(fe): remove lovable-tagger and Lovable README boilerplate

The Brewra frontend was originally generated by Lovable; lovable-tagger
was a dev-time component tagger only useful inside the Lovable IDE. Drop
it from vite.config.ts and package.json. README boilerplate replaced
with a minimal Brewra-specific stub.

Spec 16 §3 Step 2 item 1.
EOF
)"
```

### Task 2.2 — Delete `src/pages/_restore_test.txt`

**Files:**
- Delete: `frontend/src/pages/_restore_test.txt`

- [ ] **Step 1: Verify the file exists**

```bash
ls /projects/Brewra/brewra-gtm-intelligence/frontend/src/pages/_restore_test.txt
```

Expected: file listed. If absent, skip this task and note "already deleted upstream" in the Step 7 scorecard.

- [ ] **Step 2: Delete via git rm**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git rm frontend/src/pages/_restore_test.txt
```

Expected: `rm 'frontend/src/pages/_restore_test.txt'`.

- [ ] **Step 3: Run preflight**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git commit -m "chore(fe): delete src/pages/_restore_test.txt (Lovable vestige)"
```

### Task 2.3 — Remove unresolved import `./pages/AgentHub` from `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx` (line 21)

Per spec §1.3, line 21 contains `import AgentHub from "./pages/AgentHub";` — a knip-flagged unresolved import (the file `pages/AgentHub.tsx` does not exist).

- [ ] **Step 1: Confirm the file is missing and the import is on line 21**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
ls src/pages/AgentHub.tsx src/pages/AgentHub.ts 2>&1
sed -n '21p' src/App.tsx
```

Expected: `ls` reports both files don't exist (`No such file or directory`); `sed` prints `import AgentHub from "./pages/AgentHub";`.

If `AgentHub.tsx` *does* exist (a file landed since spec round 2): the import isn't unresolved any longer. Skip this task and note in the scorecard.

- [ ] **Step 2: Search for any `AgentHub` usage elsewhere in App.tsx and the codebase**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -n "AgentHub" src/App.tsx
grep -rn "AgentHub" src/ e2e/
```

Expected for App.tsx: just the import line (line 21). The symbol is imported but never referenced in any JSX/route definition (since the file it points to doesn't exist, anything that referenced it would be a build-time failure — but the build is currently green via `tsc --noEmit`, suggesting TS allows this dangling import).

If `AgentHub` is referenced elsewhere in App.tsx (e.g., inside a `<Route>`), that reference is also dead code (the symbol resolves to `undefined` at runtime). Remove both the import and the reference in the same edit. Note both in the commit body.

- [ ] **Step 3: Delete the import line**

Edit `frontend/src/App.tsx`: delete the entire line 21 (`import AgentHub from "./pages/AgentHub";`).

Verify:

```bash
grep -n "AgentHub" src/App.tsx
```

Expected: no output.

- [ ] **Step 4: Run preflight**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: green. (TypeScript's typecheck will no longer see the unresolved import; build was already green because Vite doesn't include unreferenced imports in the bundle.)

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/App.tsx
git commit -m "fix(fe): remove unresolved import ./pages/AgentHub from App.tsx"
```

### Task 2.4 — Remove unresolved import `@/components/market-research/MarketRankings` from `MarketResearch.tsx`

**Files:**
- Modify: `frontend/src/pages/MarketResearch.tsx` (line 58)

- [ ] **Step 1: Confirm the file is missing and the import is on line 58**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
ls src/components/market-research/MarketRankings.tsx src/components/market-research/MarketRankings.ts 2>&1
sed -n '58p' src/pages/MarketResearch.tsx
```

Expected: file does not exist; sed prints `import { MarketRankings } from "@/components/market-research/MarketRankings";`.

- [ ] **Step 2: Search for `MarketRankings` usage in the file and codebase**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -n "MarketRankings" src/pages/MarketResearch.tsx
grep -rn "MarketRankings" src/ e2e/
```

If only the import line matches in `MarketResearch.tsx`: safe to delete only the import. If `<MarketRankings ... />` JSX appears elsewhere in the file, the JSX is also dead — remove both. Document each removal in the commit body.

- [ ] **Step 3: Delete the import line (and any JSX usage if found)**

Edit `frontend/src/pages/MarketResearch.tsx`: delete line 58. If Step 2 found JSX usages, also delete those (preserving any sibling JSX in the surrounding fragment).

Verify:

```bash
grep -n "MarketRankings" src/pages/MarketResearch.tsx
```

Expected: no output.

- [ ] **Step 4: Run preflight**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/pages/MarketResearch.tsx
git commit -m "fix(fe): remove unresolved import @/components/market-research/MarketRankings from MarketResearch.tsx"
```

### Task 2.5 — Remove all unused npm dependencies (20 deps + 1 devDep)

**Files:**
- Modify: `frontend/package.json` (remove 21 dep entries)
- Modify: `frontend/package-lock.json` (regenerated)

Per spec §3 Step 2 item 5: per-file granularity means one file (`package.json` + lockfile) = one commit. Subject lists each dep in the body.

- [ ] **Step 1: Extract the list of unused deps from the Step 1 re-baseline**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
python3 <<'PY'
import json
d = json.load(open('docs/audits/2026-05-27-frontend-deadcode-knip-refined.json'))
# knip 5.x shape: top-level 'dependencies' (or 'unused dependencies') key
# and 'devDependencies' separately, OR per-file inside 'issues'.
# Print whatever shape exists so the engineer can see.
print("Top-level keys:", sorted(d.keys()))
for k in ('dependencies', 'devDependencies', 'unusedDependencies', 'unusedDevDependencies'):
    if k in d:
        print(f"  {k}: {d[k]}")
PY
```

The exact JSON shape varies by knip version. If top-level keys give the dep list, use that. Otherwise extract from the text reporter:

```bash
grep -A1 "Unused dependencies\|Unused devDependencies" docs/audits/2026-05-27-frontend-deadcode-knip-refined.txt
```

The output is a section like:
```
Unused dependencies (20)
  package-name-1   package.json
  package-name-2   package.json
  ...
Unused devDependencies (1)
  package-name-X   package.json
```

Record the full list. Spec §1.3 reports `20 deps + 1 devDep = 21 total`; the refined re-baseline may differ by ±1–2 if the Step 1 entry-additions changed classifications.

- [ ] **Step 2: Edit `frontend/package.json` to remove every entry from the unused list**

For each unused dep, delete its line from `dependencies` or `devDependencies` in `frontend/package.json`. Take care with trailing commas: the last entry in each object must not have a trailing comma; intermediate entries must. Common JSON-edit pitfall — verify the file parses after editing:

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
python3 -c "import json; json.load(open('package.json')); print('package.json parses OK')"
```

Expected: `package.json parses OK`. If parse fails, fix the comma error before continuing.

- [ ] **Step 3: Regenerate the lockfile**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm install
```

Expected: npm removes the 21 packages from `node_modules/` and rewrites `package-lock.json`. The diff against the previous lockfile should show only removals (and possibly resolved-version changes for transitive deps that no longer have multiple resolutions). No new direct deps should appear.

- [ ] **Step 4: Run preflight — critical gate for dep removal**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: all four checks green. Of these, `vite build` is the most likely to surface a transitive-resolution failure (a "dead" package that's actually consumed via re-export). If build fails:
- The error message usually identifies the missing package
- That package is a **false-positive knip flag** — add it back to `package.json`, regenerate lockfile, document it as a `keep` row in the Step 7 scorecard with reason "transitive consumer surfaced at vite build"
- Re-run preflight; once green, proceed

If a Playwright or Vitest run fails specifically because a test imports a removed dep: same recovery (add back, document as `keep`).

- [ ] **Step 5: Commit**

Compose the commit body listing each removed dep:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/package.json frontend/package-lock.json
git commit -m "$(cat <<'EOF'
chore(fe): remove 21 unused npm dependencies

Per Step 1 refined knip baseline (docs/audits/2026-05-27-frontend-deadcode-knip-refined.json),
the following packages are unused in src/, e2e/, scripts/, and config files:

dependencies (20):
  - <pkg-1>
  - <pkg-2>
  ... (one line per dep, copied from the unused-dependencies list in the .txt baseline)

devDependencies (1):
  - <pkg-N>

Per-file-commit convention: manifest changes ship as one commit (the file
count is one). If a transitive-resolution failure surfaces post-merge,
`git revert` operates on this single commit and the diff identifies the
culprit. vite build during preflight already validated the bundle resolves
without these packages.

Spec 16 §3 Step 2 item 5; §9 decision 5.
EOF
)"
```

(Replace `<pkg-N>` placeholders with the actual deps from Step 1's extracted list. If a dep was added back as a false-positive `keep` in Step 4, omit it from this list.)

### Task 2.6 — Delete empty `src/components/market-research/LeadStream.tsx`

**Files:**
- Delete: `frontend/src/components/market-research/LeadStream.tsx` (0 LOC)

Spec §1.3 confirmed-vestige row: this file is empty; the real implementation lives at `src/components/customers/LeadStream.tsx` (432 LOC).

- [ ] **Step 1: Confirm both files exist and the vestige is empty**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
wc -l src/components/market-research/LeadStream.tsx src/components/customers/LeadStream.tsx
```

Expected:
```
  0 src/components/market-research/LeadStream.tsx
432 src/components/customers/LeadStream.tsx
432 total
```

If the market-research file is non-zero: STOP — it's no longer a vestige; investigate before deleting.

- [ ] **Step 2: Verify no imports point at the vestige path**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -rn "market-research/LeadStream" src/ e2e/
grep -rn "from ['\"].*market-research/LeadStream" src/ e2e/
```

Expected: no output. (The empty file exports nothing, so any import targeting it would type-error; but the build was green via `tsc --noEmit`, suggesting nothing imports it.)

If imports exist: investigate. They'd be importing `{ }` from an empty module — likely a leftover the empty-file removal would surface. Update the importer to use `src/components/customers/LeadStream.tsx` (the real implementation), then proceed.

- [ ] **Step 3: Delete via git rm**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git rm frontend/src/components/market-research/LeadStream.tsx
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
chore(fe): delete src/components/market-research/LeadStream.tsx (empty vestige)

Empty 0-LOC file; real implementation lives at
src/components/customers/LeadStream.tsx (432 LOC). Identified by Phase 0a
audit (spec 15 §2.1) and confirmed by Spec 16 §1.3.

Spec 16 §3 Step 2 item 6.
EOF
)"
```

### Task 2.7 — Remove unused default export from `SuggestedICPCards.tsx`

**Files:**
- Modify: `frontend/src/components/customers/SuggestedICPCards.tsx`

Per spec §3 Step 2 item 7: the file has both `export const SuggestedICPCards` (consumed by `ICPIntelligence.tsx`) and `export default SuggestedICPCards` (unused). Delete the default-export line only; the named export stays.

- [ ] **Step 1: Locate both export sites**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -n "^export.*SuggestedICPCards" src/components/customers/SuggestedICPCards.tsx
```

Expected: two matches — one `export const SuggestedICPCards` (around line 915 per spec) and one `export default SuggestedICPCards` (around line 2280 per spec). Note the exact current line numbers.

- [ ] **Step 2: Confirm the default export has no inbound usage**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
grep -rn "from ['\"].*SuggestedICPCards['\"]" src/ e2e/
grep -rn "import SuggestedICPCards" src/ e2e/
grep -rn "import .* SuggestedICPCards" src/ e2e/
```

Expected: only **named** imports (`import { SuggestedICPCards } from ...`) — these are consuming the `export const`, not the default. Zero matches for `import SuggestedICPCards from ...` (which would consume the default).

If a default import is found: STOP — spec's claim is wrong; investigate. Either convert the consumer to a named import in this commit (then remove the default), or leave the default and document as `keep` in the Step 7 scorecard.

- [ ] **Step 3: Delete the `export default SuggestedICPCards` line**

Edit `frontend/src/components/customers/SuggestedICPCards.tsx`: delete only the `export default SuggestedICPCards;` line (typically near the very bottom of the file, the line number found in Step 1).

Verify:

```bash
grep -n "^export.*SuggestedICPCards" src/components/customers/SuggestedICPCards.tsx
```

Expected: one match remaining (the `export const`).

- [ ] **Step 4: Run preflight**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/components/customers/SuggestedICPCards.tsx
git commit -m "$(cat <<'EOF'
refactor(fe): remove unused default export from SuggestedICPCards.tsx

The file had both `export const SuggestedICPCards` (consumed by
ICPIntelligence.tsx) and `export default SuggestedICPCards` (unused —
knip-flagged as the duplicate-export finding in Spec 16 §1.3). Default
removed; named export stays.

Spec 16 §3 Step 2 item 7.
EOF
)"
```

---

## Step 3 — Mid-Phase Knip Re-Run

### Task 3 — Re-run knip and capture the mid-phase baseline

Removes the mechanical-batch noise (Lovable + dep removals + unresolved imports + duplicate-default + empty vestige) so Step 4's manual investigation works against a cleaner list.

**Files:**
- Create: `docs/audits/2026-05-27-frontend-deadcode-knip-mid-phase.json`
- Create: `docs/audits/2026-05-27-frontend-deadcode-knip-mid-phase.txt`

- [ ] **Step 1: Run knip in text and JSON reporters**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx knip --no-progress > ../docs/audits/2026-05-27-frontend-deadcode-knip-mid-phase.txt 2>&1 || true
npx knip --reporter json --no-progress > ../docs/audits/2026-05-27-frontend-deadcode-knip-mid-phase.json 2>/dev/null || true
```

- [ ] **Step 2: Verify zero hints (config didn't regress)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
grep -c "Configuration hint" docs/audits/2026-05-27-frontend-deadcode-knip-mid-phase.txt || echo "0 hints"
```

Expected: `0 hints`. If hints reappeared, Step 1 of an earlier task perturbed `frontend/knip.json` — diff against the refined baseline:

```bash
diff <(jq -S . frontend/knip.json) <(git show $(git log --diff-filter=A -- frontend/knip.json | grep -m1 '^commit ' | awk '{print $2}'):frontend/knip.json | jq -S .)
```

(If `jq` isn't installed, do a plain `diff frontend/knip.json` against the version from Task 1's commit using `git show`.) Restore the refined config if drift is found; re-run this task.

- [ ] **Step 3: Capture the mid-phase finding counts**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
python3 <<'PY'
import json
d = json.load(open('docs/audits/2026-05-27-frontend-deadcode-knip-mid-phase.json'))
print(f"  Dead files: {len(d.get('files', []))}")
print(f"  Issues (per-file):  {len(d.get('issues', []))}")
# Sum across per-file issues for exports/types if present
exports = sum(len(i.get('exports', [])) for i in d.get('issues', []))
types = sum(len(i.get('types', [])) for i in d.get('issues', []))
duplicates = sum(len(i.get('duplicates', [])) for i in d.get('issues', []))
unresolved = sum(len(i.get('unresolved', [])) for i in d.get('issues', []))
print(f"  Unused exports:        {exports}")
print(f"  Unused exported types: {types}")
print(f"  Duplicate exports:     {duplicates}")
print(f"  Unresolved imports:    {unresolved}")
PY
```

Expected (vs Spec 16 §1.3 starting counts):
- Dead files: ≤32 (Step 2.6 removed 1, Step 4 will process the rest)
- Unused exports: ≤62
- Unused exported types: ≤16
- Duplicate exports: 0 (Step 2.7 removed the only one)
- Unresolved imports: 0 (Steps 2.3 and 2.4 fixed both)

If duplicates >0 or unresolved >0: the mechanical batch missed something. Investigate before proceeding to Step 4. Likely cause: a knip false-positive that wasn't visible in the original baseline.

- [ ] **Step 4: Run preflight**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: green (this task only writes audit artifacts).

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add docs/audits/2026-05-27-frontend-deadcode-knip-mid-phase.json docs/audits/2026-05-27-frontend-deadcode-knip-mid-phase.txt
git commit -m "$(cat <<'EOF'
chore(audit): Phase 1 mid-phase knip re-baseline (post-mechanical-wins)

Re-baseline after Step 2 mechanical removals (Lovable, dep removals,
unresolved imports, duplicate default, empty vestige). Authoritative
input for Step 4's manual dead-file investigation.

Spec 16 §3 Step 3.
EOF
)"
```

---

## Step 4 — Dead-File Investigation (per-file commits)

For each dead-file flag from Step 3's re-baseline, the engineer runs the 6-check kit and ships one commit per file: either `remove` (with the 6-line check-kit block in the body) or `keep` (file untouched, scorecard annotation only) or `defer` (file untouched, `TD-FE-<n>` written to `docs/TECH_DEBT.md`).

### Task 4 — Process every dead-file flag

**Files:** variable (one per dead file removed).

**Sub-procedure to apply per dead-file flag:**

This task does not have a fixed step count — instead it defines a per-finding procedure that loops until every flag is resolved. The engineer iterates through the dead-file list from `docs/audits/2026-05-27-frontend-deadcode-knip-mid-phase.json` in **topological removal order** (computed in Step 4-prep below), running the 6-check kit per file and producing one commit per `remove` decision.

- [ ] **Step 4-prep: Extract and topologically order the dead-file list**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
python3 <<'PY' > /tmp/phase-1-dead-files-ordered.txt
"""Build a topological removal order from the mid-phase knip output.

Read each dead file, parse its imports, identify which other dead files
it depends on. Output the dead-file list in reverse-dependency order:
files with no inbound dependencies from other dead files first; files
that are heavily depended on by other dead files last.

Verified example: ICPSummaryOpportunity -> enhancedApi,
                  RateLimitStatus -> enhancedApi,
                  authenticatedApi -> enhancedApi,
                  useAuthenticatedApi -> authenticatedApi.
Removal order: ICPSummaryOpportunity, RateLimitStatus first; then
useAuthenticatedApi -> authenticatedApi -> enhancedApi last.
"""
from __future__ import annotations  # PEP 563: allows `str | None` etc. on Python 3.9
import json
import re
from pathlib import Path

ROOT = Path("frontend")
SRC = ROOT / "src"

# 1) Load dead-file list
d = json.load(open("docs/audits/2026-05-27-frontend-deadcode-knip-mid-phase.json"))
dead = set()
files_field = d.get("files", [])
if isinstance(files_field, list):
    for f in files_field:
        # knip emits paths like "src/components/.../Foo.tsx" relative to frontend/
        dead.add(f.replace("\\", "/").lstrip("./"))

print(f"# {len(dead)} dead files from mid-phase knip baseline", flush=True)

# 2) Parse each dead file's static imports to find inbound dead-file deps
IMPORT_RE = re.compile(r"""from\s+['"]([^'"]+)['"]""")
deps = {}  # file -> set of other dead files it imports
basename_to_path = {Path(f).stem: f for f in dead}

def resolve_import(importer_path: str, imported: str) -> str | None:
    """Resolve an import string against the dead-file set. Returns the dead-file
    path if the import targets another dead file, else None."""
    # Strip '@/' alias to 'src/'
    if imported.startswith("@/"):
        imported = "src/" + imported[2:]
    # Relative imports
    elif imported.startswith("."):
        importer_dir = str(Path(importer_path).parent)
        imported = str(Path(importer_dir) / imported)
        # Path.normalize equivalent
        parts = []
        for p in imported.split("/"):
            if p == "..":
                if parts: parts.pop()
            elif p and p != ".":
                parts.append(p)
        imported = "/".join(parts)
    else:
        # Bare specifier — node_module, not a local file
        return None
    # Try with .ts / .tsx extensions
    for ext in (".ts", ".tsx", "/index.ts", "/index.tsx", ""):
        candidate = imported + ext if ext else imported
        if candidate in dead:
            return candidate
    return None

for f in dead:
    abs_f = ROOT / f
    if not abs_f.exists():
        deps[f] = set()
        continue
    deps[f] = set()
    try:
        content = abs_f.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        continue
    for m in IMPORT_RE.finditer(content):
        target = resolve_import(f, m.group(1))
        if target and target != f:
            deps[f].add(target)

# 3) Topological sort: nodes (files) with no inbound dead-file edges go first.
#    "Inbound" here means: another dead file imports this file.
# Compute inbound counts.
inbound = {f: 0 for f in dead}
for f, outs in deps.items():
    for o in outs:
        if o in inbound:
            inbound[o] += 1

# Kahn's algorithm
order = []
queue = sorted(f for f, c in inbound.items() if c == 0)
while queue:
    n = queue.pop(0)
    order.append(n)
    for o in sorted(deps.get(n, [])):
        inbound[o] -= 1
        if inbound[o] == 0:
            queue.append(o)

# Cycles: append any remaining files at the end (rare for dead-file subgraphs)
for f in sorted(dead):
    if f not in order:
        order.append(f)

print(f"# Topological removal order ({len(order)} files):", flush=True)
for f in order:
    print(f, flush=True)
PY
wc -l /tmp/phase-1-dead-files-ordered.txt
head -10 /tmp/phase-1-dead-files-ordered.txt
```

Expected: a file at `/tmp/phase-1-dead-files-ordered.txt` containing one path per line, with files like `ICPSummaryOpportunity.tsx` and `RateLimitStatus.tsx` early (no other dead files depend on them) and files like `enhancedApi.ts` later (depended on by `authenticatedApi.ts`, which is depended on by `useAuthenticatedApi.ts`).

This file is the work queue for Step 4. Do **not** commit it — it's a working artifact at `/tmp/`.

- [ ] **Step 4-loop: Process each dead file in order — apply the 6-check kit**

For each file `<path>` listed in `/tmp/phase-1-dead-files-ordered.txt`:

1. **Run the 6-check kit:**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
PATH_REL="<path>"                                          # e.g. src/components/customers/ICPSummaryOpportunity.tsx
BASE="$(basename "$PATH_REL" | sed 's/\.tsx\?$//')"        # e.g. ICPSummaryOpportunity

echo "=== Check 1: static imports (rg-basename) ==="
rg -n "from ['\"][^'\"]*${BASE}['\"]" src/ e2e/

echo "=== Check 2: dynamic imports (rg-dynamic-import) ==="
rg -n "import\([^)]*${BASE}" src/ e2e/

echo "=== Check 3: re-exports (rg-reexport) ==="
rg -n "export.*from.*['\"][^'\"]*${BASE}['\"]" src/ e2e/

echo "=== Check 4: plain text (rg-plain-text) ==="
rg -n "${BASE}" src/ e2e/

echo "=== Check 5: route walk (App.tsx) ==="
rg -n "${BASE}" src/App.tsx

echo "=== Check 6: test imports ==="
rg -n "${BASE}" "src/**/__tests__" "src/**/*.test.*" "src/**/*.spec.*" e2e/ 2>/dev/null || rg -n "${BASE}" src/ e2e/ | grep -E "(__tests__|\.test\.|\.spec\.|^e2e/)"
```

2. **Record the result counts** (or `none` for route-walk and test-imports if the check returned nothing):

   - `rg-basename: <N>` — count of static-import lines found (excluding the file's own line if it's self-referential)
   - `rg-dynamic-import: <N>` — count of dynamic-import lines
   - `rg-reexport: <N>` — count of re-export lines
   - `rg-plain-text: <N>` — count of plain-text mentions (often higher than rg-basename because it catches comments, strings, etc.)
   - `route-walk: none` if Check 5 returned nothing, else the path/route mentioning the basename (e.g. `route /agent-hub`)
   - `test-imports: none` if Check 6 returned nothing, else the test file path (e.g. `e2e/journeys/03-customer-pipeline.spec.ts`)

3. **Decide verdict per posture:**

   - **All zero / all `none`** → **remove**. Apply Step 4-remove (next sub-step).
   - **Any non-zero or non-`none`** → either **keep** (file is referenced — annotate scorecard with the inbound) or **defer to `TD-FE-<n>`** (uncertainty under conservative posture). Per Spec 16 §2.3:
     - Files under `lib/`, `hooks/`, `utils/`, `contexts/` → conservative posture → `defer` on any uncertainty
     - Files under `components/<feature>/`, `pages/` → aggressive posture → investigate further; only `keep` if a true inbound exists, else `remove` despite a plain-text match (e.g., a comment mentioning the name)
   - **Test-only import** → **keep — test-only import** (per spec §2.3 test-only-import verdict). Annotate the test file path. Do **not** create a TD-FE.

4. **For `remove` verdict — apply Step 4-remove:**

   ```bash
   cd /projects/Brewra/brewra-gtm-intelligence
   git rm "frontend/<PATH_REL>"

   cd frontend
   npm run preflight
   ```

   Expected: green. If preflight fails (typecheck or build error from a missed inbound), `git restore --staged frontend/<PATH_REL>` and `git checkout -- frontend/<PATH_REL>` to undo; switch verdict to `keep` with the failure reason documented; proceed to next file.

   If green, commit:

   ```bash
   cd /projects/Brewra/brewra-gtm-intelligence
   git commit -m "$(cat <<'EOF'
   chore(fe): remove dead file <PATH_REL>

   Checks:
     rg-basename: 0
     rg-dynamic-import: 0
     rg-reexport: 0
     rg-plain-text: 0
     route-walk: none
     test-imports: none

   Spec 16 §3 Step 4.
   EOF
   )"
   ```

   (Replace `<PATH_REL>` with the actual path. Replace the `0`/`none` values with the actual numbers from Step 1 of this loop if a `keep`-overridden-by-aggressive-posture decision uses non-zero values — in that case the commit body explains why aggressive-posture removal was safe.)

5. **For `keep` verdict — no commit; record in the scorecard buffer:**

   Append a row to `/tmp/phase-1-keeps.txt` (working file, not committed):
   ```
   <PATH_REL>|keep|<inbound description, e.g. "imported by src/foo/bar.tsx via static import">
   ```
   Step 7 will read this file when writing the final scorecard.

6. **For `defer-TD-FE-<n>` verdict — write the TD-FE entry, no source removal:**

   ```bash
   cd /projects/Brewra/brewra-gtm-intelligence
   # Find the next TD-FE number
   NEXT_N=$(($(grep -oE 'TD-FE-[0-9]+' docs/TECH_DEBT.md | sort -V | tail -1 | sed 's/TD-FE-//' || echo 0) + 1))
   echo "Next TD-FE number: $NEXT_N"
   ```

   Append a new section to `docs/TECH_DEBT.md` (between existing sections, sorted by number):

   ```markdown
   ## TD-FE-<NEXT_N> — Deferred dead-file investigation: <PATH_REL>

   **Date logged:** 2026-05-27
   **Origin:** Spec 16 Phase 1 (`plans/16-frontend-phase-1-loc-reduction.md`), Step 4.

   **Current state:**
   Knip flags `<PATH_REL>` as a dead file in the Step 3 re-baseline at
   `docs/audits/2026-05-27-frontend-deadcode-knip-mid-phase.json`. The 6-check kit returned:
     rg-basename: <N>
     rg-dynamic-import: <N>
     rg-reexport: <N>
     rg-plain-text: <N>
     route-walk: <none|path>
     test-imports: <none|path>

   **Why deferred:**
   <one-line: which non-zero check triggered conservative-posture deferral, and why
    the inbound couldn't be safely classified as removable. Example:
    "rg-plain-text returned 3 matches all in JSX-comment blocks, but the file is
    under src/lib/ where blast radius is broad and Phase 0b characterization
    coverage doesn't reach this surface — conservative posture defers per Spec 16 §2.3."]

   **Pull-forward trigger:**
   Phase 13 (post-modularization LOC pass) re-evaluates with strict TS context and
   richer test coverage; the conservative-posture barrier may relax.

   **Owner:** TBD.
   ```

   Commit:

   ```bash
   git add docs/TECH_DEBT.md
   git commit -m "$(cat <<'EOF'
   docs(td): defer dead-file removal for <PATH_REL> (TD-FE-<NEXT_N>)

   Conservative posture per Spec 16 §2.3 — file under <area>/ with uncertain
   inbound surface. See TD-FE-<NEXT_N> in docs/TECH_DEBT.md.

   Spec 16 §3 Step 4.
   EOF
   )"
   ```

   Also append a row to `/tmp/phase-1-defers.txt`:
   ```
   <PATH_REL>|defer|TD-FE-<NEXT_N>
   ```

**Special case: `src/components/customers/ICPSummaryOpportunity.tsx` (6,925 LOC).** Per Spec 16 §1.3 round-2 verification, the 6-check kit is expected to return all-zero. Apply the standard procedure — no special handling. The commit body uses the same 6-line check-kit block; the unusual size (one of the larger single-commit wins of Step 4) needs no extra commentary beyond the standard.

- [ ] **Step 4-orphan-routes: Walk every `<Route>` in `App.tsx` and check nav reachability**

After processing every dead-file flag, do the orphan-route sub-pass per Spec 16 §3 Step 4 ("Orphan route detection").

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
# Extract every path="..." attribute on lines containing <Route.
# Multi-line <Route> elements (path attribute on a different line than the opening tag)
# require manual review — flag any such cases by running `grep -nE '<Route$|<Route\s*$' src/App.tsx`
# first and treating those manually if matches exist.
grep -nE '<Route' src/App.tsx | grep -oE 'path="[^"]+"' | sort -u > /tmp/phase-1-routes.txt
wc -l /tmp/phase-1-routes.txt
cat /tmp/phase-1-routes.txt

# Multi-line <Route> check
echo "--- Multi-line <Route> elements (if any, review manually):"
grep -nE '<Route\s*$' src/App.tsx
```

For each route path, check whether the sidebar nav (`src/components/layout/Sidebar.tsx`) references it:

```bash
while IFS= read -r route_line; do
  ROUTE_PATH="$(echo "$route_line" | sed -E 's/path="([^"]+)"/\1/')"
  COUNT=$(rg -c -F "$ROUTE_PATH" src/components/layout/Sidebar.tsx 2>/dev/null || echo 0)
  if [ "$COUNT" -eq 0 ]; then
    echo "ORPHAN: $ROUTE_PATH"
  fi
done < /tmp/phase-1-routes.txt
```

(The `-F` flag tells ripgrep to treat the route path as a literal string, not a regex — important because route paths contain `/` and `:` which have regex meaning.)

For each route flagged as ORPHAN:
1. Apply Spec 16 §2.3 posture: aggressive for feature-bound paths, conservative for auth/tenant/settings/protected-route wrappers
2. If aggressive `remove`: edit `src/App.tsx` to delete the `<Route>` element (preserve surrounding `<Routes>` structure), and check whether the route's component is now dead (run the 6-check kit on the component); if so, remove the component file in a separate commit per the Step 4-loop procedure
3. If conservative `defer`: write a `TD-FE-<n>` entry per Step 4-loop's defer sub-step

For each orphan removal commit subject use `chore(fe): remove orphan route <path>` and the body explains which nav surface was checked (`src/components/layout/Sidebar.tsx`) and found empty.

After every orphan route is resolved (removed or deferred), proceed to Step 5.

---

## Step 5 — Dead Exports and Dead Exported Types (per-file commits)

For each file with knip-flagged unused exports/types from Step 3's re-baseline, one commit removes the unused symbols. Concentrated across ~30 source files → ~30 commits per spec §3 Step 5.

### Task 5 — Trim every flagged unused export/type

**Files:** variable (one per affected source file).

**Sub-procedure:**

- [ ] **Step 5-prep: Extract the per-file unused-export list**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
python3 <<'PY' > /tmp/phase-1-unused-exports.txt
import json
d = json.load(open('docs/audits/2026-05-27-frontend-deadcode-knip-mid-phase.json'))
for issue in d.get('issues', []):
    file = issue.get('file', '')
    if not file: continue
    exports = issue.get('exports', [])
    types = issue.get('types', [])
    if exports or types:
        names = sorted(set(
            [e.get('name') if isinstance(e, dict) else e for e in exports] +
            [t.get('name') if isinstance(t, dict) else t for t in types]
        ))
        print(f"{file}|{','.join(n for n in names if n)}")
PY
wc -l /tmp/phase-1-unused-exports.txt
head -5 /tmp/phase-1-unused-exports.txt
```

Expected: a list of `<file>|<comma-separated symbol names>` lines, one per file. Per spec §1.3 numbers (62 exports + 16 types across some number of files; expect ~30 lines).

- [ ] **Step 5-loop: For each file in the unused-export list, apply per-symbol verification then remove**

For each `<file>|<symbols>` row:

1. **Apply Spec 16 §3 Step 5 conservative-path check per symbol** (for files under `lib/`, `hooks/`, `utils/`, `contexts/`):

   For each symbol in `<symbols>`:
   ```bash
   cd /projects/Brewra/brewra-gtm-intelligence/frontend
   SYM="<symbol>"
   FILE="<file>"
   BASE_FILE_WITHOUT_EXT="$(echo "$FILE" | sed -E 's/\.(ts|tsx)$//')"

   # rg-basename per symbol (excluding the declaring file)
   rg -n "\\b${SYM}\\b" src/ e2e/ | grep -v "^${FILE}:"
   # rg-dynamic-import (rare for named exports)
   rg -n "import\([^)]*['\"][^'\"]*\\b$(basename "$BASE_FILE_WITHOUT_EXT")\\b" src/ e2e/
   # rg-reexport
   rg -n "export.*\\b${SYM}\\b.*from" src/ e2e/
   # test imports
   rg -n "\\b${SYM}\\b" src/ e2e/ 2>/dev/null | grep -E "(__tests__|\.test\.|\.spec\.|^e2e/)"
   ```

   If all checks zero → safe to remove. If any non-zero → `keep` (annotate the scorecard buffer with the inbound) or `defer` per the same posture rules as Step 4.

2. **For files under `components/<feature>/`, `pages/`, `App.tsx`** (aggressive posture): same per-symbol checks, but remove despite a single comment-match if no actual import exists.

3. **Edit the file to remove the symbols**:

   For each symbol marked `remove`:
   - If it's a named export (`export const Foo = ...` or `export function Foo() {}`): delete the entire declaration block
   - If it's a re-export inside an `export { ... }` clause: remove only that name from the clause; delete the whole clause if it becomes empty
   - If it's an exported type alias or interface: delete the declaration

4. **Run preflight**:

   ```bash
   cd /projects/Brewra/brewra-gtm-intelligence/frontend
   npm run preflight
   ```

   Expected: green. If typecheck fails (a sibling symbol in the same file used the removed one internally), restore the file and either:
   - Re-edit to also remove the orphaned internal user (if it's now dead too — recursive cleanup)
   - Re-classify the export as `keep — internal sibling consumer` and undo

5. **Commit**:

   ```bash
   cd /projects/Brewra/brewra-gtm-intelligence
   git add frontend/<file>
   git commit -m "$(cat <<'EOF'
   chore(fe): remove unused exports from <file>

   Removed: <comma-separated symbol names>

   Verified per-symbol via rg + test-import check; no inbound references.

   Spec 16 §3 Step 5.
   EOF
   )"
   ```

6. **For deferred symbols** (conservative-path uncertainty): write a `TD-FE-<n>` entry per the Step 4-loop defer sub-step, listing all deferred symbols from the file in one entry. Use commit subject `docs(td): defer unused exports in <file> (TD-FE-<NEXT_N>)`.

After processing every file in `/tmp/phase-1-unused-exports.txt`, proceed to Step 6.

---

## Step 6 — Byte-Identical Inline-Data-Munging Extraction

### Task 6.1 — Write the custom TypeScript compiler API scan script

**Files:**
- Create: `frontend/scripts/scan-inline-blocks.ts`

The script implements the Spec 16 §3 Step 6a block definition: contiguous ≥3 statements at the same AST nesting level (relative to the immediate function/component scope), not interrupted by control-flow boundaries (`if`/`for`/`while`/`switch`/`try`/`catch`/`finally`) or JSX return statements. Self-containment: no references to outer-scope variables. Whitespace-normalized SHA-256 hash to group.

- [ ] **Step 1: Confirm `typescript` is resolvable from frontend/**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
node -e "console.log(require.resolve('typescript'))"
```

Expected: a path under `node_modules/typescript/`. If not found:

```bash
npm install --save-dev typescript@^5
```

(TypeScript is typically already present as a direct or transitive dep — verify before installing.)

- [ ] **Step 2: Create `frontend/scripts/scan-inline-blocks.ts`**

Write this exact content:

```ts
/**
 * Phase 1 §3 Step 6a — byte-identical inline-block scan.
 *
 * Walks src/**\/*.{ts,tsx}, identifies candidate blocks per the spec definition,
 * normalizes whitespace, hashes with SHA-256, groups occurrences, and emits
 * a JSON report at docs/audits/2026-05-27-frontend-inline-block-scan.json.
 *
 * Block definition (Spec 16 §3 Step 6a):
 *   - Contiguous sequence of ≥3 JavaScript statements
 *   - All at the same AST nesting level relative to the immediate function/component scope
 *   - Not interrupted by a control-flow boundary (if/for/while/switch/try/catch/finally)
 *     or a JSX return statement
 *   - Self-contained: no references to identifiers declared outside the block
 *
 * Whitespace normalization (for hashing only — fixture stores the original first
 * occurrence): collapse all runs of whitespace to a single space, drop trailing
 * whitespace before line terminators.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, resolve, dirname } from 'node:path';
import * as ts from 'typescript';

const FRONTEND_DIR = resolve(import.meta.dirname, '..');
const SRC_DIR = join(FRONTEND_DIR, 'src');
const OUTPUT_FILE = resolve(
  FRONTEND_DIR,
  '..',
  'docs',
  'audits',
  '2026-05-27-frontend-inline-block-scan.json',
);

const MIN_BLOCK_STATEMENTS = 3;
const MIN_GROUP_OCCURRENCES = 3;

interface Occurrence {
  file: string;
  line: number;
  end_line: number;
}

interface Group {
  hash: string;
  block: string; // first occurrence's normalized content (for inspection)
  occurrences: Occurrence[];
}

const groups = new Map<string, { block: string; raw: string; occurrences: Occurrence[] }>();

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function normalize(s: string): string {
  // Drop trailing whitespace per line, then collapse runs of whitespace to a single space.
  return s
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function isControlFlow(node: ts.Node): boolean {
  return (
    ts.isIfStatement(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    ts.isSwitchStatement(node) ||
    ts.isTryStatement(node)
  );
}

function isReturnWithJsx(node: ts.Node): boolean {
  if (!ts.isReturnStatement(node)) return false;
  if (!node.expression) return false;
  // Walk the return expression looking for any JSX
  let foundJsx = false;
  const visit = (n: ts.Node) => {
    if (foundJsx) return;
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
      foundJsx = true;
      return;
    }
    n.forEachChild(visit);
  };
  visit(node.expression);
  return foundJsx;
}

function collectDeclaredIdentifiers(node: ts.Node, declared: Set<string>): void {
  // For statements: var/let/const/function/class declarations
  if (ts.isVariableStatement(node)) {
    for (const decl of node.declarationList.declarations) {
      collectBindingNames(decl.name, declared);
    }
  } else if (ts.isFunctionDeclaration(node) && node.name) {
    declared.add(node.name.text);
  } else if (ts.isClassDeclaration(node) && node.name) {
    declared.add(node.name.text);
  }
}

function collectBindingNames(name: ts.BindingName, declared: Set<string>): void {
  if (ts.isIdentifier(name)) {
    declared.add(name.text);
  } else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) {
        collectBindingNames(element.name, declared);
      }
    }
  }
}

function collectReferencedIdentifiers(statements: readonly ts.Statement[]): Set<string> {
  const refs = new Set<string>();
  const visit = (n: ts.Node, inDecl: boolean) => {
    if (ts.isIdentifier(n) && !inDecl) {
      // Skip property access RHS (foo.bar — only `foo` is a reference)
      const parent = n.parent;
      if (parent && ts.isPropertyAccessExpression(parent) && parent.name === n) return;
      // Skip the property-name in object literal `{ foo: 1 }` (not a reference to `foo`)
      if (parent && ts.isPropertyAssignment(parent) && parent.name === n) return;
      // Skip the key in shorthand property assignment when used as a value — actually
      // that IS a reference; keep it.
      refs.add(n.text);
    } else if (ts.isVariableDeclaration(n)) {
      // Don't recurse into the name as a "reference"; do recurse into initializer.
      if (n.initializer) visit(n.initializer, false);
    } else {
      n.forEachChild((c) => visit(c, false));
    }
  };
  for (const s of statements) visit(s, false);
  return refs;
}

function processBlock(file: string, src: string, statements: ts.Statement[]): void {
  if (statements.length < MIN_BLOCK_STATEMENTS) return;

  // Self-containment check: declared names inside the block must satisfy all references.
  // References to identifiers NOT declared in the block disqualify it (the block depends
  // on outer scope — Phase 13 candidate, not Phase 1).
  const declared = new Set<string>();
  for (const s of statements) collectDeclaredIdentifiers(s, declared);
  const referenced = collectReferencedIdentifiers(statements);

  // Built-in / global identifiers and TypeScript keywords don't count as outer-scope refs.
  // Expanded for a PWA codebase per spec-16 plan review round 1 finding 4.
  const builtins = new Set([
    // Primitive literals + globals
    'undefined', 'null', 'true', 'false', 'NaN', 'Infinity',
    // Browser/Node globals
    'console', 'window', 'document', 'globalThis', 'self', 'process',
    'navigator', 'performance', 'location', 'history', 'screen',
    // Built-in constructors / namespaces
    'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Math', 'JSON',
    'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Symbol', 'Error', 'RegExp',
    'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError',
    // Number / parsing
    'parseInt', 'parseFloat', 'isNaN', 'isFinite',
    // Timers / microtasks
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame',
    // Networking + storage
    'fetch', 'localStorage', 'sessionStorage', 'caches', 'indexedDB',
    'Request', 'Response', 'Headers', 'URL', 'URLSearchParams', 'AbortController', 'AbortSignal',
    // Web encoding / binary
    'TextEncoder', 'TextDecoder', 'Blob', 'File', 'FormData', 'FileReader',
    'WebSocket', 'EventSource', 'crypto', 'structuredClone',
    // Events
    'Event', 'CustomEvent', 'MessageEvent', 'ErrorEvent',
    // DOM
    'HTMLElement', 'Element', 'Node', 'Document', 'Window',
    'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'PerformanceObserver',
    // User dialog primitives
    'alert', 'confirm', 'prompt',
    // React import names commonly used inside extracted blocks (these are imported at the file level
    // but appear as referenced identifiers inside the block; treating them as outer-scope refs would
    // under-extract React-flavored helpers. Acceptable: React components are not the target of Step 6
    // anyway because JSX-return guards apply.)
    'React',
  ]);

  for (const r of referenced) {
    if (declared.has(r)) continue;
    if (builtins.has(r)) continue;
    // Outer-scope reference — disqualify this block
    return;
  }

  // Compute hash from normalized concatenation of statement source ranges
  const start = statements[0].getStart(undefined, false);
  const end = statements[statements.length - 1].getEnd();
  const raw = src.slice(start, end);
  const normalized = normalize(raw);
  if (normalized.length < 20) return; // too short to be meaningful — skip
  const hash = createHash('sha256').update(normalized).digest('hex');

  const sourceFile = statements[0].getSourceFile();
  const lineStart = sourceFile.getLineAndCharacterOfPosition(start).line + 1;
  const lineEnd = sourceFile.getLineAndCharacterOfPosition(end).line + 1;

  const existing = groups.get(hash);
  const occurrence: Occurrence = {
    file: relative(FRONTEND_DIR, file).split('\\').join('/'),
    line: lineStart,
    end_line: lineEnd,
  };
  if (existing) {
    existing.occurrences.push(occurrence);
  } else {
    groups.set(hash, { block: normalized, raw, occurrences: [occurrence] });
  }
}

function visitContainer(file: string, src: string, node: ts.Node): void {
  // A "container" is a function or method body — i.e., the scope inside which
  // we look for runs of contiguous statements at the same nesting level.
  let bodyStatements: readonly ts.Statement[] | null = null;
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node) ||
      ts.isConstructorDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
    if (node.body && ts.isBlock(node.body)) {
      bodyStatements = node.body.statements;
    }
  } else if (ts.isArrowFunction(node)) {
    if (node.body && ts.isBlock(node.body)) {
      bodyStatements = node.body.statements;
    }
  }

  if (bodyStatements) {
    // Walk the body, slicing into runs of statements that are NOT interrupted by
    // a control-flow boundary or a JSX-return statement.
    let run: ts.Statement[] = [];
    const flush = () => {
      if (run.length >= MIN_BLOCK_STATEMENTS) {
        processBlock(file, src, run);
      }
      run = [];
    };
    for (const stmt of bodyStatements) {
      if (isControlFlow(stmt) || isReturnWithJsx(stmt)) {
        flush();
        // Recurse into the control-flow / return body to find nested function containers
        stmt.forEachChild((c) => visitContainer(file, src, c));
      } else {
        run.push(stmt);
      }
    }
    flush();
  }

  // Always recurse into children to find nested function containers
  node.forEachChild((c) => visitContainer(file, src, c));
}

async function main() {
  const files = await walk(SRC_DIR);
  for (const file of files) {
    const src = await readFile(file, 'utf-8');
    const sourceFile = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    visitContainer(file, src, sourceFile);
  }

  const out: { groups: Group[] } = { groups: [] };
  for (const [hash, g] of groups) {
    if (g.occurrences.length >= MIN_GROUP_OCCURRENCES) {
      out.groups.push({ hash, block: g.block, occurrences: g.occurrences });
    }
  }
  out.groups.sort((a, b) => b.occurrences.length - a.occurrences.length);

  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(out, null, 2) + '\n');
  console.log(`Scanned ${files.length} files; found ${out.groups.length} byte-identical group(s) with >=${MIN_GROUP_OCCURRENCES} occurrences.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Smoke-test the script syntactically**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx tsx scripts/scan-inline-blocks.ts
```

Expected output: `Scanned N files; found M byte-identical group(s) with >=3 occurrences.` where N is around 158 (minus any files removed in Step 4) and M is some integer ≥0.

If the script errors (TS compilation issue or runtime crash): debug. Common issues: a `forEachChild` recursion infinite loop (check the `visitContainer` recursion), a TypeScript API mismatch (verify `import * as ts from 'typescript'` works in the project's tsconfig).

- [ ] **Step 4: Validate the JSON shape**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
python3 -c "
import json
d = json.load(open('docs/audits/2026-05-27-frontend-inline-block-scan.json'))
assert 'groups' in d, d.keys()
assert isinstance(d['groups'], list)
print(f'Groups: {len(d[\"groups\"])}')
for g in d['groups'][:3]:
    assert {'hash', 'block', 'occurrences'} <= set(g.keys())
    print(f'  hash={g[\"hash\"][:12]}  occurrences={len(g[\"occurrences\"])}')
    for o in g['occurrences'][:3]:
        assert {'file', 'line', 'end_line'} == set(o.keys())
print('OK')
"
```

Expected: prints `OK` plus group summaries. Each group has `hash`, `block`, `occurrences`; each occurrence has `file`, `line`, `end_line`.

- [ ] **Step 5: Run preflight**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: green. (The new script is in `scripts/` and is only invoked manually — `npm run preflight` doesn't run it, and knip's refined config has `scripts/*.ts` in `entry`, so the script itself isn't flagged unused.)

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/scripts/scan-inline-blocks.ts docs/audits/2026-05-27-frontend-inline-block-scan.json
git commit -m "$(cat <<'EOF'
chore(audit): scan inline-data-munging blocks (Step 6a)

Custom TypeScript compiler API script implementing Spec 16 §3 Step 6a's
strict block definition: ≥3 contiguous statements at the same AST nesting
level relative to the immediate function/component scope, not interrupted
by control-flow or JSX-return boundaries, no references to outer-scope
identifiers (self-contained). Whitespace-normalized SHA-256 hash groups.

Output committed alongside as the authoritative input for Step 6b extraction
(empty groups array is acceptable per Spec 16 §3 Step 6 / §7 R3 — no
byte-identical patterns above threshold means zero extraction commits).

Spec 16 §3 Step 6a; §9 decision 11.
EOF
)"
```

### Task 6.2 — Extract per byte-identical group (per-helper commits)

**Files:** variable (one `src/lib/<helper>.ts` per group; one modified call-site file per occurrence).

**Sub-procedure:**

If Step 6a's output `docs/audits/2026-05-27-frontend-inline-block-scan.json` has `"groups": []`, **skip this task entirely** — Spec 16 §3 Step 6 explicitly says zero extraction commits is acceptable.

For each non-empty group:

- [ ] **Step 6.2-loop: Per-group extraction**

For each group in `out.groups` (Step 6a output):

1. **Inspect the block to decide a helper name**:
   ```bash
   python3 <<PY
   import json
   d = json.load(open('docs/audits/2026-05-27-frontend-inline-block-scan.json'))
   for i, g in enumerate(d['groups']):
       print(f"--- Group {i+1} (hash {g['hash'][:12]}, {len(g['occurrences'])} occurrences) ---")
       print(g['block'][:400])
       print(f"... ({len(g['block'])} chars total)")
       print("Occurrences:")
       for o in g['occurrences']:
           print(f"  {o['file']}:{o['line']}-{o['end_line']}")
       print()
   PY
   ```

   Pick a descriptive kebab-case helper name based on what the block does. Examples:
   - Normalizes a date payload → `normalize-date-payload.ts`
   - Builds a lead score object → `build-lead-score.ts`
   - Filters and sorts signals → `filter-sort-signals.ts`

2. **Create the helper file at `frontend/src/lib/<helper>.ts`**:

   Since the block is self-contained (Step 6a guaranteed no outer-scope references), the helper takes no parameters — it's pure block content wrapped in an exportable function. Use the **first occurrence's whitespace style as the canonical form** per Spec 16 §3 Step 6a canonicalization rule.

   ```ts
   /**
    * <one-line description of what this helper does>
    *
    * Extracted from N call sites by Spec 16 Phase 1 Step 6b
    * (docs/audits/2026-05-27-frontend-inline-block-scan.json group <hash>).
    */
   export function <helperName>(): <return-type-or-void> {
     <block content verbatim from first occurrence>
   }
   ```

   If the block doesn't return anything (pure side effect — e.g., a sequence of `localStorage.setItem` calls), return type is `void`. If it produces a value used downstream, the value is whatever the last statement's expression is — wrap with `return ...`.

   Note: per Spec 16 §8, this lives at `src/lib/` deliberately as a temporary home. Phase 11 will migrate to `src/shared/lib/` per Phase 11's promotion criteria. No action needed here beyond the file placement.

3. **Replace each occurrence with a call to the helper**:

   For each occurrence `{file, line, end_line}`:
   - Open the file at the given line range
   - Replace the entire block (lines `line` through `end_line` inclusive) with `<helperName>();` (or `const result = <helperName>();` if the block produces a value used downstream)
   - Add `import { <helperName> } from '@/lib/<helper>';` to the file's import block (if not already imported)

4. **Run preflight after each group's extraction**:

   ```bash
   cd /projects/Brewra/brewra-gtm-intelligence/frontend
   npm run preflight
   ```

   Expected: green. If a typecheck error surfaces (the block's return type wasn't inferred correctly, or a sibling identifier in the call site relied on a side effect of the block that the helper doesn't replicate), restore the call-site files and re-evaluate:
   - Either fix the helper signature/body to match observed behavior
   - Or skip this group entirely — annotate as "Phase 13 candidate; helper extraction surfaced semantic drift" in the Step 7 scorecard

5. **Commit per group**:

   ```bash
   cd /projects/Brewra/brewra-gtm-intelligence
   git add frontend/src/lib/<helper>.ts <list of occurrence files>
   git commit -m "$(cat <<'EOF'
   refactor(fe): extract <helperName> from <N> call sites

   Byte-identical-after-whitespace-normalization block extracted to
   src/lib/<helper>.ts per Spec 16 §3 Step 6b.

   Call sites replaced:
     - <file:line>
     - <file:line>
     ...

   Source: docs/audits/2026-05-27-frontend-inline-block-scan.json group <hash>.
   EOF
   )"
   ```

After all groups (or zero groups), proceed to Step 7.

---

## Step 7 — Final Scorecard, Preflight Wire-In, Master-Spec Update

### Task 7.1 — Write the final scorecard

**Files:**
- Create: `docs/audits/2026-05-27-frontend-loc-pass-1.md`

Per Spec 16 §4.1, the scorecard must substantiate five assertions: LOC delta, per-category execution log, per-file verdict for every originally-flagged dead file, Phase 13 handoff list, knip config delta. Layout is plan-author's choice as long as all five are visible.

- [ ] **Step 1: Compute LOC delta**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
TOTAL_LOC_NOW=$(find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec cat {} + | wc -l)
FILES_NOW=$(find src -type f \( -name '*.ts' -o -name '*.tsx' \) | wc -l)
BASELINE_LOC=76052
BASELINE_FILES=158
echo "Files: ${FILES_NOW} (was ${BASELINE_FILES}, delta $((FILES_NOW - BASELINE_FILES)))"
echo "LOC:   ${TOTAL_LOC_NOW} (was ${BASELINE_LOC}, delta $((TOTAL_LOC_NOW - BASELINE_LOC)))"
```

Record the numbers for the scorecard.

- [ ] **Step 2: Aggregate per-area LOC delta**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
python3 <<'PY'
from pathlib import Path
from collections import defaultdict

totals = defaultdict(lambda: {'files': 0, 'loc': 0})
for p in Path('src').rglob('*'):
    if p.is_file() and p.suffix in ('.ts', '.tsx'):
        parts = p.parts
        if len(parts) == 2:
            area = 'src/ (root)'
        elif parts[1] == 'components' and len(parts) >= 4:
            area = f'components/{parts[2]}/'
        elif parts[1] == 'components':
            area = 'components/ (loose)'
        else:
            area = f'{parts[1]}/'
        totals[area]['files'] += 1
        totals[area]['loc'] += len(p.read_text(encoding='utf-8', errors='ignore').split('\n'))

for area in sorted(totals):
    t = totals[area]
    print(f'  {area:<35} {t["files"]:>4} files, {t["loc"]:>7} LOC')
PY
```

Record per-area counts. Cross-reference against Phase 0a's baseline (`docs/audits/2026-05-26-frontend-baseline.md` Tier 1 table) — the delta per area is what the scorecard reports.

**Fallback** (only if Task 0b Step 4 flagged Phase 0a's Tier 1 table as missing or unparseable): use the recorded Phase 0a baseline commit SHA from your working notes to reconstruct the "before" column.

```bash
cd /projects/Brewra/brewra-gtm-intelligence
PHASE_0A_SHA="<SHA recorded in Task 0b Step 4>"
git stash push -m "phase-1-task-7.1-fallback" || true
git checkout "$PHASE_0A_SHA" -- frontend/src
cd frontend
# Re-run the same per-area aggregation against the pre-Phase-1 tree
python3 <<'PY'
from pathlib import Path
from collections import defaultdict
totals = defaultdict(lambda: {'files': 0, 'loc': 0})
for p in Path('src').rglob('*'):
    if p.is_file() and p.suffix in ('.ts', '.tsx'):
        parts = p.parts
        if len(parts) == 2: area = 'src/ (root)'
        elif parts[1] == 'components' and len(parts) >= 4: area = f'components/{parts[2]}/'
        elif parts[1] == 'components': area = 'components/ (loose)'
        else: area = f'{parts[1]}/'
        totals[area]['files'] += 1
        totals[area]['loc'] += len(p.read_text(encoding='utf-8', errors='ignore').split('\n'))
for area in sorted(totals):
    t = totals[area]
    print(f'  {area:<35} {t["files"]:>4} files, {t["loc"]:>7} LOC')
PY
# Restore the phase-1 working tree
cd /projects/Brewra/brewra-gtm-intelligence
git checkout HEAD -- frontend/src
git stash pop 2>/dev/null || true
```

Record the fallback's per-area output as the "before" column. Re-run the original Step 2 aggregation to capture the "after" column from the current (Phase 1 end) tree.

- [ ] **Step 3: Compose the scorecard**

Write `docs/audits/2026-05-27-frontend-loc-pass-1.md`:

```markdown
# Phase 1 — Frontend LOC Reduction (Pass #1) — Final Scorecard

**Date:** 2026-05-27 (re-dated at merge if different)
**Spec:** `specs/16-frontend-phase-1-loc-reduction-design.md`
**Plan:** `plans/16-frontend-phase-1-loc-reduction.md`
**Branch:** `phase-1-loc-reduction`
**Merge commit:** <SHA — filled at merge>

---

## 1. LOC delta

### Overall

| | Phase 0b end (baseline) | Phase 1 end | Delta |
|---|---:|---:|---:|
| Files (`.ts`/`.tsx` under `src/`) | 158 | <FILES_NOW> | <delta> |
| LOC (under `src/`) | 76,052 | <LOC_NOW> | <delta> |

### Per-area

| Area | Files (before) | Files (after) | LOC (before) | LOC (after) | LOC delta |
|---|---:|---:|---:|---:|---:|
<one row per area from Step 2's output, cross-referenced against Phase 0a baseline>

---

## 2. Per-category execution log

### Deps (Spec 16 §3 Step 2 item 5)

- **Removed:** N packages from `dependencies`, M from `devDependencies` (see commit `<SHA of Task 2.5>` body for full list)
- **Kept (false positive):** <list with reason if any deps had to be added back during Task 2.5 Step 4>
- **Deferred:** none (deps either remove cleanly or surface at build time)

### Lovable artifacts (Step 2 items 1–2)

- `lovable-tagger` removed from `vite.config.ts` + `package.json` — commit `<SHA>`
- Lovable README boilerplate removed from `frontend/README.md` — same commit
- `src/pages/_restore_test.txt` deleted — commit `<SHA>`

### Unresolved imports (Step 2 items 3–4)

- `./pages/AgentHub` removed from `src/App.tsx:21` — commit `<SHA>`
- `@/components/market-research/MarketRankings` removed from `src/pages/MarketResearch.tsx:58` — commit `<SHA>`

### Empty vestige (Step 2 item 6)

- `src/components/market-research/LeadStream.tsx` deleted — commit `<SHA>`

### Duplicate default export (Step 2 item 7)

- `export default SuggestedICPCards` removed from `src/components/customers/SuggestedICPCards.tsx` — commit `<SHA>`

### Dead files (Step 4)

- **Originally flagged (Step 1 re-baseline):** 32
- **Mid-phase re-baseline (Step 3):** <N>
- **Removed:** <N> (commits <list of SHAs or "see per-file verdict table in §3">)
- **Kept (with inbound):** <N>
- **Deferred to TD-FE-*:** <N>
- **Orphan routes detected and resolved:** <N> removed, <M> deferred

### Dead exports and dead exported types (Step 5)

- **Originally flagged:** 62 exports + 16 types
- **Mid-phase re-baseline:** <N> exports + <M> types
- **Removed:** <N> symbols across <M> files (commits per-file)
- **Kept (with inbound):** <N>
- **Deferred to TD-FE-*:** <N>

### Byte-identical inline-block extractions (Step 6)

- **Step 6a groups found (≥3 occurrences, self-contained):** <N>
- **Step 6b extractions committed:** <N> helpers at `src/lib/`
- **Phase 13 handoff (near-identical, outer-scope-referencing patterns logged):** <N>

---

## 3. Per-file verdict for every originally-flagged dead file

Covers all 32 from the Step 1 refined baseline plus any new flags from the Step 3 re-baseline.

| Path | Original LOC | Verdict | Evidence |
|---|---:|---|---|
<one row per file from /tmp/phase-1-keeps.txt + /tmp/phase-1-defers.txt + the remove commits, sorted alphabetically>

(Verdict values: `remove` with commit SHA in evidence; `keep` with inbound description in evidence; `defer-TD-FE-<n>` with link to docs/TECH_DEBT.md entry.)

---

## 4. Phase 13 handoff list

| Origin | Item | Why Phase 13 |
|---|---|---|
<rows for near-identical patterns from Step 6a's scan output that didn't pass byte-identical threshold, plus any `keep with reason` rows whose reason was "uncertain without strict TS / feature folders">
<rows for every TD-FE-<n> originating in Phase 1's conservative-defer paths>

---

## 5. Knip config delta

| Hint (before) | Resolution | After |
|---|---|---|
| `dev-dist/**`, `node_modules/**`, `dist/**` in `ignore` (redundant) | Removed from `ignore` (already in `.gitignore`) | 0 hints |
| `src/main.tsx`, `vite.config.ts`, `playwright.config.ts` in `entry` (redundant) | Removed from `entry` (knip auto-detects) | 0 hints |
| `scripts/**/*.{ts,sh}` matches nothing | Replaced with `scripts/*.ts` in `entry`; `.sh` files exit knip surface | 0 hints |
| No lazy-loader entry pattern | Verified zero `React.lazy()` / `lazy()` in codebase — no entry pattern needed | 0 hints |
| Root config needs entry refinement | Above changes resolve | 0 hints |
| Vitest test files not in `entry` (new hint, surfaced as a side-effect) | Added `src/**/__tests__/**/*.test.{ts,tsx}` and `src/**/*.{test,spec}.{ts,tsx}` to `entry` | 0 hints |

**Before:** 8 configuration hints
**After:** 0 configuration hints (verified at Step 1 Step 4 of plan)

---

## 6. shadcn-ui (`src/components/ui/`) unused-primitive count

Per Spec 16 §2.2 + §8 — directory locked from Phase 4 onward. Unused primitives flagged by knip stay in place; logged here for tracking.

**Count of `src/components/ui/*.tsx` files flagged unused by Step 3 re-baseline:** <N>

(If <N> ≥ 5, consider opening a separate `TD-FE-<n>` to track in aggregate. If <5, the scorecard count alone suffices.)

---

## 7. Preflight chain (final)

```
npm run preflight
= npm run typecheck
  → npm run build
  → npm run test:e2e
  → npm run test
  → npx knip --strict --no-progress     (added by this phase — Step 7.2)
```

`frontend/scripts/preflight.sh` unchanged — it delegates via `npm run preflight`.

Spec 16 §5 done-when items 1–8: <one-line verification per item>.
```

Fill in every `<...>` placeholder from the data gathered during execution. The `/tmp/phase-1-keeps.txt` and `/tmp/phase-1-defers.txt` working files (from Step 4-loop and Step 5-loop) feed §3's table.

- [ ] **Step 4: Run preflight**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add docs/audits/2026-05-27-frontend-loc-pass-1.md
git commit -m "$(cat <<'EOF'
chore(audit): Phase 1 final scorecard (LOC delta + per-file verdicts)

Substantiates Spec 16 §4.1 assertions 1-5: LOC delta by area + overall,
per-category execution log, per-file verdict for every originally-flagged
dead file, Phase 13 handoff list, knip config delta (8 → 0 hints).

Spec 16 §3 Step 7 item 1; §4.1; §5 item 1.
EOF
)"
```

### Task 7.2 — Wire `knip --strict --no-progress` into preflight

**Files:**
- Modify: `frontend/package.json` (append to `preflight` script)
- Modify: `frontend/README.md` (update preflight-chain documentation to add `→ knip --strict`)

Per Spec 16 §3 Step 7 item 2: edit `frontend/package.json` only for the wire-in. `frontend/scripts/preflight.sh` delegates via `npm run preflight` and needs no edit (verified at spec-write time and re-verified by reading the file at plan-write time). The README update is a documentation correction so the chain description matches the actual `package.json` script after this commit lands.

- [ ] **Step 1: Edit `frontend/package.json`**

Locate the `preflight` script:

```json
"preflight": "npm run typecheck && npm run build && npm run test:e2e && npm run test",
```

Replace with:

```json
"preflight": "npm run typecheck && npm run build && npm run test:e2e && npm run test && npx knip --strict --no-progress",
```

- [ ] **Step 1b: Update `frontend/README.md` preflight-chain documentation**

In `frontend/README.md`, locate the "Tests and pre-merge gate" section's `npm run preflight` comment line. It currently reads:

```bash
npm run preflight    # typecheck → build → test:e2e → test
```

Replace with:

```bash
npm run preflight    # typecheck → build → test:e2e → test → knip --strict
```

Also delete the parenthetical line below the code block that says "(Phase 1 appends `knip --strict` to this chain in its final commit; if you're reading this README in a tree after that lands, the chain ends with `→ knip --strict`.)" — this is now stale because Phase 1's final commit is THIS one.

- [ ] **Step 2: Run preflight end-to-end as the final merge gate**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: all five steps green, including the new `npx knip --strict --no-progress` at the end.

**Critical gate per Spec 16 §7 R5:** if `knip --strict` fails, Steps 2–6 missed something — there's still a knip-flagged finding the phase didn't resolve. Re-read the failing knip output, decide:
- (a) **Resolve the finding in a follow-on commit on this branch** (preferred for findings inside in-scope areas — adds a final cleanup commit before merge), or
- (b) **If failing findings are confined to `src/components/ui/`** (shadcn primitives that Spec 16 §2.2 + §8 explicitly leave in place — "locked from Phase 4 onward; any unused shadcn primitives flagged by knip log as `TD-FE-<n>` and stay in place"), add `"src/components/ui/**"` to `frontend/knip.json`'s `ignore` array and re-run preflight. This is the spec-mandated path for shadcn findings: removing them would violate the Phase 4 lock, and reverting the gate punishes the whole codebase for an out-of-scope category. Knip `ignore` entries do NOT generate configuration hints (done-when item 3 stays satisfied). Log the affected primitive file count as `TD-FE-<n>` in `docs/TECH_DEBT.md` with trigger "Phase 4 shadcn primitive consolidation", then ship a single follow-on commit `chore(fe): ignore src/components/ui/ in knip (shadcn primitives locked per Spec 16 §2.2)`, or
- (c) **Revert the `--strict` switch and log the residual as `TD-FE-<n>`**, then re-attempt the switch in a later phase. Last resort.

Order of preference: (a) > (b) > (c). Option (a) is the spec's intent — fix the finding in-scope. Option (b) is the spec-mandated path for shadcn-only failures (avoids both spec violation and gate punt). Option (c) defeats the purpose of wiring the gate and should be reserved for cases where failing findings can't be cleanly bucketed.

- [ ] **Step 3: Verify `frontend/scripts/preflight.sh` still works as a wrapper**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
./frontend/scripts/preflight.sh
```

Expected: same output as `npm run preflight` but with the section-header dressing and total-time footer from the wrapper. The wrapper's comment block at the top references "1 → + knip --strict" — that comment is now accurate.

(Optional: update the wrapper's comment block to reflect that knip --strict is now wired. The body says `# 1 → + knip --strict (after Phase 1's dead-code cleanup; currently red — 32 unused files)` — the parenthetical is now stale. If the comment matters for future readers, edit it in this same commit; if not, leave for a follow-on.)

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/package.json frontend/README.md
git commit -m "$(cat <<'EOF'
chore(fe): wire knip --strict --no-progress into npm run preflight

Final commit of Phase 1's chain. The Step 1 refined knip config + Steps
2-6 removals + Step 5 export trims should leave knip --strict green;
this commit makes that the merge gate.

frontend/scripts/preflight.sh delegates via `npm run preflight` and needs
no edit — Spec 16 §3 Step 7 item 2 explicitly notes this to avoid
double-running. frontend/README.md updated to reflect the new preflight
chain (added `→ knip --strict` to the documented chain comment).

Spec 16 §3 Step 7 item 2; §5 done-when item 4.
EOF
)"
```

### Task 7.3 — Update Spec 14's status table at merge

**Files:**
- Modify: `specs/14-frontend-refactoring-master-plan-design.md` (§4 status table row for Phase 1)

This is done as part of the merge commit (post-impl-review, controller-driven), NOT as a Phase-1-branch commit. The plan documents it here so the executor surfaces it to the controller at hand-off.

- [ ] **Step 1: Surface the status update to the merge-commit author**

In the impl-review hand-off message, include:

> Before merging `phase-1-loc-reduction` to `master`, edit `specs/14-frontend-refactoring-master-plan-design.md` §4 status table:
> - Phase 1 row: `pending` → `done`
> - Fill the merge date column with today's date (or the actual merge date if later)
>
> Make this edit on `master` after the merge, or include it in the merge commit. Spec 16 §5 done-when item 8.

The controller (running `git merge phase-1-loc-reduction` on `master`) is responsible for this final edit. The executor does NOT make this edit on the feature branch — it lives on `master` only.

---

## Done-when (Spec 16 §5 mapping)

| Spec 16 §5 item | Plan task that satisfies it | Verification |
|---|---|---|
| 1. Final scorecard committed | Task 7.1 | Scorecard file exists at `docs/audits/2026-05-27-frontend-loc-pass-1.md` covering §4.1 assertions 1–5 |
| 2. Every `execute` finding from Step 1 + Step 3 baselines applied or documented | Tasks 2, 4, 5, 6.2 | Scorecard §3 per-file verdict table has a row per originally-flagged dead file |
| 3. Knip config has zero hints | Task 1 Step 4 | `grep -c "Configuration hint" docs/audits/2026-05-27-frontend-deadcode-knip-refined.txt` returns 0 |
| 4. `knip --strict --no-progress` appended to `preflight` script in `frontend/package.json` only | Task 7.2 | `grep '"preflight"' frontend/package.json` shows the appended invocation |
| 5. `npm run preflight` green end-to-end | Task 7.2 Step 2 | Final `npm run preflight` invocation returns 0 |
| 6. All 32 originally-flagged dead-file flags have verdict in scorecard §3 | Task 7.1 Step 3 | Scorecard §3 table has ≥32 rows |
| 7. `TD-FE-<n>` entries written to `docs/TECH_DEBT.md` for every deferral | Steps 4, 5 loops (per-deferral) | Each deferral row in scorecard §3 links to a real TD-FE-<n> entry |
| 8. Spec 14 §4 row updated to `done` at merge | Task 7.3 (controller-driven) | Merge commit modifies `specs/14-frontend-refactoring-master-plan-design.md` |

---

## Post-impl-review hand-off checklist

After `/review-impl` + `/synthesize-impl-review` cycles converge clean:

1. Surface Task 7.3 to the controller — Spec 14 §4 status table edit happens on `master` post-merge
2. The controller runs `cd frontend && npm run preflight` one more time on the feature branch (already green per Task 7.2 Step 2, but recommended as a sanity check before merge)
3. Controller merges: `git checkout master && git merge phase-1-loc-reduction && git push origin master`
4. Delete the feature branch: `git branch -d phase-1-loc-reduction && git push origin --delete phase-1-loc-reduction`

The next phase (Phase 2a — strict TS) inherits the cleaned-up tree and the `knip --strict` merge gate.
