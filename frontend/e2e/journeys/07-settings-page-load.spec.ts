// Spec 15 §3.4 — gap behavioral journey for /settings.
// Same shape as 06-customers-page-load.spec.ts (see that file's header for the
// loginAsTestUser-handles-everything pattern note).
import { expect, test } from "@playwright/test";
import { loginAsTestUser } from "../helpers/login";
import { maskDynamic } from "../helpers/mask-dynamic";

test("settings page loads under mocked auth + API", async ({ page }) => {
  await loginAsTestUser(page);

  await page.goto("/settings");
  await expect(page).not.toHaveURL(/\/login/);

  // Spec §3.4 — explicit visibility assertion (see Task 7 spec file's comment
  // for selector rationale).
  await expect(page.locator('h1, h2, h3, [role="heading"]').first()).toBeVisible({ timeout: 5000 });

  await expect(page).toHaveScreenshot("01-settings-page.png", {
    mask: maskDynamic(page),
  });
});
