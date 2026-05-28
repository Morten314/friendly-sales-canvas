import { test, expect } from "@playwright/test";

import { installApiMocks, installCatchAllApiMock } from "../fixtures/api-mocks";
import { loginAsTestUser } from "../helpers/login";
import { maskDynamic } from "../helpers/mask-dynamic";

test("reports page loads with hardcoded demo cards", async ({ page }) => {
  await loginAsTestUser(page);
  await installApiMocks(page);
  await installCatchAllApiMock(page);

  await page.goto("/reports");

  await expect(page).not.toHaveURL(/\/login/);
  // Per inventory: page shows hardcoded "UK Fintech Ops Demo" / "CTO Demo".
  await expect(page).toHaveScreenshot("reports-page.png", { mask: maskDynamic(page) });
});
