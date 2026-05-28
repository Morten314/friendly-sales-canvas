// Spec 15 §3.4 — gap behavioral journey for /customers.
// Lives under journeys/ (not stubs/) because /customers is a real product
// route, not a stub-shape placeholder.
//
// Setup deviation from existing stubs: `loginAsTestUser` (helpers/login.ts)
// already installs Firebase mocks + api mocks + a catch-all internally.
// Existing e2e/stubs/*.spec.ts files call installApiMocks + installCatchAllApiMock
// again post-login redundantly — a minor smell flagged for Phase 1 cleanup
// (`installCatchAllApiMock` is itself marked @deprecated as a no-op in
// api-mocks.ts). These new journeys deliberately drop the redundant calls.
import { expect, test } from "@playwright/test";

import { loginAsTestUser } from "../helpers/login";
import { maskDynamic } from "../helpers/mask-dynamic";

test("customers page loads under mocked auth + API", async ({ page }) => {
  await loginAsTestUser(page);

  await page.goto("/customers");
  await expect(page).not.toHaveURL(/\/login/);

  // Spec §3.4 — assert a recognizable page element is visible (explicit
  // behavioral check; fails faster than waiting for the screenshot diff).
  // Page-agnostic selector. If no heading matches at execution time, swap
  // to a page-specific selector (e.g., getByText('Customers')) after
  // inspecting the rendered DOM.
  await expect(page.locator('h1, h2, h3, [role="heading"]').first()).toBeVisible({ timeout: 5000 });

  await expect(page).toHaveScreenshot("01-customers-page.png", {
    mask: maskDynamic(page),
  });
});
