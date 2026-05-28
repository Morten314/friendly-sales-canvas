import { test, expect } from "@playwright/test";

import { installApiMocks, installCatchAllApiMock } from "../fixtures/api-mocks";
import { mockFirebaseLogin } from "../helpers/login";
import { maskDynamic } from "../helpers/mask-dynamic";

test("login → tenant-selection redirect → mission-control loads", async ({ page }) => {
  await mockFirebaseLogin(page);
  await installApiMocks(page);
  await installCatchAllApiMock(page);

  await test.step("land on login page", async () => {
    await page.goto("/");
    await expect(page).toHaveScreenshot("01-login-page.png", { mask: maskDynamic(page) });
  });

  await test.step("submit login form", async () => {
    await page.getByLabel(/email/i).fill("test@brewra.test");
    await page.getByLabel(/password/i).fill("test_password");
    await page.getByRole("button", { name: /sign in|log in/i }).click();
  });

  await test.step("post-login redirect (tenant-selection or mission-control)", async () => {
    // Per inventory: "Users auto-redirected past it in practice." Capture this.
    await page.waitForURL(/\/(tenant-selection|mission-control)/, { timeout: 10000 });
    await expect(page).toHaveScreenshot("02-post-login-state.png", { mask: maskDynamic(page) });
  });

  await test.step("select tenant if shown", async () => {
    if (page.url().includes("tenant-selection")) {
      await page.getByText(/Test Org/i).click();
      await expect(page).toHaveScreenshot("03-tenant-selected.png", { mask: maskDynamic(page) });
    }
  });

  await test.step("mission-control rendered", async () => {
    await page.waitForURL(/\/mission-control/, { timeout: 10000 });
    await expect(page.getByText(/mission control/i).first()).toBeVisible();
    await expect(page).toHaveScreenshot("04-mission-control-loaded.png", {
      mask: maskDynamic(page),
    });
  });
});
