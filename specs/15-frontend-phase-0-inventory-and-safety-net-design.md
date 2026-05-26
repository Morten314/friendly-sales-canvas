# Spec 15 — Frontend Phase 0: Inventory + Full Safety Net

**Status:** Design — round 2 (round 1 review synthesized at `docs/reviews/15-frontend-phase-0-inventory-and-safety-net-design-spec-synthesis-1.md`)
**Date:** 2026-05-26 (round 1), 2026-05-26 (round 2 revisions)
**Type:** Phase spec (sub-split into 0a + 0b)
**Paired plan:** _none yet — Phase 0a and 0b each ship their own plan_
**Parent:** `specs/14-frontend-refactoring-master-plan-design.md` (§4 Phase 0)

---

## §1 Goal and context

### 1.1 Goal

Establish the audit baseline and the safety net that every subsequent phase (1 through 14) relies on. After Phase 0 merges, the frontend has: a per-file inventory with dead-code candidates surfaced, NFR + bundle baselines on disk, the existing Playwright + visual regression suite locked green on every PR under a tightened threshold, a working Vitest + RTL + MSW harness with behavior-only characterization tests against the pure utilities that survive the refactor, and a GitHub Actions CI workflow scaffolded with future-phase gates pre-shaped as TODOs.

### 1.2 Why now

Master spec §4 places Phase 0 first because every later phase needs the safety net to merge safely. Without it, Phase 1's dead-code deletions and Phase 2a's strict-TS storm have no behavioral baseline to verify against, and Phases 5–10's feature extractions are reduced to hope.

### 1.3 Starting state (Phase-0 anchor)

| Aspect | State as of 2026-05-26 |
|---|---|
| Source LOC | 75,894 across `.ts`/`.tsx` under `frontend/src/` |
| Playwright suite | Self-contained — Firebase auth and backend API both route-stubbed via `e2e/helpers/login.ts` and `e2e/fixtures/api-mocks.ts`. No real network required. |
| Playwright config | `maxDiffPixels: 100, threshold: 0.2`. Visual snapshots committed for journeys (login-tenant-mission, csv-upload-leads, signals-feed-action, market-research-5-components, icp-create) and stubs (insights, reports, calendar, agent-hub, artifacts). |
| Unit test framework | None. No Vitest, no RTL, no MSW, no Jest. |
| Lint | ESLint flat-config v9 extending `js.configs.recommended` and `tseslint.configs.recommended` (with `@typescript-eslint/no-unused-vars` off — most TS rules effectively inert under the non-strict config), plus `react-hooks` and `react-refresh`. No `import/order`, no Prettier config. |
| TS config | `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`, `noUnusedLocals: false`, `noUnusedParameters: false`. |
| CI | None. No `.github/workflows/` directory exists. |
| Package manager | npm. Evidence: `tech-brewra` (the Brewra dev) authored 3 commits touching `frontend/package-lock.json` (Dec 2025 – Jan 2026); `frontend/bun.lock` and `frontend/bun.lockb` each appeared in exactly 1 accidental commit and have no `@playwright/test` entry while `package-lock.json` does. CLAUDE.md uses `npm install`, `npm run lint`. |
| Dead-code tooling | None installed (no `knip`). |
| Playwright version | `@playwright/test: "^1.59.1"` in `package.json` (caret range — accepts 1.59.x and 1.60.x). 0a pins it exactly so the Docker image tag in CI stays in lockstep with local snapshots (see §6 R0a-5). |
| Top files (LOC) | `pages/MarketResearch.tsx` 14,956 · `components/customers/ICPSummaryOpportunity.tsx` 6,925 · `pages/MissionControl.tsx` 5,645 · `components/mission-control/DataSourcesManager.tsx` 3,747 · `components/market-research/MarketEntrySection.tsx` 3,719 · `components/mission-control/ICPManager.tsx` 3,269 · `components/market-research/RegulatoryComplianceSection.tsx` 2,395 · `components/market-research/CompetitorLandscapeSection.tsx` 2,375 · `components/customers/SuggestedICPCards.tsx` 2,279. |

### 1.4 Sub-split

Phase 0 ships as **Phase 0a** then **Phase 0b**, each running the master-spec §5 adversarial cycle (spec → plan → impl → review at each stage). This single design document covers both — each gets its own *plan* document and its own merge.

- **Phase 0a** — inventory, NFR + bundle baselines, Playwright/visual lock under tightened threshold, CI workflow scaffolding (with Phase-2c gates pre-shaped as TODOs), re-baseline workflow, bun lockfile delete.
- **Phase 0b** — Vitest + RTL + MSW install, characterization tests against pure-function survivors, two missing behavioral E2E journeys (`/customers`, `/settings`), Vitest CI gate enforced.

0a is mostly read-only / scaffolding; 0b adds executable code. The split is by deliverable kind, not by file count.

### 1.5 Out of scope (logged as `TD-FE-<n>` if surfaced)

- Any behavior change. The suite is a safety net, not a behavior-modifier.
- Strict-TS work — Phase 2a.
- Lint rule additions beyond what's already in `eslint.config.js` — Phase 2b. (Phase 0a does not add Prettier.)
- Dead-code deletion — Phase 1 executes from 0a's scorecard.
- `src/services/api.ts` disposition (currently a single file separate from the three-layer client) and the `src/lib/api.ts` / `src/lib/authenticatedApi.ts` / `src/lib/enhancedApi.ts` trio (the actual three-layer client per CLAUDE.md) — all four deferred to Phase 3.
- Lovable artifact removal (`lovable-tagger` in `vite.config.ts`, README boilerplate, `_restore_test.txt`, the `Safe*` wrapper triplet, `MarketResearch_clean.tsx`, the duplicate `LeadStream`, ~150 lines of commented code in `ICPManager.tsx`) — Phase 1 flags and deletes. Phase 0a catalogs.
- shadcn primitive consolidation in `src/components/ui/` — locked from Phase 4 onward.
- Any move into `src/features/` — Phase 4+ scaffolding.

---

## §2 Phase 0a — Inventory + locks + scaffolding

### 2.1 Audit scorecard

**File:** `docs/audits/2026-05-26-frontend-baseline.md`. Committed once at end of 0a. Two-tier structure:

**Tier 1 — feature-area summary table.** One row per current top-level grouping under `src/`. Columns: area name, file count, total LOC, monster-file count (>1,500 LOC), dead-export candidate count (from `knip`), dead-file candidate count (from `knip`), Lovable-artifact flag (Y/N), notes column. Source: `knip` only — see §2.2 for rationale. Areas: `pages/`, `components/customers/`, `components/layout/`, `components/market-research/`, `components/mission-control/`, `components/settings/`, `components/signals/`, `components/strategist/`, `components/common/`, `components/ui/`, `components/` (loose), `contexts/`, `hooks/`, `lib/`, `services/`, `styles/`, `utils/`, root files (`App.tsx`, `main.tsx`, `App.css`, `index.css`, `vite-env.d.ts`).

**Tier 2 — per-file annex.** One row per `.ts`/`.tsx` file under `src/`. Columns: relative path, LOC, static inbound-ref count (rg) (count of static `import … from "<path>"` references matched via ripgrep — a **lower bound**, see note below), dead-export flag (Y/N from `knip`), dead-file flag (Y/N from `knip` when zero static refs and knip confirms no dynamic-import or entry-point use), Lovable-artifact flag, notes column for free-text observations (e.g., "duplicate of `LeadStream` in market-research/", "commented-out block ~150 LOC", "Safe* wrapper, only `SafeMarketIntelligenceTab` is imported").

**Note on the static-ref column.** The ripgrep count misses dynamic `import()` calls, barrel re-exports, lazy route configs, and any string-interpolated paths. It's useful as a fast sort key (high-ref files are obviously load-bearing; zero-ref files are *candidates* for closer review), but it is **not** authoritative. The `knip` dead-file flag is the authoritative dead-file signal — knip resolves dynamic imports and route configs in ways ripgrep can't.

Notes column is the agent's value-add over raw tool output. Master plan §4 / Phase 1 reads this column when deciding `execute` vs `investigate` for each candidate.

### 2.2 Dead-code tooling

Install as dev dep: `knip`. Run against the post-0a-cleanup tree (i.e., after the bun lockfile delete commit). Raw output committed to `docs/audits/2026-05-26-frontend-deadcode-knip.txt` (or `.json` if knip's JSON reporter is used — plan-author decides).

A minimal `knip.json` at `frontend/knip.json` configures entry points (`src/main.tsx`, `vite.config.ts`, `playwright.config.ts`, `e2e/**/*.spec.ts`). No suppressions — the goal here is to maximize signal for Phase 1's audit.

**Why knip-only.** `ts-prune` is largely unmaintained (last release ~2 years stale) and reports false positives on barrel exports. `depcheck` is lightly maintained and overlaps with knip's dep coverage. For a one-time baseline that feeds Phase 1 triage, knip alone provides files + exports + deps coverage and avoids the cross-tool reconciliation noise (three Y/N columns mostly agreeing) that would slow Phase 1 without giving it more actionable data. If Phase 1 hits a knip blind spot, it can add `ts-prune` or `depcheck` ad hoc at that point — the cost of adding a tool later is small.

**Expected false-positive categories.** Phase 1's triage applies extra skepticism to knip findings on:

- **Barrel/re-export patterns** — files that exist purely to re-export from siblings.
- **Dynamic imports** — `lazy(() => import('…'))` and `import('…')` calls (knip resolves these but coverage isn't universal).
- **Route configs with lazy loading** — React Router `lazy` route entries.
- **Vite plugin transforms** — `?raw`, `?url`, `?worker` and PWA-injected entry points.
- **HMR-only entry points** — files that exist for `@vite/client` or `vite-plugin-pwa` lifecycle.

The Tier-2 annex notes column should flag a finding in any of these categories as "likely false positive — verify call sites" before Phase 1 promotes the candidate to `execute`.

### 2.3 Bundle baseline

Run `npm run build`. Per-chunk uncompressed sizes come from the `dist/` filesystem directly. Per-chunk gzip sizes come from a small post-build script (`frontend/scripts/capture-bundle-baseline.ts`) that uses the `gzip-size` npm package over each `dist/**/*.js` and `dist/**/*.css` file — Vite's `reportCompressedSize` log output isn't structured enough to JSON-capture directly. Output written to `docs/audits/2026-05-26-frontend-bundle-baseline.json`:

```json
{
  "captured_at": "2026-05-26T…Z",
  "build_command": "npm run build",
  "total_size_bytes": 1234567,
  "total_size_gzip_bytes": 234567,
  "chunks": [
    { "file": "assets/index-abcd1234.js", "size_bytes": …, "gzip_bytes": … },
    …
  ]
}
```

Top-10 chunks by uncompressed size are explicitly enumerated; the long tail is collapsed to a `"others": [...]` array. Phase 2c reads this file when setting bundle-budget thresholds.

### 2.4 NFR baselines

**Script:** `frontend/scripts/measure-baselines.sh`. Behavior:

- Each measurement runs 3 times. Median, min, max captured.
- Before each `tsc --noEmit` run: no cache clear (cold means "no incremental"; current config doesn't use incremental). 
- Before each `vite build` run: `rm -rf dist node_modules/.vite` so the build is genuinely cold.
- Before each `vite` dev-server cold start: same cleanup; measurement is wall time from `vite` start to first `ready in NNN ms` log line.
- Before each `playwright test` run: snapshots and node_modules left intact; `npm run build` is *not* a prerequisite (the test config uses `npx vite --port 5173` as the webServer).

**Expected runtime:** ~10–20 minutes on typical dev hardware (3× cold builds + 3× cold tsc + 3× dev-server starts + 3× Playwright runs, with `rm -rf dist node_modules/.vite` between builds). The script runs **locally**, not in CI.

**Output:** `docs/audits/2026-05-26-frontend-nfr-baseline.json`:

```json
{
  "captured_at": "2026-05-26T…Z",
  "captured_on": "local-dev-machine",
  "hardware": {
    "os": "Linux 7.0.3 / macOS … / …",
    "cpu_model": "<value of `uname -m` + brand string from /proc/cpuinfo or sysctl>",
    "ram_gb": 32,
    "node_version": "v…",
    "npm_version": "…"
  },
  "tsc_noemit_seconds": { "median": 12.3, "min": 12.0, "max": 12.7 },
  "vite_build_seconds": { "median": 18.4, "min": 18.0, "max": 19.1 },
  "vite_dev_start_seconds": { "median": 1.2, "min": 1.1, "max": 1.4 },
  "playwright_full_suite_seconds": { "median": 42.0, "min": 41.0, "max": 43.5 }
}
```

CI pipeline duration is *not* measured here — per master spec §4 line 221, Phase 2c re-measures against the actually-wired pipeline. Phase 0a numbers are sanity anchors, not budget values. The structured `hardware` block lets Phase 2c programmatically compare anchor environment to CI runner.

### 2.5 Playwright + visual snapshot lock

Update `frontend/playwright.config.ts`:

```ts
expect: {
  toHaveScreenshot: {
    maxDiffPixelRatio: 0.01,   // tightened: 1% of total pixels — was maxDiffPixels: 100, an absolute count; now a ratio
    threshold: 0.2,            // per-pixel color tolerance — unchanged
    animations: 'disabled',
  },
},
```

Also add a 2-line comment block above the `expect` config documenting the re-baseline command (see §2.6).

Run `npm run test:e2e`. Any snapshot that fails under the tighter ratio: re-baseline with `--update-snapshots` in the same commit. If more than 5 snapshots fail unexpectedly, investigate *before* re-baselining — the baselines may be hiding latent flakiness (log to TD-FE).

End state: all journeys + stubs pass under the new threshold; updated PNGs committed.

### 2.6 Re-baseline workflow

**Local-only at Phase 0.** When an intentional UI change is accepted and snapshots need refreshing, the author runs:

```
npm run test:e2e:update-snapshots
git add frontend/e2e/**/*.png
git commit -m "chore(e2e): refresh visual snapshots — <reason>"
```

The script is already in `frontend/package.json`. Snapshots are Linux-Chromium (`*-chromium-linux-linux.png`); authors on macOS/Windows should run the update inside the Playwright Docker image (`mcr.microsoft.com/playwright:v1.59.1-jammy`) for pixel-stable PNGs — a one-line example in the comment block at `playwright.config.ts` documents this.

**Why not a PR-label CI workflow.** CLAUDE.md "Business State" section is explicit: "MVP, 0 live users — optimize for velocity over deployment ceremony; skip ceremony that exists to protect users you don't have yet." A PR-label-driven automation that commits refreshed snapshots back to a branch is exactly the kind of ceremony CLAUDE.md tells us to skip at this stage. It buys nothing for a single-author repo with zero users that the local script doesn't already give us. If team growth or workflow friction surface later, Phase 2c (which lands CI gates broadly) is the natural place to introduce the automation — see §6 R0-2.

Master spec §8 Q2 listed PR-label and commit-message triggers as the two options; this spec picks neither in favor of the local script.

### 2.7 CI workflow scaffolding

**File:** `.github/workflows/ci.yml`. Triggers: PRs to `master`, pushes to `master`.

**Single job at 0a.** Only `playwright` is wired. Runs inside `mcr.microsoft.com/playwright:v1.59.1-jammy` (Playwright pinned exactly — see §1.3 and §6 R0a-5). `npm ci` runs inside the same job, so there is no cross-job cache plumbing — a setup-then-job split would not be useful at 0a because the container's filesystem layout differs from the host runner's and `actions/cache` paths don't translate cleanly across the boundary. Phase 2c (when parallel gates land — typecheck, lint, build, etc.) is the right place to introduce a shared setup job, and at that point all jobs can run in the same image or a shared volume strategy can be designed deliberately.

**Jobs at 0a:**

```yaml
jobs:
  playwright:
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.59.1-jammy
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '<TBD by plan>'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run test:e2e
    # required to merge

  # ────────────── Phase 0b will turn this on ─────────────
  # vitest:
  #   runs-on: ubuntu-latest
  #   defaults:
  #     run:
  #       working-directory: frontend
  #   steps:
  #     - uses: actions/checkout@v4
  #     - uses: actions/setup-node@v4
  #       with: { node-version: '<same>', cache: 'npm', cache-dependency-path: frontend/package-lock.json }
  #     - run: npm ci
  #     - run: npm run test

  # ────────────── Phase 2a will turn this on ──────────────
  # typecheck:
  #   # similar shape to vitest; runs `npm run typecheck` (script added in 2a)

  # ────────────── Phase 2b will turn this on ──────────────
  # lint:
  #   # eslint . --max-warnings 0
  # prettier:
  #   # prettier --check .

  # ────────────── Phase 2c will turn these on ─────────────
  # build:
  #   # npm run build
  # bundle-budget:
  #   needs: build
  #   # script reads docs/audits/<latest>-bundle-baseline.json,
  #   # compares to dist/, fails if over budget
  # knip-dead-code:
  #   # knip --strict
```

Each TODO block names the phase that turns it on. Phase 0b removes the comment around the `vitest:` block. Phases 2a, 2b, 2c remove their respective blocks. Stale-doc grep (Phase 14) will scan for `Phase N` references in CI YAML — the master-spec allowlist convention covers this file.

### 2.8 Bun lockfile delete

Discrete commit. Deletes `frontend/bun.lock` and `frontend/bun.lockb`. Commit message body cites the evidence:

> The Brewra dev (`tech-brewra`) authored 3 commits on `frontend/package-lock.json` (Dec 2025 – Jan 2026) and 1 incidental commit each on `bun.lock` / `bun.lockb`. The recent `a444436 test(fe): add Playwright dev dependency` updated `package-lock.json` only — `bun.lock` has no `@playwright/test` entry. npm is the active workflow; the bun lockfiles are stale artifacts from a pre-fork PWA dual-tracking accident.

### 2.9 Phase 0a done-when

- Audit scorecard merged at `docs/audits/2026-05-26-frontend-baseline.md`.
- Knip raw output merged.
- Bundle baseline JSON merged (with `capture-bundle-baseline.ts` script committed).
- NFR baseline JSON merged.
- Playwright suite green on a representative PR under the tightened threshold; `@playwright/test` pinned exactly in `package.json`.
- `ci.yml` runs on every PR with the Playwright gate required to merge.
- `bun.lock` and `bun.lockb` deleted; `package-lock.json` is the sole lockfile.
- `playwright.config.ts` carries a comment block documenting the local re-baseline command (per §2.6).

---

## §3 Phase 0b — Test harness + characterization + gap journeys

### 3.1 Vitest + RTL + MSW install

**Dev deps:** `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `msw`.

**Config:** `frontend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,                // explicit imports preferred — see note below
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

**Why `globals: false`.** Test files import `describe`, `it`, `expect`, `vi`, etc. explicitly from `'vitest'`. Consistent with master plan §1.4's "agents-as-authors with explicit, machine-readable contracts" principle: explicit imports help agents (and humans) trace symbols without IDE plugins. Cost is one import line per test file.

**Setup file:** `frontend/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**Package scripts:** add `"test": "vitest run"` and `"test:watch": "vitest"` and `"test:coverage": "vitest run --coverage"`.

### 3.2 MSW handler set (minimal)

**Files:**
- `frontend/src/test/msw/server.ts` — `setupServer(...handlers)` exporter.
- `frontend/src/test/msw/handlers.ts` — handler array.

**Handlers:**

1. **Proof-of-pipeline.** `GET /api/_health` → `200 { ok: true }`. Used by the smoke test at `frontend/src/test/__tests__/msw-pipeline.test.ts` (see §3.3) that asserts MSW is intercepting `fetch` in jsdom.
2. **Firebase sign-in.** `POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword*` → mirrors `firebaseSignInResponse` from `e2e/fixtures/auth.ts` (same shape, same field names).
3. **Firebase token refresh.** `POST https://securetoken.googleapis.com/v1/token*` → standard refresh response shape (id_token, refresh_token, expires_in).
4. **JWT mint.** `POST /api/auth/token` → `200 { access_token: "mock_jwt_token", expires_in: 3600 }`.
5. **JWT refresh.** `POST /api/auth/refresh` → same shape as #4.

Handler shapes mirror the Playwright fixtures so the two test layers stay consistent. Per-feature handlers (market-research, mission-control, customers, signals, scout, settings) are *not* shipped in 0b — they grow per feature in Phases 5–10 as unit tests need them.

### 3.3 Characterization tests

**Target files** (the stable utility survivors guaranteed to migrate into `src/shared/lib/` unchanged):

| File | Coverage shape | Notes |
|---|---|---|
| `src/lib/timestampUtils.ts` | Every exported function tested on representative inputs and edge cases (epoch boundary, DST-adjacent dates, invalid input). | Pure date math. |
| `src/lib/marketScoreDescriptions.ts` | Every exported lookup function returns the documented description for each score band; behavior on out-of-band input. | Static lookup table — fast. |
| `src/lib/marketScoresHeatmap.ts` | Every exported helper: bucketing logic, color mapping (asserted by category, not by hex string brittleness), sort order. | Pure transforms over score arrays. |
| `src/lib/utils.ts` | `cn()` merges Tailwind classes correctly. Use shadcn's documented edge cases (conditional classes, conflicting classes, undefined/null inputs). | Single-function file from shadcn template. |
| `src/lib/rateLimitManager.ts` | The 4-req/min boundary holds; queues when cap is hit; releases as the rolling window slides; behavior under concurrent enqueues. | **Stateful** singleton — not a pure function. Use `vi.useFakeTimers()` exclusively; reset module state between tests via `vi.resetModules()` or a per-test re-import. The 4 req/min value is a frozen interface per master §2.3. |
| `src/test/__tests__/msw-pipeline.test.ts` | `fetch('/api/_health')` returns `{ ok: true }` under jsdom + MSW; an unhandled-path fetch fails per `onUnhandledRequest: 'error'`. | The MSW proof-of-pipeline smoke test (§3.2 handler #1). Not a characterization target, but ships in the same set so the harness is verifiably wired. |

**Categorization.** Four files (`timestampUtils`, `marketScoreDescriptions`, `marketScoresHeatmap`, `utils`) are pure functions; their tests can be written without timer manipulation or state setup. `rateLimitManager` is the one stateful survivor — it manages a rolling-window queue and singleton state. The test plan reflects that distinction (fake timers + module reset).

**Excluded** (with reason):
- `src/lib/firebase.ts` — initializes the live Firebase app; testing it requires either mocking Firebase entirely (low value) or hitting the real network (not allowed in unit tests).
- `src/lib/testFirebase.ts` — likely cruft; Phase 1 should evaluate for deletion.
- `src/lib/api.ts`, `src/lib/authenticatedApi.ts`, `src/lib/enhancedApi.ts` — Phase 3 collapses the 3-layer client into TanStack Query. Tests written now go in the bin.
- `src/lib/jwt.ts` — touches the auth-token storage paths; Phase 3 may reshape these. Defer (notable risk: this *is* a pure-function survivor in spirit, but the master plan groups it with the auth/data-layer work).
- `src/lib/leadStreamHeatmapSession.ts`, `src/lib/missionProfilerSessionCache.ts` — session-backed helpers tied to specific features; migrate with those features and tested there.
- `src/hooks/useAuth.ts`, `src/hooks/useAuthenticatedApi.ts` — re-export wrappers; testing them tests context behavior, which is shadcn/React territory.
- `src/hooks/use-toast.ts`, `src/hooks/use-mobile.tsx` — shadcn defaults; not our authored code.
- `src/hooks/usePageTitle.ts` — small hook coupled to document state; reasonable test target but not on the survivor-priority list.
- `src/utils/*` — mostly feature-coupled (`leadStreamChatContext`, `profileIcpsExtract`, `profilerAcceptedIcpDisplay`); migrate with features in 5–10 and tested there.

**Test colocation convention.** All Vitest tests under `src/lib/__tests__/<name>.test.ts`. One folder, easy to find while features don't exist yet. Master plan Phase 4 introduces per-feature colocation when `src/features/` exists; tests move with their utilities at that point — this is a deliberate temporary location, called out in Phase 4's spec when written.

### 3.4 Gap behavioral journeys

**Coverage map** (master spec calls for behavioral E2E covering the user journeys monster files participate in):

| Route | Existing coverage | Action |
|---|---|---|
| `/` (login) | journey 01 | covered |
| `/tenant-selection` | journey 01 | covered |
| `/mission-control` | journey 01 (basic load), 02 (csv upload), 05 (icp create) | covered |
| `/your-ai-team/scout/:tab` | journey 04 navigates to `/your-ai-team/scout/marketintelligence` | covered |
| `/your-ai-team/strategist/:tab` | none | **excluded** — Strategist has no backend (CLAUDE.md: it's a sessionStorage-driven sequence builder). A load test would add little beyond the auth-path coverage journey 01 already provides. Phase 8 (strategist extraction) adds its own coverage. |
| `/signals` | journey 03 | covered |
| `/customers` | none | **gap → add `06-customers-page-load.spec.ts`** |
| `/settings` | none | **gap → add `07-settings-page-load.spec.ts`** |
| `/calendar`, `/deals`, `/insights`, `/reports`, `/artifacts`, `/agent-hub` (stub routes) | `e2e/stubs/*.spec.ts` | covered (stub-shape) |

The new gap journeys close coverage on the two routes that have neither a journey nor a stub.

Two new Playwright spec files under `frontend/e2e/journeys/`:

**`06-customers-page-load.spec.ts`** — log in via `mockFirebaseLogin` + `installApiMocks` + `installCatchAllApiMock`, navigate to `/customers`, assert the page heading or a recognizable element is visible, capture screenshot `01-customers-page.png`. ~30–50 LOC. Mirrors the `stubs/` pattern in shape (single load assertion + screenshot) but lives under `journeys/` because `/customers` is a real product route.

**`07-settings-page-load.spec.ts`** — same shape for `/settings`. Snapshot `01-settings-page.png`.

If either route reveals a wiring bug that breaks the load (e.g., a required API call has no `installApiMocks` entry), the fix lands inside `e2e/fixtures/api-mocks.ts` as part of the 0b commit. If the bug is in product code itself, the 0b spec author judges at execution: small fix → land in 0b; non-trivial → log to TD-FE and the gap-journey is marked `test.fixme` with the TD reference until the fix lands.

### 3.5 CI gate addition

Update `.github/workflows/ci.yml`: uncomment the `vitest:` job block (the TODO comment from 0a). The job runs `npm run test`. Marked `required` to merge alongside `playwright`.

The other TODO blocks (typecheck, lint, prettier, build, bundle-budget, knip-dead-code) remain commented out — each turns on in its named phase.

### 3.6 NFR re-measurement (informational)

Re-run `scripts/measure-baselines.sh` after the harness install + gap journeys land. Append to `docs/audits/2026-05-26-frontend-nfr-baseline.json` as a new `"after_phase_0b"` field:

```json
{
  …,
  "after_phase_0b": {
    "captured_at": "…",
    "tsc_noemit_seconds": …,
    "vite_build_seconds": …,
    "vite_dev_start_seconds": …,
    "playwright_full_suite_seconds": …,
    "vitest_full_suite_seconds": …
  }
}
```

Informational only. Phase 2c re-measures against the wired pipeline and sets the actual budgets.

### 3.7 Phase 0b done-when

- Vitest + RTL + MSW installed; `npm run test` works locally and in CI.
- `frontend/vitest.config.ts` and `frontend/src/test/setup.ts` exist.
- MSW handler set covers the proof-of-pipeline + auth handlers documented in §3.2.
- Characterization tests for the §3.3 target files exist and pass.
- `frontend/e2e/journeys/06-customers-page-load.spec.ts` and `…/07-settings-page-load.spec.ts` exist, pass, with committed snapshots.
- Vitest CI gate enforced (`required` to merge).
- NFR JSON updated with `after_phase_0b` measurements.

---

## §4 Workflow

Both 0a and 0b run the master-spec §5 adversarial cycle: spec → review → synthesize → plan → review → synthesize → impl → review → synthesize → merge. This single design document IS the spec for both sub-phases. Each sub-phase ships its own plan (`plans/15a-frontend-phase-0a-inventory.md`, `plans/15b-frontend-phase-0b-test-harness.md`) and its own impl-review cycle.

**Branch naming:** `phase-0a-inventory`, `phase-0b-test-harness`. Each merges to `master` independently. 0b does not start until 0a is merged (it depends on 0a's CI workflow scaffolding being in place to add the Vitest gate).

**Review artifacts** (per master §5.4 naming convention):
- Spec reviews: `docs/reviews/15-frontend-phase-0-inventory-and-safety-net-design-spec-review-<round>.md`
- Spec syntheses: `docs/reviews/15-frontend-phase-0-inventory-and-safety-net-design-spec-synthesis-<round>.md`
- Phase 0a plan reviews: `docs/reviews/15a-frontend-phase-0a-inventory-plan-review-<round>.md`
- Phase 0b plan reviews: `docs/reviews/15b-frontend-phase-0b-test-harness-plan-review-<round>.md`
- Impl reviews/syntheses follow the same pattern with `-impl-`.

---

## §5 Definition of done (combined)

Phase 0 is done when:

1. **0a deliverables** (§2.9) are merged.
2. **0b deliverables** (§3.7) are merged.
3. On every PR, `ci.yml` runs install → playwright → vitest, all required to pass.
4. Visual snapshots are refreshed locally via `npm run test:e2e:update-snapshots` when an intentional UI change is accepted; the documenting comment block in `playwright.config.ts` explains the workflow.
5. Audit scorecard, dead-code raw outputs, NFR + bundle baseline JSON files all committed under `docs/audits/`.
6. `bun.lock` and `bun.lockb` are gone.
7. Phase 1 has a complete picture of dead-code candidates and a stable safety net to backstop its execution.

---

## §6 Risks and mitigations

| # | Risk | Mitigation |
|---|---|---|
| R0a-1 | Audit scorecard takes longer than expected because file-by-file inbound-ref enumeration at 75,894 LOC is slow if done manually. | Tooling-driven, not narrative. `knip --reporter json` + a ripgrep batch produce the raw data; the scorecard is a *structured view* of those outputs, not a hand-written census. Agent value lives in the notes column (knip false-positive flagging per §2.2 categories, Lovable-artifact identification, duplicate-component spotting). |
| R0a-2 | Tightening visual threshold to `maxDiffPixelRatio: 0.01` breaks more snapshots than expected. | Re-baseline as part of the same commit. If >5 snapshots fail unexpectedly, investigate before re-baselining — the existing baselines may hide latent flakiness; log findings to TD-FE. |
| R0a-3 | Playwright in CI is flaky on Linux runners against locally-baselined PNGs. | Use `mcr.microsoft.com/playwright:v1.59.1-jammy` Docker image so Chromium binaries match exactly. Cache `~/.cache/ms-playwright` by Playwright version. The existing local snapshots are already `*-chromium-linux-linux.png` so the convention is consistent. |
| R0a-4 | `scripts/measure-baselines.sh` numbers vary 2–3× run-to-run on shared hardware. | 0a measures on a local dev machine, recorded as such in the JSON (`captured_on: "local-dev-machine"`, with structured hardware metadata). Phase 2c re-measures on CI hardware and sets budget values with headroom. 0a numbers are anchor sanity checks, not gates. |
| R0a-5 | Playwright Docker image version (`mcr.microsoft.com/playwright:v1.59.1-jammy`) and `package.json`'s `@playwright/test` version can desynchronize. A caret-range bump in `package.json` would silently change the Chromium binary version in CI from the one used to generate local snapshots. | 0a pins `@playwright/test` to exact `1.59.1` (no caret) in `package.json`. Any version bump is then a deliberate, reviewable change touching both `package.json` and `ci.yml` together. Dependabot/Renovate (if introduced later) must be configured to update both in the same PR. |
| R0-2 | The local-only re-baseline workflow (§2.6) becomes friction once the team grows or visual changes become frequent. | Reintroduce a PR-label-driven automation in Phase 2c (when CI gates land more broadly). The decision is reversible at any later phase; 0a's choice is to skip the ceremony until usage justifies it (CLAUDE.md "Business State"). |
| R0b-1 | MSW handler shapes drift from the real backend over time. | Handlers mirror the Playwright fixtures' shapes verbatim. Playwright fixtures are the source of truth — they were originally validated against the real backend. If MSW and Playwright disagree, Playwright wins. |
| R0b-2 | Characterization tests for `rateLimitManager` are flaky due to timing. | Use `vi.useFakeTimers()` exclusively. No `setTimeout`-based real-time waits. The 4 req/min value is a frozen interface; the test is deterministic against fake timers. |
| R0b-3 | Gap journey for `/customers` or `/settings` fails because route requires API data not in the existing stub set. | Extend `e2e/fixtures/api-mocks.ts` as part of 0b. If a real product wiring bug is uncovered, 0b spec author judges: small mechanical fix lands in 0b; otherwise the gap-journey is marked `test.fixme` with a `TD-FE-<n>` reference until the underlying bug is fixed. |
| R0-1 | The 0a / 0b split adds two cycles of ceremony where one would do. | Accepted. 0a's deliverables are mostly read-only inventory + CI scaffolding; 0b's deliverables are executable code. Reviewing them together would obscure both kinds of work in one diff. Per master §1.5 the chosen sequence is foundation-first with LOC reduction inserted as Phase 1 — the same logic that justifies a separate Phase 1 justifies the 0a/0b split. |

---

## §7 Open questions

### 7.1 Resolved in this spec (deferred from master §8)

| Master ref | Question | Resolution |
|---|---|---|
| §8 Q1 | Vitest test methodology — behavior-only vs DOM snapshots vs both? | Behavior-only for utilities; RTL queries (`getByRole`, `getByText`) for any component; no DOM snapshots. |
| §8 Q2 | Visual regression exact threshold within 0.5–1.0% range; re-baseline workflow details. | `maxDiffPixelRatio: 0.01` (1.0%) with existing `threshold: 0.2` preserved. Re-baseline workflow: **local-only** (`npm run test:e2e:update-snapshots`) — neither of the PR-label nor commit-message options at this stage. Picked per CLAUDE.md "MVP, 0 live users — skip ceremony." A PR-label automation can be reintroduced in Phase 2c if usage justifies (see §6 R0-2). |
| §8 Q8 | CI choice — GitHub Actions vs other? | GitHub Actions. No alternative CI exists in the repo; CLAUDE.md uses `gh`; no signal of any other CI provider. |

### 7.2 Deferred to plans

| # | Question | Owner |
|---|---|---|
| 0-Q1 | Characterization test file location: `src/lib/__tests__/<name>.test.ts` (chosen here) vs co-located `src/lib/<name>.test.ts`. The choice has no design impact; either works. | Phase 0b plan, one-line decision. |
| 0-Q2 | If a gap journey reveals a wiring bug in `/customers` or `/settings`, fix in 0b or log to TD-FE? | Phase 0b spec author at execution time, per §3.4. |

---

## §8 Companion documents

Created during Phase 0a:
- `docs/audits/2026-05-26-frontend-baseline.md` — audit scorecard (Tier 1 + Tier 2)
- `docs/audits/2026-05-26-frontend-nfr-baseline.json` — NFR baseline (with structured `hardware` block)
- `docs/audits/2026-05-26-frontend-bundle-baseline.json` — bundle baseline (per-chunk uncompressed + gzip)
- `docs/audits/2026-05-26-frontend-deadcode-knip.txt` (or `.json`) — knip raw output
- `frontend/scripts/measure-baselines.sh` — NFR measurement script
- `frontend/scripts/capture-bundle-baseline.ts` — bundle baseline capture script (uses `gzip-size`)
- `frontend/knip.json` — knip config
- `.github/workflows/ci.yml` — primary CI workflow (single `playwright` job at 0a; extended in 0b)
- `frontend/playwright.config.ts` updated: `maxDiffPixelRatio: 0.01`, exact-pinned `@playwright/test`, comment block documenting local re-baseline command

Created during Phase 0b:
- `frontend/vitest.config.ts` — Vitest config (with `globals: false`)
- `frontend/src/test/setup.ts` — Vitest + MSW + jest-dom setup
- `frontend/src/test/msw/server.ts`, `frontend/src/test/msw/handlers.ts` — MSW server + handlers
- `frontend/src/test/__tests__/msw-pipeline.test.ts` — MSW proof-of-pipeline smoke test
- `frontend/src/lib/__tests__/timestampUtils.test.ts`
- `frontend/src/lib/__tests__/marketScoreDescriptions.test.ts`
- `frontend/src/lib/__tests__/marketScoresHeatmap.test.ts`
- `frontend/src/lib/__tests__/utils.test.ts`
- `frontend/src/lib/__tests__/rateLimitManager.test.ts`
- `frontend/e2e/journeys/06-customers-page-load.spec.ts`
- `frontend/e2e/journeys/07-settings-page-load.spec.ts`
- `.github/workflows/ci.yml` — extended with the Vitest job

Master plan reference: `specs/14-frontend-refactoring-master-plan-design.md` (§4 Phase 0, §8 open questions).
