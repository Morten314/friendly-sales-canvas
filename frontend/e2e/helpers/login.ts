import { Page } from '@playwright/test';
import { firebaseSignInResponse, seededAuthEntries } from '../fixtures/auth';
import { installApiMocks } from '../fixtures/api-mocks';

/**
 * Install Firebase REST mocks. Use this for tests that drive the login form
 * themselves (e.g. journey 01, which screenshots each step).
 */
export async function mockFirebaseLogin(page: Page) {
  await page.route('**/identitytoolkit.googleapis.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(firebaseSignInResponse),
    });
  });

  await page.route('**/securetoken.googleapis.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id_token: 'mock_firebase_token',
        refresh_token: 'mock_refresh_token',
        expires_in: '3600',
      }),
    });
  });
}

/**
 * "Skip the login screen" helper for tests that aren't about the login flow
 * itself.
 *
 * The previous implementation only seeded localStorage with non-existent
 * keys (`auth_token`, `user_id`, etc.) and was a no-op against the real
 * AuthContext. The fix drives the real Firebase login flow with REST
 * endpoints mocked, so `onAuthStateChanged` actually fires with a User
 * whose `uid === TEST_USER_ID` and Firebase persists the session in
 * IndexedDB for subsequent navigations.
 *
 * The helper installs default API mocks (catch-all + standard endpoints)
 * before driving the form so post-login navigations don't hit the real
 * backend. Tests that need endpoint-specific responses can call
 * `installApiMocks(page, overrides)` again after — Playwright matches the
 * most-recently-registered route first, so per-test overrides win.
 *
 * Post-condition: the page is on /tenant-selection or /mission-control,
 * and Firebase IndexedDB has a persisted user.
 */
export async function loginAsTestUser(page: Page) {
  await mockFirebaseLogin(page);
  await installApiMocks(page);

  // Seed UID-keyed localStorage so AuthContext.useEffect finds the org
  // synchronously when onAuthStateChanged fires — avoiding a fetch race
  // with the /api/org mock.
  await page.addInitScript((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      window.localStorage.setItem(key, value as string);
    }
  }, seededAuthEntries);

  await page.goto('/');
  await page.getByLabel(/email/i).fill('test@brewra.test');
  await page.getByLabel(/password/i).fill('test_password');
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  await page.waitForURL(
    /\/(tenant-selection|mission-control|your-ai-team)/,
    { timeout: 15000 },
  );
}
