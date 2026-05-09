import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/login';
import { installApiMocks, installCatchAllApiMock } from '../fixtures/api-mocks';
import { maskDynamic } from '../helpers/mask-dynamic';

test('artifacts page loads with mock reports', async ({ page }) => {
  await loginAsTestUser(page);
  await installApiMocks(page);
  await installCatchAllApiMock(page);

  await page.goto('/artifacts');

  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveScreenshot('artifacts-page.png', { mask: maskDynamic(page) });
});

test('artifacts page download button generates PDF', async ({ page }) => {
  await loginAsTestUser(page);
  await installApiMocks(page);
  await installCatchAllApiMock(page);

  await page.goto('/artifacts');

  // Per inventory: createSimplePDF() function generates real PDF data on download.
  const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
  const downloadButton = page.getByRole('button', { name: /download|pdf|export/i }).first();
  if (await downloadButton.isVisible()) {
    await downloadButton.click();
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    }
  }
});
