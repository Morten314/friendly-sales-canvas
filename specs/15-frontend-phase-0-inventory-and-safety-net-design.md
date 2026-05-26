# Spec 15 — Frontend Phase 0: Inventory + Full Safety Net

**Status:** Design — round 1
**Date:** 2026-05-26
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
| Lint | ESLint flat-config v9 with `react-hooks` + `react-refresh` only. No type-aware rules, no import plugin, no Prettier config. |
| TS config | `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`, `noUnusedLocals: false`, `noUnusedParameters: false`. |
| CI | None. No `.github/workflows/` directory exists. |
| Package manager | npm. Evidence: `tech-brewra` (the Brewra dev) authored 3 commits touching `frontend/package-lock.json` (Dec 2025 – Jan 2026); `frontend/bun.lock` and `frontend/bun.lockb` each appeared in exactly 1 accidental commit and have no `@playwright/test` entry while `package-lock.json` does. CLAUDE.md uses `npm install`, `npm run lint`. |
| Dead-code tooling | None installed (no `knip`, no `ts-prune`, no `depcheck`). |
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
- `src/services/api.ts` disposition (currently a single file) — Phase 3.
- Lovable artifact removal (`lovable-tagger` in `vite.config.ts`, README boilerplate, `_restore_test.txt`, the `Safe*` wrapper triplet, `MarketResearch_clean.tsx`, the duplicate `LeadStream`, ~150 lines of commented code in `ICPManager.tsx`) — Phase 1 flags and deletes. Phase 0a catalogs.
- shadcn primitive consolidation in `src/components/ui/` — locked from Phase 4 onward.
- Any move into `src/features/` — Phase 4+ scaffolding.

---

## §2 Phase 0a — Inventory + locks + scaffolding

### 2.1 Audit scorecard

**File:** `docs/audits/2026-05-26-frontend-baseline.md`. Committed once at end of 0a. Two-tier structure:

**Tier 1 — feature-area summary table.** One row per current top-level grouping under `src/`. Columns: area name, file count, total LOC, monster-file count (>1,500 LOC), dead-export candidate count (from `knip`), dead-file candidate count (from `knip`), Lovable-artifact flag (Y/N), notes. Areas: `pages/`, `components/customers/`, `components/layout/`, `components/market-research/`, `components/mission-control/`, `components/settings/`, `components/signals/`, `components/strategist/`, `components/common/`, `components/ui/`, `components/` (loose), `contexts/`, `hooks/`, `lib/`, `services/`, `styles/`, `utils/`, root files (`App.tsx`, `main.tsx`, `App.css`, `index.css`, `vite-env.d.ts`).

**Tier 2 — per-file annex.** One row per `.ts`/`.tsx` file under `src/`. Columns: relative path, LOC, inbound-ref count (number of source files importing it, computed via ripgrep), dead-export flag (Y/N from `knip`), dead-export flag (Y/N from `ts-prune`), dead-file flag (Y/N from `knip` when zero inbound refs), Lovable-artifact flag, notes column for free-text observations (e.g., "duplicate of `LeadStream` in market-research/", "commented-out block ~150 LOC", "Safe* wrapper, only `SafeMarketIntelligenceTab` is imported").

Notes column is the agent's value-add over raw tool output. Master plan §4 / Phase 1 reads this column when deciding `execute` vs `investigate` for each candidate.

### 2.2 Dead-code tooling

Install as dev deps: `knip`, `ts-prune`, `depcheck`. Run each against the post-0a-cleanup tree (i.e., after the bun lockfile delete commit). Raw outputs committed to:

- `docs/audits/2026-05-26-frontend-deadcode-knip.txt`
- `docs/audits/2026-05-26-frontend-deadcode-tsprune.txt`
- `docs/audits/2026-05-26-frontend-deadcode-depcheck.txt`

A minimal `knip.json` at `frontend/knip.json` configures the entry points (`src/main.tsx`, `vite.config.ts`, `playwright.config.ts`, `e2e/**/*.spec.ts`). No suppressions — the goal here is to maximize signal for Phase 1's audit.

`knip` is the primary source; `ts-prune` cross-checks unused exports (often catches edge cases knip misses); `depcheck` cross-checks dependency-only findings (better at dev-only deps). Tier-2 annex columns reference all three independently so Phase 1 sees the agreement (or lack of) per finding.

### 2.3 Bundle baseline

Run `npm run build`. Capture to `docs/audits/2026-05-26-frontend-bundle-baseline.json`:

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

**Output:** `docs/audits/2026-05-26-frontend-nfr-baseline.json`:

```json
{
  "captured_at": "2026-05-26T…Z",
  "captured_on": "local-dev-machine",
  "hardware_note": "Author records CPU/RAM/OS so Phase 2c knows the anchor environment",
  "node_version": "…",
  "npm_version": "…",
  "tsc_noemit_seconds": { "median": 12.3, "min": 12.0, "max": 12.7 },
  "vite_build_seconds": { "median": 18.4, "min": 18.0, "max": 19.1 },
  "vite_dev_start_seconds": { "median": 1.2, "min": 1.1, "max": 1.4 },
  "playwright_full_suite_seconds": { "median": 42.0, "min": 41.0, "max": 43.5 }
}
```

CI pipeline duration is *not* measured here — per master spec §4 line 221, Phase 2c re-measures against the actually-wired pipeline. Phase 0a numbers are sanity anchors, not budget values.

### 2.5 Playwright + visual snapshot lock

Update `frontend/playwright.config.ts`:

```ts
expect: {
  toHaveScreenshot: {
    maxDiffPixelRatio: 0.01,   // tightened: 1% of total pixels (was maxDiffPixels: 100)
    threshold: 0.2,            // per-pixel color tolerance — unchanged
    animations: 'disabled',
  },
},
```

Run `npm run test:e2e`. Any snapshot that fails under the tighter ratio: re-baseline with `--update-snapshots` in the same commit. If more than 5 snapshots fail unexpectedly, investigate *before* re-baselining — the baselines may be hiding latent flakiness (log to TD-FE).

End state: all journeys + stubs pass under the new threshold; updated PNGs committed.

### 2.6 Re-baseline workflow

**File:** `.github/workflows/visual-rebaseline.yml`.

**Trigger:** PR labeled `visual-rebaseline`.

**Job:**
1. Checkout PR branch.
2. Set up Node + npm cache.
3. `npm ci`.
4. `npx playwright install --with-deps chromium` (or rely on the Docker image — see §2.7).
5. `npm run test:e2e -- --update-snapshots`.
6. Commit refreshed PNGs to the PR branch with a message like `chore(e2e): refresh visual snapshots [skip ci]`.
7. Remove the `visual-rebaseline` label.

Documentation: `frontend/e2e/REBASELINE.md` explains the label workflow, when to use it (intentional UI changes accepted by author or review), and what *not* to use it for (suppressing real regressions).

### 2.7 CI workflow scaffolding

**File:** `.github/workflows/ci.yml`. Triggers: PRs to `master`, pushes to `master`.

**Runtime base.** Job runs in `mcr.microsoft.com/playwright:v1.59.1-jammy` so Chromium binaries match the locally-baselined snapshots. Cache key: `~/.cache/ms-playwright` keyed on the Playwright version pinned in `package.json`.

**Jobs at 0a (only `playwright` enforced):**

```yaml
jobs:
  setup:
    # Node + npm ci + cache
  playwright:
    needs: setup
    # npm run test:e2e
    # required to merge
  # ────────────── Phase 2a will turn this on ──────────────
  # typecheck:
  #   needs: setup
  #   # npm run typecheck (script does not exist yet — added in 2a)
  # ────────────── Phase 2b will turn this on ──────────────
  # lint:
  #   needs: setup
  #   # eslint . --max-warnings 0
  # prettier:
  #   needs: setup
  #   # prettier --check .
  # ────────────── Phase 0b will turn this on ─────────────
  # vitest:
  #   needs: setup
  #   # npm run test
  # ────────────── Phase 2c will turn these on ─────────────
  # build:
  #   needs: setup
  #   # npm run build
  # bundle-budget:
  #   needs: build
  #   # script reads docs/audits/<latest>-bundle-baseline.json,
  #   # compares to dist/, fails if over budget
  # knip-dead-code:
  #   needs: setup
  #   # knip --strict
```

Each TODO block names the phase that turns it on. Phase 0b removes the comment around the `vitest:` block. Phases 2a, 2b, 2c remove their respective blocks. Stale-doc grep (Phase 14) will scan for `Phase N` references in CI YAML — the master-spec allowlist convention covers this file.

### 2.8 Bun lockfile delete

Discrete commit. Deletes `frontend/bun.lock` and `frontend/bun.lockb`. Commit message body cites the evidence:

> The Brewra dev (`tech-brewra`) authored 3 commits on `frontend/package-lock.json` (Dec 2025 – Jan 2026) and 1 incidental commit each on `bun.lock` / `bun.lockb`. The recent `a444436 test(fe): add Playwright dev dependency` updated `package-lock.json` only — `bun.lock` has no `@playwright/test` entry. npm is the active workflow; the bun lockfiles are stale artifacts from a pre-fork PWA dual-tracking accident.

### 2.9 Phase 0a done-when

- Audit scorecard merged at `docs/audits/2026-05-26-frontend-baseline.md`.
- Dead-code raw outputs merged (knip, ts-prune, depcheck).
- Bundle baseline JSON merged.
- NFR baseline JSON merged.
- Playwright suite green on a representative PR under the tightened threshold.
- Re-baseline workflow exercised once (intentional snapshot refresh on a throwaway PR) and verified.
- `ci.yml` runs on every PR with the Playwright gate required to merge.
- `bun.lock` and `bun.lockb` deleted; `package-lock.json` is the sole lockfile.

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
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

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

1. **Proof-of-pipeline.** `GET /api/_health` → `200 { ok: true }`. Used by a smoke test in 0b that asserts MSW is intercepting in jsdom.
2. **Firebase sign-in.** `POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword*` → mirrors `firebaseSignInResponse` from `e2e/fixtures/auth.ts` (same shape, same field names).
3. **Firebase token refresh.** `POST https://securetoken.googleapis.com/v1/token*` → standard refresh response shape (id_token, refresh_token, expires_in).
4. **JWT mint.** `POST /api/auth/token` → `200 { access_token: "mock_jwt_token", expires_in: 3600 }`.
5. **JWT refresh.** `POST /api/auth/refresh` → same shape as #4.

Handler shapes mirror the Playwright fixtures so the two test layers stay consistent. Per-feature handlers (market-research, mission-control, customers, signals, scout, settings) are *not* shipped in 0b — they grow per feature in Phases 5–10 as unit tests need them.

### 3.3 Characterization tests

**Target files** (the pure-function survivors guaranteed to migrate into `src/shared/lib/` unchanged):

| File | Coverage shape | Notes |
|---|---|---|
| `src/lib/timestampUtils.ts` | Every exported function tested on representative inputs and edge cases (epoch boundary, DST-adjacent dates, invalid input). | Pure date math. |
| `src/lib/marketScoreDescriptions.ts` | Every exported lookup function returns the documented description for each score band; behavior on out-of-band input. | Static lookup table — fast. |
| `src/lib/marketScoresHeatmap.ts` | Every exported helper: bucketing logic, color mapping (asserted by category, not by hex string brittleness), sort order. | Pure transforms over score arrays. |
| `src/lib/utils.ts` | `cn()` merges Tailwind classes correctly. Use shadcn's documented edge cases (conditional classes, conflicting classes, undefined/null inputs). | Single-function file from shadcn template. |
| `src/lib/rateLimitManager.ts` | The 4-req/min boundary holds; queues when cap is hit; releases as the rolling window slides; behavior under concurrent enqueues. | Use `vi.useFakeTimers()` exclusively — no real-time waits. The 4 req/min value is a frozen interface per master §2.3. |

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
4. Visual snapshots are refreshed via the labeled re-baseline workflow when needed; no PR is blocked from merging by a snapshot delta with no review acknowledgement.
5. Audit scorecard, dead-code raw outputs, NFR + bundle baseline JSON files all committed under `docs/audits/`.
6. `bun.lock` and `bun.lockb` are gone.
7. Phase 1 has a complete picture of dead-code candidates and a stable safety net to backstop its execution.

---

## §6 Risks and mitigations

| # | Risk | Mitigation |
|---|---|---|
| R0a-1 | Audit scorecard takes longer than expected because file-by-file inbound-ref enumeration at 75,894 LOC is slow if done manually. | Tooling-driven, not narrative. `knip --reporter json` + `ts-prune` + a ripgrep batch produce the raw data; the scorecard is a *structured view* of those outputs, not a hand-written census. Agent value lives in the notes column. |
| R0a-2 | Tightening visual threshold to `maxDiffPixelRatio: 0.01` breaks more snapshots than expected. | Re-baseline as part of the same commit. If >5 snapshots fail unexpectedly, investigate before re-baselining — the existing baselines may hide latent flakiness; log findings to TD-FE. |
| R0a-3 | Playwright in CI is flaky on Linux runners against locally-baselined PNGs. | Use `mcr.microsoft.com/playwright:v1.59.1-jammy` Docker image so Chromium binaries match exactly. Cache `~/.cache/ms-playwright` by Playwright version. The existing local snapshots are already `*-chromium-linux-linux.png` so the convention is consistent. |
| R0a-4 | `scripts/measure-baselines.sh` numbers vary 2–3× run-to-run on shared hardware. | 0a measures on a local dev machine, recorded as such in the JSON (`captured_on: "local-dev-machine"`, with hardware notes). Phase 2c re-measures on CI hardware and sets budget values with headroom. 0a numbers are anchor sanity checks, not gates. |
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
| §8 Q2 | Visual regression exact threshold within 0.5–1.0% range; re-baseline workflow details. | `maxDiffPixelRatio: 0.01` (1.0%) with existing `threshold: 0.2` preserved. Re-baseline via PR label `visual-rebaseline` (workflow at §2.6). |
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
- `docs/audits/2026-05-26-frontend-nfr-baseline.json` — NFR baseline
- `docs/audits/2026-05-26-frontend-bundle-baseline.json` — bundle baseline
- `docs/audits/2026-05-26-frontend-deadcode-knip.txt` — knip raw output
- `docs/audits/2026-05-26-frontend-deadcode-tsprune.txt` — ts-prune raw output
- `docs/audits/2026-05-26-frontend-deadcode-depcheck.txt` — depcheck raw output
- `frontend/scripts/measure-baselines.sh` — NFR measurement script
- `frontend/knip.json` — knip config
- `frontend/e2e/REBASELINE.md` — re-baseline workflow documentation
- `.github/workflows/ci.yml` — primary CI workflow (extended in 0b)
- `.github/workflows/visual-rebaseline.yml` — labeled re-baseline workflow

Created during Phase 0b:
- `frontend/vitest.config.ts` — Vitest config
- `frontend/src/test/setup.ts` — Vitest + MSW + jest-dom setup
- `frontend/src/test/msw/server.ts`, `frontend/src/test/msw/handlers.ts` — MSW server + handlers
- `frontend/src/lib/__tests__/timestampUtils.test.ts` and the other characterization test files per §3.3
- `frontend/e2e/journeys/06-customers-page-load.spec.ts`
- `frontend/e2e/journeys/07-settings-page-load.spec.ts`
- `.github/workflows/ci.yml` — extended with the Vitest job

Master plan reference: `specs/14-frontend-refactoring-master-plan-design.md` (§4 Phase 0, §8 open questions).
