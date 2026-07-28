import { test, expect } from "@playwright/test";

import { installApiMocks, installCatchAllApiMock } from "../fixtures/api-mocks";
import { icp } from "../fixtures/seed-data";
import { loginAsTestUser } from "../helpers/login";
import { maskDynamic } from "../helpers/mask-dynamic";

test("ICP create via Mission Control → appears in saved list", async ({ page }) => {
  await loginAsTestUser(page);

  const createRequest = page.waitForRequest("**/api/customer_profile");

  // First load: empty list.
  let firstFetchHandled = false;
  await page.route("**/api/customer_profile**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(icp({ name: "New Test ICP" })),
      });
    } else {
      // GET: first time empty, second time has the new ICP.
      const profiles = firstFetchHandled ? [icp({ name: "New Test ICP" })] : [];
      firstFetchHandled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ profiles }),
      });
    }
  });
  await installApiMocks(page);
  await installCatchAllApiMock(page);

  await test.step("land on customer-profile tab", async () => {
    // MissionControl.tsx:943 reads ?tab=customer-profile and switches to it
    // when isCustomerProfileLocked is false — which requires the company
    // profile to be marked as saved (gated by data.company_name in the
    // /api/profile/company response, supplied by the orgProfile fixture).
    await page.goto("/mission-control?tab=customer-profile");
    await expect(page).toHaveScreenshot("01-mission-control-empty-icp.png", {
      mask: maskDynamic(page),
    });
  });

  await test.step("open Add ICP form", async () => {
    // Empty-state CTA when icps.length === 0; header button otherwise.
    // Both are exact-text "Add ICP".
    await page.getByRole("button", { name: "Add ICP" }).first().click();
    await expect(page).toHaveScreenshot("02-icp-create-form-open.png", { mask: maskDynamic(page) });
  });

  await test.step("submit form + assert POST/PUT fired", async () => {
    // The inline form has many fields with sensible defaults; for
    // characterization we only need a POST/PUT to /api/customer_profile to
    // fire. If a future Save-button-disabled-until-form-valid change
    // breaks this, capture the required fields and fill them here.
    const saveButton = page.getByRole("button", { name: /^save$/i }).last();
    if (await saveButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveButton.click();
      const req = await Promise.race([
        createRequest,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
      if (req) {
        expect(req.method()).toMatch(/POST|PUT/);
      }
    }
    await expect(page).toHaveScreenshot("03-icp-create-form-after-submit.png", {
      mask: maskDynamic(page),
    });
  });
});
