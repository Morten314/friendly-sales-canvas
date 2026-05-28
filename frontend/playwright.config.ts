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
    // Build + preview serves the production bundle, eliminating Vite's
    // transform-on-demand penalty that caused cold-start flake under 4 workers.
    command: "npm run build && npm run preview -- --port 5173 --strictPort",
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
      maxDiffPixelRatio: 0.01, // 1% of total pixels — was maxDiffPixels: 100, an absolute count; now a ratio
      threshold: 0.2, // per-pixel color tolerance — unchanged
      animations: "disabled",
    },
  },
});
