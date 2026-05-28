import { Page } from "@playwright/test";
import { firebaseSignInResponse, seededAuthEntries } from "../fixtures/auth";
import { installApiMocks } from "../fixtures/api-mocks";

/**
 * Install Firebase REST mocks. Use this for tests that drive the login form
 * themselves (e.g. journey 01, which screenshots each step).
 *
 * Firebase Web SDK's signInWithEmailAndPassword fires multiple REST calls
 * under identitytoolkit.googleapis.com and securetoken.googleapis.com, each
 * with a distinct response shape:
 *   - accounts:signInWithPassword → idToken/localId/refreshToken/expiresIn
 *   - accounts:lookup             → { users: [...] }  ← needs `users` array,
 *                                                      otherwise SDK crashes
 *                                                      with "Cannot read
 *                                                      properties of undefined
 *                                                      (reading 'length')"
 *   - token (securetoken)         → id_token/refresh_token/expires_in
 *
 * A single catch-all mock returning the signin shape causes the lookup call
 * to fail. We route by endpoint suffix.
 */
export async function mockFirebaseLogin(page: Page) {
  await page.route("**/identitytoolkit.googleapis.com/**", async (route) => {
    const url = route.request().url();
    if (url.includes("accounts:lookup") || url.includes("getAccountInfo")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "identitytoolkit#GetAccountInfoResponse",
          users: [
            {
              localId: firebaseSignInResponse.localId,
              email: firebaseSignInResponse.email,
              emailVerified: true,
              displayName: "Test User",
              providerUserInfo: [
                {
                  providerId: "password",
                  email: firebaseSignInResponse.email,
                  federatedId: firebaseSignInResponse.email,
                  rawId: firebaseSignInResponse.email,
                  displayName: "Test User",
                },
              ],
              passwordHash: "redacted",
              passwordUpdatedAt: 1700000000000,
              validSince: "0",
              disabled: false,
              lastLoginAt: "1700000000000",
              createdAt: "1700000000000",
            },
          ],
        }),
      });
      return;
    }
    // Default: signin shape (signInWithPassword, signUp, etc.).
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "identitytoolkit#VerifyPasswordResponse",
        ...firebaseSignInResponse,
        displayName: "Test User",
      }),
    });
  });

  await page.route("**/securetoken.googleapis.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "mock_firebase_token",
        id_token: "mock_firebase_token",
        refresh_token: "mock_refresh_token",
        expires_in: "3600",
        token_type: "Bearer",
        user_id: firebaseSignInResponse.localId,
        project_id: "710721694093",
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

  await page.goto("/");
  await page.getByLabel(/email/i).fill("test@brewra.test");
  await page.getByLabel(/password/i).fill("test_password");
  await page.getByRole("button", { name: /sign in|log in/i }).click();

  await page.waitForURL(/\/(tenant-selection|mission-control|your-ai-team)/, { timeout: 15000 });
}
