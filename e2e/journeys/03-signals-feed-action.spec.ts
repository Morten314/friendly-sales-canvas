import { test, expect } from "@playwright/test";

import { installApiMocks, installCatchAllApiMock } from "../fixtures/api-mocks";
import { TEST_ORG_ID } from "../fixtures/identities";
import { signalList } from "../fixtures/seed-data";
import { loginAsTestUser } from "../helpers/login";
import { maskDynamic } from "../helpers/mask-dynamic";

test("signals feed loads, accept persists, snapshot stable", async ({ page }) => {
  await loginAsTestUser(page);

  const actionRequest = page.waitForRequest("**/api/signal_action");

  await installApiMocks(page, {
    "/api/v2/fetch-signals": { items: signalList(5), total: 5, limit: 10, offset: 0 },
    "/api/signal_action": { status: "success", signal_id: "sig_00000000" },
  });
  await installCatchAllApiMock(page);

  await test.step("navigate to signals feed", async () => {
    // Route is /signals, not /your-ai-team/scout/signals.
    await page.goto("/signals");
    await expect(page.getByText(/signals/i).first()).toBeVisible();
    await expect(page).toHaveScreenshot("01-signals-feed-loaded.png", { mask: maskDynamic(page) });
  });

  await test.step("signals rendered from API mock", async () => {
    // Page maps signal_id → id; headline `Test signal N` renders as visible text.
    await expect(page.getByText("Test signal 0")).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveScreenshot("02-signal-cards-visible.png", { mask: maskDynamic(page) });
  });

  await test.step("click accept on first signal", async () => {
    // Accept is an icon button (ThumbsUp lucide SVG) with no text label.
    await page.locator("button:has(svg.lucide-thumbs-up)").first().click();
  });

  await test.step("signal_action POST fired with right payload", async () => {
    const req = await actionRequest;
    const payload = req.postDataJSON();
    expect(payload.action).toBe("accept");
    expect(payload.org_id).toBe(TEST_ORG_ID);
    await expect(page).toHaveScreenshot("03-post-accept-loading.png", { mask: maskDynamic(page) });
  });

  await test.step("final post-accept state", async () => {
    await expect(page).toHaveScreenshot("04-post-accept-final.png", { mask: maskDynamic(page) });
  });
});
