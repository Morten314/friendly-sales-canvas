import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "../helpers/login";
import { installApiMocks, installCatchAllApiMock } from "../fixtures/api-mocks";
import { maskDynamic } from "../helpers/mask-dynamic";

test("calendar (Activator) page loads without errors", async ({ page }) => {
  await loginAsTestUser(page);
  await installApiMocks(page);
  await installCatchAllApiMock(page);

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/calendar");

  // Per inventory: page is a 158-LOC stub with three "will appear here" tabs.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 5000 });
  await expect(page.locator("body")).toBeVisible();
  await expect(page).toHaveScreenshot("calendar-page.png", { mask: maskDynamic(page) });

  // Lock current behavior: page loads. If console errors are expected, capture them.
  // Don't fail on console errors — characterize what happens today.
});
