import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/login';
import { installApiMocks, installCatchAllApiMock } from '../fixtures/api-mocks';
import { maskDynamic } from '../helpers/mask-dynamic';
import { signalList } from '../fixtures/seed-data';
import { TEST_ORG_ID } from '../fixtures/identities';

test('signals feed loads, accept persists, snapshot stable', async ({ page }) => {
  await loginAsTestUser(page);

  const actionRequest = page.waitForRequest('**/api/signal_action');

  await installApiMocks(page, {
    '/api/fetch-signals': { signals: signalList(5) },
    '/api/signal_action': { status: 'success', signal_id: 'sig_00000000' },
  });
  await installCatchAllApiMock(page);

  // Step 1: Navigate to signals feed. (Route is /signals, not /your-ai-team/scout/signals.)
  await page.goto('/signals');
  await expect(page.getByText(/signals/i).first()).toBeVisible();
  await expect(page).toHaveScreenshot('01-signals-feed-loaded.png', { mask: maskDynamic(page) });

  // Step 2: Verify signals rendered. The page maps signal_id → id, so our fixture
  // is picked up; headline `Test signal N` is what renders as visible text.
  await expect(page.getByText('Test signal 0')).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveScreenshot('02-signal-cards-visible.png', { mask: maskDynamic(page) });

  // Step 3: Click accept (thumbs-up icon button — no text label, so target via
  // the lucide icon class on the SVG).
  await page.locator('button:has(svg.lucide-thumbs-up)').first().click();

  // Step 4: Assert request fired correctly.
  const req = await actionRequest;
  const payload = req.postDataJSON();
  expect(payload.action).toBe('accept');
  expect(payload.org_id).toBe(TEST_ORG_ID);
  await expect(page).toHaveScreenshot('03-post-accept-loading.png', { mask: maskDynamic(page) });

  // Step 5: Final state.
  await expect(page).toHaveScreenshot('04-post-accept-final.png', { mask: maskDynamic(page) });
});
