import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/login';
import { installApiMocks, installCatchAllApiMock } from '../fixtures/api-mocks';
import { maskDynamic } from '../helpers/mask-dynamic';
import { signalList } from '../fixtures/seed-data';

test('agent-hub route currently renders Signals (bug-as-feature lock)', async ({ page }) => {
  await loginAsTestUser(page);
  await installApiMocks(page, {
    '/api/fetch-signals': { signals: signalList(3) },
  });
  await installCatchAllApiMock(page);

  await page.goto('/agent-hub');

  // Per inventory: App.tsx:60-64 renders <Signals /> instead of AgentHub.tsx.
  // Lock this current incorrect behavior; when fixed, intentionally update snapshot.
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveScreenshot('agent-hub-page.png', { mask: maskDynamic(page) });

  // Defensive: confirm we see signals UI text, not AgentHub-specific text.
  const signalsHeader = page.getByText(/signals/i).first();
  await expect(signalsHeader).toBeVisible({ timeout: 10000 });
});
