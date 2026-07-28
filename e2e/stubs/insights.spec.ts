import { test, expect } from "@playwright/test";

import { installApiMocks, installCatchAllApiMock } from "../fixtures/api-mocks";
import { loginAsTestUser } from "../helpers/login";
import { maskDynamic } from "../helpers/mask-dynamic";

test("insights page loads with static hardcoded percentages", async ({ page }) => {
  await loginAsTestUser(page);
  await installApiMocks(page);
  await installCatchAllApiMock(page);

  await page.goto("/insights");

  await expect(page).not.toHaveURL(/\/login/);
  // Per inventory: hardcoded 87% / 92% percentages.
  await expect(page).toHaveScreenshot("insights-page.png", { mask: maskDynamic(page) });
});
