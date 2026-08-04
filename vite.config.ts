import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendBaseUrl =
    env.VITE_BACKEND_BASE_URL || "https://brewra-gtm-intelligence-1.onrender.com";
  const proxyTargetIsLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(
    backendBaseUrl,
  );

  return {
  server: {
    // Lovable sandbox requires port 8080, IPv6 bind, and strictPort (see @lovable.dev/lovite).
    host: "::",
    port: 8080,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: backendBaseUrl,
        changeOrigin: !proxyTargetIsLocal,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: !proxyTargetIsLocal,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.png'],
      manifest: {
        name: 'Brewra',
        short_name: 'Brewra',
        description: 'Multi-tenant sales management application',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        additionalManifestEntries: [
          { url: '/logo.png', revision: null }
        ],
        skipWaiting: true,
        clientsClaim: true
      },
      devOptions: {
        // Service worker in dev can serve stale bundles inside Lovable's iframe preview.
        enabled: !env.LOVABLE_SANDBOX,
        type: 'module'
      }
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
};
});
