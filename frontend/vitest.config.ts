import path from "path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

// Spec 15 §3.1. globals: false — every test file imports describe/it/expect/vi
// explicitly from 'vitest'. Master plan §1.4 "agents-as-authors with explicit,
// machine-readable contracts."
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // Spec 42: the API base is now env-driven (import.meta.env.VITE_*). Tests run
    // with no .env loaded, so supply the local-dev values here — this restores
    // the prior `/api` base that the MSW handlers (src/test/msw/handlers.ts)
    // register against. Vitest exposes these on import.meta.env. Production code
    // has NO fallback by design (a missing var must fail the build).
    env: {
      VITE_API_BASE_URL: "/api",
      VITE_BACKEND_BASE_URL: "http://localhost:8000",
    },
    // Bound worker concurrency. Vitest otherwise spawns ~1 worker per core (22+
    // on CI/sandbox hardware); that oversubscribes the box — especially when a
    // second preflight runs in a parallel worktree — and the jsdom `waitFor`
    // tests blow their 5s timeout, failing the run (false red → the whole
    // preflight gets re-run). Capping to 4 keeps parallelism while staying
    // deterministic. Tunable: raise on dedicated/idle hardware.
    maxWorkers: 4,
    minWorkers: 1,
    // Exclude Playwright e2e specs — they use @playwright/test's test() and
    // will fail loudly if Vitest collects them.
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
