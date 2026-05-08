import { Page, Locator } from '@playwright/test';

export function maskDynamic(page: Page): Locator[] {
  return [
    page.locator('[data-testid="timestamp"]'),
    page.locator('[data-testid*="generated-id"]'),
    page.locator('.spinner'),
    page.locator('[data-testid="loading-spinner"]'),
    page.locator('text=/^\\d+\\s+(seconds?|minutes?|hours?|days?)\\s+ago$/i'),
  ];
}
