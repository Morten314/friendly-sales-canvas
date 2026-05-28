import { test, expect } from "@playwright/test";

import { loginAsTestUser } from "../helpers/login";

/**
 * The page (src/pages/MarketResearch.tsx) auto-fetches market-research data
 * on mount via fetchMarketSizeData (and similar per-component fetchers). We
 * mock /api/market-research to respond per-component based on the request
 * body's `component_name`. Real component_name values use spaces and `&`
 * (e.g. "market size & opportunity"), not the underscore/snake_case the
 * earlier draft assumed.
 *
 * Visual-regression assertions intentionally omitted. The page is 14k LOC
 * with multi-tab orchestration, rotating loading messages, and several
 * concurrent fetches resolving on independent timelines — making stable
 * screenshot comparison impractical without much heavier mocking. Earlier
 * attempts (gate one route + mask the cached-data banner) reduced but did
 * not eliminate flake. This spec is a smoke check: navigate, don't get
 * bounced to login, auto-fetch fires. Reinstate screenshots when the page
 * is refactored.
 */
test("market research page loads + auto-fetches first component", async ({ page }) => {
  await loginAsTestUser(page);

  let marketResearchRequestCount = 0;
  await page.route("**/api/market-research", async (route) => {
    marketResearchRequestCount += 1;
    const reqBody = route.request().postDataJSON();
    const componentName = reqBody?.component_name || "market size & opportunity";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        component_name: componentName,
        status: "completed",
        result: {
          title: `${componentName} (mocked)`,
          summary: `Mocked summary for ${componentName}.`,
          key_findings: ["Finding 1", "Finding 2", "Finding 3"],
          sources: [{ url: "https://example.test", title: "Source 1" }],
        },
        cached: false,
      }),
    });
  });

  // App.tsx:92 redirects /market-research → /your-ai-team/scout/marketintelligence.
  await page.goto("/your-ai-team/scout/marketintelligence");
  await expect(page).not.toHaveURL(/\/login/);

  await expect.poll(() => marketResearchRequestCount, { timeout: 15000 }).toBeGreaterThan(0);
});
