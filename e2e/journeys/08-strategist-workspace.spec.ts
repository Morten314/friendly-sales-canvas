import { test, expect } from "@playwright/test";

import { installApiMocks, installCatchAllApiMock } from "../fixtures/api-mocks";
import { loginAsTestUser } from "../helpers/login";
import { maskDynamic } from "../helpers/mask-dynamic";

test("strategist workspace renders with a seeded lead context", async ({ page }) => {
  await loginAsTestUser(page);
  await installApiMocks(page);
  await installCatchAllApiMock(page);

  // StrategistPage mounts the live StrategistWorkspace only when
  // `context.leads` is non-empty. The page hydrates `context` from
  // `sessionStorage.strategistContext` in a mount effect, then removes the
  // key (StrategistPage.tsx:21-32). Seed it via addInitScript so it is
  // present on the next navigation (loginAsTestUser already navigated; this
  // applies to the goto below). The object MUST match the real
  // StrategistContext shape (src/features/strategist/types.ts): leads rows
  // carry name/company/jobTitle (+ optional email/tenure/source/signals),
  // and the top-level required field is `triggerPrompt` (not `source`).
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "strategistContext",
      JSON.stringify({
        leads: [
          {
            name: "Dana Lee",
            company: "Acme Co",
            jobTitle: "VP Revenue",
            email: "dana@acme.test",
            tenure: "2 years",
            source: "e2e",
            signals: ["Hiring surge", "Series B funding"],
          },
        ],
        opportunity: "Scout Research",
        triggerPrompt: "Build outreach for these leads",
      }),
    );
  });

  await test.step("navigate to the strategist workspace", async () => {
    await page.goto("/your-ai-team/strategist/workspace");
    await expect(page).not.toHaveURL(/\/login/);
  });

  await test.step("two-panel workspace + chat render", async () => {
    await expect(page.getByText("Chat with Strategist")).toBeVisible();
    // Left dashboard panel landmark — confirms the live workspace mounted
    // (not the empty-state StrategistRecommendations fallback).
    await expect(page.getByText("Quick Actions")).toBeVisible();
    await expect(page).toHaveScreenshot("08-strategist-workspace.png", {
      mask: maskDynamic(page),
    });
  });
});
