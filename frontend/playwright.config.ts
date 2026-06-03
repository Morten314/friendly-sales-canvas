import { createHash } from "node:crypto";

import { defineConfig } from "@playwright/test";

// R3 (2026-06-03 test-infra speedup): derive a per-worktree preview port from
// the working directory so concurrent worktrees never share one port. Combined
// with reuseExistingServer defaulting OFF (see webServer below), this closes the
// false-green hazard where a stale sibling-worktree preview is reused and VR
// passes against the WRONG build. Override with E2E_PORT.
const E2E_PORT =
  Number(process.env.E2E_PORT) ||
  5180 + (parseInt(createHash("sha1").update(process.cwd()).digest("hex").slice(0, 6), 16) % 800);
const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

// R4 (2026-06-03): contention-aware worker count. scripts/with-slot.mjs sets
// PREFLIGHT_CONTENDED=1 when this run had to WAIT for a global heavy-phase slot
// (another worktree is mid build/test/e2e); on the memory-bound box, fewer
// Chromium workers then avoids swap + the waitFor-timeout flake. Explicit
// PW_WORKERS always wins.
const E2E_WORKERS = process.env.PW_WORKERS
  ? Number(process.env.PW_WORKERS)
  : process.env.PREFLIGHT_CONTENDED
    ? 2
    : 4;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: E2E_WORKERS,
  timeout: 60_000,
  reporter: "list",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium-linux",
      use: {
        browserName: "chromium",
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
  webServer: {
    // Preview serves the production bundle (no transform-on-demand penalty, which
    // caused cold-start flake under 4 workers). We deliberately do NOT rebuild
    // here: in the preflight chain `npm run build` already runs immediately
    // before `test:e2e`, so a build inside this command would be a redundant
    // second full PWA build (~50s wasted). The preflight `build` step is the
    // single source of `dist/`, consumed by both `bundle:check` and this preview.
    // Caveat: running `npm run test:e2e` standalone now requires a prior
    // `npm run build` (run `npm run build && npm run test:e2e`, or just use
    // `npm run preflight`).
    command: `npm run preview -- --port ${E2E_PORT} --strictPort`,
    url: E2E_BASE_URL,
    // R3: default OFF (gate-safe) — always boot a fresh preview of the
    // just-built dist so VR can never pass against a stale build. The
    // per-worktree port already prevents reusing a sibling worktree's server.
    // Set E2E_REUSE=1 for fast same-worktree local iteration.
    reuseExistingServer: process.env.E2E_REUSE === "1",
    timeout: 180 * 1000,
  },
  expect: {
    // Re-baseline visual snapshots when an intentional UI change is accepted:
    //   npm run test:e2e:update-snapshots
    // On macOS/Windows, run inside the Playwright Docker image so PNGs are
    // pixel-stable across host OS:
    //   docker run --rm -v "$PWD:/work" -w /work mcr.microsoft.com/playwright:v1.59.1-jammy \
    //     bash -c "npm ci && npm run test:e2e:update-snapshots"
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02, // 2% of total pixels — was 0.01 (1%); widened in Phase 2c (spec 19 §1.3)
      threshold: 0.2, // per-pixel color tolerance — unchanged
      animations: "disabled",
    },
  },
});
