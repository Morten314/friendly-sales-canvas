import path from "path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5175, // Changed from 8080 to test if port/origin affects PWA behavior
    warmup: {
      // Pre-transform the entry + the four heavy pages that drive e2e cold-start
      // contention (01 login, 02 csv-upload, 04 market-research, 05 icp-create).
      // Removes the first-request compile penalty when Playwright workers race.
      clientFiles: [
        "./src/main.tsx",
        "./src/App.tsx",
        "./src/contexts/AuthContext.tsx",
        "./src/pages/Login.tsx",
        "./src/pages/MissionControl.tsx",
        "./src/pages/MarketResearch.tsx",
      ],
    },
    proxy: {
      "/api": {
        target: "https://backend-11kr.onrender.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        secure: true,
        configure: (proxy, options) => {
          proxy.on("error", (err, req, res) => {
            console.log("proxy error", err);
          });
          proxy.on("proxyReq", (proxyReq, req, res) => {
            console.log("Sending Request to the Target:", req.method, req.url);
          });
          proxy.on("proxyRes", (proxyRes, req, res) => {
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
        target: "https://backend-11kr.onrender.com",
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
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
