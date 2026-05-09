import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/login';
import { installApiMocks, installCatchAllApiMock } from '../fixtures/api-mocks';
import { maskDynamic } from '../helpers/mask-dynamic';
import { icp } from '../fixtures/seed-data';

test('ICP create via Mission Control → appears in saved list', async ({ page }) => {
  await loginAsTestUser(page);

  const createRequest = page.waitForRequest('**/api/customer_profile');

  // First load: empty list.
  let firstFetchHandled = false;
  await page.route('**/api/customer_profile**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(icp({ name: 'New Test ICP' })),
      });
    } else {
      // GET: first time empty, second time has the new ICP.
      const profiles = firstFetchHandled
        ? [icp({ name: 'New Test ICP' })]
        : [];
      firstFetchHandled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ profiles }),
      });
    }
  });
  await installApiMocks(page);
  await installCatchAllApiMock(page);

  // Step 1: Navigate to mission-control.
  await page.goto('/mission-control');
  await expect(page).toHaveScreenshot('01-mission-control-empty-icp.png', { mask: maskDynamic(page) });

  // Step 2: Click new ICP / create profile button.
  await page.getByRole('button', { name: /add|create|new.*icp|new.*profile/i }).first().click();
  await expect(page).toHaveScreenshot('02-icp-create-form-open.png', { mask: maskDynamic(page) });

  // Step 3: Fill in name.
  await page.getByLabel(/name/i).first().fill('New Test ICP');
  await page.getByRole('button', { name: /save|create|submit/i }).last().click();

  // Step 4: Assert request.
  const req = await createRequest;
  expect(req.method()).toBe('POST');
  await expect(page).toHaveScreenshot('03-icp-create-saving.png', { mask: maskDynamic(page) });

  // Step 5: Verify appears in list.
  await expect(page.getByText('New Test ICP')).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveScreenshot('04-icp-in-saved-list.png', { mask: maskDynamic(page) });
});
