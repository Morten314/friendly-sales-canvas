import { test, expect } from "@playwright/test";

import { loginAsTestUser } from "../helpers/login";

/**
 * The page (src/pages/MarketResearch.tsx) auto-fetches market-research data
 * on mount via fetchMarketSizeData (and similar per-component fetchers). We
 * mock /api/market-research_claude to respond per-component based on the request
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
  await page.route("**/api/market-research_claude", async (route) => {
    marketResearchRequestCount += 1;
    const reqBody = route.request().postDataJSON();
    const componentName = reqBody?.component_name || "market size & opportunity";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "success",
        data: {
          component_name: componentName,
          title: `${componentName} (mocked)`,
          summary: `Mocked summary for ${componentName}.`,
          key_findings: ["Finding 1", "Finding 2", "Finding 3"],
          sources: [{ url: "https://example.test", title: "Source 1" }],
        },
      }),
    });
  });

  // App.tsx:92 redirects /market-research → /your-ai-team/scout/marketintelligence.
  await page.goto("/your-ai-team/scout/marketintelligence");
  await expect(page).not.toHaveURL(/\/login/);

  await expect.poll(() => marketResearchRequestCount, { timeout: 15000 }).toBeGreaterThan(0);

  await test.step("Chat with Scout (trends) tab renders the scout-chat surface", async () => {
    await page.getByRole("tab", { name: "Chat with Scout" }).click();
    await expect(page.getByRole("tab", { name: "Chat with Scout" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // ChatWithHistory renders an <h3>Chat with Scout</h3> empty-state heading when no session
    // is selected. This is always the initial state (no sessionStorage context in e2e).
    await expect(
      page.getByRole("heading", { name: "Chat with Scout" }),
    ).toBeVisible();
  });

  await test.step("Your Lead Stream (analysis) tab renders the lead stream", async () => {
    await page.getByRole("tab", { name: "Your Lead Stream" }).click();
    await expect(page.getByRole("tab", { name: "Your Lead Stream" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // OpportunityDashboard renders an <h2>Opportunity Dashboard</h2> unconditionally.
    await expect(
      page.getByRole("heading", { name: "Opportunity Dashboard" }),
    ).toBeVisible();
  });
});
