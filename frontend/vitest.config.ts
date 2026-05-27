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
    // Exclude Playwright e2e specs — they use @playwright/test's test() and
    // will fail loudly if Vitest collects them.
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
