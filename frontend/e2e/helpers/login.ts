import { Page } from '@playwright/test';
import { mockAuthState, firebaseSignInResponse } from '../fixtures/auth';

export async function loginAsTestUser(page: Page) {
  await page.addInitScript((auth) => {
    for (const [key, value] of Object.entries(auth)) {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      window.localStorage.setItem(key, stringValue);
    }
  }, mockAuthState);
}

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
