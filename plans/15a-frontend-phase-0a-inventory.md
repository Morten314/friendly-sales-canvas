# Phase 0a — Frontend Inventory + Safety Net Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land Phase 0a deliverables from `specs/15-frontend-phase-0-inventory-and-safety-net-design.md` §2.9 — audit scorecard, knip output, bundle + NFR baselines, tightened Playwright visual lock, preflight script scaffolding (`npm run preflight` + `frontend/scripts/preflight.sh`), bun lockfile delete — on a `phase-0a-inventory` branch, merged to `master` after impl review converges.

**Architecture:** Eight commits on one branch, ordered by dependency. Pin Playwright exact → tighten visual threshold + refresh snapshots → delete bun lockfiles → install knip → bundle baseline → NFR baseline → audit scorecard (consumes knip JSON) → preflight script + npm script chain → final sanity-check + hand-off. The bun delete precedes knip per spec §2.2 ("Run against the post-0a-cleanup tree"). Each task is one commit; cross-cutting changes that touch `package.json` + `package-lock.json` together (knip install, bundle-deps install) ship as one commit per CLAUDE.md "Cross-stack atomicity." Per spec §2.7, this repo has no CI — the preflight script is the entire pre-merge gate, run locally by the controller agent.

**Parallelization opportunities (subagent-driven execution mode):** After Task 2 completes, three independent chains can dispatch in parallel: `[Task 3 → Task 4 → Task 7]` (bun delete → knip → scorecard, sequential because Task 7 consumes Task 4's knip JSON), `[Task 5]` (bundle baseline), and `[Task 6]` (NFR baseline). Caveat: Tasks 4 and 5 both run `npm install`, so they truly parallelize only when subagent worktrees give each its own working tree; in a shared working tree they serialize on the lockfile. Tasks 8 and 9 must run after all three chains complete. Single-agent inline execution runs everything sequentially per the task numbering.

**Abort criteria.** Per-task STOP conditions are documented inline (Tasks 0/2/3/5/6). In addition, two plan-level escalations apply:

1. **Per-task budget.** If any single task fails after two independent debug attempts (i.e., two attempts to fix the root cause, not retries of the same approach), pause and report to the operator for a go/no-go decision rather than continuing the debug loop.
2. **Task 9 preflight budget.** If `npm run preflight` cannot be made green within 3 distinct fix attempts on `phase-0a-inventory`, log the failing-preflight findings to `docs/TECH_DEBT.md` (which check failed, error pattern, hypothesis) and report to the operator. Repeated failures often indicate environment-specific issues (spec §6 R0a-3) that warrant explicit handling rather than continued patching.

These thresholds are starting values; the operator can tighten or loosen per execution observation.

**Tech Stack:** Node 22 + npm 10 + TypeScript 5.5 + Vite 5 + Playwright 1.59.1 + knip 5.x + gzip-size 7.x (ESM) + tsx (run TS scripts) + bash (NFR measurement script) + ripgrep (audit data gathering).

**Pre-flight assumption:** Working tree is on `master` and clean. Run `git status` to confirm before starting Task 0.

**Where to run commands:** Per CLAUDE.md "Run tooling from the correct subdir," npm/vite/eslint/playwright commands run from `frontend/`. Plan steps below use absolute paths so they're unambiguous; engineer's `cd` is `frontend/` for any `npm`/`npx` invocation unless noted.

---

## File Structure

**Created:**
- `frontend/knip.json` — knip config (entry points: `src/main.tsx`, `vite.config.ts`, `playwright.config.ts`, `e2e/**/*.spec.ts`)
- `frontend/scripts/capture-bundle-baseline.ts` — post-build script reading `dist/`, using `gzip-size` to write per-chunk uncompressed + gzipped sizes
- `frontend/scripts/measure-baselines.sh` — NFR measurement (3-run median for tsc/build/dev-start/playwright)
- `frontend/scripts/build-audit-scorecard.ts` — joins knip JSON + per-file LOC + static-ref counts (ripgrep) into the Tier 1 + Tier 2 markdown scorecard
- `frontend/scripts/preflight.sh` — thin bash wrapper for `npm run preflight` with section headers + per-check timing (same style as `measure-baselines.sh`)
- `docs/audits/2026-05-26-frontend-baseline.md` — Tier 1 summary + Tier 2 per-file annex
- `docs/audits/2026-05-26-frontend-deadcode-knip.json` — knip raw output (JSON reporter)
- `docs/audits/2026-05-26-frontend-deadcode-knip.txt` — knip raw output (default reporter, human-readable)
- `docs/audits/2026-05-26-frontend-bundle-baseline.json` — per-chunk size + gzip JSON
- `docs/audits/2026-05-26-frontend-nfr-baseline.json` — tsc/build/dev-start/playwright median wall times + hardware metadata

**Modified:**
- `frontend/package.json` — pin `@playwright/test` to exact `1.59.1` (drop caret); add devDeps `knip@^5`, `gzip-size@^7`, `tsx@^4`; add npm scripts `typecheck` (`tsc --noEmit`) and `preflight` (`npm run typecheck && npm run build && npm run test:e2e`)
- `frontend/package-lock.json` — regenerated by the npm installs above
- `frontend/playwright.config.ts` — `maxDiffPixels: 100` → `maxDiffPixelRatio: 0.01`; add 4-line comment block above `expect` documenting `npm run test:e2e:update-snapshots` and the Docker-image note for macOS/Windows authors

**Deleted:**
- `frontend/bun.lock`
- `frontend/bun.lockb`

**Snapshots refreshed (only if Task 2's check finds ≤25% failure rate):**
- Any of the 20 PNGs under `frontend/e2e/journeys/*-snapshots/` and `frontend/e2e/stubs/*-snapshots/` that fail the tightened threshold.

---

## Task 0: Branch Setup

**Files:** none (git operations only).

- [ ] **Step 1: Verify clean working tree on master**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git status
git branch --show-current
```

Expected: `master`, "nothing to commit, working tree clean".

If working tree is dirty: STOP. Resolve uncommitted changes before continuing — do not stash silently.

- [ ] **Step 2: Pull latest master**

```bash
git pull --ff-only origin master
```

Expected: "Already up to date." or a fast-forward report. Non-fast-forward → STOP, investigate before continuing.

- [ ] **Step 3: Create and checkout the feature branch**

```bash
git checkout -b phase-0a-inventory
```

Expected: "Switched to a new branch 'phase-0a-inventory'".

- [ ] **Step 4: Confirm Node and npm versions**

```bash
node --version
npm --version
```

Expected: Node `v22.x.x` (LTS), npm `10.x.x` or higher. If Node is `v20.x`: the preflight chain doesn't pin a Node version (it uses whatever Node is on PATH), so no Task 8 edit is needed; just record the local version in the impl-review handoff for any future agent reproducing the run.

No commit at this task — only branch setup.

---

## Task 1: Pin @playwright/test to Exact Version

**Files:**
- Modify: `frontend/package.json` (devDependencies)
- Modify: `frontend/package-lock.json` (regenerated)

Rationale (spec §1.3, §6 R0a-5): the locally-baselined PNGs were captured against a specific Chromium binary that ships with `@playwright/test@1.59.1`. A caret-range bump in `package.json` would silently change the Chromium binary on any controller/agent machine that runs `npm install`, breaking pixel-diff against those snapshots. Exact pin ensures `npm ci` always installs the same Chromium across machines. (The §2.6 Docker-image command also references `v1.59.1-jammy` for cross-OS authoring; the pin keeps the npm side in lockstep with that opt-in workflow.)

- [ ] **Step 1: Edit `frontend/package.json` to remove the caret**

In `frontend/package.json`, in `devDependencies`, change:

```json
"@playwright/test": "^1.59.1",
```

to:

```json
"@playwright/test": "1.59.1",
```

(Remove the `^` only. All other fields unchanged.)

- [ ] **Step 2: Regenerate the lockfile**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm install
```

Expected: npm reports a small number of changes (the lockfile range pin shifts but the installed version doesn't change because the cache already has 1.59.1). No warnings about peer dependencies that weren't already there.

- [ ] **Step 3: Verify the pin took**

```bash
grep -E '"@playwright/test"' frontend/package.json
```

Expected output (exact):

```
    "@playwright/test": "1.59.1",
```

If the caret is still present: re-edit and re-run `npm install`.

- [ ] **Step 4: Sanity-check that Playwright still runs**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx playwright --version
```

Expected: `Version 1.59.1`.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/package.json frontend/package-lock.json
git commit -m "$(cat <<'EOF'
chore(fe): pin @playwright/test to exact 1.59.1

The locally-baselined PNGs were captured against the Chromium binary that
ships with @playwright/test@1.59.1. A caret range would silently change
that binary on the next `npm install`, breaking pixel-diff. Exact pin
keeps every controller/agent machine's Chromium in lockstep with the
committed snapshots. Spec 15 §6 R0a-5.
EOF
)"
```

Expected: one commit on `phase-0a-inventory` touching `frontend/package.json` and `frontend/package-lock.json`.

---

## Task 2: Tighten Visual Threshold, Refresh Snapshots, Document Re-baseline Workflow

**Files:**
- Modify: `frontend/playwright.config.ts:31-37`
- Modify: any PNG under `frontend/e2e/journeys/*-snapshots/` or `frontend/e2e/stubs/*-snapshots/` that fails under the tighter threshold

Rationale (spec §2.5, §2.6): replace `maxDiffPixels: 100` (absolute count) with `maxDiffPixelRatio: 0.01` (1% of total pixels). At 1280×720 viewport that's ~9,216 pixels — looser than 100, deliberately. Spec §7.1 picked 1.0% as the conservative end of the master spec's 0.5–1.0% range. Same commit also adds a 4-line comment block above `expect` documenting the local re-baseline command (spec §2.6) and the Docker-image note for macOS/Windows authors.

- [ ] **Step 1: Update `frontend/playwright.config.ts`**

Replace the existing `expect` block (lines 31–37 of the current file) with:

```ts
  expect: {
    // Re-baseline visual snapshots when an intentional UI change is accepted:
    //   npm run test:e2e:update-snapshots
    // On macOS/Windows, run inside the Playwright Docker image so PNGs are
    // pixel-stable across host OS:
    //   docker run --rm -v "$PWD:/work" -w /work mcr.microsoft.com/playwright:v1.59.1-jammy \
    //     bash -c "npm ci && npm run test:e2e:update-snapshots"
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,   // 1% of total pixels — was maxDiffPixels: 100, an absolute count; now a ratio
      threshold: 0.2,            // per-pixel color tolerance — unchanged
      animations: 'disabled',
    },
  },
```

- [ ] **Step 2: Run the full Playwright suite once and capture failure count**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run test:e2e 2>&1 | tee /tmp/phase-0a-playwright-initial.log
```

Expected: a summary line like `N passed (M.Ms)` or `X failed, N passed (M.Ms)`. The full suite currently has 20 committed snapshots across 4 journeys + 5 stubs (spec §1.3) plus the non-screenshot smoke checks in journeys 02 and 04.

- [ ] **Step 3: Count failures and apply the 25% gate**

Count `expect.toHaveScreenshot` failures only (not other expect failures, which would be a different bug).

```bash
grep -cE "Screenshot comparison failed|toHaveScreenshot" /tmp/phase-0a-playwright-initial.log || true
```

Threshold: more than 5 of 20 (>25%) is the spec §2.5 investigation trigger.

- If failure count is **0**: skip to Step 5.
- If failure count is **1–5 (≤25%)**: proceed to Step 4 (re-baseline).
- If failure count is **>5 (>25%)**: **STOP**. Do not re-baseline. Log a TD-FE entry in `docs/TECH_DEBT.md` describing the unexpected failure rate, paste the failing test names and a representative diff. Investigate whether the existing baselines were hiding latent flakiness. Resolve, then re-attempt Steps 2–3.

- [ ] **Step 4: Re-baseline only if ≤25% failed**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run test:e2e:update-snapshots
```

Expected: the failed snapshots are rewritten in place under `e2e/journeys/*-snapshots/` and `e2e/stubs/*-snapshots/`. PNGs remain `*-chromium-linux-linux.png` (filename convention preserved).

- [ ] **Step 5: Verify the suite is now green**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run test:e2e
```

Expected: all tests pass. If any fail: STOP, do not commit; investigate.

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/playwright.config.ts frontend/e2e/journeys frontend/e2e/stubs
git status   # confirm the diff is only playwright.config.ts + PNGs (no source files)
git commit -m "$(cat <<'EOF'
test(fe): tighten visual threshold to maxDiffPixelRatio 0.01 + document local re-baseline

Replaces the absolute maxDiffPixels: 100 with maxDiffPixelRatio: 0.01 (1%
of total pixels at 1280x720 — ~9,216px). Comment block above the expect
block documents the local re-baseline command and the Docker-image
fallback for macOS/Windows authors so snapshots stay pixel-stable across
host OS. Failing snapshots refreshed in this commit. Spec 15 §2.5 + §2.6.
EOF
)"
```

If no PNGs changed (Step 3 found zero failures), the commit only updates `playwright.config.ts`. That's fine.

---

## Task 3: Delete Bun Lockfiles

**Files:**
- Delete: `frontend/bun.lock`
- Delete: `frontend/bun.lockb`

Rationale (spec §2.8): `package-lock.json` is the active lockfile per the empirical commit-author evidence; `bun.lock` and `bun.lockb` are stale dual-tracking artifacts. The recent `a444436 test(fe): add Playwright dev dependency` updated `package-lock.json` only; `bun.lock` has no `@playwright/test` entry. CLAUDE.md uses `npm`.

This deletion must precede Task 4 (knip install) per spec §2.2 ("Run against the post-0a-cleanup tree").

- [ ] **Step 1: Verify the bun lockfiles exist**

```bash
ls frontend/bun.lock frontend/bun.lockb
```

Expected: both files listed. If either is missing, drop it from Step 2.

- [ ] **Step 2: Delete both files**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git rm frontend/bun.lock frontend/bun.lockb
```

Expected: `rm 'frontend/bun.lock'` and `rm 'frontend/bun.lockb'` confirmation.

- [ ] **Step 3: Confirm package-lock.json is the only lockfile**

```bash
ls frontend/*.lock* 2>/dev/null
ls frontend/package-lock.json
```

Expected: first command finds nothing; second confirms `package-lock.json` remains.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore(fe): delete stale bun lockfiles (npm is the active workflow)

The Brewra dev (tech-brewra) authored 3 commits on frontend/package-lock.json
(Dec 2025 – Jan 2026) and 1 incidental commit each on bun.lock / bun.lockb.
Recent a444436 (Playwright dev dep) updated package-lock.json only; bun.lock
had no @playwright/test entry. CLAUDE.md uses npm. The bun lockfiles are
pre-fork PWA dual-tracking artifacts.

Spec 15 §2.8.
EOF
)"
```

---

## Task 4: Install knip, Configure, Capture Dead-Code Baseline

**Files:**
- Modify: `frontend/package.json` (add `knip` to devDependencies)
- Modify: `frontend/package-lock.json` (regenerated)
- Create: `frontend/knip.json`
- Create: `docs/audits/2026-05-26-frontend-deadcode-knip.json`
- Create: `docs/audits/2026-05-26-frontend-deadcode-knip.txt`

Rationale (spec §2.2): knip-only (not ts-prune, not depcheck). For a one-time baseline that feeds Phase 1's triage, knip covers files + exports + deps in one tool and avoids the three-column reconciliation noise. Phase 1 can add ts-prune ad hoc later if it hits a blind spot.

- [ ] **Step 1: Install knip as a devDependency**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm install --save-dev knip@^5
```

Expected: knip ~5.x added to `devDependencies` in `package.json`; `package-lock.json` updated. No peer dep warnings beyond pre-existing ones.

- [ ] **Step 2: Create `frontend/knip.json`**

Write this exact content:

```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": [
    "src/main.tsx",
    "vite.config.ts",
    "playwright.config.ts",
    "e2e/**/*.spec.ts"
  ],
  "project": [
    "src/**/*.{ts,tsx}",
    "e2e/**/*.ts",
    "scripts/**/*.{ts,sh}"
  ],
  "ignore": [
    "dev-dist/**",
    "node_modules/**",
    "dist/**"
  ]
}
```

- [ ] **Step 3: Ensure docs/audits/ exists**

```bash
mkdir -p /projects/Brewra/brewra-gtm-intelligence/docs/audits
```

The directory already exists from prior backend audits, but `mkdir -p` is safe.

- [ ] **Step 4: Run knip in default reporter (human-readable text) and capture**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx knip --no-progress > ../docs/audits/2026-05-26-frontend-deadcode-knip.txt 2>&1 || true
```

The `|| true` is intentional: knip exits non-zero when it finds dead code (which is the whole point here). The output file is the deliverable. Spec §2.2 makes no suppression — maximum signal for Phase 1.

Expected: file written, hundreds of lines covering unused files, exports, types, dependencies, dev-dependencies. The exact counts are what Phase 1 inherits.

- [ ] **Step 5: Run knip in JSON reporter and capture**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx knip --reporter json --no-progress > ../docs/audits/2026-05-26-frontend-deadcode-knip.json 2>/dev/null || true
```

Expected: valid JSON written. Verify shape:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
python3 -c "import json; d=json.load(open('docs/audits/2026-05-26-frontend-deadcode-knip.json')); print(sorted(d.keys()))"
```

Expected: a list including `files` (unused files) and `issues` (per-file issue details). Exact keys depend on knip version but `files` and `issues` are stable in knip 5.x.

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/package.json frontend/package-lock.json frontend/knip.json \
  docs/audits/2026-05-26-frontend-deadcode-knip.json \
  docs/audits/2026-05-26-frontend-deadcode-knip.txt
git commit -m "$(cat <<'EOF'
chore(fe): add knip + capture dead-code baseline

knip-only (not ts-prune/depcheck): for a one-time baseline knip covers
files + exports + deps in one tool with the lowest false-positive surface.
Raw JSON + text outputs both committed so Phase 1's triage has both
machine-parseable and human-readable formats.

Spec 15 §2.2.
EOF
)"
```

---

## Task 5: Capture Bundle Baseline

**Files:**
- Modify: `frontend/package.json` (add `gzip-size@^7`, `tsx@^4` to devDependencies)
- Modify: `frontend/package-lock.json` (regenerated)
- Create: `frontend/scripts/capture-bundle-baseline.ts`
- Create: `docs/audits/2026-05-26-frontend-bundle-baseline.json`

Rationale (spec §2.3): Vite's `reportCompressedSize` log line isn't structured enough for JSON capture. The `gzip-size` npm package gives per-file gzipped sizes from the built `dist/`. Single `chunks` array sorted by `size_bytes` descending — Phase 2c computes its own ordering and slicing when setting budgets.

- [ ] **Step 1: Install gzip-size and tsx**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm install --save-dev gzip-size@^7 tsx@^4
```

Expected: both added to `devDependencies`. `gzip-size` 7.x is ESM-only — `frontend/package.json` already has `"type": "module"`, so ESM imports work directly.

- [ ] **Step 2: Create `frontend/scripts/capture-bundle-baseline.ts`**

```bash
mkdir -p /projects/Brewra/brewra-gtm-intelligence/frontend/scripts
```

Write this exact content to `frontend/scripts/capture-bundle-baseline.ts`:

```ts
import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, resolve, dirname } from 'node:path';
import { gzipSize } from 'gzip-size';

const FRONTEND_DIR = resolve(import.meta.dirname, '..');
const DIST_DIR = join(FRONTEND_DIR, 'dist');
const OUTPUT_FILE = resolve(
  FRONTEND_DIR,
  '..',
  'docs',
  'audits',
  '2026-05-26-frontend-bundle-baseline.json',
);

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.isFile() && /\.(js|css)$/.test(entry.name)) {
      // Spec §2.3 scopes the bundle baseline to .js and .css. Phase 2c can
      // extend if it wants full shipped-size accounting (html, svg, png).
      out.push(full);
    }
  }
  return out;
}

async function main() {
  const files = await walk(DIST_DIR);
  const chunks = await Promise.all(
    files.map(async (full) => {
      const contents = await readFile(full);
      const sizeBytes = (await stat(full)).size;
      const gz = await gzipSize(contents);
      return {
        file: relative(DIST_DIR, full).split('\\').join('/'),
        size_bytes: sizeBytes,
        gzip_bytes: gz,
      };
    }),
  );
  chunks.sort((a, b) => b.size_bytes - a.size_bytes);

  const totals = chunks.reduce(
    (acc, c) => ({
      total_size_bytes: acc.total_size_bytes + c.size_bytes,
      total_size_gzip_bytes: acc.total_size_gzip_bytes + c.gzip_bytes,
    }),
    { total_size_bytes: 0, total_size_gzip_bytes: 0 },
  );

  const payload = {
    captured_at: new Date().toISOString(),
    build_command: 'npm run build',
    ...totals,
    chunks,
  };

  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(payload, null, 2) + '\n');
  console.log(`Wrote ${chunks.length} chunks to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Build the frontend (cold)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
rm -rf dist node_modules/.vite
npm run build
```

Expected: Vite emits `dist/` with `assets/*.js`, `assets/*.css`, `index.html`, and some PWA-related files. Build completes in <60s typically.

**If build fails: STOP.** Do not proceed to Step 4 — an empty or incomplete `dist/` would silently produce a misleading bundle baseline. Investigate the build error before continuing. Common causes: a TypeScript error introduced earlier in the branch, a peer-dep warning surfacing as a real conflict, or a Vite config issue. Re-run after fixing the root cause.

- [ ] **Step 4: Run the bundle-baseline script**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx tsx scripts/capture-bundle-baseline.ts
```

Expected: `Wrote N chunks to .../docs/audits/2026-05-26-frontend-bundle-baseline.json` where N is the number of files matching `.js|.css|.html|.svg` under `dist/`.

- [ ] **Step 5: Verify the JSON shape**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
python3 -c "
import json
d = json.load(open('docs/audits/2026-05-26-frontend-bundle-baseline.json'))
assert set(d.keys()) >= {'captured_at', 'build_command', 'total_size_bytes', 'total_size_gzip_bytes', 'chunks'}, d.keys()
assert isinstance(d['chunks'], list) and len(d['chunks']) > 0
first = d['chunks'][0]
assert set(first.keys()) == {'file', 'size_bytes', 'gzip_bytes'}, first.keys()
sizes = [c['size_bytes'] for c in d['chunks']]
assert sizes == sorted(sizes, reverse=True), 'chunks not sorted by size descending'
print(f'OK — {len(d[\"chunks\"])} chunks, total {d[\"total_size_bytes\"]} bytes ({d[\"total_size_gzip_bytes\"]} gz)')
"
```

Expected: `OK — N chunks, total <bytes> bytes (<gz bytes> gz)`. Any assertion failure → fix the script before continuing.

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/package.json frontend/package-lock.json \
  frontend/scripts/capture-bundle-baseline.ts \
  docs/audits/2026-05-26-frontend-bundle-baseline.json
git commit -m "$(cat <<'EOF'
chore(fe): capture bundle baseline (gzip-size per chunk)

Vite's reportCompressedSize log line isn't structured enough for JSON
capture. The script walks dist/ post-build and writes per-chunk
uncompressed + gzipped sizes, sorted descending. Phase 2c computes its
own top-N slicing when setting budgets.

Spec 15 §2.3.
EOF
)"
```

**Regression gate for Tasks 4 + 5 devDep additions.** Tasks 4 (knip) and 5 (gzip-size, tsx) added devDependencies that are tooling-only — none are imported into production code or Playwright config, so direct regression risk is near-zero. Empirical regression coverage is provided by Task 6 (next), which runs `npm run test:e2e` three times as part of NFR measurement. If any of those runs fails when previous Playwright runs (Task 2) passed, the failure is attributable to the devDep installs in Tasks 4–5 and must be investigated before proceeding. No additional Playwright re-run is added here because Task 6's 3× runs already serve this purpose at zero extra cost.

---

## Task 6: Capture NFR Baselines

**Files:**
- Create: `frontend/scripts/measure-baselines.sh`
- Create: `docs/audits/2026-05-26-frontend-nfr-baseline.json`

Rationale (spec §2.4): 3-run median for tsc/build/dev-start/playwright, with explicit cold-cache cleanup between runs. Local-only (~10–20 min runtime), not CI. Phase 2c re-measures against the wired pipeline and sets budgets.

- [ ] **Step 1: Create `frontend/scripts/measure-baselines.sh`**

Write this exact content:

```bash
#!/usr/bin/env bash
# Phase 0a NFR baseline capture. Spec 15 §2.4.
# 3-run median for: tsc --noEmit, vite build, vite dev cold start, playwright full suite.
# Runtime: 10-20 minutes on typical dev hardware. Local-only, not CI.

set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_FILE="$FRONTEND_DIR/../docs/audits/2026-05-26-frontend-nfr-baseline.json"
RUNS=3

cd "$FRONTEND_DIR"

# ---------- helpers ----------

# median min max <list-of-floats>
median_min_max() {
  python3 -c "
import statistics, sys
vals = sorted(float(x) for x in sys.argv[1:])
print(f'{statistics.median(vals):.3f} {vals[0]:.3f} {vals[-1]:.3f}')
" "$@"
}

# wall-clock seconds for a command
time_cmd() {
  local start end
  start=$(python3 -c 'import time; print(time.time())')
  "$@" > /dev/null 2>&1
  end=$(python3 -c 'import time; print(time.time())')
  # Pass values via argv (not shell interpolation into Python source) so the
  # subtraction is robust even if Python ever changed float formatting.
  python3 -c "import sys; print(f'{float(sys.argv[1]) - float(sys.argv[2]):.3f}')" "$end" "$start"
}

# wall-clock from start until log file contains "ready in", with a 60s timeout
# so the NFR script can't hang indefinitely if vite hangs without crashing.
time_dev_start() {
  local logfile="/tmp/phase-0a-vite-dev.$$.log"
  local start end vite_pid elapsed
  local timeout_seconds=60
  start=$(python3 -c 'import time; print(time.time())')
  npx vite --port 5173 > "$logfile" 2>&1 &
  vite_pid=$!
  while ! grep -q "ready in" "$logfile" 2>/dev/null; do
    # Bail if vite died.
    if ! kill -0 "$vite_pid" 2>/dev/null; then
      cat "$logfile" >&2
      rm -f "$logfile"
      echo "vite exited before ready" >&2
      exit 1
    fi
    # Bail if the timeout elapsed (vite alive but stuck — e.g., unresolved module).
    elapsed=$(python3 -c "import sys, time; print(time.time() - float(sys.argv[1]))" "$start")
    if python3 -c "import sys; sys.exit(0 if float(sys.argv[1]) > float(sys.argv[2]) else 1)" "$elapsed" "$timeout_seconds"; then
      cat "$logfile" >&2
      kill "$vite_pid" 2>/dev/null || true
      wait "$vite_pid" 2>/dev/null || true
      rm -f "$logfile"
      echo "vite did not become ready within ${timeout_seconds}s" >&2
      exit 1
    fi
    sleep 0.05
  done
  end=$(python3 -c 'import time; print(time.time())')
  kill "$vite_pid" 2>/dev/null || true
  wait "$vite_pid" 2>/dev/null || true
  rm -f "$logfile"
  python3 -c "import sys; print(f'{float(sys.argv[1]) - float(sys.argv[2]):.3f}')" "$end" "$start"
}

# ---------- measurements ----------

echo "[1/4] tsc --noEmit ($RUNS runs, no cache to clear)" >&2
tsc_times=()
for i in $(seq 1 "$RUNS"); do
  t=$(time_cmd npx tsc --noEmit)
  echo "  run $i: ${t}s" >&2
  tsc_times+=("$t")
done

echo "[2/4] vite build ($RUNS runs, cold each run)" >&2
build_times=()
for i in $(seq 1 "$RUNS"); do
  rm -rf dist node_modules/.vite
  t=$(time_cmd npm run build)
  echo "  run $i: ${t}s" >&2
  build_times+=("$t")
done

echo "[3/4] vite dev cold start ($RUNS runs)" >&2
dev_times=()
for i in $(seq 1 "$RUNS"); do
  rm -rf node_modules/.vite
  t=$(time_dev_start)
  echo "  run $i: ${t}s" >&2
  dev_times+=("$t")
done

echo "[4/4] playwright full suite ($RUNS runs)" >&2
playwright_times=()
for i in $(seq 1 "$RUNS"); do
  t=$(time_cmd npm run test:e2e)
  echo "  run $i: ${t}s" >&2
  playwright_times+=("$t")
done

# ---------- compose JSON ----------

read tsc_med tsc_min tsc_max < <(median_min_max "${tsc_times[@]}")
read build_med build_min build_max < <(median_min_max "${build_times[@]}")
read dev_med dev_min dev_max < <(median_min_max "${dev_times[@]}")
read pw_med pw_min pw_max < <(median_min_max "${playwright_times[@]}")

# Hardware metadata
OS_NAME="$(uname -srm)"
if [[ "$(uname)" == "Darwin" ]]; then
  CPU_MODEL="$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo 'unknown')"
  RAM_GB="$(($(sysctl -n hw.memsize) / 1024 / 1024 / 1024))"
else
  CPU_MODEL="$(grep -m1 'model name' /proc/cpuinfo 2>/dev/null | sed 's/.*: //' || uname -m)"
  RAM_GB="$(( $(grep MemTotal /proc/meminfo | awk '{print $2}') / 1024 / 1024 ))"
fi
NODE_VER="$(node --version)"
NPM_VER="$(npm --version)"
CAPTURED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

mkdir -p "$(dirname "$OUTPUT_FILE")"
cat > "$OUTPUT_FILE" <<JSON
{
  "captured_at": "$CAPTURED_AT",
  "captured_on": "local-dev-machine",
  "hardware": {
    "os": "$OS_NAME",
    "cpu_model": "$CPU_MODEL",
    "ram_gb": $RAM_GB,
    "node_version": "$NODE_VER",
    "npm_version": "$NPM_VER"
  },
  "tsc_noemit_seconds":          { "median": $tsc_med,   "min": $tsc_min,   "max": $tsc_max },
  "vite_build_seconds":          { "median": $build_med, "min": $build_min, "max": $build_max },
  "vite_dev_start_seconds":      { "median": $dev_med,   "min": $dev_min,   "max": $dev_max },
  "playwright_full_suite_seconds": { "median": $pw_med,    "min": $pw_min,    "max": $pw_max }
}
JSON

echo "" >&2
echo "Wrote $OUTPUT_FILE" >&2
```

- [ ] **Step 2: Make the script executable**

```bash
chmod +x /projects/Brewra/brewra-gtm-intelligence/frontend/scripts/measure-baselines.sh
```

- [ ] **Step 3: Run the script (10–20 minutes)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
./frontend/scripts/measure-baselines.sh
```

Expected: progress lines for each of the 4 measurements (3 runs each), then a final "Wrote ..." line. Total runtime ~10–20 minutes depending on hardware. If any measurement fails (e.g., dev-start can't find "ready in"), STOP and debug — the script bails on first failure.

- [ ] **Step 4: Validate the output JSON shape**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
python3 -c "
import json
d = json.load(open('docs/audits/2026-05-26-frontend-nfr-baseline.json'))
assert set(d.keys()) == {'captured_at', 'captured_on', 'hardware',
                          'tsc_noemit_seconds', 'vite_build_seconds',
                          'vite_dev_start_seconds', 'playwright_full_suite_seconds'}, d.keys()
hw = d['hardware']
assert set(hw.keys()) == {'os', 'cpu_model', 'ram_gb', 'node_version', 'npm_version'}, hw.keys()
for k in ('tsc_noemit_seconds', 'vite_build_seconds', 'vite_dev_start_seconds', 'playwright_full_suite_seconds'):
    assert set(d[k].keys()) == {'median', 'min', 'max'}, (k, d[k].keys())
    assert d[k]['min'] <= d[k]['median'] <= d[k]['max'], k
print('OK')
print(f'  tsc median:        {d[\"tsc_noemit_seconds\"][\"median\"]}s')
print(f'  vite build median: {d[\"vite_build_seconds\"][\"median\"]}s')
print(f'  vite dev median:   {d[\"vite_dev_start_seconds\"][\"median\"]}s')
print(f'  playwright median: {d[\"playwright_full_suite_seconds\"][\"median\"]}s')
"
```

Expected: `OK` plus the four median lines. Sanity-check magnitudes: tsc on 75k LOC is typically 5–20s; vite build 10–30s; dev start 0.5–3s; Playwright 30–120s.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/scripts/measure-baselines.sh docs/audits/2026-05-26-frontend-nfr-baseline.json
git commit -m "$(cat <<'EOF'
chore(fe): capture NFR baselines (tsc / build / dev-start / playwright)

3-run median wall times with explicit cold-cache cleanup between runs.
Local-only (10-20 min runtime); Phase 2c re-measures `npm run preflight`
once all checks are wired into the chain and sets the actual budgets.
The structured hardware block lets Phase 2c programmatically compare the
anchor environment to whatever machine eventually runs the full preflight.

Spec 15 §2.4.
EOF
)"
```

---

## Task 7: Build Audit Scorecard

**Files:**
- Create: `frontend/scripts/build-audit-scorecard.ts`
- Create: `docs/audits/2026-05-26-frontend-baseline.md`

Rationale (spec §2.1, §6 R0a-1): "Tooling-driven, not narrative." The script joins per-file LOC + ripgrep static inbound-ref counts + knip JSON findings into the Tier 1 + Tier 2 markdown tables. After the script produces the skeleton, the engineer augments the notes column with Phase-1-meaningful observations (Lovable artifacts, loose components, monster files, false-positive flags from spec §2.2's 5 categories).

- [ ] **Step 1: Confirm ripgrep is installed**

```bash
rg --version
```

Expected: `ripgrep 13.x` or similar. If not installed: `apt install ripgrep` (sandbox) or `brew install ripgrep` (macOS).

- [ ] **Step 2: Create `frontend/scripts/build-audit-scorecard.ts`**

Write this exact content:

```ts
import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, relative, resolve, dirname, basename } from 'node:path';

const execFileP = promisify(execFile);

const FRONTEND_DIR = resolve(import.meta.dirname, '..');
const SRC_DIR = join(FRONTEND_DIR, 'src');
const KNIP_JSON = resolve(
  FRONTEND_DIR,
  '..',
  'docs',
  'audits',
  '2026-05-26-frontend-deadcode-knip.json',
);
const OUTPUT_FILE = resolve(
  FRONTEND_DIR,
  '..',
  'docs',
  'audits',
  '2026-05-26-frontend-baseline.md',
);

interface FileRow {
  path: string;            // relative to frontend/
  area: string;            // top-level grouping label
  loc: number;
  staticRefs: number;
  deadExport: boolean;
  deadFile: boolean;
  lovableArtifact: boolean;
  looseComponent: boolean;
  notes: string[];
}

// Lovable-artifact filename patterns (spec §1.5 + CLAUDE.md "Frontend has unused/duplicate cruft").
const LOVABLE_PATTERNS: RegExp[] = [
  /^Safe.*\.(ts|tsx)$/,                     // Safe* wrapper triplet
  /MarketResearch_clean\.tsx$/,             // duplicate of MarketResearch.tsx
  /SafeChatWithScout copy\.tsx$/,           // " copy" suffix
];

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

function classifyArea(relPath: string): string {
  // relPath is e.g. "src/components/customers/Foo.tsx" or "src/lib/utils.ts"
  const parts = relPath.split('/');
  if (parts[0] !== 'src') return 'other';
  if (parts.length === 2) return 'root';                        // src/App.tsx, src/main.tsx
  if (parts[1] === 'components') {
    if (parts.length === 3) return 'components/ (loose)';       // src/components/Foo.tsx
    return `components/${parts[2]}/`;                            // src/components/customers/Foo.tsx
  }
  return `${parts[1]}/`;                                         // src/lib/, src/hooks/, etc.
}

async function countLoc(absPath: string): Promise<number> {
  const buf = await readFile(absPath, 'utf-8');
  return buf.split('\n').length;
}

async function collectAllImports(): Promise<Map<string, number>> {
  // Single ripgrep pass to extract every `from '<path>'` import string across
  // src/ and e2e/. Returns a Map of import path → occurrence count. The
  // per-file countRefs lookup then aggregates from this map in O(map size)
  // rather than spawning ripgrep per source file (which was O(files) process
  // spawns at hundreds of files).
  const { stdout } = await execFileP(
    'rg',
    [
      '--no-heading',
      '--no-filename',
      '--only-matching',
      '--glob', '*.ts',
      '--glob', '*.tsx',
      `from ['\"][^'\"]+['\"]`,
      join(FRONTEND_DIR, 'src'),
      join(FRONTEND_DIR, 'e2e'),
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  const counts = new Map<string, number>();
  for (const line of stdout.split('\n')) {
    const m = line.match(/from ['"]([^'"]+)['"]/);
    if (!m) continue;
    const importPath = m[1];
    counts.set(importPath, (counts.get(importPath) ?? 0) + 1);
  }
  return counts;
}

function countRefsFor(allImports: Map<string, number>, relPathNoExt: string): number {
  // Match imports whose path ends with the file's src-relative path (sans ext).
  // Preserves the original countStaticRefs semantics: `@/lib/utils`, `../lib/utils`,
  // `../../lib/utils` all count for `src/lib/utils.ts`; bare `./utils` does not
  // (matches the documented lower-bound limitation in spec §2.1).
  const suffix = relPathNoExt.replace(/^src\//, '');             // "lib/utils" or "components/customers/Foo"
  let total = 0;
  for (const [importPath, count] of allImports) {
    if (importPath === suffix || importPath.endsWith('/' + suffix)) {
      total += count;
    }
  }
  return total;
}

async function loadKnip(): Promise<{ deadFiles: Set<string>; deadExports: Set<string> }> {
  const raw = await readFile(KNIP_JSON, 'utf-8');
  const parsed = JSON.parse(raw);
  const deadFiles = new Set<string>();
  const deadExports = new Set<string>();

  // knip 5.x JSON: { files: [...], issues: [{file, exports, types, ...}, ...] }
  // Be defensive — accept both array and object shapes.
  const filesField = parsed.files;
  if (Array.isArray(filesField)) {
    for (const f of filesField) deadFiles.add(normalize(f));
  }
  const issuesField = parsed.issues;
  if (Array.isArray(issuesField)) {
    for (const issue of issuesField) {
      const file = normalize(issue.file ?? '');
      if (!file) continue;
      const hasExports =
        (Array.isArray(issue.exports) && issue.exports.length > 0) ||
        (Array.isArray(issue.types) && issue.types.length > 0);
      if (hasExports) deadExports.add(file);
    }
  } else if (issuesField && typeof issuesField === 'object') {
    for (const [file, payload] of Object.entries(issuesField as Record<string, any>)) {
      const f = normalize(file);
      const hasExports =
        (Array.isArray(payload.exports) && payload.exports.length > 0) ||
        (Array.isArray(payload.types) && payload.types.length > 0);
      if (hasExports) deadExports.add(f);
    }
  }
  return { deadFiles, deadExports };

  function normalize(p: string): string {
    // knip emits paths relative to frontend/. Normalize separators.
    return p.replace(/\\/g, '/').replace(/^\.\//, '');
  }
}

function isLovableArtifact(relPath: string): boolean {
  const base = basename(relPath);
  return LOVABLE_PATTERNS.some((re) => re.test(base));
}

function isLooseComponent(relPath: string): boolean {
  // src/components/<file>.tsx (depth-2 under src/)
  const parts = relPath.split('/');
  return parts[0] === 'src' && parts[1] === 'components' && parts.length === 3;
}

function fmtYN(b: boolean): string {
  return b ? 'Y' : 'N';
}

function buildTier1(rows: FileRow[]): string {
  // Aggregate by area.
  const byArea = new Map<string, FileRow[]>();
  for (const r of rows) {
    if (!byArea.has(r.area)) byArea.set(r.area, []);
    byArea.get(r.area)!.push(r);
  }
  const areas = Array.from(byArea.keys()).sort();

  const lines: string[] = [];
  lines.push('| Area | Files | Total LOC | Monster files (>1500) | Dead exports | Dead files | Lovable | Notes |');
  lines.push('|---|---:|---:|---:|---:|---:|:---:|---|');
  for (const area of areas) {
    const files = byArea.get(area)!;
    const fileCount = files.length;
    const totalLoc = files.reduce((s, r) => s + r.loc, 0);
    const monster = files.filter((r) => r.loc > 1500).length;
    const deadExp = files.filter((r) => r.deadExport).length;
    const deadFile = files.filter((r) => r.deadFile).length;
    const lovable = files.some((r) => r.lovableArtifact) ? 'Y' : 'N';
    const notes: string[] = [];
    if (area === 'components/ (loose)') {
      notes.push(`loose under components/ — relocate in Phase 1 or with owning feature's extraction phase`);
    }
    lines.push(`| \`${area}\` | ${fileCount} | ${totalLoc} | ${monster} | ${deadExp} | ${deadFile} | ${lovable} | ${notes.join('; ')} |`);
  }
  return lines.join('\n');
}

function buildTier2(rows: FileRow[]): string {
  rows.sort((a, b) => a.path.localeCompare(b.path));
  const lines: string[] = [];
  lines.push('| Path | LOC | Static refs (rg, lower bound) | Dead export | Dead file | Lovable | Notes |');
  lines.push('|---|---:|---:|:---:|:---:|:---:|---|');
  for (const r of rows) {
    const notes: string[] = [...r.notes];
    if (r.looseComponent) notes.push('loose under components/ — relocate in Phase 1 or with owning feature');
    if (r.loc > 1500) notes.push(`monster file (>1500 LOC)`);
    if (r.lovableArtifact) notes.push('Lovable artifact — Phase 1 deletes');
    lines.push(
      `| \`${r.path}\` | ${r.loc} | ${r.staticRefs} | ${fmtYN(r.deadExport)} | ${fmtYN(r.deadFile)} | ${fmtYN(r.lovableArtifact)} | ${notes.join('; ')} |`,
    );
  }
  return lines.join('\n');
}

async function main() {
  const { deadFiles, deadExports } = await loadKnip();
  const allImports = await collectAllImports();     // one rg pass, before the file loop
  const absFiles = await walk(SRC_DIR);

  const rows: FileRow[] = [];
  for (const abs of absFiles) {
    const rel = relative(FRONTEND_DIR, abs).split('\\').join('/');
    const relNoExt = rel.replace(/\.(ts|tsx)$/, '');
    const loc = await countLoc(abs);
    const staticRefs = countRefsFor(allImports, relNoExt);
    rows.push({
      path: rel,
      area: classifyArea(rel),
      loc,
      staticRefs,
      deadExport: deadExports.has(rel),
      deadFile: deadFiles.has(rel),
      lovableArtifact: isLovableArtifact(rel),
      looseComponent: isLooseComponent(rel),
      notes: [],
    });
  }

  const totalFiles = rows.length;
  const totalLoc = rows.reduce((s, r) => s + r.loc, 0);

  const md = `# Frontend Baseline Audit — 2026-05-26

> Source: Spec 15 §2.1. Generated by \`frontend/scripts/build-audit-scorecard.ts\`. The notes
> columns below are agent-augmented after generation — see "Notes column augmentation" at the end.

**Captured at:** ${new Date().toISOString()}
**Total files:** ${totalFiles}
**Total LOC:** ${totalLoc}
**Source of dead-code flags:** \`docs/audits/2026-05-26-frontend-deadcode-knip.json\`
**Static-ref column note:** lower bound — ripgrep matches \`from '…/<path>'\` only. Misses
dynamic \`import()\`, barrel re-exports, lazy route configs, string-interpolated paths.
The knip dead-file flag is the authoritative dead-file signal.

---

## Tier 1 — Feature-area summary

${buildTier1(rows)}

---

## Tier 2 — Per-file annex

${buildTier2(rows)}

---

## Notes column augmentation

The notes column above is the agent's value-add over raw tool output. Phase 1's triage reads
this column when deciding \`execute\` vs \`investigate\` for each dead-code candidate.

**Categories applied automatically by the generator:**
- \`loose under components/\` — \`.tsx\` files directly under \`src/components/\` (not in a named subfolder)
- \`monster file (>1500 LOC)\`
- \`Lovable artifact — Phase 1 deletes\` — files matching the patterns in \`LOVABLE_PATTERNS\` in the script

**Categories to add manually (one pass over the Tier 2 annex before merging):**
- \`likely false positive — verify call sites\` for knip findings in any of these categories (spec §2.2):
  - Barrel/re-export files (e.g., \`src/components/ui/index.ts\` if present)
  - Dynamic-import targets (e.g., \`lazy(() => import('…'))\` in router config; check \`src/App.tsx\`)
  - React Router lazy route entries
  - Vite plugin transforms (\`?raw\`, \`?url\`, \`?worker\`, PWA-injected entry points)
  - HMR-only entry points (anything wired to \`@vite/client\` or \`vite-plugin-pwa\` lifecycle)
- \`duplicate of <name>\` — for the known FE duplicates per CLAUDE.md:
  - \`SafeChatWithScout copy.tsx\` → duplicate of \`SafeChatWithScout.tsx\`
  - \`MarketResearch_clean.tsx\` → duplicate of \`MarketResearch.tsx\`
  - \`ScoutChatWithHistory\` vs \`ProfilerChatWithHistory\` — flag both as "90% duplicate of each other"
  - \`LeadStream\` if duplicated under market-research/ — flag the duplicate
- \`~150 lines of commented code\` for \`src/components/ICPManager.tsx\` per CLAUDE.md
- \`Safe* wrapper — only SafeMarketIntelligenceTab imported in active paths\` for the Safe* triplet

After applying these augmentations, the scorecard is ready to merge.
`;

  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, md);
  console.log(`Wrote ${totalFiles} files into ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Run the script**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx tsx scripts/build-audit-scorecard.ts
```

Expected: `Wrote N files into .../docs/audits/2026-05-26-frontend-baseline.md` where N is total `.ts`/`.tsx` count under `src/` (will be in the hundreds for 75,894 LOC). Runtime: <30 seconds typically (one ripgrep pass + per-file LOC reads; the previous per-file-ripgrep approach was minutes).

If the script errors on `loadKnip` due to unexpected JSON shape: open `docs/audits/2026-05-26-frontend-deadcode-knip.json`, inspect top-level keys, and adjust the `loadKnip()` function to match. The defensive both-array-and-object handling should cover knip 5.x but versions evolve.

- [ ] **Step 4: Verify the scorecard renders**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
head -60 docs/audits/2026-05-26-frontend-baseline.md
```

Expected: the header, the Tier 1 table, the first rows of Tier 2. Sanity-check that the LOC totals match the spec's 75,894 figure (within rounding for trailing-newline counts).

- [ ] **Step 5: Augment the notes column manually**

Open `docs/audits/2026-05-26-frontend-baseline.md`. For each item in the "Categories to add manually" list at the bottom of the file, find the matching rows in the Tier 2 annex and append the prescribed note to the notes column.

Specific files to find and annotate (drawn from CLAUDE.md "Gotchas" + spec §1.5):

| Tier 2 path to find | Note to append |
|---|---|
| `src/components/SafeChatWithScout copy.tsx` | `duplicate of SafeChatWithScout.tsx` |
| `src/pages/MarketResearch_clean.tsx` | `duplicate of MarketResearch.tsx` |
| `src/components/Safe*.tsx` (any of the triplet) | `Safe* wrapper — only SafeMarketIntelligenceTab imported in active paths` |
| `src/components/ICPManager.tsx` (or `src/components/mission-control/ICPManager.tsx` — whichever exists) | `~150 lines of commented code (per CLAUDE.md Gotchas)` |
| `src/components/strategist/ScoutChatWithHistory.tsx` | `90% duplicate of ProfilerChatWithHistory.tsx` |
| `src/components/strategist/ProfilerChatWithHistory.tsx` | `90% duplicate of ScoutChatWithHistory.tsx` |
| Any knip-flagged file under `src/App.tsx`-referenced lazy routes | `likely false positive — lazy() route entry, verify call sites` |
| Any knip-flagged file matching `*.worker.ts` or imported via `?worker`/`?raw`/`?url` | `likely false positive — Vite plugin transform target, verify call sites` |

Use `grep -n` on the markdown to locate each row quickly:

```bash
grep -n "ICPManager" docs/audits/2026-05-26-frontend-baseline.md
grep -n "MarketResearch_clean" docs/audits/2026-05-26-frontend-baseline.md
```

If a file doesn't exist in the current tree, skip the row — leave the note category in the bottom of the markdown for future-Phase-1 reference.

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/scripts/build-audit-scorecard.ts docs/audits/2026-05-26-frontend-baseline.md
git commit -m "$(cat <<'EOF'
docs(audits): land frontend baseline scorecard (Tier 1 + Tier 2)

Script joins per-file LOC + ripgrep static inbound-ref counts + knip JSON
findings into the Tier 1 area summary and Tier 2 per-file annex. Notes
column is auto-populated for loose-components / monster-files /
Lovable-artifacts, then augmented manually with the duplicate-component
and commented-block observations from CLAUDE.md Gotchas.

Phase 1 reads the notes column to decide execute vs investigate for each
dead-code candidate. Spec 15 §2.1 + §6 R0a-1.
EOF
)"
```

---

## Task 8: Add Preflight Script

**Files:**
- Modify: `frontend/package.json` (add `typecheck` + `preflight` npm scripts)
- Create: `frontend/scripts/preflight.sh` (bash wrapper)

> **Historical note (impl-branch flow only).** An earlier draft of this task created `.github/workflows/ci.yml`. The project subsequently decided against CI of any kind (spec §2.7), so the impl branch's Task 8 commit instead handles two things in one commit: (a) deletes any pre-existing `.github/workflows/ci.yml`, (b) lands the preflight script + npm scripts described below. Future readers running this plan from scratch on a clean tree do not need to delete anything — the deletion is a one-time cleanup for the in-flight `phase-0a-inventory` branch.

Rationale (spec §2.7): this repo has no GitHub Actions and no other external CI. The pre-merge quality gate is `npm run preflight`, run locally by the controller agent immediately before the user-approved merge step. At Phase 0a the chain is the three checks currently green on the codebase (typecheck, build, Playwright). Lint is deferred to Phase 2b for the same reason knip --strict is deferred to Phase 1: the existing `eslint .` script is red with 428 errors at 0a, so including it would make preflight perpetually red until 2b's config cleanup. Each later phase appends one more check to the chain.

- [ ] **Step 1: Add the `typecheck` and `preflight` npm scripts to `frontend/package.json`**

In `frontend/package.json`, under `"scripts"`, add:

```json
"typecheck": "tsc --noEmit",
"preflight": "npm run typecheck && npm run build && npm run test:e2e",
```

Place them so the alphabetical-ish ordering reads sensibly (e.g., `typecheck` after `test:e2e:ui`, `preflight` after `preview`). Other existing scripts (`dev`, `build`, `lint`, `test:e2e*`, `preview`) stay unchanged.

**Why these three checks at 0a:** typecheck (tsc), build (vite), and Playwright (test:e2e) are the checks currently green on the codebase. Lint is deferred to Phase 2b: `eslint .` is red with 428 errors at 0a (mostly `@typescript-eslint/no-explicit-any`), so including it now would mean a perpetually-red preflight signal. Same logic as knip --strict's deferral to Phase 1 (32 unused files). Vitest is deferred to 0b (not installed yet). Prettier and bundle-budget are deferred to 2b / 2c respectively.

- [ ] **Step 2: Ensure `frontend/scripts/` exists** (it does, from Task 5/6, but `mkdir -p` is safe)

```bash
mkdir -p /projects/Brewra/brewra-gtm-intelligence/frontend/scripts
```

- [ ] **Step 3: Create `frontend/scripts/preflight.sh`**

Write this exact content (use Write tool):

```bash
#!/usr/bin/env bash
# Phase 0a preflight script. Spec 15 §2.7.
# Pre-merge quality gate: runs all wired checks with section headers + per-check
# timing. The controller agent runs this from frontend/ immediately before the
# user-approved merge step. Green required for merge; red blocks the merge.
#
# At 0a the chain is: typecheck + build + Playwright.
# Each later phase appends one more check to npm run preflight in package.json:
#   0b → + vitest
#   1  → + knip --strict (after Phase 1's dead-code cleanup)
#   2a → strict-TS typecheck (same `tsc --noEmit` command, against strict config)
#   2b → + prettier --check .
#   2c → + bundle-budget comparator
#
# Source of truth for the check list is the `preflight` npm script in
# frontend/package.json. This wrapper just calls `npm run preflight` with
# nicer output. To run without the wrapper: `npm run preflight`.

set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$FRONTEND_DIR"

start_total=$(python3 -c 'import time; print(time.time())')

echo ""
echo "════════════════════════════════════════════════════════════════"
echo " npm run preflight  (Phase 0a — Spec 15 §2.7)"
echo "════════════════════════════════════════════════════════════════"
echo ""

npm run preflight

end_total=$(python3 -c 'import time; print(time.time())')
elapsed=$(python3 -c "import sys; print(f'{float(sys.argv[1]) - float(sys.argv[2]):.1f}')" "$end_total" "$start_total")

echo ""
echo "════════════════════════════════════════════════════════════════"
echo " preflight green — ${elapsed}s total"
echo "════════════════════════════════════════════════════════════════"
echo ""
```

The wrapper is intentionally thin — it delegates the actual check list to `npm run preflight` in `package.json` so there is one source of truth. The wrapper's only job is the timing + section headers.

- [ ] **Step 4: Make the script executable**

```bash
chmod +x /projects/Brewra/brewra-gtm-intelligence/frontend/scripts/preflight.sh
```

- [ ] **Step 5: For the in-flight `phase-0a-inventory` branch only: delete the old `ci.yml`**

If `phase-0a-inventory` already has `.github/workflows/ci.yml` from an earlier draft of this task (pre-pivot to local preflight), remove it in the same commit:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
test -f .github/workflows/ci.yml && git rm .github/workflows/ci.yml || true
# If the .github/workflows/ directory ends up empty, git won't track it anyway.
```

Future readers running this plan on a clean tree (no prior ci.yml) can skip this step.

- [ ] **Step 6: Run preflight to verify it works end-to-end**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
bash scripts/preflight.sh
```

Expected: all three checks pass (typecheck → build → Playwright). Total wall time ~90–120s depending on hardware (per Task 6's NFR baseline; verified locally: 98.5s with 11 Playwright tests green). If any check fails: STOP, do not commit. Fix the failing check on the branch, then re-run.

- [ ] **Step 7: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/package.json frontend/scripts/preflight.sh
# If Step 5 staged the ci.yml deletion, it's already in the index — include it in the commit.
git status   # sanity: package.json + preflight.sh (+ optional ci.yml deletion)
git commit -m "$(cat <<'EOF'
chore(fe): add preflight script + npm chain (local pre-merge gate)

Spec 15 §2.7: this repo has no GitHub Actions and no other external CI.
The pre-merge quality gate is `npm run preflight`, run locally by the
controller agent immediately before the user-approved merge step.

At Phase 0a the chain is: typecheck + build + Playwright.
Vitest joins in 0b; knip --strict in 1; strict-TS typecheck in 2a;
prettier in 2b; bundle-budget in 2c. Each later phase appends to the
chain in the same commit that installs the tool.

frontend/scripts/preflight.sh is a thin wrapper that calls
`npm run preflight` with section headers + total wall time. The
package.json chain is the source of truth.

(If this commit also deletes .github/workflows/ci.yml, that's the
one-time cleanup of the pre-pivot draft on the in-flight branch.)
EOF
)"
```

---

## Task 9: Sanity-Check + Hand Off to Impl-Review Cycle

**Files:** none (git + preflight verification only — no push, no PR, no CI; this repo has no CI per spec §2.7).

Per master spec 14 §5 and CLAUDE.md "Spec-driven flow," the impl-review cycle (`/review-impl` → `/synthesize-impl-review`, looped until clean) is the quality gate before merge. The user triggers the merge once impl-review converges; the controller then runs `npm run preflight` (per master §5.6) and, only if green, executes `git merge` + `git push`.

- [ ] **Step 1: Sanity-check the commit list**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git log --oneline master..phase-0a-inventory
```

Expected: 8 commits on the branch (Task 1 through Task 8, in order). Task 0 created the branch but no commit.

- [ ] **Step 2: Verify the working tree matches the spec's §2.9 done-when checklist**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
# Audit scorecard exists?
test -f docs/audits/2026-05-26-frontend-baseline.md && echo "scorecard: OK"
# Knip raw output exists?
test -f docs/audits/2026-05-26-frontend-deadcode-knip.json && \
  test -f docs/audits/2026-05-26-frontend-deadcode-knip.txt && echo "knip: OK"
# Bundle baseline?
test -f docs/audits/2026-05-26-frontend-bundle-baseline.json && \
  test -f frontend/scripts/capture-bundle-baseline.ts && echo "bundle: OK"
# NFR baseline?
test -f docs/audits/2026-05-26-frontend-nfr-baseline.json && \
  test -f frontend/scripts/measure-baselines.sh && echo "nfr: OK"
# Playwright pinned exactly?
grep -E '"@playwright/test": "1\.59\.1"' frontend/package.json && echo "playwright pin: OK"
# bun lockfiles gone?
! test -f frontend/bun.lock && ! test -f frontend/bun.lockb && echo "bun: OK"
# Preflight script + npm scripts wired?
test -x frontend/scripts/preflight.sh && \
  grep -q '"preflight"' frontend/package.json && \
  grep -q '"typecheck"' frontend/package.json && echo "preflight: OK"
# No leftover ci.yml from the pre-pivot draft?
! test -f .github/workflows/ci.yml && echo "no-ci: OK"
# Playwright config has the comment block and the ratio?
grep -q "maxDiffPixelRatio: 0.01" frontend/playwright.config.ts && \
  grep -q "test:e2e:update-snapshots" frontend/playwright.config.ts && echo "playwright config: OK"
```

Expected: 9 lines of `OK`. Any missing → return to the relevant task.

- [ ] **Step 3: Run `npm run preflight` to verify the full pre-merge gate is green**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
bash scripts/preflight.sh
```

Expected: green (typecheck + build + Playwright all pass). This is the same script the controller will run at merge time. A red run here means the merge will fail at the controller's preflight step in Step 5 — fix the failing check on the branch before handing off.

- [ ] **Step 4: Hand off to impl-review**

The implementation is complete on `phase-0a-inventory`. Hand control back to the user with a brief summary (commits landed, headline findings from the audits, any non-blocking observations from inline reviews, preflight green confirmation). The user then runs `/review-impl` (fresh-eyes agent reads the branch and writes `docs/reviews/15a-frontend-phase-0a-inventory-impl-review-<round>.md`).

When the review file lands, the controller agent (this session) runs `/synthesize-impl-review`, writing `docs/reviews/15a-frontend-phase-0a-inventory-impl-synthesis-<round>.md` with agree/disagree/defer reasoning. Any "agree" items that require code changes land as additional commits on `phase-0a-inventory` and re-enter the review loop. Repeat until findings are at nit-severity or below.

- [ ] **Step 5: Plan-level done — wait for user merge prompt**

Once impl-review converges to nit-or-below and the user is satisfied with quality, the user explicitly prompts for merge. At that point (and only then), the controller executes the merge step per master §5.6:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
# 1. Re-run preflight on the latest branch tip (covers any commits added during the impl-review loop)
cd frontend && bash scripts/preflight.sh && cd ..
# 2. If green, merge and push. If red, report the failing check; do NOT merge.
git checkout master
git merge phase-0a-inventory          # no --no-ff needed; fast-forward is fine for a phase branch
git push origin master
```

If preflight is red at merge time, the controller does not merge — reports which check failed and waits for the user's call (fix on branch and re-run, or abort the phase). There is no CI after the push; the preflight is the only gate.

The merge + push step is outside this plan's mechanical execution scope; this plan stops at Step 4's hand-off.

---

## Phase 0a Done-When Coverage Map

Cross-reference of Spec 15 §2.9 done-when bullets to the tasks that satisfy them:

| §2.9 bullet | Satisfied by |
|---|---|
| Audit scorecard merged at `docs/audits/2026-05-26-frontend-baseline.md` | Task 7 |
| Knip raw output merged | Task 4 |
| Bundle baseline JSON merged (with `capture-bundle-baseline.ts` committed) | Task 5 |
| NFR baseline JSON merged | Task 6 |
| Playwright suite green under tightened threshold; `@playwright/test` pinned exactly | Task 1 + Task 2 + Task 9 |
| `npm run preflight` runs locally before any merge; required to pass | Task 8 + Task 9 |
| `bun.lock` and `bun.lockb` deleted; `package-lock.json` sole lockfile | Task 3 |
| `playwright.config.ts` comment block documenting local re-baseline | Task 2 |

---

## Reference: spec sections by task

- Task 1: §1.3, §6 R0a-5
- Task 2: §2.5, §2.6, §7.1 (Q2)
- Task 3: §2.8
- Task 4: §2.2, §6 R0a-1
- Task 5: §2.3
- Task 6: §2.4, §6 R0a-4
- Task 7: §2.1, §6 R0a-1
- Task 8: §2.7
- Task 9: §2.9 (all bullets), §6 R0a-3
