import { Page } from "@playwright/test";
import { lead, leadList, signal, signalList, icp, orgProfile, orgList } from "./seed-data";
import { TEST_ORG_ID } from "./identities";

const apiMocks: Record<string, unknown> = {
  "/api/org": { orgs: orgList },
  "/api/profile/company": orgProfile,
  "/api/profile/org": orgProfile,
  "/api/profile/user": { user_id: "test_user_123", display_name: "Test User" },
  "/api/leads": { leads: leadList(3), total: 3 },
  "/api/leads/by-file": { leads: leadList(3) },
  "/api/leads/stream/status": { uploads: [] },
  "/api/leads/market-scores/status": { status: "idle", leads_processed: 0 },
  "/api/fetch-signals": { signals: signalList(5) },
  "/api/customer_profile": { profiles: [icp(), icp({ icp_id: "icp_002", name: "Fintech CFOs" })] },
  "/api/icp": { suggested: [{ icp_id: "sug_1", name: "Suggested", match_score: 0.8 }] },
  "/api/market-research": {
    component_name: "market_size_opportunity",
    status: "completed",
    result: { title: "Market Size", summary: "Test summary", key_findings: [] },
    cached: false,
  },
  "/api/user-documents": { documents: [] },
};

/**
 * Install API mocks plus a catch-all for /api/*.
 *
 * Playwright matches routes in REVERSE registration order (last registered
 * wins). To get specific overrides to take precedence over the catch-all, we
 * register the catch-all FIRST, then the specific mocks LAST.
 *
 * Path matching uses URL pathname equality (not glob substring), so
 * `/api/leads` does NOT match `/api/leads/by-file` or `/api/leads/batch-upload`.
 * Each desired path must be listed explicitly in `apiMocks` or `overrides`.
 */
export async function installApiMocks(page: Page, overrides: Record<string, unknown> = {}) {
  const merged = { ...apiMocks, ...overrides };

  // 1. Catch-all FIRST (lowest priority). Returns empty 200 for any /api/*
  //    that wasn't explicitly mocked, so the page doesn't crash on
  //    untracked endpoints.
  await page.route(
    (url) => {
      try {
        return new URL(url).pathname.startsWith("/api/");
      } catch {
        return false;
      }
    },
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    },
  );

  // 2. Specific mocks LAST (highest priority). Exact pathname match — query
  //    strings are ignored, so `/api/leads?org_id=foo` matches `/api/leads`.
  for (const [path, response] of Object.entries(merged)) {
    await page.route(
      (url) => {
        try {
          return new URL(url).pathname === path;
        } catch {
          return false;
        }
      },
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(response),
        });
      },
    );
  }
}

/**
 * @deprecated Catch-all is now installed by installApiMocks. Kept as a no-op
 * shim so existing call sites don't break; remove once all callers migrate.
 */
export async function installCatchAllApiMock(_page: Page) {
  // intentional no-op
}
