import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/login';
import { installApiMocks } from '../fixtures/api-mocks';
import { maskDynamic } from '../helpers/mask-dynamic';

/**
 * The page (src/pages/MarketResearch.tsx) auto-fetches market-research data
 * on mount via fetchMarketSizeData (and similar per-component fetchers). We
 * mock /api/market-research to respond per-component based on the request
 * body's `component_name`. Real component_name values use spaces and `&`
 * (e.g. "market size & opportunity"), not the underscore/snake_case the
 * earlier draft assumed.
 *
 * This journey is intentionally narrow: it captures (a) the initial page
 * load, (b) the post-fetch state once the first auto-loaded component
 * resolves. Per-component navigation and assertions are deferred — the
 * page is 14k LOC with multi-tab orchestration that's too fragile to
 * exhaustively script in a characterization test.
 */
test('market research page loads + auto-fetches first component', async ({ page }) => {
  await loginAsTestUser(page);

  let marketResearchRequestCount = 0;
  // Hold the mock response open so the "initial" screenshot is taken in a
  // deterministic request-in-flight state. Without this gate the screenshot
  // races the auto-fetch's resolution and pixel diffs fluctuate run-to-run.
  let releaseFetch!: () => void;
  const fetchGate = new Promise<void>((resolve) => { releaseFetch = resolve; });

  await page.route('**/api/market-research', async (route) => {
    marketResearchRequestCount += 1;
    await fetchGate;
    const reqBody = route.request().postDataJSON();
    const componentName = reqBody?.component_name || 'market size & opportunity';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        component_name: componentName,
        status: 'completed',
        result: {
          title: `${componentName} (mocked)`,
          summary: `Mocked summary for ${componentName}.`,
          key_findings: ['Finding 1', 'Finding 2', 'Finding 3'],
          sources: [{ url: 'https://example.test', title: 'Source 1' }],
        },
        cached: false,
      }),
    });
  });

  // Step 1: Navigate to the marketintelligence tab. (App.tsx:92 redirects
  // /market-research → /your-ai-team/scout/marketintelligence.)
  await page.goto('/your-ai-team/scout/marketintelligence');

  // Wait for the auto-fetch to fire (response still gated by fetchGate) so
  // the initial-state screenshot captures the loading UI, not a pre-mount frame.
  await expect.poll(() => marketResearchRequestCount, { timeout: 15000 })
    .toBeGreaterThan(0);

  await expect(page).toHaveScreenshot('01-market-research-initial.png', {
    mask: maskDynamic(page),
  });

  // Step 2: Release the fetch and capture the resolved state.
  releaseFetch();
  await expect(page).toHaveScreenshot('02-after-first-fetch.png', {
    mask: maskDynamic(page),
  });
});
