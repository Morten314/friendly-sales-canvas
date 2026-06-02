import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 4,
  timeout: 60_000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
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
    command: "npm run preview -- --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
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
