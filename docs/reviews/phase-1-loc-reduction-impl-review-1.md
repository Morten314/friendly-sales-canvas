---
artifact: phase-1-loc-reduction
artifact_type: impl
verdict: findings
reviewer_model: glm-5.1
date: 2026-05-27
round: 1
base_ref: master (11d8d32)
spec_loaded: true
plan_loaded: true
---

## Context

Reviewed the full aggregate diff of 38 commits on `phase-1-loc-reduction` (base `master` at `11d8d32`, head `059e427`) against `specs/16-frontend-phase-1-loc-reduction-design.md` and `plans/16-frontend-phase-1-loc-reduction.md`. A prior in-flight review exists at `docs/reviews/16-frontend-phase-1-loc-reduction-impl-review-1.md` (round 1 at commit `bc511b5`) with synthesis at `...-synthesis-1.md`. This review covers the complete branch including the 5 post-synthesis commits (`239a8f5..059e427`).

Aggregate delta: 41 files changed, +1,534 / −10,832 lines. Net: −9,351 LOC under `frontend/src/` (−12.2%), 11 fewer source files, 24 unused npm deps removed, 10 dead files removed, 17 dead exports trimmed across 7 files, 8 TD-FE entries written, `knip --strict` merge gate wired.

Preflight claims are taken from commit bodies and the scorecard's done-when checklist; this reviewer did not execute `npm run preflight`.

## Findings

### [Medium] Out-of-scope behavior changes in final two commits

**Location:** Commits `5c4bae8` (api.ts localhost detection) and `059e427` (E2E cold-start flake fix); `frontend/src/lib/api.ts:7-11`, `frontend/playwright.config.ts:9,27-30`, `frontend/vite.config.ts:10-19`.

Spec 16 §2.2 explicitly states "every commit must be pixel-identical and behaviorally identical." Two commits in the post-synthesis tail introduce runtime behavior changes unrelated to dead-code removal:

1. **`api.ts` localhost detection** (`5c4bae8`): Adds `isLocalhost` branch that routes all API calls through `/api` proxy when `window.location.hostname` is `localhost` or `127.0.0.1`. This is a new runtime code path. The comment justifies it as needed for Playwright's `build+preview` mode, but the code runs in any localhost context — not just e2e.

2. **Playwright build+preview switch** (`059e427`): Replaces `npx vite --port 5173` with `npm run build && npm run preview -- --port 5173 --strictPort` in `webServer.command`, adds `timeout: 60_000`, and increases `webServer.timeout` from 120s to 180s. Also adds Vite `warmup.clientFiles` for 6 heavy pages.

3. **Vite warmup configuration** (`059e427`): Adds `server.warmup.clientFiles` targeting `main.tsx`, `App.tsx`, and four page components. This is a dev-server optimization, not a dead-code change.

These are legitimate improvements (the build+preview switch is a better test strategy than dev-server racing, and the warmup reduces e2e flake). But they violate the spec's behavioral-identity constraint. They don't affect the deployed production build (Vercel), and the `api.ts` change doesn't affect production-Vercel origins. However, the `api.ts` localhost branch does affect developers running `vite preview` manually — they now hit `/api` (requiring a proxy) instead of direct Render.

Why **Medium**: the spec's frozen-interfaces rule (§2.4) and behavior-identity rule (§2.2) are Phase 1's primary safety constraints. These commits don't break production, but the `api.ts` change is a runtime code-path addition that could surprise a developer testing the production bundle locally. A cleaner approach would be to ship these as a separate branch (e.g., `fix/e2e-cold-start-flake`) or note the scope extension in the scorecard.

### [Medium] `knip.json` `src/**/*.{ts,tsx}!` entry pattern disables knip dead-file detection for future phases

**Location:** `frontend/knip.json:4`; commit `239a8f5` ("replace TD-FE-8 ignoreDependencies workaround with src/** production entry").

The final `knip.json` uses `"src/**/*.{ts,tsx}!"` as a production entry. The `!` suffix tells knip to treat every matching file as a production entry even in strict mode. This correctly resolved the dependency-tracing gap (reducing `ignoreDependencies` from 30 packages to 2) and is well-documented in the scorecard's §5 root-cause-discovery section.

However, this pattern has a side effect: **every file under `src/` is now considered "used" by definition**, so knip can never flag a dead file under `src/` again. Future Phase 13's LOC pass (per Spec 14 §4) expects knip to surface dead files; with this config, knip will produce zero dead-file findings regardless of what gets orphaned.

The scorecard's §4 Phase 13 handoff list mentions TD-FE-1..8 but does not explicitly note that the knip entry config must be adjusted before Phase 13 to re-enable dead-file detection. This should be added.

Why **Medium**: this is a latent configuration issue that will silently reduce Phase 13's effectiveness if not documented. The fix is documentation-only (add a note to Phase 13 handoff), not a code change.

### [Low] `api.ts` localhost detection affects developer `vite preview` workflows beyond e2e

**Location:** `frontend/src/lib/api.ts:7-11`.

The `isLocalhost` guard routes through `/api` proxy for any localhost origin. The comment says "vite preview and e2e tests run on localhost," but the code runs unconditionally in any localhost context:

- A developer running `npm run preview` to test the production bundle locally now hits `/api` (which goes nowhere unless a proxy is configured), instead of `https://backend-11kr.onrender.com` directly.
- The previous behavior (direct Render URL in production mode) was the expected fallback for non-Vercel, non-dev-server environments.

Consider scoping the `isLocalhost` branch to only activate when Playwright is driving (e.g., check `navigator.webdriver` or an env var), or document the developer-experience change in `frontend/README.md`.

### [Low] `SuggestedICPCards.tsx` missing trailing newline after export-default removal

**Location:** `frontend/src/components/customers/SuggestedICPCards.tsx` (end of file, after `};`).

Commit `ce48530` removed the `export default SuggestedICPCards` line, leaving the file ending at `};` with no trailing newline. POSIX convention and most diff/patch tools expect files to end with `\n`. Many editors auto-add it, but git will show a `\ No newline at end of file` marker.

Trivial to fix: add a trailing newline to the closing `};`.

### [Nit] Playwright `timeout: 60_000` doubles the default, potentially masking slow-test regressions

**Location:** `frontend/playwright.config.ts:9`.

The test timeout was raised from knip's default (30s) to 60s. Justified for build+preview cold starts, but once the warmup and build+preview stabilize, consider resetting to the default or a closer value (e.g., 45s) to maintain regression sensitivity.

### [Nit] Scorecard done-when row 4 shows ⏳ but Task 7.2 commit landed on this branch

**Location:** `docs/audits/2026-05-27-frontend-loc-pass-1.md` line ~257.

The done-when checklist shows item 4 as "⏳ Pending: `knip --strict --no-progress` appended to preflight (Task 7.2)" but commit `bc511b5` already landed this change. The scorecard was written before Task 7.2 committed, and the synthesis-fix commit (`6777bee`) may not have updated this row. The substantive gate is satisfied (preflight script in `package.json` includes the knip invocation), but the scorecard's own done-when checklist is stale.

### [Nit] Scorecard done-when row 8 references Task 7.3 controller-driven merge edit — acceptable but the row shows ⏳

**Location:** `docs/audits/2026-05-27-frontend-loc-pass-1.md` line ~261.

Consistent with the plan (Task 7.3 is controller-driven, not executor-driven), but the reader scanning the done-when checklist sees 2 of 8 items as ⏳ and must read the parenthetical to understand they're satisfied/post-merge. Not a quality concern, just a note for future scorecard authors.
