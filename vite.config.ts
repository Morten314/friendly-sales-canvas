import path from "path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Dev/preview proxy target is env-driven (spec 42). vite.config can't reliably
  // import from src, so read it via loadEnv, with a localhost-friendly default
  // so local dev needs no extra setup.
  const env = loadEnv(mode, ".", "");
  const backendUrl = env.VITE_BACKEND_BASE_URL || "http://localhost:8000";

  return {
    server: {
      host: "::",
      port: 8080, // Lovable preview expects 8080
      warmup: {
        // Pre-transform the entry + the four heavy pages that drive e2e cold-start
        // contention (01 login, 02 csv-upload, 04 market-research, 05 icp-create).
        // Removes the first-request compile penalty when Playwright workers race.
        clientFiles: [
          "./src/main.tsx",
          "./src/App.tsx",
          "./src/shared/auth/AuthContext.tsx",
          "./src/features/auth/pages/LoginPage.tsx",
          "./src/features/mission-control/pages/MissionControlPage.tsx",
          "./src/features/market-research/pages/MarketResearchPage.tsx",
        ],
      },
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
          secure: true,
          configure: (proxy, _options) => {
            proxy.on("error", (err, _req, _res) => {
              console.log("proxy error", err);
            });
            proxy.on("proxyReq", (proxyReq, req, _res) => {
              console.log("Sending Request to the Target:", req.method, req.url);
            });
            proxy.on("proxyRes", (proxyRes, req, _res) => {
              console.log("Received Response from the Target:", proxyRes.statusCode, req.url);
            });
          },
        },
      },
    },
    preview: {
      // Mirror the dev server's /api proxy so manual `npm run preview` works
      // for the PWA-install + production-bundle smoke workflows documented in
      // PWA_SETUP.md, TEST_PWA_INSTALL.md, PRODUCTION_PWA.md, DEV_VS_PREVIEW_PWA.md.
      // E2E tests don't hit this proxy — Playwright's page.route intercepts first.
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
          secure: true,
        },
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "logo.png"],
        manifest: {
          name: "Brewra",
          short_name: "Brewra",
          description: "Multi-tenant sales management application",
          theme_color: "#2563eb",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "any",
          scope: "/",
          start_url: "/",
          icons: [
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          // R8 (2026-06-03 test-infra speedup): precache only the app shell
          // (js/css/html). Images (ico/png/svg) are fetched on demand — at MVP
          // there is no offline-first requirement, and globbing + hashing every
          // image inflates the Workbox precache-manifest pass that runs on the
          // build's critical path (build → e2e). `maximumFileSizeToCacheInBytes`
          // also defuses the hard build-error newer plugin versions throw on an
          // oversized precache entry as assets grow.
          globPatterns: ["**/*.{js,css,html}"],
          maximumFileSizeToCacheInBytes: 3_000_000,
          additionalManifestEntries: [{ url: "/logo.png", revision: null }],
          skipWaiting: true,
          clientsClaim: true,
        },
        devOptions: {
          enabled: true,
          type: "module",
        },
      }),
    ].filter(Boolean),
    build: {
      // R7 (2026-06-03 test-infra speedup): skip the end-of-build gzip pass over
      // every emitted chunk. It runs on the main thread on the build's critical
      // path (build → e2e) and only feeds a decorative stdout column — nothing in
      // the preflight gate consumes it (`bundle:check` reads dist bytes directly).
      // Output bytes are unchanged.
      reportCompressedSize: false,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
