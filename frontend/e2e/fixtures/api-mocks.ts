import { Page } from '@playwright/test';
import { lead, leadList, signal, signalList, icp, orgProfile, orgList } from './seed-data';
import { TEST_ORG_ID } from './identities';

export const apiMocks: Record<string, unknown> = {
  '/api/org': { orgs: orgList },
  '/api/profile/company': orgProfile,
  '/api/profile/org': orgProfile,
  '/api/profile/user': { user_id: 'test_user_123', display_name: 'Test User' },
  '/api/leads': { leads: leadList(3), total: 3 },
  '/api/leads/by-file': { leads: leadList(3) },
  '/api/leads/stream/status': { uploads: [] },
  '/api/leads/market-scores/status': { status: 'idle', leads_processed: 0 },
  '/api/fetch-signals': { signals: signalList(5) },
  '/api/customer_profile': { profiles: [icp(), icp({ icp_id: 'icp_002', name: 'Fintech CFOs' })] },
  '/api/icp': { suggested: [{ icp_id: 'sug_1', name: 'Suggested', match_score: 0.8 }] },
  '/api/market-research': {
    component_name: 'market_size_opportunity',
    status: 'completed',
    result: { title: 'Market Size', summary: 'Test summary', key_findings: [] },
    cached: false,
  },
  '/api/user-documents': { documents: [] },
};

export async function installApiMocks(
  page: Page,
  overrides: Record<string, unknown> = {},
) {
  const merged = { ...apiMocks, ...overrides };
  for (const [path, response] of Object.entries(merged)) {
    await page.route(`**${path}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  }
}

// Catch-all for any /api/* not in the registry — return empty 200 to prevent
// network errors from crashing the test.
export async function installCatchAllApiMock(page: Page) {
  await page.route('**/api/**', async (route, request) => {
    if (request.url().includes('identitytoolkit.googleapis.com')) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
}
