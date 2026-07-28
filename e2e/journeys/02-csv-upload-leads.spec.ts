import { test, expect } from "@playwright/test";

import { installApiMocks } from "../fixtures/api-mocks";
import { leadList } from "../fixtures/seed-data";
import { loginAsTestUser } from "../helpers/login";
import { maskDynamic } from "../helpers/mask-dynamic";

/**
 * The CSV upload UI lives in DataSourcesManager (rendered in the Data Sources
 * tab of Mission Control), NOT in a Scout lead-stream view. Reaching the
 * upload form requires:
 *   1. Land on /mission-control?tab=sources (gated by isCompanyProfileSaved,
 *      which the orgProfile fixture's company_name field unlocks).
 *   2. Click "Add Data Source" dropdown.
 *   3. Open "Connect to Systems" submenu.
 *   4. Click "Lead stream" item — flips showLeadUpload=true.
 *   5. setInputFiles on the hidden #lead-csv-upload input.
 *   6. Click "Add leads" submit button → POST /api/leads/batch-upload.
 *
 * The file input is hidden behind a styled label, so setInputFiles targets
 * the input directly by id.
 */
test("CSV upload via Data Sources → batch-upload fires with right shape", async ({ page }) => {
  await loginAsTestUser(page);

  const uploadRequest = page.waitForRequest("**/api/leads/batch-upload");

  await installApiMocks(page, {
    "/api/leads/batch-upload": {
      status: "completed",
      file_id: "file_test_001",
      lead_count: 3,
    },
    "/api/leads": { leads: leadList(3), total: 3 },
  });

  await test.step("navigate to Data Sources tab", async () => {
    await page.goto("/mission-control?tab=sources");
    await expect(page).toHaveScreenshot("01-data-sources-empty.png", { mask: maskDynamic(page) });
  });

  await test.step("open Add Data Source dropdown", async () => {
    await page
      .getByRole("button", { name: /add data source/i })
      .first()
      .click();
    await expect(page).toHaveScreenshot("02-add-data-source-menu.png", { mask: maskDynamic(page) });
  });

  await test.step("open Lead stream upload form", async () => {
    // Radix submenus open on hover/click of the trigger.
    await page.getByRole("menuitem", { name: /connect to systems/i }).hover();
    await page.getByRole("menuitem", { name: /^lead stream$/i }).click();
    await expect(page.getByText(/add leads/i).first()).toBeVisible();
    await expect(page).toHaveScreenshot("03-lead-upload-form-open.png", {
      mask: maskDynamic(page),
    });
  });

  await test.step("set CSV file", async () => {
    const csvBuffer = Buffer.from(
      "company_name,contact_name,email\nAcme,Jane,jane@acme.test\nBeta,John,john@beta.test\n",
      "utf-8",
    );
    await page.setInputFiles("#lead-csv-upload", {
      name: "test_leads.csv",
      mimeType: "text/csv",
      buffer: csvBuffer,
    });
  });

  await test.step("submit upload + assert batch-upload fired", async () => {
    // Submit button reads "Add leads" (changes to "Uploading..." in flight).
    await page.getByRole("button", { name: "Add leads" }).last().click();
    const req = await uploadRequest;
    expect(req.method()).toBe("POST");
    await expect(page).toHaveScreenshot("04-upload-fired.png", { mask: maskDynamic(page) });
  });
});
