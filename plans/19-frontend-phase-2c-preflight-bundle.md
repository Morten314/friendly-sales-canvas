# Phase 2c — Preflight Gates + Bundle Comparator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Plan — round 2 (rounds 1 and 2 reviews synthesized at `docs/reviews/19-frontend-phase-2c-preflight-bundle-plan-synthesis-1.md` and `…-synthesis-2.md`)
**Date:** 2026-05-28
**Spec:** `specs/19-frontend-phase-2c-preflight-bundle-design.md` (round 2)
**Master plan:** `specs/14-frontend-refactoring-master-plan-design.md` §4 Phase 2c
**Branch:** `phase-2c-preflight-bundle`

**Goal:** Wire an advisory bundle-size comparator into `npm run preflight`, lock the Playwright visual-regression threshold at 2%, finalize the preflight chain order, document the re-baseline conventions, and amend master Spec 14 to reflect resolutions.

**Architecture:** A standalone TypeScript script (`frontend/scripts/check-bundle-budget.ts`) parses the Phase 0 bundle baseline JSON, walks `frontend/dist/`, prints a delta table, and always exits 0 in the comparator-success path. Pure helpers are TDD'd with Vitest; IO-heavy paths are smoke-tested. The script wires into `npm run preflight` between `build` and `test:e2e` so it sees `dist/` from the prior `build` step. Visual-regression threshold widens in one config edit. Master Spec 14 amendments land as one dedicated commit.

**Tech Stack:** TypeScript 5.5, Node 21+, Vitest 3.2 (jsdom env, globals off), `gzip-size` (already a devDep), `tsx` runtime (already a devDep), Playwright 1.59.

---

## §0 Execution conventions

### Recovery policy

On any step failure, the executing agent **stops and reports to the human**, unless the failure is a trivial typo or path correction (in which case fix locally and retry once). No silent fixing of substantive issues. A failure on a typecheck, lint, test, build, Playwright, or knip step is substantive and requires a stop.

### Abort triggers

Phase-level abort criteria live in master Spec 14 §5.7 (Abort and revert protocol). Phase 2c also names three phase-specific triggers — if any of these surfaces, stop and escalate, do not proceed with the plan:

1. **Phase 0 baseline JSON shape has drifted.** If `capture-bundle-baseline.ts` no longer produces the schema the comparator expects (e.g., field names changed, structure altered), Task 5's fixture-based tests won't validate against real output. Stop and request a spec revision.
2. **Vitest does not discover `frontend/scripts/check-bundle-budget.test.ts`.** If the verification step in Task 2 fails — i.e., Vitest's default include glob does not pick up the test file — and the fix requires changing `vitest.config.ts`, that's a config change outside Phase 2c's stated scope. Stop and request scope guidance.
3. **Playwright VR tests fail at the new 2% threshold against unchanged code.** Loosening from 1% to 2% should never invalidate stricter snapshots. If Task 11 Step 3 fails with no visual change, the cause is likely a pre-existing Phase 0 snapshot integrity problem, not a Phase 2c bug. Stop and investigate at the phase level, not within Task 11.

### Parallelism guidance

Tasks 1–8 are sequential (each builds on the prior). Task 9 must precede Task 10 (Task 10's reordered `preflight` script references Task 9's `bundle:check` command). Tasks 13 and 14 are sequential at the end.

**Tasks 11 (Playwright VR threshold) and 12 (scripts README) are independent of Tasks 9–10 and of each other.** In a subagent-driven execution model, dispatch Tasks 11 and 12 in parallel with Tasks 9–10 once Task 8 completes. In an inline execution model, run them serially in the listed order.

---

## File Structure

**Files created:**
- `frontend/scripts/check-bundle-budget.ts` — comparator script (~150 LOC: types, helpers, IO, main; spec §3.5 estimate)
- `frontend/scripts/check-bundle-budget.test.ts` — Vitest unit tests for pure helpers (~120 LOC)
- `frontend/scripts/__fixtures__/baseline-{valid,malformed,missing-fields}.json` — fixtures consumed by `loadBaseline` tests
- `frontend/scripts/README.md` — re-baseline conventions for bundle + VR (~50 LOC; spec §3.5 estimate)

**Files modified:**
- `frontend/playwright.config.ts` — single-value change `maxDiffPixelRatio: 0.01 → 0.02`
- `frontend/package.json` — `preflight` chain reordered + extended; `bundle:check` + `bundle:rebaseline` added
- `specs/14-frontend-refactoring-master-plan-design.md` — amendments per spec §3.4 (single commit)

**No tests added for IO functions (`walkDist`, the `main()` wiring).** Those are smoke-tested by running the script against the real baseline + current dist. The pure helpers carry the testable behavior; the IO layer's failure modes are visible from the standalone smoke tests.

---

## Task 1: Create phase branch

**Files:** none

- [ ] **Step 1: Confirm starting branch is `master` and tree is clean**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git status
git rev-parse --abbrev-ref HEAD
```

Expected: branch `master`, working tree clean.

- [ ] **Step 2: Create and check out the phase branch**

```bash
git checkout -b phase-2c-preflight-bundle
```

Expected: `Switched to a new branch 'phase-2c-preflight-bundle'`.

---

## Task 2: Script skeleton with type definitions

**Files:**
- Create: `frontend/scripts/check-bundle-budget.ts`

- [ ] **Step 1: Create the file with types, constants, and empty function stubs**

```ts
// frontend/scripts/check-bundle-budget.ts
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";

import { gzipSize } from "gzip-size";

const FRONTEND_DIR = resolve(import.meta.dirname, "..");
const DIST_DIR = join(FRONTEND_DIR, "dist");
const DEFAULT_BASELINE_PATH = resolve(
  FRONTEND_DIR,
  "..",
  "docs",
  "audits",
  "2026-05-26-frontend-bundle-baseline.json",
);
const CHUNK_REPORT_THRESHOLD_BYTES = 10 * 1024;

export interface ChunkEntry {
  file: string;
  size_bytes: number;
  gzip_bytes: number;
}

export interface Baseline {
  captured_at: string;
  build_command?: string;
  total_size_bytes: number;
  total_size_gzip_bytes: number;
  chunks: ChunkEntry[];
}

export type LoadResult =
  | { ok: true; baseline: Baseline }
  | { ok: false; reason: string };

export function baseName(_file: string): string {
  throw new Error("not implemented");
}

export function formatBytes(_bytes: number): string {
  throw new Error("not implemented");
}

export function computeDelta(
  _baseline: number,
  _current: number,
): { absolute: number; percent: number } {
  throw new Error("not implemented");
}

export function formatDelta(_deltaBytes: number, _basePercent: number): string {
  throw new Error("not implemented");
}

export async function walkDist(_distPath: string): Promise<ChunkEntry[]> {
  throw new Error("not implemented");
}

export async function loadBaseline(_path: string): Promise<LoadResult> {
  throw new Error("not implemented");
}

export function compareAndPrint(
  _baseline: Baseline,
  _current: ChunkEntry[],
): void {
  throw new Error("not implemented");
}
```

- [ ] **Step 2: Verify the file typechecks**

Run from `frontend/`:
```bash
cd frontend
npm run typecheck
```

Expected: PASS (no errors).

- [ ] **Step 3: Verify Vitest will discover script tests**

Create a temporary smoke test to confirm Vitest's default include glob picks up files under `frontend/scripts/`:

```bash
cd frontend
cat > scripts/discovery-check.test.ts <<'EOF'
import { describe, it, expect } from "vitest";
describe("vitest discovery", () => {
  it("picks up tests under scripts/", () => {
    expect(true).toBe(true);
  });
});
EOF
npm run test -- scripts/discovery-check
```

Expected: 1 test PASSES. If Vitest reports "No test files found," this is **abort trigger #2** from §0 — stop and escalate.

Clean up:
```bash
rm scripts/discovery-check.test.ts
```

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/scripts/check-bundle-budget.ts
git commit -m "chore(fe): scaffold bundle comparator script with types"
```

---

## Task 3: TDD pure helpers — `baseName`, `formatBytes`, `computeDelta`, `formatDelta`

**Files:**
- Create: `frontend/scripts/check-bundle-budget.test.ts`
- Modify: `frontend/scripts/check-bundle-budget.ts` (replace stubs)

- [ ] **Step 1: Write failing tests for all four helpers**

Create `frontend/scripts/check-bundle-budget.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  baseName,
  computeDelta,
  formatBytes,
  formatDelta,
} from "./check-bundle-budget";

describe("baseName", () => {
  it("strips Vite hash from index-DoZK05uc.js", () => {
    expect(baseName("assets/index-DoZK05uc.js")).toBe("index-*.js");
  });

  it("strips Vite hash with internal hyphen from index-CqIc-MII.css", () => {
    expect(baseName("assets/index-CqIc-MII.css")).toBe("index-*.css");
  });

  it("strips hash from workbox-5ffe50d4.js", () => {
    expect(baseName("workbox-5ffe50d4.js")).toBe("workbox-*.js");
  });

  it("strips trailing hash from workbox-window.prod.es5-B9K5rw8f.js", () => {
    expect(
      baseName("assets/workbox-window.prod.es5-B9K5rw8f.js"),
    ).toBe("workbox-window.prod.es5-*.js");
  });

  it("returns unchanged name when there is no hash segment", () => {
    expect(baseName("sw.js")).toBe("sw.js");
  });

  it("returns unchanged name when path has no dash", () => {
    expect(baseName("assets/main.js")).toBe("main.js");
  });

  it("documents the known over-stripping limitation for hand-named hyphenated files", () => {
    // The current regex assumes every hyphenated filename in `dist/` is
    // Vite-hashed. A hand-named file like `my-component.js` is over-stripped
    // to `my-*.js`. This test asserts the current (incorrect) behavior so a
    // future tightening trips it deliberately. See spec 19 §6 Risk R1.
    expect(baseName("vendor/my-component.js")).toBe("my-*.js");
  });
});

describe("formatBytes", () => {
  it("formats bytes < 1KB as B", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats KB to one decimal", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("formats MB to two decimals", () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.00 MB");
  });

  it("formats negative bytes with leading minus", () => {
    expect(formatBytes(-1024)).toBe("-1.0 KB");
  });
});

describe("computeDelta", () => {
  it("computes positive delta and percent", () => {
    const d = computeDelta(1000, 1100);
    expect(d.absolute).toBe(100);
    expect(d.percent).toBeCloseTo(10, 5);
  });

  it("computes negative delta and percent", () => {
    const d = computeDelta(1000, 800);
    expect(d.absolute).toBe(-200);
    expect(d.percent).toBeCloseTo(-20, 5);
  });

  it("returns 0 percent when baseline is 0", () => {
    const d = computeDelta(0, 100);
    expect(d.absolute).toBe(100);
    expect(d.percent).toBe(0);
  });
});

describe("formatDelta", () => {
  it("renders positive delta with + sign", () => {
    expect(formatDelta(2048, 0.95)).toBe("+2.0 KB (+0.95%)");
  });

  it("renders negative delta without extra sign", () => {
    expect(formatDelta(-1024, -3.2)).toBe("-1.0 KB (-3.20%)");
  });

  it("renders zero as +0", () => {
    expect(formatDelta(0, 0)).toBe("+0 B (+0.00%)");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend
npm run test -- check-bundle-budget
```

Expected: All tests FAIL with "not implemented" errors.

- [ ] **Step 3: Implement the four helpers**

In `frontend/scripts/check-bundle-budget.ts`, replace each stub:

```ts
// Assumption: every hyphenated filename in `dist/` is Vite-hashed (the current
// 5-file baseline satisfies this). A hand-named file like `my-component.js`
// would over-strip to `my-*.js`. Vite's `manualChunks` could break this in
// future; Phase 3+ revisits per spec 19 §6 Risk R1.
export function baseName(file: string): string {
  const name = basename(file);
  const ext = extname(name);
  const stem = ext ? name.slice(0, -ext.length) : name;
  if (!stem.includes("-")) return name;
  // Strip the trailing hash segment: -[A-Za-z0-9_-]+ at end of stem.
  // Vite's default hash is base64url-style (alphanumeric, _, -).
  const stripped = stem.replace(/-[A-Za-z0-9_-]+$/, "");
  if (stripped === stem) return name;
  return `${stripped}-*${ext}`;
}

export function formatBytes(bytes: number): string {
  const abs = Math.abs(bytes);
  if (abs >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (abs >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function computeDelta(
  baseline: number,
  current: number,
): { absolute: number; percent: number } {
  return {
    absolute: current - baseline,
    percent: baseline === 0 ? 0 : ((current - baseline) / baseline) * 100,
  };
}

export function formatDelta(deltaBytes: number, basePercent: number): string {
  const byteSign = deltaBytes >= 0 ? "+" : "";
  const pctSign = basePercent >= 0 ? "+" : "";
  return `${byteSign}${formatBytes(deltaBytes)} (${pctSign}${basePercent.toFixed(2)}%)`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend
npm run test -- check-bundle-budget
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/scripts/check-bundle-budget.ts frontend/scripts/check-bundle-budget.test.ts
git commit -m "feat(fe): implement bundle comparator pure helpers (baseName, formatBytes, computeDelta, formatDelta)"
```

---

## Task 4: Implement `walkDist`

**Files:**
- Modify: `frontend/scripts/check-bundle-budget.ts`

This step has no Vitest test — `walkDist` is verified by the standalone smoke test in Task 7. It mirrors `capture-bundle-baseline.ts`'s walk logic (`.js`/`.css` only, recursive, sorted by raw size descending).

- [ ] **Step 1: Replace the `walkDist` stub**

```ts
export async function walkDist(distPath: string): Promise<ChunkEntry[]> {
  if (!existsSync(distPath)) return [];
  const out: ChunkEntry[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && /\.(js|css)$/.test(entry.name)) {
        const contents = await readFile(full);
        const sizeBytes = (await stat(full)).size;
        const gz = await gzipSize(contents);
        out.push({
          file: relative(distPath, full).split("\\").join("/"),
          size_bytes: sizeBytes,
          gzip_bytes: gz,
        });
      }
    }
  };
  await walk(distPath);
  out.sort((a, b) => b.size_bytes - a.size_bytes);
  return out;
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd frontend
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/scripts/check-bundle-budget.ts
git commit -m "feat(fe): implement walkDist for bundle comparator"
```

---

## Task 5: Implement `loadBaseline` with error paths + unit tests

**Files:**
- Modify: `frontend/scripts/check-bundle-budget.ts`
- Modify: `frontend/scripts/check-bundle-budget.test.ts`
- Create: `frontend/scripts/__fixtures__/baseline-valid.json`
- Create: `frontend/scripts/__fixtures__/baseline-missing-fields.json`
- Create: `frontend/scripts/__fixtures__/baseline-malformed.json`

`loadBaseline` returns a tagged union so the caller decides how to surface errors (the main function prints to stderr and exits 1; tests inspect the result directly).

- [ ] **Step 1: Create fixture files**

Create `frontend/scripts/__fixtures__/baseline-valid.json`:

```json
{
  "captured_at": "2026-05-26T20:40:40.521Z",
  "build_command": "npm run build",
  "total_size_bytes": 2092063,
  "total_size_gzip_bytes": 525745,
  "chunks": [
    { "file": "assets/index-DoZK05uc.js", "size_bytes": 1966968, "gzip_bytes": 500483 },
    { "file": "assets/index-CqIc-MII.css", "size_bytes": 102485, "gzip_bytes": 16866 }
  ]
}
```

Create `frontend/scripts/__fixtures__/baseline-missing-fields.json`:

```json
{
  "captured_at": "2026-05-26T20:40:40.521Z",
  "total_size_gzip_bytes": 525745
}
```

Create `frontend/scripts/__fixtures__/baseline-malformed.json`:

```
{ not json — this file intentionally malformed
```

- [ ] **Step 2: Add failing tests for `loadBaseline`**

The test file from Task 3 currently has top imports:

```ts
import { describe, expect, it } from "vitest";

import {
  baseName,
  computeDelta,
  formatBytes,
  formatDelta,
} from "./check-bundle-budget";
```

**Modify the top imports** so the file imports `resolve` from `node:path` and adds `loadBaseline` to the import from `./check-bundle-budget`. The resulting top of the file is:

```ts
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  baseName,
  computeDelta,
  formatBytes,
  formatDelta,
  loadBaseline,
} from "./check-bundle-budget";

const FIXTURE_DIR = resolve(import.meta.dirname, "__fixtures__");
```

**Append the new `describe` block** to the bottom of the file (after the existing `describe("formatDelta", …)` block):

```ts
describe("loadBaseline", () => {
  it("returns ok with parsed baseline for a valid file", async () => {
    const result = await loadBaseline(
      resolve(FIXTURE_DIR, "baseline-valid.json"),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.baseline.total_size_bytes).toBe(2092063);
      expect(result.baseline.chunks).toHaveLength(2);
    }
  });

  it("returns not-ok with actionable reason when file missing", async () => {
    const result = await loadBaseline(
      resolve(FIXTURE_DIR, "does-not-exist.json"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("baseline not found");
      expect(result.reason).toContain("npm run bundle:rebaseline");
    }
  });

  it("returns not-ok when JSON is malformed", async () => {
    const result = await loadBaseline(
      resolve(FIXTURE_DIR, "baseline-malformed.json"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("malformed");
    }
  });

  it("returns not-ok when required fields are missing", async () => {
    const result = await loadBaseline(
      resolve(FIXTURE_DIR, "baseline-missing-fields.json"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("missing expected fields");
    }
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

```bash
cd frontend
npm run test -- check-bundle-budget
```

Expected: 4 `loadBaseline` tests FAIL with "not implemented".

- [ ] **Step 4: Implement `loadBaseline`**

Replace the stub in `frontend/scripts/check-bundle-budget.ts`:

```ts
export async function loadBaseline(path: string): Promise<LoadResult> {
  if (!existsSync(path)) {
    return {
      ok: false,
      reason: `baseline not found at ${path}; run npm run bundle:rebaseline to create one`,
    };
  }
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (e) {
    return {
      ok: false,
      reason: `baseline at ${path} could not be read: ${(e as Error).message}`,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      reason: `baseline JSON malformed at ${path}; expected shape from capture-bundle-baseline.ts`,
    };
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as Baseline).total_size_bytes !== "number" ||
    !Array.isArray((parsed as Baseline).chunks)
  ) {
    return {
      ok: false,
      reason: `baseline JSON at ${path} missing expected fields (total_size_bytes, chunks)`,
    };
  }
  return { ok: true, baseline: parsed as Baseline };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd frontend
npm run test -- check-bundle-budget
```

Expected: All tests PASS (10 helpers + 4 loadBaseline = 14 total or however many you wrote).

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/scripts/check-bundle-budget.ts frontend/scripts/check-bundle-budget.test.ts frontend/scripts/__fixtures__/
git commit -m "feat(fe): implement loadBaseline with error-path unit tests"
```

---

## Task 6: Implement `compareAndPrint`

**Files:**
- Modify: `frontend/scripts/check-bundle-budget.ts`

`compareAndPrint` produces the table output described in spec §3.1. Output is verified by the smoke test in Task 7 (visual inspection of the table). The logic uses `baseName` for hash-stable matching and falls back to totals-only when duplicates are detected.

- [ ] **Step 1: Replace the `compareAndPrint` stub**

```ts
export function compareAndPrint(
  baseline: Baseline,
  current: ChunkEntry[],
): void {
  const currentTotalRaw = current.reduce((acc, c) => acc + c.size_bytes, 0);
  const currentTotalGzip = current.reduce((acc, c) => acc + c.gzip_bytes, 0);

  const rawDelta = computeDelta(baseline.total_size_bytes, currentTotalRaw);
  const gzipDelta = computeDelta(
    baseline.total_size_gzip_bytes,
    currentTotalGzip,
  );

  console.log("");
  console.log("                  Baseline       Current        Delta");
  console.log(
    `Total (raw)       ${formatBytes(baseline.total_size_bytes).padEnd(14)} ${formatBytes(currentTotalRaw).padEnd(14)} ${formatDelta(rawDelta.absolute, rawDelta.percent)}`,
  );
  console.log(
    `Total (gzip)      ${formatBytes(baseline.total_size_gzip_bytes).padEnd(14)} ${formatBytes(currentTotalGzip).padEnd(14)} ${formatDelta(gzipDelta.absolute, gzipDelta.percent)}`,
  );

  // Bucket by hash-stripped base name. Bail to totals-only on collisions.
  const baselineByKey = new Map<string, ChunkEntry>();
  for (const chunk of baseline.chunks) {
    const key = baseName(chunk.file);
    if (baselineByKey.has(key)) {
      console.log("");
      console.log(
        "(per-chunk matching unavailable: duplicate base name in baseline; only totals shown)",
      );
      console.log("");
      console.log("(advisory — exit 0)");
      return;
    }
    baselineByKey.set(key, chunk);
  }
  const currentByKey = new Map<string, ChunkEntry>();
  for (const chunk of current) {
    const key = baseName(chunk.file);
    if (currentByKey.has(key)) {
      console.log("");
      console.log(
        "(per-chunk matching unavailable: duplicate base name in current; only totals shown)",
      );
      console.log("");
      console.log("(advisory — exit 0)");
      return;
    }
    currentByKey.set(key, chunk);
  }

  const largeMatched: Array<[string, ChunkEntry, ChunkEntry]> = [];
  for (const [key, baseChunk] of baselineByKey) {
    const cur = currentByKey.get(key);
    if (!cur) continue;
    if (
      baseChunk.size_bytes >= CHUNK_REPORT_THRESHOLD_BYTES ||
      cur.size_bytes >= CHUNK_REPORT_THRESHOLD_BYTES
    ) {
      largeMatched.push([key, baseChunk, cur]);
    }
  }

  if (largeMatched.length > 0) {
    console.log("");
    console.log("Chunks > 10KB:");
    for (const [key, baseChunk, cur] of largeMatched) {
      const delta = computeDelta(baseChunk.size_bytes, cur.size_bytes);
      console.log(
        `  ${key.padEnd(14)} ${formatBytes(baseChunk.size_bytes).padEnd(13)} ${formatBytes(cur.size_bytes).padEnd(14)} ${formatDelta(delta.absolute, delta.percent)}`,
      );
    }
  }

  const added = current.filter((c) => !baselineByKey.has(baseName(c.file)));
  const removed = baseline.chunks.filter(
    (c) => !currentByKey.has(baseName(c.file)),
  );
  if (added.length || removed.length) {
    console.log("");
    if (added.length) {
      console.log(`Added: ${added.map((c) => c.file).join(", ")}`);
    }
    if (removed.length) {
      console.log(`Removed: ${removed.map((c) => c.file).join(", ")}`);
    }
  }

  console.log("");
  console.log("(advisory — exit 0)");
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd frontend
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Verify Vitest still passes**

```bash
cd frontend
npm run test -- check-bundle-budget
```

Expected: All tests PASS (no new tests; this verifies nothing regressed).

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/scripts/check-bundle-budget.ts
git commit -m "feat(fe): implement compareAndPrint with hash-stable matching and ambiguity fallback"
```

---

## Task 7: Wire `main()` and smoke-test happy path

**Files:**
- Modify: `frontend/scripts/check-bundle-budget.ts`

- [ ] **Step 1: Append `main()` and error-handling wiring**

Add at the end of `frontend/scripts/check-bundle-budget.ts`:

```ts
async function main(): Promise<void> {
  const baselinePath =
    process.env.BUNDLE_BASELINE_PATH || DEFAULT_BASELINE_PATH;

  if (!existsSync(DIST_DIR)) {
    console.error("no dist/ found; run npm run build first");
    process.exit(1);
  }

  const loadResult = await loadBaseline(baselinePath);
  if (!loadResult.ok) {
    console.error(loadResult.reason);
    process.exit(1);
  }

  const current = await walkDist(DIST_DIR);
  const displayPath = relative(FRONTEND_DIR, baselinePath);
  console.log(`Bundle vs baseline (${displayPath})`);
  compareAndPrint(loadResult.baseline, current);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Re-run Vitest to confirm `main()` addition didn't regress helper tests**

```bash
cd frontend
npm run test -- check-bundle-budget
```

Expected: all helper + loadBaseline tests PASS. Catches any side-effect from the `main()` wiring (unlikely but cheap to verify before smoke testing).

- [ ] **Step 3: Build dist/ from current source**

```bash
cd frontend
npm run build
```

Expected: build succeeds; `dist/` is populated.

- [ ] **Step 4: Run the script standalone against the Phase 0 baseline**

```bash
cd frontend
npx tsx scripts/check-bundle-budget.ts
```

Expected output shape (placeholders are illustrative; real values depend on current `dist/`):

```
Bundle vs baseline (../docs/audits/2026-05-26-frontend-bundle-baseline.json)

                  Baseline       Current        Delta
Total (raw)       <size>         <size>         <delta>
Total (gzip)      <size>         <size>         <delta>

Chunks > 10KB:
  index-*.js     <size>         <size>         <delta>
  index-*.css    <size>         <size>         <delta>

(advisory — exit 0)
```

Real `<delta>` values will be non-zero (post-Phase-2a/2b code is slightly different from the Phase 0 capture). **What to verify:** (a) the table renders, (b) totals match `dist/` reality, (c) the script exits 0 (`echo $?` after the run). Do NOT treat zero deltas as expected.

- [ ] **Step 5: Confirm exit code 0**

```bash
cd frontend
npx tsx scripts/check-bundle-budget.ts; echo "exit=$?"
```

Expected: `exit=0` on the last line.

- [ ] **Step 6: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/scripts/check-bundle-budget.ts
git commit -m "feat(fe): wire bundle comparator main() and verify happy-path smoke test"
```

---

## Task 8: Smoke-test error paths

**Files:** none (verification only)

- [ ] **Step 1: Missing baseline JSON**

```bash
cd frontend
BUNDLE_BASELINE_PATH=/tmp/nonexistent-baseline.json npx tsx scripts/check-bundle-budget.ts; echo "exit=$?"
```

Expected: stderr prints `baseline not found at /tmp/nonexistent-baseline.json; run npm run bundle:rebaseline to create one`; last line is `exit=1`.

- [ ] **Step 2: Malformed baseline JSON**

```bash
cd frontend
BUNDLE_BASELINE_PATH=scripts/__fixtures__/baseline-malformed.json npx tsx scripts/check-bundle-budget.ts; echo "exit=$?"
```

Expected: stderr prints a "baseline JSON malformed at …" message; last line is `exit=1`.

- [ ] **Step 3: Missing `dist/`**

```bash
cd frontend
mv dist dist.bak
npx tsx scripts/check-bundle-budget.ts; echo "exit=$?"
mv dist.bak dist
```

Expected: stderr prints `no dist/ found; run npm run build first`; last line is `exit=1`. `dist` is restored.

- [ ] **Step 4: No commit for this task** (verification-only — no files changed)

---

## Task 9: Add `bundle:check` and `bundle:rebaseline` scripts to `package.json`

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Confirm `capture-bundle-baseline.ts` exists (precondition for `bundle:rebaseline`)**

```bash
ls /projects/Brewra/brewra-gtm-intelligence/frontend/scripts/capture-bundle-baseline.ts
```

Expected: the file path prints. If `ls` errors, that's a phase-level state problem (the Phase 0 capture script is missing) — stop and escalate per §0 abort policy. Do not proceed; the `bundle:rebaseline` script depends on this file.

- [ ] **Step 2: Insert the two new scripts**

Edit `frontend/package.json` and insert these two lines into the `scripts` object (alphabetical placement fits between `build:dev` and `dev`, but any location works since JSON key order is not load-bearing):

```json
"bundle:check": "tsx scripts/check-bundle-budget.ts",
"bundle:rebaseline": "vite build && tsx scripts/capture-bundle-baseline.ts",
```

Do **not** rewrite the rest of the `scripts` object — only insert these two keys. The `preflight` script is reordered in Task 10, not this one. Any other existing scripts (`build`, `dev`, `format`, `lint`, `preview`, `test:*`, `typecheck`, etc.) stay exactly as they are.

- [ ] **Step 3: Verify `bundle:check` runs (does NOT run `bundle:rebaseline`)**

```bash
cd frontend
npm run bundle:check; echo "exit=$?"
```

Expected: comparator table prints, `exit=0`.

**Do NOT run `npm run bundle:rebaseline` during this verification.** Running it overwrites the Phase 0 baseline JSON, and a skipped-or-crashed discard step would contaminate the canonical anchor. The capture script's correctness was established in Phase 0; we trust it. Verification that the script is wired correctly is sufficient at this stage:

```bash
cd frontend
npm pkg get scripts.bundle:rebaseline
```

Expected: prints `"vite build && tsx scripts/capture-bundle-baseline.ts"`. If absent or wrong, fix the `package.json` edit and re-verify.

- [ ] **Step 4: Commit the `package.json` change**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/package.json
git commit -m "feat(fe): add bundle:check and bundle:rebaseline npm scripts"
```

---

## Task 10: Reorder the preflight chain

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Update the `preflight` script value**

Replace the current `preflight` line in `frontend/package.json`:

Before:
```json
"preflight": "npm run typecheck && npm run lint && npm run format:check && npm run build && npm run test:e2e && npm run test && npx knip --strict --no-progress",
```

After:
```json
"preflight": "npm run typecheck && npm run lint && npm run format:check && npm run test && npm run build && npm run bundle:check && npm run test:e2e && npx knip --strict --no-progress",
```

Changes: `npm run test` moves ahead of `npm run build`; `npm run bundle:check` inserted between `npm run build` and `npm run test:e2e`.

- [ ] **Step 2: Run the full preflight chain to verify green**

```bash
cd frontend
npm run preflight
```

Expected: every step exits 0; the chain reaches `knip --strict --no-progress` and passes.

(This will take several minutes — `vite build` ~35s, Playwright ~50s, Vitest ~33s. Be patient. If anything fails, fix it before committing.)

- [ ] **Step 3: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/package.json
git commit -m "chore(fe): reorder preflight chain — test before build; insert bundle:check"
```

---

## Task 11: Update `playwright.config.ts` — VR threshold 1% → 2%

**Files:**
- Modify: `frontend/playwright.config.ts`

- [ ] **Step 1: Change the `maxDiffPixelRatio` value**

In `frontend/playwright.config.ts`, locate the `toHaveScreenshot` block (around line 41):

Before:
```ts
toHaveScreenshot: {
  maxDiffPixelRatio: 0.01, // 1% of total pixels — was maxDiffPixels: 100, an absolute count; now a ratio
  threshold: 0.2, // per-pixel color tolerance — unchanged
  animations: "disabled",
},
```

After:
```ts
toHaveScreenshot: {
  maxDiffPixelRatio: 0.02, // 2% of total pixels — was 0.01 (1%); widened in Phase 2c (spec 19 §1.3)
  threshold: 0.2, // per-pixel color tolerance — unchanged
  animations: "disabled",
},
```

`threshold` and `animations` are preserved.

- [ ] **Step 2: Verify typecheck passes**

```bash
cd frontend
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run Playwright VR tests to confirm existing snapshots still match**

```bash
cd frontend
npm run test:e2e
```

Expected: all tests PASS. Loosening the threshold from 1% to 2% should never invalidate snapshots captured at the stricter 1% threshold.

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/playwright.config.ts
git commit -m "chore(fe): widen Playwright VR maxDiffPixelRatio to 2% (spec 19)"
```

---

## Task 12: Create `frontend/scripts/README.md`

**Files:**
- Create: `frontend/scripts/README.md`

- [ ] **Step 1: Write the README**

```markdown
# `frontend/scripts/` — developer scripts and re-baseline conventions

This folder holds standalone TypeScript scripts invoked by `npm run …` from `frontend/`. Most are one-shot audits and baselines that get re-run when an explicit phase calls for it. Two of them — the bundle comparator and the bundle baseline — have a conventional workflow worth documenting.

## Script inventory

- `build-audit-scorecard.ts` — Phase 0 LOC scorecard generator
- `build-lint-probe.ts` — Phase 2b pre-execution lint probe
- `build-strict-probe.ts` — Phase 2a pre-execution strict-TS probe
- `capture-bundle-baseline.ts` — writes the bundle baseline JSON (Phase 0 baseline; re-run by `bundle:rebaseline`)
- `check-bundle-budget.ts` — compares current `dist/` against the bundle baseline; advisory mode (always exits 0 on the comparator-success path)
- `measure-baselines.sh` — Phase 0 baseline orchestrator (NFR)
- `preflight.sh` — wrapper for `npm run preflight`
- `scan-inline-blocks.ts` — utility for detecting repeated inline code patterns

## Bundle re-baseline workflow

The bundle baseline at `docs/audits/2026-05-26-frontend-bundle-baseline.json` is the reference the comparator (`npm run bundle:check`) compares each build against. When a PR legitimately grows the bundle (e.g., Phase 3 lands TanStack Query, a future feature adds a heavy dep), the developer re-baselines:

```bash
cd frontend
npm run bundle:rebaseline
```

This runs `vite build` then overwrites the baseline JSON with the current build. **Commit the regenerated baseline as part of the same PR that grew the bundle.** Commit message convention: `chore(fe): re-baseline bundle for <reason>` (or a body line explaining the growth — e.g., "added TanStack Query for Phase 3 data layer").

The bundle comparator is currently in advisory mode (Phase 2c spec §1.3 resolution 1) — it prints deltas but exits 0. Re-baselining is therefore a discipline convention, not a hard requirement; the comparator will never block a PR. Future hardening (Phase 14) may flip this.

## VR re-baseline workflow

The Playwright visual-regression snapshots live in `frontend/e2e/**-snapshots/`. The threshold is set globally in `playwright.config.ts` (`expect.toHaveScreenshot.maxDiffPixelRatio: 0.02` — 2%). When an intentional UI change is being introduced:

```bash
cd frontend
npm run test:e2e:update-snapshots
```

Playwright regenerates the PNG snapshots to match the new UI. **Commit the regenerated PNGs in the same commit as the code change.** Commit message convention: `chore(fe): re-baseline VR for <reason>`, or include a body line explaining the visual change. The reviewer of the PR confirms the visual change was intentional by inspecting the new PNG files.

During the refactor phases (0–14 per master Spec 14), §2.2 forbids visual redesign. A VR failure is presumed to be a regression bug and investigated — re-baselining is the exception, not the rule, and the commit message should explain why the sub-pixel diff was unavoidable. Post-refactor, re-baselining becomes routine for intentional design changes.

## Cross-platform note for VR snapshots

VR snapshots are pixel-sensitive across host operating systems. To re-baseline on macOS or Windows, run inside the Playwright Docker image so PNGs are stable against the Linux CI/dev baseline:

```bash
docker run --rm -v "$PWD:/work" -w /work mcr.microsoft.com/playwright:v1.59.1-jammy \
  bash -c "npm ci && npm run test:e2e:update-snapshots"
```

(Same note is in `playwright.config.ts` comments next to the `toHaveScreenshot` block.)
```

- [ ] **Step 2: Verify Prettier accepts the file**

```bash
cd frontend
npm run format:check
```

Expected: PASS. If Prettier complains, run `npm run format` and re-stage.

- [ ] **Step 3: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/scripts/README.md
git commit -m "docs(fe): add scripts/README documenting bundle + VR re-baseline conventions"
```

---

## Task 13: Amend master Spec 14 — single dedicated commit

**Files:**
- Modify: `specs/14-frontend-refactoring-master-plan-design.md`

Per Phase 2c spec §3.4, the master-spec amendments land as one commit, separate from any code change, so the spec evolution is reviewable as a unit.

- [ ] **Step 1: Amend the §4 Phase 2c block**

In `specs/14-frontend-refactoring-master-plan-design.md`, locate the "Phase 2c — Foundation: preflight gates + budget" section under §4 (around the line where Phase 2c is described).

Rewrite the Phase 2c bullet list to:

```markdown
### Phase 2c — Foundation: preflight gates + bundle comparator (advisory)

**Mission:** every gate runs as part of `npm run preflight`, blocks merge on failure (except bundle comparator, which is advisory).

- `npm run preflight` chain in `frontend/package.json` runs: typecheck → lint → format:check → test (Vitest) → build → bundle:check (advisory) → test:e2e (Playwright + visual regression) → knip --strict --no-progress. Local-only; no GitHub Actions.
- **Bundle comparator (advisory).** Comparator script `frontend/scripts/check-bundle-budget.ts` prints raw and gzip deltas from the Phase 0 baseline (`docs/audits/2026-05-26-frontend-bundle-baseline.json`) and always exits 0 in the comparator-success path. No hard-fail threshold. Re-baselining via `npm run bundle:rebaseline`; conventions in `frontend/scripts/README.md`. Future hardening (Phase 14's watcher) starts from this advisory placement.
- **NFR wall-time enforcement: dropped from Phase 2c scope.** No `tsc` / Vitest / preflight-total gating. Reasoning: noisy and machine-dependent; for a pre-launch MVP, flaky gates erode trust faster than they catch regressions. Phase 14 reconsiders post-launch.
- `knip.json` config already locked at Phase 1. Watcher: `knip --strict --no-progress` runs as part of preflight.
- **Visual regression threshold codified at 2%** in `frontend/playwright.config.ts` (`expect.toHaveScreenshot.maxDiffPixelRatio: 0.02`). Up from Phase 0's 1% (which sat at the top of this section's original 0.5–1.0% range); 2% widens past that range. The re-baseline workflow (`npm run test:e2e:update-snapshots`) is documented in `frontend/scripts/README.md`. Deviation rationale: 1% over-fires on sub-pixel rendering differences; 2% still catches a moved button, recolored header, or shifted card grid.

**Done when:** `npm run preflight` green on the phase branch immediately before merge; gates required to pass for any merge to `master` (excluding the advisory bundle comparator, which never blocks).
```

- [ ] **Step 2: Amend §6 Definition of done item 6**

Locate §6 item 6, which currently reads (around the `npm run preflight runs typecheck + lint + Vitest + Playwright + visual regression + build + bundle-size budget + knip --strict` line).

Rewrite to:

```markdown
6. **Preflight.** `npm run preflight` runs typecheck + lint + format:check + Vitest + build + Playwright + visual regression + `knip --strict --no-progress` and is required to pass before any `git merge` to `master`. The bundle comparator (`bundle:check`) also runs in the preflight chain but is **advisory** — it prints deltas and never blocks merge. NFR wall-time gating was dropped during Phase 2c (Phase 14 reconsiders). Local-only (no GitHub Actions); the controller agent runs preflight as part of the user-approved merge step (§5.3, §5.6).
```

- [ ] **Step 3: Amend §8 Open questions Q2 and Q3**

Locate §8 question 2 (visual-regression exact threshold) and question 3 (bundle-size and NFR budget values).

Rewrite Q2 to:

```markdown
2. **Visual regression exact threshold — RESOLVED (Phase 2c, 2026-05-28).** Phase 0 settled at 1% (top of the original 0.5–1.0% range). Phase 2c widened to **2%** (`maxDiffPixelRatio: 0.02`) to reduce sub-pixel false positives — a deliberate deviation past the original range. Re-baseline workflow is local-only via `npm run test:e2e:update-snapshots`, documented in `frontend/scripts/README.md`.
```

Rewrite Q3 to:

```markdown
3. **Bundle-size and NFR budget values — PARTIALLY RESOLVED (Phase 2c, 2026-05-28).** Bundle comparator landed in advisory mode (no hard-fail threshold; prints deltas and exits 0). NFR wall-time enforcement dropped from Phase 2c scope — for a pre-launch MVP, machine-dependent wall-time gates erode trust faster than they catch regressions. Phase 14's watcher reconsiders both gates with post-launch data.
```

- [ ] **Step 4: Commit the amendments as one dedicated commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add specs/14-frontend-refactoring-master-plan-design.md
git commit -m "docs(spec-14): amend Phase 2c — bundle advisory, NFR dropped, VR 2%"
```

---

## Task 14: Final preflight + merge prep

**Files:** none

- [ ] **Step 1: Run the full preflight chain one more time**

```bash
cd frontend
npm run preflight
```

Expected: every step PASSES; the chain reaches `knip --strict --no-progress` and exits 0.

- [ ] **Step 2: Review the branch's commits**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git log master..phase-2c-preflight-bundle --oneline
```

Expected: a clean ordered list — scaffold, pure helpers, walkDist, loadBaseline, compareAndPrint, main, scripts, preflight reorder, VR threshold, scripts README, spec-14 amendments. Each commit small and focused.

- [ ] **Step 3: Verify no unintended files staged or modified**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git status
```

Expected: working tree clean.

- [ ] **Step 4: Do NOT merge.** Per master Spec 14 §5.6, the controller agent does the merge only after the human approves and after `/review-impl` → `/synthesize-impl-review` converges. Report the branch state and pause for the next step in the cycle.

---

## §X — Verification summary (read this before reporting "done")

- **Spec coverage (against spec 19 round 2):**
  - §2.1 in-scope file list: `check-bundle-budget.ts` ✓ Task 2–7; `frontend/scripts/README.md` ✓ Task 12; `frontend/package.json` ✓ Tasks 9 + 10; `frontend/playwright.config.ts` ✓ Task 11; master spec amendments ✓ Task 13.
  - §3.1 bundle comparator: inputs ✓ (Tasks 2, 7), behavior ✓ (Tasks 3–7), hash-stable matching ✓ (Task 3 + Task 6 with collision fallback), output sketch ✓ (Task 6 + verified Task 7), re-baseline command ✓ (Task 9), error handling ✓ (Task 5 + Task 7 + Task 8).
  - §3.2 VR threshold codification: ✓ Task 11 (with `threshold` and `animations` preserved per spec §3.2 round-2 amendment).
  - §3.3 preflight chain reorder: ✓ Task 10.
  - §3.4 master Spec 14 amendments: ✓ Task 13 (single dedicated commit).
  - §4 DoD items 1–7: 1 ✓ (Task 7), 2 ✓ (Task 12), 3 ✓ (Task 11), 4 ✓ (Task 10), 5 ✓ (Task 14), 6 ✓ (Tasks 8 + 9), 7 ✓ (Task 13).
- **Branch hygiene:** every commit small and focused (1 task = 1 commit, with two commits for Task 9+10 since they're separate concerns in `package.json`).
- **Out-of-scope deferrals:** none surfaced during planning. If implementation surfaces an out-of-scope discovery (e.g., a structural bug in `capture-bundle-baseline.ts` worth fixing), log as `TD-FE-<n>` in `docs/TECH_DEBT.md` rather than folding into Phase 2c.
