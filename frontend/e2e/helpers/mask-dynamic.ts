import type { Page, Locator } from "@playwright/test";

export function maskDynamic(page: Page): Locator[] {
  return [
    page.locator('[data-testid="timestamp"]'),
    page.locator('[data-testid*="generated-id"]'),
    page.locator(".spinner"),
    page.locator('[data-testid="loading-spinner"]'),
    page.locator("text=/^\\d+\\s+(seconds?|minutes?|hours?|days?)\\s+ago$/i"),
    // Wall-clock timestamps rendered via Date.toLocaleTimeString().
    // MarketResearch.tsx surfaces these in its cached-data banner.
    page.locator("text=/Showing( expired)? cached data from/i"),
  ];
}
