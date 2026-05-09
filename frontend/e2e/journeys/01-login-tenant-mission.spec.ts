import { test, expect } from '@playwright/test';
import { mockFirebaseLogin } from '../helpers/login';
import { installApiMocks, installCatchAllApiMock } from '../fixtures/api-mocks';
import { maskDynamic } from '../helpers/mask-dynamic';

test('login → tenant-selection redirect → mission-control loads', async ({ page }) => {
  await mockFirebaseLogin(page);
  await installApiMocks(page);
  await installCatchAllApiMock(page);

  // Step 1: Land on login page.
  await page.goto('/');
  await expect(page).toHaveScreenshot('01-login-page.png', { mask: maskDynamic(page) });

  // Step 2: Submit login form.
  await page.getByLabel(/email/i).fill('test@brewra.test');
  await page.getByLabel(/password/i).fill('test_password');
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  // Step 3: Tenant-selection redirect.
  // Per inventory: "Users auto-redirected past it in practice." Capture this.
  await page.waitForURL(/\/(tenant-selection|mission-control)/, { timeout: 10000 });
  await expect(page).toHaveScreenshot('02-post-login-state.png', { mask: maskDynamic(page) });

  // Step 4: If on tenant-selection, click first tenant.
  if (page.url().includes('tenant-selection')) {
    await page.getByText(/Test Org/i).click();
    await expect(page).toHaveScreenshot('03-tenant-selected.png', { mask: maskDynamic(page) });
  }

  // Step 5: Mission-control loaded.
  await page.waitForURL(/\/mission-control/, { timeout: 10000 });
  await expect(page.getByText(/mission control/i).first()).toBeVisible();
  await expect(page).toHaveScreenshot('04-mission-control-loaded.png', { mask: maskDynamic(page) });
});
