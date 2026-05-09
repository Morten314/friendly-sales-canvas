import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/login';
import { installApiMocks, installCatchAllApiMock } from '../fixtures/api-mocks';
import { maskDynamic } from '../helpers/mask-dynamic';

const COMPONENTS = [
  'market_size_opportunity',
  'industry_trends',
  'competitor_landscape',
  'regulatory_compliance',
  'market_entry',
];

test('market research kicks off all 5 components, results render', async ({ page }) => {
  await loginAsTestUser(page);

  // Mock per-component responses.
  for (const component of COMPONENTS) {
    await page.route(`**/api/market-research**`, async (route) => {
      const reqBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          component_name: reqBody?.component_name || component,
          status: 'completed',
          result: {
            title: `${component} Title`,
            summary: `${component} summary text.`,
            key_findings: ['F1', 'F2', 'F3'],
            sources: [{ url: 'https://example.test', title: 'Source 1' }],
          },
          cached: false,
        }),
      });
    });
  }
  await installApiMocks(page);
  await installCatchAllApiMock(page);

  // Step 1: Navigate to market research.
  await page.goto('/your-ai-team/scout/market-research');
  await expect(page).toHaveScreenshot('01-market-research-initial.png', { mask: maskDynamic(page) });

  // Step 2: Trigger the research flow.
  // Selectors here depend on actual UI — adjust on first run.
  const startButton = page.getByRole('button', { name: /start|run|generate|research/i }).first();
  if (await startButton.isVisible()) {
    await startButton.click();
  }
  await expect(page).toHaveScreenshot('02-research-in-progress.png', { mask: maskDynamic(page) });

  // Step 3: Wait for first component result.
  await expect(page.getByText(/market_size_opportunity Title/i)).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveScreenshot('03-component-1-loaded.png', { mask: maskDynamic(page) });

  // Step 4: Wait for second component.
  await expect(page.getByText(/industry_trends Title/i)).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveScreenshot('04-component-2-loaded.png', { mask: maskDynamic(page) });

  // Step 5: Wait for third.
  await expect(page.getByText(/competitor_landscape Title/i)).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveScreenshot('05-component-3-loaded.png', { mask: maskDynamic(page) });

  // Step 6: Wait for fourth.
  await expect(page.getByText(/regulatory_compliance Title/i)).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveScreenshot('06-component-4-loaded.png', { mask: maskDynamic(page) });

  // Step 7: Wait for fifth.
  await expect(page.getByText(/market_entry Title/i)).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveScreenshot('07-component-5-loaded.png', { mask: maskDynamic(page) });

  // Step 8: All-loaded final state.
  await expect(page).toHaveScreenshot('08-all-components-loaded.png', { mask: maskDynamic(page) });
});
