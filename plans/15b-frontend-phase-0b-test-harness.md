# Phase 0b — Frontend Test Harness + Characterization + Gap Journeys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land Phase 0b deliverables from `specs/15-frontend-phase-0-inventory-and-safety-net-design.md` §3.7 — Vitest + RTL + MSW harness with MSW proof-of-pipeline smoke test, characterization tests against the 5 pure-utility survivor files, two gap behavioral E2E journeys (`/customers`, `/settings`), `npm run test` appended to the local preflight chain, and NFR JSON updated with `after_phase_0b` Vitest measurements — on a `phase-0b-test-harness` branch, merged to `master` after impl-review converges.

**Architecture:** Ten commits on one branch, ordered by dependency. Install Vitest+RTL+MSW with config + setup + MSW server + handlers + proof-of-pipeline smoke test + npm scripts in one self-contained "harness up" commit (Task 1) → five characterization-test commits, one per survivor file (Tasks 2–6) → two gap-journey commits, one per missing route (Tasks 7–8) → extend the preflight chain with `npm run test` (Task 9) → extend `measure-baselines.sh` with a Vitest measurement and re-run to append `after_phase_0b` to the NFR JSON (Task 10) → sanity-check + impl-review handoff (Task 11, no commit). Per spec §2.7, this repo has no CI — the preflight script is the entire pre-merge gate, run locally by the controller agent.

**Parallelization opportunities (subagent-driven execution mode):** After Task 1 completes, Tasks 2–6 (characterization tests) are mutually independent and can dispatch in parallel — each touches only `src/lib/__tests__/<name>.test.ts` (no shared file). Tasks 7 and 8 (gap journeys) can each parallel with Tasks 2–6, but **must serialize relative to each other** — both may modify `frontend/e2e/fixtures/api-mocks.ts` under the bug-handling decision tree (see Task 7 preamble), and parallel modification in separate worktrees would conflict on merge. None of Tasks 2–8 touch `package.json` or the MSW handler set. Tasks 9, 10, 11 must run sequentially after Tasks 2–8 complete (Task 9 needs all Vitest content to exist so the extended preflight chain has something to gate on; Task 10 runs the full preflight under timing harness; Task 11 is the final sanity-check + handoff). Single-agent inline execution runs everything sequentially per the task numbering.

**Abort criteria.** Per-task STOP conditions are documented inline (Tasks 0/1/6/7/8/9/10/11). In addition, three plan-level escalations apply:

1. **Per-task budget.** If any single task fails after two independent debug attempts (i.e., two attempts to fix the root cause, not retries of the same approach), pause and report to the operator for a go/no-go decision rather than continuing the debug loop.
2. **Task 11 preflight budget.** If `npm run preflight` cannot be made green within 3 distinct fix attempts on `phase-0b-test-harness`, log the failing-preflight findings to `docs/TECH_DEBT.md` (which check failed, error pattern, hypothesis) and report to the operator. Repeated failures often indicate harness-installation issues that warrant explicit handling rather than continued patching.
3. **Plan-level wall-time ceiling.** If total wall time (excluding Task 10's 12–25min measurement window) exceeds 90 minutes, report to the operator. Cumulative ceremony usually indicates an environment issue worth escalating rather than continuing to patch task-by-task.

These thresholds are starting values; the operator can tighten or loosen per execution observation.

**Tech Stack:** Node 22 + npm 10 + TypeScript 5.5 + Vite 5 + Vitest 3.x + @testing-library/react 16.x + @testing-library/jest-dom 6.x + @testing-library/user-event 14.x + jsdom 25.x + MSW 2.x + Playwright 1.59.1 (from Phase 0a). All test-side deps are devDependencies — none ship in production.

**Pre-flight assumption:** Working tree is on `master`, clean, and Phase 0a is merged (provides `npm run preflight` chain at `typecheck && build && test:e2e`). Run `git status` and `git log --oneline -1` to confirm before starting Task 0.

**Where to run commands:** Per CLAUDE.md "Run tooling from the correct subdir," npm/vite/vitest/playwright commands run from `frontend/`. Plan steps below use absolute paths so they're unambiguous; engineer's `cd` is `frontend/` for any `npm`/`npx` invocation unless noted.

**Spec adherence vs code reality (read this before starting).** Three places where the spec's prose drifted from the current code. Characterization tests assert what the code does *today* (per master spec 14 — these tests are a behavioral baseline for the refactor, not a wish-list):

1. **`rateLimitManager.maxRequestsPerMinute` default is `30`, not `4`.** Spec §3.3 says "The 4 req/min boundary holds" and §6 R0b-2 calls 4 a "frozen interface per master §2.3." The constructor at `frontend/src/lib/rateLimitManager.ts:27` reads `maxRequestsPerMinute: 30` with a code comment "// Increased limit for faster processing" — the default was bumped after the docs were written. Task 6 tests the actual `30` boundary and includes a note in the commit body flagging the discrepancy. Per CLAUDE.md "Spec-driven flow" ("specs and plans are a frozen record of intent... don't update specs/plans to reflect post-merge drift; the code is authoritative"), the spec is **not** amended. Tracked post-merge via a TD-FE entry — see Open Questions at end of plan.
2. **`utils.ts` exports two functions, not one.** Spec §3.3 mentions only `cn()`. The file at `frontend/src/lib/utils.ts` also exports `sanitizeAnswerText(text: string): string` — a markdown/symbol stripper. Task 5 tests both. (Excluding `sanitizeAnswerText` would leave a survivor function uncharacterized.) Documentation oversight; no action needed.
3. **`marketScoreDescriptions.ts` is a column-key → description lookup, not "score-band descriptions."** Spec §3.3 implies the lookup returns "descriptions for each score band." The actual function `getDescriptionTextForColumn(response, reportColumnKey)` looks up by report-column key (e.g., `"market-size"`) via the `REPORT_KEY_TO_DESCRIPTION_LABEL` map, with case-insensitive fallback. Task 3 tests the actual lookup shape. Documentation oversight; no action needed.

These are recorded as Open Questions at the end of this plan; only item 1 requires a tracked follow-up (TD-FE entry).

---

## File Structure

**Created:**
- `frontend/vitest.config.ts` — Vitest config (jsdom env, globals: false, MSW setup file, v8 coverage)
- `frontend/src/test/setup.ts` — Vitest + MSW + jest-dom setup (server.listen/resetHandlers/close lifecycle)
- `frontend/src/test/msw/server.ts` — `setupServer(...handlers)` exporter
- `frontend/src/test/msw/handlers.ts` — MSW handler array (proof-of-pipeline + Firebase auth + JWT)
- `frontend/src/test/__tests__/msw-pipeline.test.ts` — MSW proof-of-pipeline smoke test
- `frontend/src/lib/__tests__/timestampUtils.test.ts` — characterization for `toUTCTimestamp`, `isTimestampNewer`, `getCurrentUTCTimestamp`, `logTimestampComparison`
- `frontend/src/lib/__tests__/marketScoreDescriptions.test.ts` — characterization for `getDescriptionTextForColumn` + `REPORT_KEY_TO_DESCRIPTION_LABEL`
- `frontend/src/lib/__tests__/marketScoresHeatmap.test.ts` — characterization for `scorePercentToRating`, `mapMarketScoresRowToHeatmapLead`, `extractMarketScoreRowsFromResponse`, `heatmapLeadFromUnknownRow`
- `frontend/src/lib/__tests__/utils.test.ts` — characterization for `cn` AND `sanitizeAnswerText`
- `frontend/src/lib/__tests__/rateLimitManager.test.ts` — characterization for queuing, rolling-window cap, sliding-window release (with `vi.useFakeTimers()`)
- `frontend/e2e/journeys/06-customers-page-load.spec.ts` — gap behavioral journey for `/customers`
- `frontend/e2e/journeys/07-settings-page-load.spec.ts` — gap behavioral journey for `/settings`
- `frontend/e2e/journeys/06-customers-page-load.spec.ts-snapshots/01-customers-page-chromium-linux-linux.png` (committed after first green run)
- `frontend/e2e/journeys/07-settings-page-load.spec.ts-snapshots/01-settings-page-chromium-linux-linux.png` (committed after first green run)

**Modified:**
- `frontend/package.json` — add devDeps `vitest@^3`, `@vitest/coverage-v8@^3`, `@testing-library/react@^16`, `@testing-library/jest-dom@^6`, `@testing-library/user-event@^14`, `jsdom@^25`, `msw@^2`; add npm scripts `test` (`vitest run`), `test:watch` (`vitest`), `test:coverage` (`vitest run --coverage`); extend `preflight` to append `&& npm run test`
- `frontend/package-lock.json` — regenerated by the install above
- `frontend/scripts/measure-baselines.sh` — append a 5th measurement (`vitest run`, 3 runs, no cold-cache step needed); add `vitest_full_suite_seconds` to the JSON output
- `docs/audits/2026-05-26-frontend-nfr-baseline.json` — add an `after_phase_0b` top-level key with re-measured tsc/build/dev-start/playwright + new vitest median (existing top-level fields preserved unchanged per spec §3.6)

**Deleted:** none.

---

## Task 0: Branch Setup

**Files:** none (git operations only).

- [ ] **Step 1: Verify Phase 0a is on master**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout master
git pull --ff-only origin master
git log --oneline -1 frontend/scripts/preflight.sh
```

Expected: latest commit on master, and the `git log` shows a recent commit involving `preflight.sh` (Phase 0a's preflight scaffolding commit, e.g., `d0b99b1 chore(fe): replace ci.yml with local preflight script + npm chain`).

If `preflight.sh` doesn't exist or no commit history references it: STOP. Phase 0a has not merged. Phase 0b depends on the preflight chain being in place (per spec §4 "0b does not start until 0a is merged").

- [ ] **Step 2: Verify clean working tree on master**

```bash
git status
git branch --show-current
```

Expected: `master`, "nothing to commit, working tree clean" (or only untracked files unrelated to Phase 0b; the existing untracked `docs/parallel-sandbox-development.md` is fine and stays untracked).

If tracked files are dirty: STOP. Resolve uncommitted changes before continuing — do not stash silently.

- [ ] **Step 3: Confirm the 0a-extended preflight chain runs green (sanity baseline)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: typecheck + build + Playwright all green. Total wall time ~90–120s. This confirms the Phase 0b branch starts from a known-green baseline; if preflight is red on master, every later Task 11 sanity-check will inherit the failure and falsely attribute it to 0b's work.

If preflight takes >180s but is green: note the time in the impl-review handoff and proceed; cold caches or shared-machine load can stretch wall time without indicating a real issue.

If preflight is red on master: STOP. Investigate before continuing — fix on master first (separate non-0b commit) or roll back to a known-green commit.

- [ ] **Step 4: Create and checkout the feature branch**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git checkout -b phase-0b-test-harness
```

Expected: "Switched to a new branch 'phase-0b-test-harness'".

- [ ] **Step 5: Confirm Node and npm versions**

```bash
node --version
npm --version
```

Expected: Node `v22.x.x` (LTS), npm `10.x.x` or higher. (Vitest 3.x requires Node 18+, MSW 2.x requires Node 18+, jsdom 25.x requires Node 18+ — Node 22 satisfies all.)

No commit at this task — only branch setup and baseline sanity-check.

---

## Task 1: Install Vitest + RTL + MSW Harness (with MSW Smoke Test)

**Files:**
- Modify: `frontend/package.json` (devDeps + new npm scripts; preflight chain unchanged here — extended in Task 9)
- Modify: `frontend/package-lock.json` (regenerated)
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/test/msw/server.ts`
- Create: `frontend/src/test/msw/handlers.ts`
- Create: `frontend/src/test/__tests__/msw-pipeline.test.ts`

Rationale (spec §3.1 + §3.2): one self-contained "harness works" commit. Installing the dev-deps without simultaneously proving the harness intercepts `fetch` in jsdom would leave a broken installation in place if the smoke test reveals a misconfiguration. Shipping the harness install + config + setup + MSW server + handlers + smoke test as one commit means the post-commit state is "Vitest exists AND demonstrates end-to-end MSW interception" — a strictly stronger guarantee than "Vitest is installed, probably works."

Per spec §3.1, `globals: false` — every Vitest test file imports `describe`, `it`, `expect`, `vi` explicitly from `'vitest'`. Per CLAUDE.md "agents-as-authors with explicit, machine-readable contracts." Cost is one import line per test file; benefit is traceable symbols without IDE plugins.

**Note on `@testing-library/react`:** RTL is installed as part of the harness baseline per spec §3.1 but **no Phase 0b test consumes it** — all characterization tests are against utility functions (no component rendering). Phases 5–10's per-feature component tests will use it. The unused-dep install is intentional, not an oversight.

- [ ] **Step 1: Install Vitest + RTL + MSW + jsdom dev-deps in one npm install**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm install --save-dev \
  vitest@^3 \
  @vitest/coverage-v8@^3 \
  @testing-library/react@^16 \
  @testing-library/jest-dom@^6 \
  @testing-library/user-event@^14 \
  jsdom@^25 \
  msw@^2
```

Expected: all 7 added to `devDependencies` in one `package.json` write. `package-lock.json` regenerated. Output reports installed counts and may emit peer-dep warnings — if any warnings reference React 18 vs RTL 16 (RTL 16 supports React 18+), they're advisory; if any warning references something *new* (not pre-existing on master), pause and investigate before continuing.

If install fails on a peer dependency conflict not present pre-install: STOP. Read the failing peer-dep message verbatim and report to the operator with the failing chain. Do not blindly add `--legacy-peer-deps`.

- [ ] **Step 2: Add npm scripts (test / test:watch / test:coverage) — preflight chain not yet extended**

Edit `frontend/package.json` `scripts` block. The current scripts block (read at plan-writing time) is:

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "lint": "eslint .",
    "preflight": "npm run typecheck && npm run build && npm run test:e2e",
    "preview": "vite preview",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:update-snapshots": "playwright test --update-snapshots",
    "test:e2e:ui": "playwright test --ui",
    "typecheck": "tsc --noEmit"
  },
```

Add three new scripts so the final block reads (alphabetical within the block where existing pattern allows):

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "lint": "eslint .",
    "preflight": "npm run typecheck && npm run build && npm run test:e2e",
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

Only adding `test`, `test:coverage`, `test:watch`. Do **not** modify `preflight` in this task — Task 9 extends it.

- [ ] **Step 3: Create `frontend/vitest.config.ts`**

Write this exact content:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// Spec 15 §3.1. globals: false — every test file imports describe/it/expect/vi
// explicitly from 'vitest'. Master plan §1.4 "agents-as-authors with explicit,
// machine-readable contracts."
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 4: Create `frontend/src/test/setup.ts`**

Write this exact content:

```ts
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw/server';

// Spec 15 §3.1 — MSW lifecycle. `onUnhandledRequest: 'error'` is intentional:
// any test that fires an un-mocked network request fails loudly instead of
// silently hitting (or refusing) a real backend.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- [ ] **Step 5: Create `frontend/src/test/msw/server.ts`**

```bash
mkdir -p /projects/Brewra/brewra-gtm-intelligence/frontend/src/test/msw
mkdir -p /projects/Brewra/brewra-gtm-intelligence/frontend/src/test/__tests__
```

Write this exact content to `frontend/src/test/msw/server.ts`:

```ts
// Spec 15 §3.2 — Node-side MSW server. Used by setupFiles in vitest.config.ts.
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

- [ ] **Step 6: Create `frontend/src/test/msw/handlers.ts`**

The handler shapes mirror `frontend/e2e/fixtures/auth.ts` so the Vitest and Playwright auth-mock layers stay consistent (spec §3.2). The Firebase signin handler returns the same `firebaseSignInResponse` shape (`idToken`, `email`, `localId`, `registered`, `refreshToken`, `expiresIn`). MSW v2 uses `http.*` + `HttpResponse` (v1's `rest.*` is removed).

Write this exact content to `frontend/src/test/msw/handlers.ts`:

```ts
// Spec 15 §3.2 — MSW handler set (minimal).
//
// Five handlers shipped at 0b:
//   1. Proof-of-pipeline GET /api/_health — used by msw-pipeline.test.ts to
//      assert MSW intercepts fetch under jsdom.
//   2. Firebase sign-in (identitytoolkit) — shape mirrors firebaseSignInResponse
//      from e2e/fixtures/auth.ts so the Vitest and Playwright layers agree.
//   3. Firebase token refresh (securetoken).
//   4. JWT mint POST /api/auth/token.
//   5. JWT refresh POST /api/auth/refresh.
//
// Per-feature handlers (market-research, mission-control, customers, signals,
// scout, settings) are NOT shipped here. They grow per feature in Phases 5–10
// as unit tests need them. Spec §3.2 last paragraph.
import { http, HttpResponse } from 'msw';

export const handlers = [
  // 1. Proof-of-pipeline
  http.get('/api/_health', () => HttpResponse.json({ ok: true })),

  // 2. Firebase sign-in. MSW v2 ignores query strings by default, so this
  //    matches /accounts:signInWithPassword?key=API_KEY too. Shape matches
  //    firebaseSignInResponse from e2e/fixtures/auth.ts.
  http.post(
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword',
    () =>
      HttpResponse.json({
        kind: 'identitytoolkit#VerifyPasswordResponse',
        idToken: 'mock_firebase_token',
        email: 'test@brewra.test',
        localId: 'test_user_123',
        registered: true,
        refreshToken: 'mock_refresh_token',
        expiresIn: '3600',
      }),
  ),

  // 3. Firebase token refresh
  http.post('https://securetoken.googleapis.com/v1/token', () =>
    HttpResponse.json({
      access_token: 'mock_firebase_token',
      id_token: 'mock_firebase_token',
      refresh_token: 'mock_refresh_token',
      expires_in: '3600',
      token_type: 'Bearer',
      user_id: 'test_user_123',
      project_id: '710721694093',
    }),
  ),

  // 4. JWT mint
  http.post('/api/auth/token', () =>
    HttpResponse.json({ access_token: 'mock_jwt_token', expires_in: 3600 }),
  ),

  // 5. JWT refresh
  http.post('/api/auth/refresh', () =>
    HttpResponse.json({ access_token: 'mock_jwt_token', expires_in: 3600 }),
  ),
];
```

- [ ] **Step 7: Create the MSW proof-of-pipeline smoke test**

Write this exact content to `frontend/src/test/__tests__/msw-pipeline.test.ts`:

```ts
// Spec 15 §3.2 handler #1 + §3.3 "Not a characterization target, but ships in
// the same set so the harness is verifiably wired."
//
// Two assertions:
//   1. GET /api/_health under jsdom + MSW returns { ok: true }.
//   2. An unhandled-path fetch is observed by MSW's request:unhandled event
//      (proves onUnhandledRequest: 'error' is wired in setup.ts).
//
// The second assertion uses server.events instead of asserting on fetch's
// reject behavior, which is brittle across MSW patch versions and jsdom
// fetch implementations. The request:unhandled event is a documented,
// version-stable MSW v2 API that fires regardless of how the fetch resolves.
import { describe, expect, it } from 'vitest';
import { server } from '../msw/server';

describe('MSW pipeline (jsdom + node MSW server)', () => {
  it('intercepts /api/_health and returns the handler payload', async () => {
    const res = await fetch('/api/_health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it('observes unhandled-path fetch via request:unhandled event', async () => {
    let unhandled: Request | undefined;
    const onUnhandled = ({ request }: { request: Request }) => {
      unhandled = request;
    };
    server.events.on('request:unhandled', onUnhandled);
    try {
      // The fetch itself may reject, resolve, or hang depending on jsdom's
      // fetch implementation when MSW raises. We don't assert on the fetch
      // outcome — only that MSW saw the unhandled URL.
      await fetch('/api/this-path-is-not-handled').catch(() => undefined);
    } finally {
      server.events.removeListener('request:unhandled', onUnhandled);
    }
    expect(unhandled).toBeDefined();
    expect(unhandled?.url).toMatch(/this-path-is-not-handled/);
  });
});
```

- [ ] **Step 8: Run the smoke test**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run test
```

Expected: `2 passed` from `src/test/__tests__/msw-pipeline.test.ts`. Total wall time <5s. If `0 tests collected`, the vitest config's project glob isn't picking up `src/**/*.test.ts` — verify `vitest.config.ts` matches Step 3 exactly. If the second assertion fails (no `request:unhandled` event fired), MSW isn't intercepting the fetch at all — verify `setup.ts` matches Step 4 exactly and that `server.listen()` ran in `beforeAll`.

If both tests pass: harness is wired end-to-end. Proceed to commit.

If anything fails: STOP. Do not commit a half-wired harness. Diagnose root cause (missing alias, missing dep, MSW v1-vs-v2 import path mismatch). Common pitfall: `import { rest } from 'msw'` (v1 syntax) — MSW v2 uses `import { http, HttpResponse } from 'msw'`.

- [ ] **Step 9: Run the existing Playwright suite as a regression gate for the dep installs**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run test:e2e
```

Expected: full Playwright suite passes (~50–80s wall time). The Vitest/RTL/MSW/jsdom installs are devDeps and don't touch production code, so a Playwright regression here would indicate an unintended side effect (e.g., a peer-dep upgrade that touched something runtime).

If Playwright suddenly fails: STOP. Compare `package-lock.json` diff against master for unintended runtime-dep version drift. Do not commit until Playwright is green.

- [ ] **Step 10: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/package.json frontend/package-lock.json \
  frontend/vitest.config.ts \
  frontend/src/test/setup.ts \
  frontend/src/test/msw/server.ts \
  frontend/src/test/msw/handlers.ts \
  frontend/src/test/__tests__/msw-pipeline.test.ts
git commit -m "$(cat <<'EOF'
test(fe): install Vitest+RTL+MSW harness with proof-of-pipeline smoke test

Self-contained harness commit: dev-dep install, vitest.config.ts (jsdom +
globals:false), MSW server + handlers + lifecycle setup, and the smoke
test that proves MSW intercepts fetch under jsdom. Handler shapes mirror
e2e/fixtures/auth.ts so the Vitest and Playwright auth-mock layers agree.
Three new npm scripts (test, test:watch, test:coverage); the preflight
chain is extended in a follow-up commit so this commit ships only the
harness and the chain extension lands once all Vitest content is committed.

Spec 15 §3.1 + §3.2.
EOF
)"
```

---

## Task 2: Characterization — `timestampUtils.ts`

**Files:**
- Create: `frontend/src/lib/__tests__/timestampUtils.test.ts`

Rationale (spec §3.3): every exported function tested on representative inputs and edge cases (epoch boundary, DST-adjacent dates, invalid input). Pure date math — straightforward unit tests, no timer manipulation needed (the only `Date.now()`-dependent function is `getCurrentUTCTimestamp`, which is trivial to assert against an ISO-string format).

The file (read at plan-writing time) exports 4 functions: `toUTCTimestamp`, `isTimestampNewer`, `getCurrentUTCTimestamp`, and `logTimestampComparison` (a documented no-op kept for API compatibility — see `frontend/src/lib/timestampUtils.ts:60-68`). The test covers all 4.

`toUTCTimestamp` has a non-obvious branch: ISO strings *without* timezone marker get `'Z'` appended (treated as UTC). Strings with `T` but no `Z`/`+`/`-` past position 10 (i.e., naked datetime) trigger this. Tests must cover this branch explicitly because Phase 1+ refactors could regress this silently.

- [ ] **Step 1: Write the test file**

Write this exact content to `frontend/src/lib/__tests__/timestampUtils.test.ts`:

```ts
// Spec 15 §3.3 — characterization for src/lib/timestampUtils.ts.
// Covers all 4 exported functions on representative inputs and edge cases.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCurrentUTCTimestamp,
  isTimestampNewer,
  logTimestampComparison,
  toUTCTimestamp,
} from '@/lib/timestampUtils';

describe('toUTCTimestamp', () => {
  it('returns null for null/undefined/0/empty-string inputs', () => {
    expect(toUTCTimestamp(null)).toBeNull();
    expect(toUTCTimestamp(undefined)).toBeNull();
    expect(toUTCTimestamp(0)).toBeNull();         // falsy guard at line 10
    expect(toUTCTimestamp('')).toBeNull();
  });

  it('passes through fully-qualified ISO strings (Z suffix)', () => {
    expect(toUTCTimestamp('2026-05-08T10:00:00.000Z')).toBe('2026-05-08T10:00:00.000Z');
  });

  it('appends Z to naked ISO strings (no timezone marker)', () => {
    // "2026-05-08T10:00:00" → treated as UTC via the appended 'Z' branch
    expect(toUTCTimestamp('2026-05-08T10:00:00')).toBe('2026-05-08T10:00:00.000Z');
  });

  it('respects explicit timezone offsets (does not append Z)', () => {
    // +00:00 is explicit — should NOT be re-interpreted as naked UTC
    expect(toUTCTimestamp('2026-05-08T10:00:00+00:00')).toBe('2026-05-08T10:00:00.000Z');
    // -05:00 → converted to UTC by Date
    expect(toUTCTimestamp('2026-05-08T10:00:00-05:00')).toBe('2026-05-08T15:00:00.000Z');
  });

  it('converts Unix epoch millisecond numbers', () => {
    // Epoch boundary: 0 is falsy (returns null per the guard). 1 ms after epoch.
    expect(toUTCTimestamp(1)).toBe('1970-01-01T00:00:00.001Z');
    expect(toUTCTimestamp(1715169600000)).toBe('2024-05-08T12:00:00.000Z');
  });

  it('handles Date object inputs', () => {
    const d = new Date('2026-05-08T10:00:00.000Z');
    expect(toUTCTimestamp(d)).toBe('2026-05-08T10:00:00.000Z');
  });

  it('returns null and warns on invalid timestamp string', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(toUTCTimestamp('not-a-date')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('Invalid timestamp provided:', 'not-a-date');
    warnSpy.mockRestore();
  });

  it('survives a DST-adjacent input as a Date (no timezone confusion)', () => {
    // US DST 2024 transition was 2024-03-10T02:00 local — passing a UTC ISO
    // around that date should not shift the wall-clock UTC.
    expect(toUTCTimestamp('2024-03-10T07:00:00.000Z')).toBe('2024-03-10T07:00:00.000Z');
  });
});

describe('isTimestampNewer', () => {
  it('returns true when first is strictly newer', () => {
    expect(isTimestampNewer('2026-05-08T11:00:00Z', '2026-05-08T10:00:00Z')).toBe(true);
  });

  it('returns false when timestamps are equal', () => {
    expect(isTimestampNewer('2026-05-08T10:00:00Z', '2026-05-08T10:00:00Z')).toBe(false);
  });

  it('returns false when first is older', () => {
    expect(isTimestampNewer('2026-05-08T09:00:00Z', '2026-05-08T10:00:00Z')).toBe(false);
  });

  it('returns false when either input is invalid (null/undefined/garbage)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(isTimestampNewer(null, '2026-05-08T10:00:00Z')).toBe(false);
    expect(isTimestampNewer('2026-05-08T10:00:00Z', undefined)).toBe(false);
    expect(isTimestampNewer('garbage', '2026-05-08T10:00:00Z')).toBe(false);
    warnSpy.mockRestore();
  });

  it('compares Unix ms numbers correctly', () => {
    expect(isTimestampNewer(2000, 1000)).toBe(true);
    expect(isTimestampNewer(1000, 2000)).toBe(false);
  });
});

describe('getCurrentUTCTimestamp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the current time as ISO-Z string', () => {
    expect(getCurrentUTCTimestamp()).toBe('2026-05-08T10:00:00.000Z');
  });

  it('format is ISO 8601 with millisecond + Z suffix', () => {
    vi.setSystemTime(new Date('2026-12-31T23:59:59.999Z'));
    expect(getCurrentUTCTimestamp()).toBe('2026-12-31T23:59:59.999Z');
  });
});

describe('logTimestampComparison', () => {
  it('is a no-op (does not throw, returns undefined)', () => {
    // The function is kept for API compatibility per the source comment at
    // src/lib/timestampUtils.ts:60-68. It must not throw and must not emit
    // any console output (no warn/log/error spies fire).
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(logTimestampComparison('2026-05-08T10:00:00Z', '2026-05-08T11:00:00Z', 'TestComponent')).toBeUndefined();
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run only this test file**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run test -- src/lib/__tests__/timestampUtils.test.ts
```

Expected: all assertions pass. ~20 assertions across 4 describe blocks; total <2s.

If any assertion fails: read the actual vs expected and decide — is the test wrong (rewrite the assertion to match the code's actual behavior, since characterization tests document reality), or is the code unexpectedly broken (very unlikely, since master is green; if so, STOP and report).

- [ ] **Step 3: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/lib/__tests__/timestampUtils.test.ts
git commit -m "$(cat <<'EOF'
test(fe): characterization tests for timestampUtils

Locks the behavior of toUTCTimestamp (including the naked-ISO → append-Z
branch and the epoch-boundary falsy guard), isTimestampNewer, the no-op
logTimestampComparison, and getCurrentUTCTimestamp (against fake timers).

Spec 15 §3.3.
EOF
)"
```

---

## Task 3: Characterization — `marketScoreDescriptions.ts`

**Files:**
- Create: `frontend/src/lib/__tests__/marketScoreDescriptions.test.ts`

Rationale (spec §3.3): "Every exported lookup function returns the documented description for each score band." The spec's description is slightly off — the actual function `getDescriptionTextForColumn(response, reportColumnKey)` does a **column-key → description-text lookup** via the `REPORT_KEY_TO_DESCRIPTION_LABEL` map (not a score-band lookup). It also has a case-insensitive fallback when the canonical key isn't found verbatim in `response.descriptions`. The test covers the actual lookup shape and both branches.

File exports (read at plan-writing time):
- `MarketScoreDescriptionsResponse` (interface)
- `REPORT_KEY_TO_DESCRIPTION_LABEL` (record: column-key → canonical description label)
- `getDescriptionTextForColumn(response, reportColumnKey): string | undefined`

- [ ] **Step 1: Write the test file**

Write this exact content to `frontend/src/lib/__tests__/marketScoreDescriptions.test.ts`:

```ts
// Spec 15 §3.3 — characterization for src/lib/marketScoreDescriptions.ts.
//
// Note: spec §3.3 phrasing implies a score-band lookup; the actual function
// is a report-column → description-text lookup via REPORT_KEY_TO_DESCRIPTION_LABEL.
// This test characterizes the actual behavior. Spec drift logged for post-merge.
import { describe, expect, it } from 'vitest';
import {
  REPORT_KEY_TO_DESCRIPTION_LABEL,
  getDescriptionTextForColumn,
  type MarketScoreDescriptionsResponse,
} from '@/lib/marketScoreDescriptions';

describe('REPORT_KEY_TO_DESCRIPTION_LABEL', () => {
  it('contains the 5 expected report column keys', () => {
    expect(Object.keys(REPORT_KEY_TO_DESCRIPTION_LABEL).sort()).toEqual([
      'competitor-landscape',
      'industry-trends',
      'market-entry',
      'market-size',
      'regulatory-compliance',
    ]);
  });

  it('maps each key to its canonical lowercase description label', () => {
    expect(REPORT_KEY_TO_DESCRIPTION_LABEL['market-size']).toBe('market size & opportunity');
    expect(REPORT_KEY_TO_DESCRIPTION_LABEL['industry-trends']).toBe('industry trends report');
    expect(REPORT_KEY_TO_DESCRIPTION_LABEL['competitor-landscape']).toBe('competitor landscape');
    expect(REPORT_KEY_TO_DESCRIPTION_LABEL['regulatory-compliance']).toBe('regulatory & compliance highlights');
    expect(REPORT_KEY_TO_DESCRIPTION_LABEL['market-entry']).toBe('market entry & growth strategy');
  });
});

describe('getDescriptionTextForColumn', () => {
  const fullResponse: MarketScoreDescriptionsResponse = {
    lead_id: 'lead_1',
    org_id: 'org_1',
    combined_score: 75,
    scored_at: '2026-05-08T10:00:00Z',
    descriptions: {
      'market size & opportunity': 'A large addressable market.',
      'industry trends report': 'Trends are favorable.',
      'competitor landscape': 'Three major competitors identified.',
      'regulatory & compliance highlights': 'GDPR compliance required.',
      'market entry & growth strategy': 'Direct sales recommended.',
    },
  };

  it('returns the canonical description for each known column key', () => {
    expect(getDescriptionTextForColumn(fullResponse, 'market-size'))
      .toBe('A large addressable market.');
    expect(getDescriptionTextForColumn(fullResponse, 'industry-trends'))
      .toBe('Trends are favorable.');
    expect(getDescriptionTextForColumn(fullResponse, 'competitor-landscape'))
      .toBe('Three major competitors identified.');
    expect(getDescriptionTextForColumn(fullResponse, 'regulatory-compliance'))
      .toBe('GDPR compliance required.');
    expect(getDescriptionTextForColumn(fullResponse, 'market-entry'))
      .toBe('Direct sales recommended.');
  });

  it('returns undefined when response is undefined', () => {
    expect(getDescriptionTextForColumn(undefined, 'market-size')).toBeUndefined();
  });

  it('returns undefined when response.descriptions is missing', () => {
    // @ts-expect-error — intentionally simulating a partially-formed response
    expect(getDescriptionTextForColumn({ lead_id: 'x', org_id: 'y', combined_score: 0 }, 'market-size')).toBeUndefined();
  });

  it('returns undefined for an unknown column key', () => {
    expect(getDescriptionTextForColumn(fullResponse, 'not-a-real-key')).toBeUndefined();
  });

  it('falls back to case-insensitive lookup when the canonical key is not exact', () => {
    const oddCaseResponse: MarketScoreDescriptionsResponse = {
      lead_id: 'lead_1',
      org_id: 'org_1',
      combined_score: 50,
      descriptions: {
        'Market Size & Opportunity': 'Title-cased key with matching label.',
        '  industry trends report  ': 'Padded with whitespace.',
      },
    };
    expect(getDescriptionTextForColumn(oddCaseResponse, 'market-size'))
      .toBe('Title-cased key with matching label.');
    expect(getDescriptionTextForColumn(oddCaseResponse, 'industry-trends'))
      .toBe('Padded with whitespace.');
  });

  it('returns undefined when neither exact nor case-insensitive match exists', () => {
    const partial: MarketScoreDescriptionsResponse = {
      lead_id: 'lead_1',
      org_id: 'org_1',
      combined_score: 0,
      descriptions: { 'market size & opportunity': 'Only this one is present.' },
    };
    expect(getDescriptionTextForColumn(partial, 'competitor-landscape')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run only this test file**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run test -- src/lib/__tests__/marketScoreDescriptions.test.ts
```

Expected: all assertions pass. <1s wall time.

- [ ] **Step 3: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/lib/__tests__/marketScoreDescriptions.test.ts
git commit -m "$(cat <<'EOF'
test(fe): characterization tests for marketScoreDescriptions

Locks REPORT_KEY_TO_DESCRIPTION_LABEL contents and the
getDescriptionTextForColumn lookup behavior including the case-insensitive
fallback branch. (Spec §3.3 prose referenced "score band descriptions"; the
actual function is a report-column key lookup — see plan header §"Spec
adherence vs code reality" item 3.)

Spec 15 §3.3.
EOF
)"
```

---

## Task 4: Characterization — `marketScoresHeatmap.ts`

**Files:**
- Create: `frontend/src/lib/__tests__/marketScoresHeatmap.test.ts`

Rationale (spec §3.3): "Every exported helper: bucketing logic, color mapping (asserted by category, not by hex string brittleness), sort order." The actual file has no color mapping or sort order helpers (those live in consumer components). It exports 4 functions and 1 interface:

- `scorePercentToRating(score: number): Rating` — bucketing at 75/50/0 → "High"/"Medium"/"Low"
- `MarketScoresApiRow` (interface)
- `mapMarketScoresRowToHeatmapLead(row: MarketScoresApiRow): HeatmapLead`
- `extractMarketScoreRowsFromResponse(data: unknown): Record<string, unknown>[]` — envelope-shape extraction
- `heatmapLeadFromUnknownRow(raw: Record<string, unknown>): HeatmapLead | null`

The Tier 2 mapping function consumes types from `@/components/market-research/lead-stream/leadData` (`Rating`, `HeatmapLead`, `getPriority`); the test imports types as needed and exercises the bucketing thresholds (75/50/0), the envelope-shape branches, and the camelCase/snake_case tolerance in `heatmapLeadFromUnknownRow`.

- [ ] **Step 1: Write the test file**

Write this exact content to `frontend/src/lib/__tests__/marketScoresHeatmap.test.ts`:

```ts
// Spec 15 §3.3 — characterization for src/lib/marketScoresHeatmap.ts.
// Tests bucketing thresholds, envelope-shape branches, and snake/camel
// case tolerance. No color mapping or sort order in the file itself — those
// helpers live in consumer components and will be tested at extraction time.
import { describe, expect, it } from 'vitest';
import {
  extractMarketScoreRowsFromResponse,
  heatmapLeadFromUnknownRow,
  mapMarketScoresRowToHeatmapLead,
  scorePercentToRating,
  type MarketScoresApiRow,
} from '@/lib/marketScoresHeatmap';

describe('scorePercentToRating', () => {
  it('returns "High" at >= 75', () => {
    expect(scorePercentToRating(100)).toBe('High');
    expect(scorePercentToRating(75)).toBe('High');
  });

  it('returns "Medium" in [50, 75)', () => {
    expect(scorePercentToRating(74.9)).toBe('Medium');
    expect(scorePercentToRating(50)).toBe('Medium');
  });

  it('returns "Low" below 50', () => {
    expect(scorePercentToRating(49.9)).toBe('Low');
    expect(scorePercentToRating(0)).toBe('Low');
    expect(scorePercentToRating(-10)).toBe('Low');
  });

  it('treats NaN-producing input as Low (via the num() guard chain in callers)', () => {
    // scorePercentToRating itself takes a number; NaN comparisons against 75
    // and 50 are both false, falling through to "Low".
    expect(scorePercentToRating(NaN)).toBe('Low');
  });
});

describe('mapMarketScoresRowToHeatmapLead', () => {
  const baseRow: MarketScoresApiRow = {
    lead_id: 'lead_001',
    org_id: 'org_abc',
    company_name: 'Acme Corp',
    score_market_size_opportunity: 80,
    score_industry_trends_report: 60,
    score_competitor_landscape: 40,
    score_regulatory_compliance_highlights: 75,
    score_market_entry_growth_strategy: 50,
    combined_score: 61.234,
  };

  it('rounds combined_score to one decimal in totalScore', () => {
    const lead = mapMarketScoresRowToHeatmapLead(baseRow);
    expect(lead.totalScore).toBe(61.2);
  });

  it('maps every per-column score into the ratings record', () => {
    const lead = mapMarketScoresRowToHeatmapLead(baseRow);
    expect(lead.ratings).toEqual({
      'market-size': 'High',          // 80
      'industry-trends': 'Medium',    // 60
      'competitor-landscape': 'Low',  // 40
      'regulatory-compliance': 'High', // 75
      'market-entry': 'Medium',       // 50
    });
  });

  it('uses company_name for name and company fields; em-dash fallback when blank', () => {
    const lead = mapMarketScoresRowToHeatmapLead(baseRow);
    expect(lead.company).toBe('Acme Corp');
    expect(lead.name).toBe('Acme Corp');

    const blank = mapMarketScoresRowToHeatmapLead({ ...baseRow, company_name: '   ' });
    expect(blank.company).toBe('—');
    expect(blank.name).toBe('—');
  });

  it('assigns "Prospect List" as the source label', () => {
    expect(mapMarketScoresRowToHeatmapLead(baseRow).source).toBe('Prospect List');
  });

  it('stringifies lead_id (defensive against numeric IDs from JSON gateways)', () => {
    // @ts-expect-error — exercising the String() coercion intentionally
    const lead = mapMarketScoresRowToHeatmapLead({ ...baseRow, lead_id: 12345 });
    expect(lead.id).toBe('12345');
  });
});

describe('extractMarketScoreRowsFromResponse', () => {
  it('returns [] for null/undefined/non-object input', () => {
    expect(extractMarketScoreRowsFromResponse(null)).toEqual([]);
    expect(extractMarketScoreRowsFromResponse(undefined)).toEqual([]);
    expect(extractMarketScoreRowsFromResponse(42)).toEqual([]);
    expect(extractMarketScoreRowsFromResponse('string')).toEqual([]);
  });

  it('extracts from { rows: [...] }', () => {
    expect(extractMarketScoreRowsFromResponse({ rows: [{ lead_id: 'a' }] }))
      .toEqual([{ lead_id: 'a' }]);
  });

  it('extracts from { leads: [...] }', () => {
    expect(extractMarketScoreRowsFromResponse({ leads: [{ lead_id: 'b' }] }))
      .toEqual([{ lead_id: 'b' }]);
  });

  it('extracts from { results: [...] }', () => {
    expect(extractMarketScoreRowsFromResponse({ results: [{ lead_id: 'c' }] }))
      .toEqual([{ lead_id: 'c' }]);
  });

  it('extracts from { data: [...] }', () => {
    expect(extractMarketScoreRowsFromResponse({ data: [{ lead_id: 'd' }] }))
      .toEqual([{ lead_id: 'd' }]);
  });

  it('extracts from { data: { rows: [...] } } and { data: { leads: [...] } }', () => {
    expect(extractMarketScoreRowsFromResponse({ data: { rows: [{ lead_id: 'e' }] } }))
      .toEqual([{ lead_id: 'e' }]);
    expect(extractMarketScoreRowsFromResponse({ data: { leads: [{ lead_id: 'f' }] } }))
      .toEqual([{ lead_id: 'f' }]);
  });

  it('prefers rows over leads over results when multiple envelope keys are present', () => {
    expect(
      extractMarketScoreRowsFromResponse({
        rows: [{ lead_id: 'rows-wins' }],
        leads: [{ lead_id: 'leads-loses' }],
      }),
    ).toEqual([{ lead_id: 'rows-wins' }]);
  });

  it('returns [] when no recognized envelope key is present', () => {
    expect(extractMarketScoreRowsFromResponse({ unrelated: 'field' })).toEqual([]);
  });
});

describe('heatmapLeadFromUnknownRow', () => {
  it('returns null when lead_id / leadId / lead.lead_id are all missing', () => {
    expect(heatmapLeadFromUnknownRow({})).toBeNull();
    expect(heatmapLeadFromUnknownRow({ lead_id: '' })).toBeNull();
    expect(heatmapLeadFromUnknownRow({ lead_id: '   ' })).toBeNull();
  });

  it('accepts lead_id at the top level', () => {
    const lead = heatmapLeadFromUnknownRow({
      lead_id: 'lead_1',
      company_name: 'TopLevel Co',
      score_market_size_opportunity: 80,
      score_industry_trends_report: 60,
      score_competitor_landscape: 40,
      score_regulatory_compliance_highlights: 75,
      score_market_entry_growth_strategy: 50,
      combined_score: 60,
    });
    expect(lead).not.toBeNull();
    expect(lead!.id).toBe('lead_1');
    expect(lead!.company).toBe('TopLevel Co');
  });

  it('accepts camelCase scores (scoreMarketSizeOpportunity etc.)', () => {
    const lead = heatmapLeadFromUnknownRow({
      lead_id: 'lead_2',
      company_name: 'CamelCase Co',
      scoreMarketSizeOpportunity: 80,
      scoreIndustryTrendsReport: 80,
      scoreCompetitorLandscape: 80,
      scoreRegulatoryComplianceHighlights: 80,
      scoreMarketEntryGrowthStrategy: 80,
      combinedScore: 80,
    });
    expect(lead).not.toBeNull();
    expect(lead!.ratings['market-size']).toBe('High');
    expect(lead!.totalScore).toBe(80);
  });

  it('falls back to company.name when company_name is absent', () => {
    const lead = heatmapLeadFromUnknownRow({
      lead_id: 'lead_3',
      company: { name: 'Nested Co' },
      combined_score: 50,
    });
    expect(lead!.company).toBe('Nested Co');
  });

  it('uses contact_name for display name with company fallback', () => {
    const lead = heatmapLeadFromUnknownRow({
      lead_id: 'lead_4',
      company_name: 'Acme',
      contact_name: 'Jane Doe',
      combined_score: 50,
    });
    expect(lead!.name).toBe('Jane Doe');
    expect(lead!.company).toBe('Acme');
  });

  it('returns "—" as company when no company field resolves and contact_name is also absent', () => {
    const lead = heatmapLeadFromUnknownRow({ lead_id: 'lead_5' });
    expect(lead).not.toBeNull();
    expect(lead!.company).toBe('—');
    expect(lead!.name).toBe('—');
    // Lock the absent-score fallback chain: num(undefined) → 0 → scorePercentToRating(0) → "Low".
    // Catches a Phase 1+ regression if num()'s fallback ever changes from 0 to NaN or throws.
    expect(lead!.totalScore).toBe(0);
    expect(lead!.ratings).toEqual({
      'market-size': 'Low',
      'industry-trends': 'Low',
      'competitor-landscape': 'Low',
      'regulatory-compliance': 'Low',
      'market-entry': 'Low',
    });
  });

  it('extracts lead_id from a nested lead.lead_id path', () => {
    const lead = heatmapLeadFromUnknownRow({
      lead: { lead_id: 'nested_id' },
      company_name: 'Co',
    });
    expect(lead).not.toBeNull();
    expect(lead!.id).toBe('nested_id');
  });
});
```

- [ ] **Step 2: Run only this test file**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run test -- src/lib/__tests__/marketScoresHeatmap.test.ts
```

Expected: all assertions pass. <2s wall time.

- [ ] **Step 3: Intermediate full-suite regression check (midpoint gate)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run test
```

Expected: all test files green together — the MSW smoke test + Tasks 2, 3, and 4's characterization files. ~3s wall time. This catches cross-file interference (fake-timer state leaks, MSW handler pollution, module-import state) at the midpoint of the characterization run, before 2 more test files are committed. If a test that previously passed in isolation fails when run with others, debug now: likely cause is `vi.useFakeTimers()` not paired with `vi.useRealTimers()` in `afterEach`, or a singleton being import-cached across files. Per plan-level Abort Criterion #1, allow 2 debug attempts.

- [ ] **Step 4: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/lib/__tests__/marketScoresHeatmap.test.ts
git commit -m "$(cat <<'EOF'
test(fe): characterization tests for marketScoresHeatmap

Locks the score-bucketing thresholds (75/50/0 → High/Medium/Low), the
mapMarketScoresRowToHeatmapLead transform shape, the 5 envelope-shape
branches of extractMarketScoreRowsFromResponse, and the snake/camelCase
+ nested-object tolerance of heatmapLeadFromUnknownRow.

Spec 15 §3.3.
EOF
)"
```

---

## Task 5: Characterization — `utils.ts` (`cn` AND `sanitizeAnswerText`)

**Files:**
- Create: `frontend/src/lib/__tests__/utils.test.ts`

Rationale (spec §3.3 + plan header §"Spec adherence vs code reality" item 2): the spec mentions only `cn`. The actual file at `frontend/src/lib/utils.ts` also exports `sanitizeAnswerText(text: string): string` — a markdown/symbol stripper used in recommendation/agent answer display. Both functions are pure-survivor utilities; excluding `sanitizeAnswerText` would leave it uncharacterized through the Phase 1 dead-code pass.

`cn` uses shadcn's `clsx` + `twMerge`; tests cover the documented edge cases (conditional classes, conflicting Tailwind classes, undefined/null inputs). `sanitizeAnswerText` has ~15 regex replacements covering markdown emphasis, headers, code fences, em-dashes, smart quotes, emoji surrogates, etc.; tests cover representative inputs for each replacement category.

- [ ] **Step 1: Write the test file**

Write this exact content to `frontend/src/lib/__tests__/utils.test.ts`:

```ts
// Spec 15 §3.3 — characterization for src/lib/utils.ts.
// Two exported functions: cn (shadcn classnames) and sanitizeAnswerText
// (markdown/symbol stripper for agent recommendation display).
import { describe, expect, it } from 'vitest';
import { cn, sanitizeAnswerText } from '@/lib/utils';

describe('cn', () => {
  it('joins string class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('drops undefined / null / false / empty conditionals', () => {
    expect(cn('foo', undefined, null, false, '', 'bar')).toBe('foo bar');
  });

  it('respects conditional classes via object syntax', () => {
    expect(cn('foo', { bar: true, baz: false })).toBe('foo bar');
  });

  it('merges conflicting Tailwind classes — last one wins', () => {
    // twMerge dedupes within the same Tailwind utility group
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('preserves non-conflicting Tailwind classes', () => {
    // px and py are different groups — both retained
    expect(cn('px-2', 'py-4')).toBe('px-2 py-4');
  });

  it('returns an empty string when no truthy inputs are provided', () => {
    expect(cn()).toBe('');
    expect(cn(undefined, null, false)).toBe('');
  });

  it('handles arrays of class values (clsx behavior)', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
    expect(cn(['foo', null, 'bar'])).toBe('foo bar');
  });
});

describe('sanitizeAnswerText', () => {
  it('returns empty string for empty/null/undefined/non-string input', () => {
    expect(sanitizeAnswerText('')).toBe('');
    // @ts-expect-error — exercising the typeof guard at line 11
    expect(sanitizeAnswerText(null)).toBe('');
    // @ts-expect-error
    expect(sanitizeAnswerText(undefined)).toBe('');
    // @ts-expect-error
    expect(sanitizeAnswerText(42)).toBe('');
  });

  it('strips *** and ** emphasis markers', () => {
    expect(sanitizeAnswerText('***bold-italic***')).toBe('bold-italic');
    expect(sanitizeAnswerText('**bold**')).toBe('bold');
  });

  it('strips single-asterisk italics with content preserved', () => {
    expect(sanitizeAnswerText('*italic word*')).toBe('italic word');
  });

  it('strips dangling asterisks at line ends', () => {
    expect(sanitizeAnswerText('text *\nnext line')).toBe('text \nnext line');
  });

  it('strips markdown headers', () => {
    expect(sanitizeAnswerText('# Header 1')).toBe('Header 1');
    expect(sanitizeAnswerText('## Header 2')).toBe('Header 2');
    expect(sanitizeAnswerText('### Header 3')).toBe('Header 3');
  });

  it('strips backticks from inline code', () => {
    expect(sanitizeAnswerText('use `myFn` here')).toBe('use myFn here');
    expect(sanitizeAnswerText('```code block```')).toBe('code block');
  });

  it('strips horizontal rules (--- lines)', () => {
    expect(sanitizeAnswerText('top\n---\nbottom')).toBe('top\n\nbottom');
  });

  it('replaces pipe characters with spaces', () => {
    expect(sanitizeAnswerText('col1 | col2')).toBe('col1 col2');
  });

  it('normalizes em-dash, en-dash, and horizontal-bar to " - "', () => {
    expect(sanitizeAnswerText('foo — bar')).toBe('foo - bar');  // U+2014 em-dash
    expect(sanitizeAnswerText('foo – bar')).toBe('foo - bar');  // U+2013 en-dash
    expect(sanitizeAnswerText('foo ― bar')).toBe('foo - bar');  // U+2015 horizontal bar — covered by utils.ts:21 regex [–—―]
  });

  it('normalizes smart quotes to ASCII', () => {
    expect(sanitizeAnswerText('‘single’')).toBe("'single'");
    expect(sanitizeAnswerText('“double”')).toBe('"double"');
  });

  it('normalizes ellipsis character to ...', () => {
    expect(sanitizeAnswerText('and then…')).toBe('and then...');
  });

  it('strips check/cross symbols (Unicode 2705/2713/2714/274C/274E)', () => {
    expect(sanitizeAnswerText('done ✅ next')).toBe('done next');
    expect(sanitizeAnswerText('fail ❌ retry')).toBe('fail retry');
  });

  it('strips misc symbol-block characters (U+2600–U+27BF)', () => {
    // U+2600 is the start of the block (sun, weather, arrows, etc.)
    expect(sanitizeAnswerText('a ☀ b')).toBe('a b');
    expect(sanitizeAnswerText('arrow → here')).toBe('arrow here');
  });

  it('strips emoji surrogate pairs', () => {
    expect(sanitizeAnswerText('rocket 🚀 launch')).toBe('rocket launch');
  });

  it('collapses runs of horizontal whitespace to single spaces (preserves newlines)', () => {
    expect(sanitizeAnswerText('foo    bar')).toBe('foo bar');
    expect(sanitizeAnswerText('foo\nbar')).toBe('foo\nbar');
  });

  it('collapses 3+ consecutive newlines to exactly 2', () => {
    expect(sanitizeAnswerText('a\n\n\n\nb')).toBe('a\n\nb');
  });

  it('trims leading and trailing whitespace from the final result', () => {
    expect(sanitizeAnswerText('  hello world  ')).toBe('hello world');
  });
});
```

- [ ] **Step 2: Run only this test file**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run test -- src/lib/__tests__/utils.test.ts
```

Expected: all assertions pass. <1s wall time.

- [ ] **Step 3: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/lib/__tests__/utils.test.ts
git commit -m "$(cat <<'EOF'
test(fe): characterization tests for utils (cn + sanitizeAnswerText)

Both exports tested. cn (shadcn classnames) covers conditional classes,
Tailwind conflict resolution via twMerge, and empty-input handling.
sanitizeAnswerText covers all ~15 regex-replace branches: emphasis markers,
headers, code fences, horizontal rules, pipe chars, em/en-dashes, smart
quotes, ellipsis, check/cross symbols, U+2600 symbol-block, emoji surrogates,
whitespace collapse.

(Spec §3.3 lists only cn; utils.ts also exports sanitizeAnswerText — see plan
header §"Spec adherence vs code reality" item 2.)

Spec 15 §3.3.
EOF
)"
```

---

## Task 6: Characterization — `rateLimitManager.ts`

**Files:**
- Create: `frontend/src/lib/__tests__/rateLimitManager.test.ts`

Rationale (spec §3.3 + §6 R0b-2 + plan header §"Spec adherence vs code reality" item 1): the only **stateful** survivor in §3.3's target list. Singleton with rolling-window queue; uses `setTimeout` internally. Per spec, the test plan:

- Uses `vi.useFakeTimers()` exclusively — no real-time `setTimeout` waits.
- Resets module state between tests via `vi.resetModules()` so the singleton is fresh per test.
- Tests the rolling-window cap, queuing behavior under cap, sliding-window release, and concurrent enqueue safety.

**Critical:** the spec asserts the cap is 4 req/min. The actual constructor default is **30 req/min** (file at `src/lib/rateLimitManager.ts:27` — code comment says "Increased limit for faster processing"). This test asserts the actual `30` boundary against the singleton, and tests a **custom-config `RateLimitManager`** instance at low `maxRequestsPerMinute` (e.g., 2) for clean boundary assertions. The singleton's behavior is also covered for completeness. Spec drift is documented in the plan header and the commit body.

**Async + fake timers pattern:** the rateLimitManager's `processQueue` uses `await request.apiCall()` and `setTimeout`. To advance time and flush microtasks, the test uses `await vi.runAllTimersAsync()` and `await Promise.resolve()` between phases. This is the canonical Vitest pattern for async-aware fake timer testing.

**Scope expansion beyond spec §3.3.** Spec §3.3 calls out "queuing, rolling-window cap, sliding-window release, and concurrent enqueues" — the *trickiest* behaviors. The test also covers the retry path, the full `isRateLimitError` substring fan-out (all 12 phrases from `rateLimitManager.ts:124-143`), `clearQueue`, and the `executeWithRateLimit` helper export. **This is deliberate, not scope creep:** characterization tests lock *all reachable behavior* so Phase 3+ refactors (which touch the auth/data layer collapsing this singleton into TanStack Query) cannot silently regress an untested branch. Adding the retry/classification tests is cheap (same fake-timer machinery) and prevents a category of post-refactor surprise. Trade-off: Task 6 is the longest characterization test (~250 LOC) and the most likely to hit the per-task abort budget — see Step 2 for the timer-flush diagnostic.

- [ ] **Step 1: Write the test file**

Write this exact content to `frontend/src/lib/__tests__/rateLimitManager.test.ts`:

```ts
// Spec 15 §3.3 — characterization for src/lib/rateLimitManager.ts.
// Stateful singleton; uses vi.useFakeTimers() exclusively per spec §6 R0b-2.
// vi.resetModules() per test re-imports a fresh singleton (otherwise the
// requestHistory leaks between tests via the module-level `rateLimitManager`
// instance).
//
// IMPORTANT: spec §3.3 asserts the cap is "4 req/min." The constructor default
// at src/lib/rateLimitManager.ts:27 is maxRequestsPerMinute: 30 (with a code
// comment "Increased limit for faster processing"). Tests below assert the
// ACTUAL behavior (30 default), and exercise the boundary on a custom-config
// instance at low cap for clean assertions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('rateLimitManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('singleton default config', () => {
    it('exports a singleton at default 30 req/min cap (NOT spec-stated 4)', async () => {
      const { rateLimitManager } = await import('@/lib/rateLimitManager');
      const status = rateLimitManager.getQueueStatus();
      expect(status.maxRequestsPerMinute).toBe(30);
    });

    it('queue starts empty', async () => {
      const { rateLimitManager } = await import('@/lib/rateLimitManager');
      expect(rateLimitManager.getQueueStatus().queueLength).toBe(0);
      expect(rateLimitManager.getQueueStatus().requestsThisMinute).toBe(0);
    });
  });

  describe('custom-config RateLimitManager (cap = 2)', () => {
    // Using a low cap makes boundary assertions clean and avoids running 30+
    // promises in tight succession.
    it('runs requests up to the cap immediately', async () => {
      vi.setSystemTime(new Date('2026-05-08T10:00:00.000Z'));
      const { RateLimitManager } = await import('@/lib/rateLimitManager');
      const m = new RateLimitManager({
        maxRequestsPerMinute: 2,
        maxRetries: 0,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        jitterMs: 0,
      });

      const calls: number[] = [];
      const p1 = m.executeWithRateLimit(async () => {
        calls.push(1);
        return 'a';
      });
      const p2 = m.executeWithRateLimit(async () => {
        calls.push(2);
        return 'b';
      });

      await vi.runAllTimersAsync();
      expect(await p1).toBe('a');
      expect(await p2).toBe('b');
      expect(calls).toEqual([1, 2]);
      expect(m.getQueueStatus().requestsThisMinute).toBe(2);
    });

    it('queues a request beyond the cap until the rolling window slides', async () => {
      vi.setSystemTime(new Date('2026-05-08T10:00:00.000Z'));
      const { RateLimitManager } = await import('@/lib/rateLimitManager');
      const m = new RateLimitManager({
        maxRequestsPerMinute: 2,
        maxRetries: 0,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        jitterMs: 0,
      });

      // Fire 2 requests to fill the window
      const calls: number[] = [];
      const p1 = m.executeWithRateLimit(async () => { calls.push(1); return 1; });
      const p2 = m.executeWithRateLimit(async () => { calls.push(2); return 2; });
      await vi.runAllTimersAsync();
      expect(await p1).toBe(1);
      expect(await p2).toBe(2);
      expect(calls).toEqual([1, 2]);

      // Third request enters the queue but cannot dispatch (cap hit). The
      // processQueue internal wait caps at 1000ms (see source line 83).
      const p3 = m.executeWithRateLimit(async () => { calls.push(3); return 3; });
      // Run pending timers a few times so the queue's poll-wait loop iterates
      // without advancing wall clock past the 60s window.
      await vi.advanceTimersByTimeAsync(500);
      expect(calls).toEqual([1, 2]);   // 3rd has not dispatched

      // Slide past 60s — the cleanupOldRequests filter at line 36-41 drops
      // the first two history entries and the third can dispatch.
      vi.setSystemTime(new Date('2026-05-08T10:01:01.000Z'));
      await vi.advanceTimersByTimeAsync(1000);
      expect(await p3).toBe(3);
      expect(calls).toEqual([1, 2, 3]);
    });

    it('rejects non-rate-limit errors immediately (no retry path)', async () => {
      vi.setSystemTime(new Date('2026-05-08T10:00:00.000Z'));
      const { RateLimitManager } = await import('@/lib/rateLimitManager');
      const m = new RateLimitManager({
        maxRequestsPerMinute: 5,
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        jitterMs: 0,
      });

      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const p = m.executeWithRateLimit(async () => {
        throw new Error('something broke');
      });
      await vi.runAllTimersAsync();
      await expect(p).rejects.toThrow('something broke');
      errSpy.mockRestore();
    });

    it('retries rate-limit-classified errors up to maxRetries', async () => {
      vi.setSystemTime(new Date('2026-05-08T10:00:00.000Z'));
      const { RateLimitManager } = await import('@/lib/rateLimitManager');
      const m = new RateLimitManager({
        maxRequestsPerMinute: 5,
        maxRetries: 2,
        baseDelayMs: 50,
        maxDelayMs: 100,
        jitterMs: 0,
      });

      // Suppress the manager's own console.error and console.log to keep the
      // test output clean.
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});

      let attempts = 0;
      const p = m.executeWithRateLimit(async () => {
        attempts++;
        if (attempts < 3) throw new Error('rate limit exceeded');
        return 'ok';
      });
      await vi.runAllTimersAsync();
      expect(await p).toBe('ok');
      expect(attempts).toBe(3);   // initial + 2 retries
    });

    it('classifies common rate-limit error strings (isRateLimitError fan-out)', async () => {
      vi.setSystemTime(new Date('2026-05-08T10:00:00.000Z'));
      const { RateLimitManager } = await import('@/lib/rateLimitManager');
      const m = new RateLimitManager({
        maxRequestsPerMinute: 5,
        maxRetries: 1,
        baseDelayMs: 10,
        maxDelayMs: 50,
        jitterMs: 0,
      });
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});

      // Each string triggers the retry path → attempts === 2.
      // Covers all 12 substrings in isRateLimitError (rateLimitManager.ts:130-142)
      // so Phase 1+ refactors can't silently drop a phrase (notably the
      // DeepSeek-specific string, which would otherwise be invisible).
      const phrases = [
        'rate limit',
        '429',
        'model_rate_limit',
        'deepseek-r1-distill-llama-70b-free',
        'too many requests',
        'quota exceeded',
        'throttled',
        'rate_limit_exceeded',
        'api rate limit',
        'request limit',
        'concurrent request limit',
        'model rate limit exceeded',
      ];
      for (const phrase of phrases) {
        let attempts = 0;
        const p = m.executeWithRateLimit(async () => {
          attempts++;
          if (attempts < 2) throw new Error(phrase);
          return 'ok';
        });
        await vi.runAllTimersAsync();
        await p;
        expect(attempts).toBe(2);
      }
    });
  });

  describe('clearQueue', () => {
    it('rejects every queued request with "Queue cleared"', async () => {
      vi.setSystemTime(new Date('2026-05-08T10:00:00.000Z'));
      const { RateLimitManager } = await import('@/lib/rateLimitManager');
      const m = new RateLimitManager({
        maxRequestsPerMinute: 1,
        maxRetries: 0,
        baseDelayMs: 50,
        maxDelayMs: 100,
        jitterMs: 0,
      });

      // Saturate the cap so subsequent requests queue
      const p1 = m.executeWithRateLimit(async () => 'first');
      await vi.runAllTimersAsync();
      await p1;

      const p2 = m.executeWithRateLimit(async () => 'queued');
      // Don't advance enough to let it run.
      await vi.advanceTimersByTimeAsync(10);

      m.clearQueue();
      await expect(p2).rejects.toThrow('Queue cleared');
    });
  });

  describe('executeWithRateLimit helper export', () => {
    it('forwards to the singleton', async () => {
      vi.setSystemTime(new Date('2026-05-08T10:00:00.000Z'));
      const { executeWithRateLimit, rateLimitManager } = await import('@/lib/rateLimitManager');
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const p = executeWithRateLimit(async () => 'via-helper', 'TestCaller');
      await vi.runAllTimersAsync();
      expect(await p).toBe('via-helper');
      // The singleton's requestHistory recorded the call.
      expect(rateLimitManager.getQueueStatus().requestsThisMinute).toBeGreaterThanOrEqual(1);
    });
  });
});
```

- [ ] **Step 2: Run only this test file**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run test -- src/lib/__tests__/rateLimitManager.test.ts
```

Expected: all assertions pass. ~2–4s wall time (slightly slower than the pure tests due to multiple `await vi.runAllTimersAsync()` flushes per test).

If a test hangs (vitest reports timeout): the most likely cause is a `setTimeout` whose callback enqueues *more* work after `runAllTimersAsync` thinks the queue is drained. Switch the suspect block to `await vi.advanceTimersByTimeAsync(N)` with a specific N and a follow-up `await Promise.resolve()` to flush microtasks. If still stuck after two debug attempts, STOP per plan-level Abort Criterion #1.

- [ ] **Step 3: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/src/lib/__tests__/rateLimitManager.test.ts
git commit -m "$(cat <<'EOF'
test(fe): characterization tests for rateLimitManager (fake timers, stateful)

Locks the rolling-window cap behavior (queue dispatches up to cap, queues
beyond, releases as window slides), the rate-limit-error retry path (with
the isRateLimitError fan-out), non-rate-limit-error immediate-reject, and
clearQueue's rejection-with-"Queue cleared". vi.useFakeTimers() exclusively
per spec §6 R0b-2; vi.resetModules() per test for a fresh singleton.

Note: spec §3.3 states the cap is "4 req/min." The constructor default at
src/lib/rateLimitManager.ts:27 is 30 (code comment "Increased limit for
faster processing" — the default was bumped after the docs were written).
This test characterizes the actual behavior; the singleton assertion verifies
the 30 default. Proposed post-merge follow-up: amend spec 15 §3.3 + CLAUDE.md
"Frontend topology" paragraph to reflect the 30/min reality.

Spec 15 §3.3 + §6 R0b-2.
EOF
)"
```

---

## Task 7: Gap Journey — `/customers` Page Load

**Files:**
- Create: `frontend/e2e/journeys/06-customers-page-load.spec.ts`
- Create (after first green run): `frontend/e2e/journeys/06-customers-page-load.spec.ts-snapshots/01-customers-page-chromium-linux-linux.png`

Rationale (spec §3.4): `/customers` has no behavioral journey today, only the loose stub-shape coverage. This gap journey is ~30–50 LOC, mirrors the existing `e2e/stubs/insights.spec.ts` pattern (login + navigate + screenshot with `maskDynamic`), but lives under `journeys/` because `/customers` is a real product route (not a stub).

**Open question 0-Q2 — bug-handling decision tree at execution time** (spec §3.4): if Playwright reveals a wiring bug while running the new spec, default decision:
- **Small mechanical fix** (e.g., the route needs `installApiMocks` to include a new endpoint that returns trivial fixture data) → land the fix in the same `frontend/e2e/fixtures/api-mocks.ts` commit as the gap journey.
- **Non-trivial fix** (e.g., the page hits a real network call the catch-all can't satisfy, or there's a render-blocking error in product code) → mark the spec with `test.fixme(true, 'TD-FE-<n>: <description>')` and add the TD-FE entry to `docs/TECH_DEBT.md` describing the bug, the affected route, and the trigger that should pull it forward (e.g., "Phase 5 customers feature extraction").

The current `installApiMocks` returns `{ ok: true }` for unknown `/api/*` paths and explicit fixtures for a curated set (org, profile, leads, signals, customer_profile, icp, market-research, user-documents). `/customers` route handler is `<Customers />` (App.tsx:67). If `<Customers />` makes API calls that aren't in the curated set, the catch-all should satisfy them as `{ ok: true }` — usually enough to render the page heading and shell.

- [ ] **Step 1: Write the spec file**

Write this exact content to `frontend/e2e/journeys/06-customers-page-load.spec.ts`:

```ts
// Spec 15 §3.4 — gap behavioral journey for /customers.
// Lives under journeys/ (not stubs/) because /customers is a real product
// route, not a stub-shape placeholder.
//
// Setup deviation from existing stubs: `loginAsTestUser` (helpers/login.ts)
// already installs Firebase mocks + api mocks + a catch-all internally.
// Existing e2e/stubs/*.spec.ts files call installApiMocks + installCatchAllApiMock
// again post-login redundantly — a minor smell flagged for Phase 1 cleanup
// (`installCatchAllApiMock` is itself marked @deprecated as a no-op in
// api-mocks.ts). These new journeys deliberately drop the redundant calls.
import { expect, test } from '@playwright/test';
import { loginAsTestUser } from '../helpers/login';
import { maskDynamic } from '../helpers/mask-dynamic';

test('customers page loads under mocked auth + API', async ({ page }) => {
  await loginAsTestUser(page);

  await page.goto('/customers');
  await expect(page).not.toHaveURL(/\/login/);

  // Spec §3.4 — assert a recognizable page element is visible (explicit
  // behavioral check; fails faster than waiting for the screenshot diff).
  // Page-agnostic selector. If no heading matches at execution time, swap
  // to a page-specific selector (e.g., getByText('Customers')) after
  // inspecting the rendered DOM.
  await expect(
    page.locator('h1, h2, h3, [role="heading"]').first(),
  ).toBeVisible({ timeout: 5000 });

  await expect(page).toHaveScreenshot('01-customers-page.png', {
    mask: maskDynamic(page),
  });
});
```

- [ ] **Step 2: Run only this spec to generate the initial snapshot**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx playwright test e2e/journeys/06-customers-page-load.spec.ts --update-snapshots
```

Expected: 1 test passes; a new PNG written under `e2e/journeys/06-customers-page-load.spec.ts-snapshots/`.

If the test fails because the page won't load:
- Watch the playwright report (`npx playwright show-report`) for the failing assertion. If it's a hard navigation error or a render-blocking JS exception, fall back to the bug-handling decision tree at the top of this task.
- If it's a missing API mock (Network panel shows a 4xx/5xx for `/api/<something>`), add a one-line entry to `frontend/e2e/fixtures/api-mocks.ts` returning a minimal placeholder shape and re-run.

- [ ] **Step 3: Verify the snapshot was created**

```bash
ls /projects/Brewra/brewra-gtm-intelligence/frontend/e2e/journeys/06-customers-page-load.spec.ts-snapshots/
```

Expected: `01-customers-page-chromium-linux-linux.png` listed.

- [ ] **Step 4: Re-run the spec to confirm the snapshot matches itself (idempotency check)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx playwright test e2e/journeys/06-customers-page-load.spec.ts
```

Expected: pass. If it fails on the second run, the screenshot has non-determinism (e.g., spinner or animated content not covered by `maskDynamic`) — extend `e2e/helpers/mask-dynamic.ts` with the relevant locator and re-snapshot.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/e2e/journeys/06-customers-page-load.spec.ts \
  frontend/e2e/journeys/06-customers-page-load.spec.ts-snapshots
# If api-mocks.ts was modified in Step 2, also stage:
# git add frontend/e2e/fixtures/api-mocks.ts
git commit -m "$(cat <<'EOF'
test(fe): add gap journey for /customers page load

Closes the /customers coverage gap identified in spec 15 §3.4. ~15 LOC,
mirrors the e2e/stubs/<route>.spec.ts pattern (login + navigate + masked
screenshot) but lives under journeys/ because /customers is a real product
route. Snapshot 01-customers-page-chromium-linux-linux.png committed.

Spec 15 §3.4.
EOF
)"
```

If `api-mocks.ts` was modified, mention it in the commit body (`Adds <endpoint> mock to api-mocks.ts; trivial fixture shape per the bug-handling decision tree in plan §Task 7.`).

---

## Task 8: Gap Journey — `/settings` Page Load

**Files:**
- Create: `frontend/e2e/journeys/07-settings-page-load.spec.ts`
- Create (after first green run): `frontend/e2e/journeys/07-settings-page-load.spec.ts-snapshots/01-settings-page-chromium-linux-linux.png`

Rationale (spec §3.4): same as Task 7, for `/settings`.

**Bug-handling decision tree** (repeated from Task 7 for out-of-order readers): if Playwright reveals a wiring bug while running this spec:
- **Small mechanical fix** (e.g., the route needs `installApiMocks` to include a new endpoint that returns trivial fixture data) → land the fix in the same `frontend/e2e/fixtures/api-mocks.ts` commit as the gap journey.
- **Non-trivial fix** (e.g., the page hits a real network call the catch-all can't satisfy, or there's a render-blocking error in product code) → mark the spec with `test.fixme(true, 'TD-FE-<n>: <description>')` and add the TD-FE entry to `docs/TECH_DEBT.md` describing the bug, the affected route, and the trigger that should pull it forward (e.g., "Phase 9 settings feature extraction").

- [ ] **Step 1: Write the spec file**

Write this exact content to `frontend/e2e/journeys/07-settings-page-load.spec.ts`:

```ts
// Spec 15 §3.4 — gap behavioral journey for /settings.
// Same shape as 06-customers-page-load.spec.ts (see that file's header for the
// loginAsTestUser-handles-everything pattern note).
import { expect, test } from '@playwright/test';
import { loginAsTestUser } from '../helpers/login';
import { maskDynamic } from '../helpers/mask-dynamic';

test('settings page loads under mocked auth + API', async ({ page }) => {
  await loginAsTestUser(page);

  await page.goto('/settings');
  await expect(page).not.toHaveURL(/\/login/);

  // Spec §3.4 — explicit visibility assertion (see Task 7 spec file's comment
  // for selector rationale).
  await expect(
    page.locator('h1, h2, h3, [role="heading"]').first(),
  ).toBeVisible({ timeout: 5000 });

  await expect(page).toHaveScreenshot('01-settings-page.png', {
    mask: maskDynamic(page),
  });
});
```

- [ ] **Step 2: Run only this spec to generate the initial snapshot**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx playwright test e2e/journeys/07-settings-page-load.spec.ts --update-snapshots
```

Expected: 1 test passes; a new PNG written.

(If fails, follow the bug-handling decision tree at Task 7 top.)

- [ ] **Step 3: Verify the snapshot was created**

```bash
ls /projects/Brewra/brewra-gtm-intelligence/frontend/e2e/journeys/07-settings-page-load.spec.ts-snapshots/
```

Expected: `01-settings-page-chromium-linux-linux.png` listed.

- [ ] **Step 4: Re-run the spec to confirm idempotency**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npx playwright test e2e/journeys/07-settings-page-load.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/e2e/journeys/07-settings-page-load.spec.ts \
  frontend/e2e/journeys/07-settings-page-load.spec.ts-snapshots
git commit -m "$(cat <<'EOF'
test(fe): add gap journey for /settings page load

Closes the /settings coverage gap identified in spec 15 §3.4. Same shape
as 06-customers-page-load.spec.ts. Snapshot
01-settings-page-chromium-linux-linux.png committed.

Spec 15 §3.4.
EOF
)"
```

---

## Task 9: Extend Preflight Chain with `npm run test`

**Files:**
- Modify: `frontend/package.json` (`preflight` script — append `&& npm run test`)

Rationale (spec §3.5): the preflight script is the merge gate. At 0a it ran `typecheck && build && test:e2e`. At 0b it must also run Vitest. Per spec §5.3 (master plan), each later phase appends one more check to the chain in the same commit that lands its tooling — but in 0b's case, the tooling (Vitest install) shipped in Task 1, and the test files needed for the chain to be meaningful only finished landing in Task 6. This task is the one-line chain extension that closes the loop.

Per master spec 14 §5.3, the chain ordering matters: fast checks first so red preflights fail-fast. The current chain is `typecheck` (fast) → `build` (medium) → `test:e2e` (slow, ~50–80s). Appending `npm run test` (Vitest, ~2–4s) after `build` and before `test:e2e` would shave a few seconds off failure cases. But spec §3.5 prose says "append `&& npm run test` to the `npm run preflight` chain" — explicit "append," i.e., at the end. Following the spec literally: `&& npm run test` goes at the very end. This is intentional and fine; Vitest at the end is consistent with the "append per phase" model so Phase 1's knip-strict, 2a's strict-TS, etc. each compose by appending. Reordering for performance can be a Phase 2c concern (when preflight wall time is measured and budgeted).

- [ ] **Step 1: Edit `frontend/package.json`**

Change the `preflight` script from:

```json
    "preflight": "npm run typecheck && npm run build && npm run test:e2e",
```

to:

```json
    "preflight": "npm run typecheck && npm run build && npm run test:e2e && npm run test",
```

(Only the `preflight` line changes — all other scripts unchanged.)

- [ ] **Step 2: Run the full preflight chain end-to-end**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: typecheck green → build green → Playwright green (including the two new gap journeys from Tasks 7+8) → Vitest green (the smoke test + the 5 characterization test files from Tasks 1–6).

Total wall time ~100–130s typically. If anything is red, this is the first time the full chain has run end-to-end on this branch — fix root cause and re-run. STOP if not green within 2 fix attempts (per plan-level Abort Criterion #1).

- [ ] **Step 3: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/package.json
git commit -m "$(cat <<'EOF'
chore(fe): append `npm run test` to the preflight chain

Vitest joins typecheck + build + Playwright as the fourth preflight gate.
Each later phase appends its own check to the chain in the same commit
that lands its tooling (knip --strict at Phase 1, strict-TS at 2a, lint
+ Prettier at 2b, bundle-budget at 2c per spec 14 §5.3).

Spec 15 §3.5.
EOF
)"
```

---

## Task 10: Extend `measure-baselines.sh` + Re-measure NFR

**Files:**
- Modify: `frontend/scripts/measure-baselines.sh` (append a 5th measurement: vitest 3-run median)
- Modify: `docs/audits/2026-05-26-frontend-nfr-baseline.json` (add `after_phase_0b` top-level key)

Rationale (spec §3.6): re-measure NFR after the harness install and gap journeys land, append `after_phase_0b` to the JSON. Per spec, the existing top-level fields are **preserved unchanged** (they're the Phase-0a anchor); `after_phase_0b` is a new sibling field with the post-0b snapshot, including the new `vitest_full_suite_seconds` median.

The script extension uses the same 3-run protocol as the existing measurements. Vitest has no persistent build cache (per spec §2.4 Phase 0b extension), so no cold-cache step is needed between runs.

**Important workflow note:** the script must be updated and re-run **on this branch** with 0b's content fully landed. Running it any earlier would measure incomplete state. Hence this task lands after Task 9 (preflight chain extension) so the `after_phase_0b` snapshot reflects all of Phase 0b.

- [ ] **Step 1: Edit `frontend/scripts/measure-baselines.sh`**

The current script (committed in Phase 0a) measures tsc/build/dev-start/playwright. Add a 5th measurement block after the playwright block and update the JSON write to emit `after_phase_0b` rather than overwriting the top-level fields.

**Drift guard.** Before applying the replacement below, verify the on-disk script matches the Phase 0a baseline the plan assumes (the script content at plan-writing time). Run:

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git log --oneline frontend/scripts/measure-baselines.sh
```

If the most recent commit touching the file is Phase 0a's `chore(fe): capture NFR baselines ...`, the on-disk content matches the plan's expected base — apply the replacement below. If there are later commits, **STOP**: read the diff (`git show <sha> -- frontend/scripts/measure-baselines.sh`) and reconcile the changes into the replacement content manually before overwriting. A blind full-file replacement would silently lose any post-0a fixes.

Replace the file with this exact content (preserves all Phase 0a logic; adds vitest measurement; restructures the write to produce a *full* JSON with both the original top-level anchor and the new `after_phase_0b` sibling key):

```bash
#!/usr/bin/env bash
# Phase 0 NFR baseline capture. Spec 15 §2.4 (0a) + §3.6 (0b).
# 3-run median for: tsc --noEmit, vite build, vite dev cold start,
# playwright full suite, vitest full suite (added at 0b).
# Runtime: 12-25 minutes on typical dev hardware (0a was 10-20; +2-5 for vitest).
# Local-only, not CI.
#
# The output JSON has TWO layers:
#   - Top-level fields preserved from the 0a anchor (DO NOT overwrite).
#   - "after_phase_0b" sibling key with re-measured values plus the new
#     vitest_full_suite_seconds field. Spec §3.6.
#
# Re-running this script overwrites only the after_phase_0b key. The original
# anchor is read from the existing JSON if present.

set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_FILE="$FRONTEND_DIR/../docs/audits/2026-05-26-frontend-nfr-baseline.json"
RUNS=3

cd "$FRONTEND_DIR"

# ---------- helpers ----------

median_min_max() {
  python3 -c "
import statistics, sys
vals = sorted(float(x) for x in sys.argv[1:])
print(f'{statistics.median(vals):.3f} {vals[0]:.3f} {vals[-1]:.3f}')
" "$@"
}

time_cmd() {
  local start end
  start=$(python3 -c 'import time; print(time.time())')
  "$@" > /dev/null 2>&1
  end=$(python3 -c 'import time; print(time.time())')
  python3 -c "import sys; print(f'{float(sys.argv[1]) - float(sys.argv[2]):.3f}')" "$end" "$start"
}

time_dev_start() {
  local logfile="/tmp/phase-0a-vite-dev.$$.log"
  local start end vite_pid elapsed
  local timeout_seconds=60
  start=$(python3 -c 'import time; print(time.time())')
  npx vite --port 5173 > "$logfile" 2>&1 &
  vite_pid=$!
  while ! grep -q "ready in" "$logfile" 2>/dev/null; do
    if ! kill -0 "$vite_pid" 2>/dev/null; then
      cat "$logfile" >&2
      rm -f "$logfile"
      echo "vite exited before ready" >&2
      exit 1
    fi
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

# ---------- pre-flight integrity check ----------
# Fail fast if the existing NFR JSON is malformed — otherwise we'd run all 5
# measurements (12-25 minutes) only to crash at the final json.load(). Missing
# file is fine (Phase 0a anchor will simply not exist on a fresh tree).

if [[ -f "$OUTPUT_FILE" ]]; then
  if ! python3 -c "import json; json.load(open('$OUTPUT_FILE'))" 2>/dev/null; then
    echo "ERROR: $OUTPUT_FILE exists but is not valid JSON." >&2
    echo "       Fix or remove the file before re-running this script —" >&2
    echo "       otherwise all $RUNS-run measurements would be discarded at write time." >&2
    exit 1
  fi
  echo "Pre-flight: existing NFR JSON parses cleanly." >&2
else
  echo "Pre-flight: no existing NFR JSON (will write fresh)." >&2
fi

# ---------- measurements ----------

echo "[1/5] tsc --noEmit ($RUNS runs, no cache to clear)" >&2
tsc_times=()
for i in $(seq 1 "$RUNS"); do
  t=$(time_cmd npx tsc --noEmit)
  echo "  run $i: ${t}s" >&2
  tsc_times+=("$t")
done

echo "[2/5] vite build ($RUNS runs, cold each run)" >&2
build_times=()
for i in $(seq 1 "$RUNS"); do
  rm -rf dist node_modules/.vite
  t=$(time_cmd npm run build)
  echo "  run $i: ${t}s" >&2
  build_times+=("$t")
done

echo "[3/5] vite dev cold start ($RUNS runs)" >&2
dev_times=()
for i in $(seq 1 "$RUNS"); do
  rm -rf node_modules/.vite
  t=$(time_dev_start)
  echo "  run $i: ${t}s" >&2
  dev_times+=("$t")
done

echo "[4/5] playwright full suite ($RUNS runs)" >&2
playwright_times=()
for i in $(seq 1 "$RUNS"); do
  t=$(time_cmd npm run test:e2e)
  echo "  run $i: ${t}s" >&2
  playwright_times+=("$t")
done

echo "[5/5] vitest full suite ($RUNS runs, no persistent cache to clear)" >&2
vitest_times=()
for i in $(seq 1 "$RUNS"); do
  t=$(time_cmd npm run test)
  echo "  run $i: ${t}s" >&2
  vitest_times+=("$t")
done

# ---------- compose JSON ----------

read tsc_med tsc_min tsc_max < <(median_min_max "${tsc_times[@]}")
read build_med build_min build_max < <(median_min_max "${build_times[@]}")
read dev_med dev_min dev_max < <(median_min_max "${dev_times[@]}")
read pw_med pw_min pw_max < <(median_min_max "${playwright_times[@]}")
read vt_med vt_min vt_max < <(median_min_max "${vitest_times[@]}")

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

# Read existing 0a anchor from disk (preserve verbatim) and merge in the
# after_phase_0b sibling. Python handles the JSON merge atomically.
mkdir -p "$(dirname "$OUTPUT_FILE")"
python3 - "$OUTPUT_FILE" "$CAPTURED_AT" "$OS_NAME" "$CPU_MODEL" "$RAM_GB" \
  "$NODE_VER" "$NPM_VER" \
  "$tsc_med" "$tsc_min" "$tsc_max" \
  "$build_med" "$build_min" "$build_max" \
  "$dev_med" "$dev_min" "$dev_max" \
  "$pw_med" "$pw_min" "$pw_max" \
  "$vt_med" "$vt_min" "$vt_max" <<'PYEOF'
import json, sys, os
(_, path, captured_at, os_name, cpu_model, ram_gb, node_ver, npm_ver,
 tsc_med, tsc_min, tsc_max,
 build_med, build_min, build_max,
 dev_med, dev_min, dev_max,
 pw_med, pw_min, pw_max,
 vt_med, vt_min, vt_max) = sys.argv

existing = {}
if os.path.exists(path):
    with open(path) as f:
        existing = json.load(f)

after_phase_0b = {
    "captured_at": captured_at,
    "captured_on": "local-dev-machine",
    "hardware": {
        "os": os_name,
        "cpu_model": cpu_model,
        "ram_gb": int(ram_gb),
        "node_version": node_ver,
        "npm_version": npm_ver,
    },
    "tsc_noemit_seconds":             {"median": float(tsc_med),   "min": float(tsc_min),   "max": float(tsc_max)},
    "vite_build_seconds":             {"median": float(build_med), "min": float(build_min), "max": float(build_max)},
    "vite_dev_start_seconds":         {"median": float(dev_med),   "min": float(dev_min),   "max": float(dev_max)},
    "playwright_full_suite_seconds":  {"median": float(pw_med),    "min": float(pw_min),    "max": float(pw_max)},
    "vitest_full_suite_seconds":      {"median": float(vt_med),    "min": float(vt_min),    "max": float(vt_max)},
}
existing["after_phase_0b"] = after_phase_0b

with open(path, "w") as f:
    json.dump(existing, f, indent=2)
    f.write("\n")
PYEOF

echo "" >&2
echo "Wrote $OUTPUT_FILE (added after_phase_0b sibling key)" >&2
```

- [ ] **Step 2: Re-make the script executable (chmod is preserved on most filesystems but be safe)**

```bash
chmod +x /projects/Brewra/brewra-gtm-intelligence/frontend/scripts/measure-baselines.sh
```

- [ ] **Step 3: Run the script (12–25 minutes)**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
./frontend/scripts/measure-baselines.sh
```

Expected: progress lines for each of the 5 measurements (3 runs each), then a "Wrote ... (added after_phase_0b sibling key)" line. Total wall time ~12–25 min depending on hardware.

If any measurement fails, the script bails on first failure (set -e). Debug and re-run.

- [ ] **Step 4: Validate JSON shape — 0a anchor preserved, `after_phase_0b` added**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
python3 -c "
import json
d = json.load(open('docs/audits/2026-05-26-frontend-nfr-baseline.json'))
# Phase 0a anchor still present, untouched
assert 'captured_at' in d and 'hardware' in d and 'tsc_noemit_seconds' in d, list(d.keys())
# Phase 0b sibling added
assert 'after_phase_0b' in d, list(d.keys())
ab = d['after_phase_0b']
assert set(ab.keys()) == {'captured_at', 'captured_on', 'hardware',
                          'tsc_noemit_seconds', 'vite_build_seconds',
                          'vite_dev_start_seconds',
                          'playwright_full_suite_seconds',
                          'vitest_full_suite_seconds'}, ab.keys()
for k in ('tsc_noemit_seconds', 'vite_build_seconds', 'vite_dev_start_seconds',
          'playwright_full_suite_seconds', 'vitest_full_suite_seconds'):
    assert set(ab[k].keys()) == {'median', 'min', 'max'}, (k, ab[k].keys())
    assert ab[k]['min'] <= ab[k]['median'] <= ab[k]['max'], k
print('OK — 0a anchor preserved + after_phase_0b added')
print(f'  vitest_full_suite_seconds median: {ab[\"vitest_full_suite_seconds\"][\"median\"]}s')
"
```

Expected: `OK — 0a anchor preserved + after_phase_0b added` plus the vitest median line.

- [ ] **Step 5: Commit**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git add frontend/scripts/measure-baselines.sh docs/audits/2026-05-26-frontend-nfr-baseline.json
git commit -m "$(cat <<'EOF'
chore(fe): extend measure-baselines.sh with vitest + capture after_phase_0b NFR

Adds a 5th 3-run median measurement (vitest run) and refactors the JSON
write to preserve the existing Phase 0a anchor verbatim while adding an
after_phase_0b sibling key with the full re-measured snapshot (tsc, build,
dev-start, playwright, plus the new vitest_full_suite_seconds field).

Informational only — Phase 2c re-measures `npm run preflight` against the
fully-wired chain and sets the actual budgets. Spec 15 §3.6.
EOF
)"
```

---

## Task 11: Sanity-Check + Impl-Review Handoff

**Files:** none (verification + handoff only — no commit).

Rationale: per the workflow described in `/projects/Brewra/brewra-gtm-intelligence/CLAUDE.md` "Spec-driven flow," after implementing the plan, the controller agent:
1. Runs `npm run preflight` to confirm the branch is mergeable.
2. Hands off to `/review-impl` (a separate agent invocation) which produces an adversarial review document.
3. After the user-prompted merge step, the controller runs preflight a second time and merges if green.

This task is step (1) — the in-branch sanity check that precedes handoff. No commits; only verification.

- [ ] **Step 1: Confirm git state — all 10 commits landed on the branch**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git log --oneline master..phase-0b-test-harness
```

Expected output (10 commits in reverse-chronological order; SHAs will differ):

```
<sha> chore(fe): extend measure-baselines.sh with vitest + capture after_phase_0b NFR
<sha> chore(fe): append `npm run test` to the preflight chain
<sha> test(fe): add gap journey for /settings page load
<sha> test(fe): add gap journey for /customers page load
<sha> test(fe): characterization tests for rateLimitManager (fake timers, stateful)
<sha> test(fe): characterization tests for utils (cn + sanitizeAnswerText)
<sha> test(fe): characterization tests for marketScoresHeatmap
<sha> test(fe): characterization tests for marketScoreDescriptions
<sha> test(fe): characterization tests for timestampUtils
<sha> test(fe): install Vitest+RTL+MSW harness with proof-of-pipeline smoke test
```

If the count is off, identify the missing task before continuing.

- [ ] **Step 2: Working tree is clean**

```bash
git status
```

Expected: "nothing to commit, working tree clean" (or only the pre-existing untracked `docs/parallel-sandbox-development.md` listed).

- [ ] **Step 3: Run the full preflight chain end-to-end**

```bash
cd /projects/Brewra/brewra-gtm-intelligence/frontend
npm run preflight
```

Expected: all 4 checks green (typecheck → build → Playwright [13 specs: 5 journeys + 5 stubs + 2 new gap journeys + 1 smoke check journey 04] → Vitest [6 test files: 1 smoke + 5 characterization, ~80+ assertions]).

Total wall time ~100–130s.

If preflight is red: per plan-level Abort Criterion #2, allow up to 3 distinct fix attempts (root-cause fixes, not retries of the same approach). If still red after 3 attempts, log the failing-preflight findings to `docs/TECH_DEBT.md` (which check failed, error pattern, hypothesis) and STOP — report to the operator.

- [ ] **Step 4: Verify all expected new files are present and tracked**

```bash
cd /projects/Brewra/brewra-gtm-intelligence
git diff --name-status master..phase-0b-test-harness | sort
```

Expected (file paths exactly; Phase 0a created the NFR JSON so it's `M`, not `A`):

```
A	frontend/e2e/journeys/06-customers-page-load.spec.ts
A	frontend/e2e/journeys/06-customers-page-load.spec.ts-snapshots/01-customers-page-chromium-linux-linux.png
A	frontend/e2e/journeys/07-settings-page-load.spec.ts
A	frontend/e2e/journeys/07-settings-page-load.spec.ts-snapshots/01-settings-page-chromium-linux-linux.png
A	frontend/src/lib/__tests__/marketScoreDescriptions.test.ts
A	frontend/src/lib/__tests__/marketScoresHeatmap.test.ts
A	frontend/src/lib/__tests__/rateLimitManager.test.ts
A	frontend/src/lib/__tests__/timestampUtils.test.ts
A	frontend/src/lib/__tests__/utils.test.ts
A	frontend/src/test/__tests__/msw-pipeline.test.ts
A	frontend/src/test/msw/handlers.ts
A	frontend/src/test/msw/server.ts
A	frontend/src/test/setup.ts
A	frontend/vitest.config.ts
M	docs/audits/2026-05-26-frontend-nfr-baseline.json
M	frontend/package-lock.json
M	frontend/package.json
M	frontend/scripts/measure-baselines.sh
```

If a file is missing from the diff: that task didn't commit it. Re-stage and commit before handoff.

- [ ] **Step 5: Hand off to impl-review**

Tell the operator:

> Phase 0b implementation complete on `phase-0b-test-harness` branch. All 10 commits landed; preflight is green. Ready for `/review-impl` against `docs/reviews/15b-frontend-phase-0b-test-harness-impl-review-1.md` (per spec §4 review-artifact naming). After review + synthesis converge, run the merge step (preflight + `git checkout master && git merge phase-0b-test-harness && git push origin master`).

The merge step is **operator-initiated** per CLAUDE.md "Spec-driven flow" (step 4: "Human-approved merge"). Do not merge proactively.

---

## Plan-Level Done-When

- All 10 commits on the `phase-0b-test-harness` branch (matching the order/scope in Task 11 Step 1).
- `npm run preflight` green end-to-end (Task 11 Step 3).
- All files present and tracked (Task 11 Step 4).
- `docs/audits/2026-05-26-frontend-nfr-baseline.json` has both the original 0a anchor (preserved unchanged) and the new `after_phase_0b` sibling key with `vitest_full_suite_seconds`.
- Operator handed off to impl-review (Task 11 Step 5). Merge happens after review + synthesis converge, on operator command.

This matches spec §3.7 done-when criteria 1-on-1.

---

## Coverage Map: spec §3.7 done-when ↔ plan tasks

| Spec §3.7 done-when item | Plan task(s) |
|---|---|
| Vitest + RTL + MSW installed; `npm run test` works locally | Task 1 |
| `frontend/vitest.config.ts` and `frontend/src/test/setup.ts` exist | Task 1 (Steps 3+4) |
| MSW handler set covers the proof-of-pipeline + auth handlers documented in §3.2 | Task 1 (Steps 5+6) |
| Characterization tests for the §3.3 target files exist and pass | Tasks 2 (timestampUtils), 3 (marketScoreDescriptions), 4 (marketScoresHeatmap), 5 (utils), 6 (rateLimitManager) |
| `frontend/e2e/journeys/06-customers-page-load.spec.ts` and `…/07-settings-page-load.spec.ts` exist, pass, with committed snapshots | Tasks 7 + 8 |
| `npm run test` (Vitest) appended to the `npm run preflight` chain in `frontend/package.json`; preflight green required before any merge to `master` | Task 9 |
| NFR JSON updated with `after_phase_0b` measurements | Task 10 |

---

## Open Questions for Post-Merge Follow-Up

Three documented spec drifts that surfaced during plan-writing. Per CLAUDE.md "Spec-driven flow" — "specs and plans are a frozen record of intent... don't update specs/plans to reflect post-merge drift; the code is authoritative" — the spec is **not** amended. Item 1 is genuine tech debt and gets tracked; items 2 and 3 are documentation oversights with no action needed.

1. **Spec 15 §3.3 + CLAUDE.md state `rateLimitManager` cap is 4 req/min; actual code is 30.** Code comment at `frontend/src/lib/rateLimitManager.ts:27` says "Increased limit for faster processing" — the default was bumped after the docs were written. This *is* potentially load-bearing: if the 4/min cap was intentionally normative (to stay under provider rate limits), the bumped default could cause production rate-limit hits when traffic scales.

   **Action (post-merge, not blocking 0b):** add a TD-FE entry to `docs/TECH_DEBT.md` capturing the discrepancy with these fields:
   - **Title:** "rateLimitManager default 30/min diverges from spec/CLAUDE.md (4/min)"
   - **Current state:** `frontend/src/lib/rateLimitManager.ts:27` defaults to `maxRequestsPerMinute: 30`.
   - **Documented intent:** Spec 15 §3.3 + §6 R0b-2 + CLAUDE.md "Frontend topology" all reference 4 req/min as the FE cap to stay under provider limits.
   - **Why deferred:** Phase 0b is characterization-only; changing runtime behavior is out of scope.
   - **Trigger:** Phase 3 touches the auth/data layer (rateLimitManager is collapsed into TanStack Query per spec 14 §1.5). At that point, the spec-author decides: align code to 4/min (intentional cap) or accept 30/min as the new normative value.

2. **Spec 15 §3.3 lists only `cn` for `utils.ts`; the file also exports `sanitizeAnswerText`.** Plan Task 5 tests both. **No action needed** — documentation oversight; characterization covers both exports.

3. **Spec 15 §3.3 describes `marketScoreDescriptions.ts` as a "score band" lookup; the actual function is a report-column → description-text lookup.** Plan Task 3 tests the actual lookup shape. **No action needed** — documentation oversight; characterization covers the actual function behavior.
