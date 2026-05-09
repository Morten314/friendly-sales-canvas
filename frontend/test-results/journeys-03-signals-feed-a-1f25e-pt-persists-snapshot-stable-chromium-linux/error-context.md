# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: journeys/03-signals-feed-action.spec.ts >> signals feed loads, accept persists, snapshot stable
- Location: e2e/journeys/03-signals-feed-action.spec.ts:8:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Test signal 0')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Test signal 0')

```

```
Error: page.waitForRequest: Test ended.
=========================== logs ===========================
waiting for request "**/api/signal_action"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]: Brewra
        - button "Toggle sidebar" [ref=e7] [cursor=pointer]:
          - img
          - generic [ref=e8]: Toggle sidebar
      - navigation [ref=e9]:
        - list [ref=e10]:
          - listitem [ref=e11]:
            - link "Mission Control" [ref=e12] [cursor=pointer]:
              - /url: /mission-control
              - img [ref=e13]
              - generic [ref=e15]: Mission Control
          - listitem [ref=e16]:
            - generic [ref=e18] [cursor=pointer]:
              - img [ref=e19]
              - generic [ref=e21]: Signals
              - button [ref=e22]:
                - img [ref=e23]
          - listitem [ref=e25]:
            - generic [ref=e27] [cursor=pointer]:
              - img [ref=e28]
              - generic [ref=e33]: Your AI Team
              - button [ref=e34]:
                - img [ref=e35]
          - listitem [ref=e37]:
            - link "Settings" [ref=e38] [cursor=pointer]:
              - /url: /settings
              - img [ref=e39]
              - generic [ref=e42]: Settings
      - generic [ref=e43]:
        - generic "View profile" [ref=e44] [cursor=pointer]: U
        - generic "View profile" [ref=e45] [cursor=pointer]:
          - generic [ref=e46]: User
        - button "Logout" [ref=e47] [cursor=pointer]:
          - img
          - generic [ref=e48]: Logout
    - generic [ref=e49]:
      - banner [ref=e50]:
        - generic [ref=e52]:
          - generic [ref=e53]:
            - heading "Scout" [level=1] [ref=e54]
            - button [ref=e55] [cursor=pointer]:
              - img
          - generic [ref=e56]: Find the best markets before your competitors do
          - generic [ref=e57]: Reports are generated according to fields such as company name, industry, etc. from your Company profile on Mission Control
        - generic [ref=e58]:
          - button "Refresh" [ref=e59] [cursor=pointer]:
            - img
            - text: Refresh
          - generic [ref=e60]:
            - img [ref=e61]
            - generic [ref=e65]: Test Org
      - main [ref=e66]:
        - generic [ref=e68]:
          - generic [ref=e70]:
            - alert [ref=e71]:
              - img [ref=e72]
              - generic [ref=e74]: Showing cached data from 11:32:28 PM
            - tablist [ref=e75]:
              - tab "Market Intelligence" [selected] [ref=e76] [cursor=pointer]:
                - img [ref=e77]
                - text: Market Intelligence
              - tab "Your Lead Stream" [ref=e80] [cursor=pointer]:
                - img [ref=e81]
                - text: Your Lead Stream
              - tab "Chat with Scout" [ref=e86] [cursor=pointer]:
                - img [ref=e87]
                - text: Chat with Scout
          - tabpanel "Market Intelligence" [ref=e93]:
            - generic [ref=e95]:
              - generic [ref=e97]:
                - paragraph [ref=e98]: No market size data available
                - button "Generate Report with Scout" [ref=e99] [cursor=pointer]:
                  - img
                  - text: Generate Report with Scout
              - generic [ref=e102]:
                - generic [ref=e103]:
                  - heading "Industry Trends" [level=2] [ref=e104]:
                    - img [ref=e105]
                    - text: Industry Trends
                  - generic [ref=e107]:
                    - button [ref=e108] [cursor=pointer]:
                      - img
                    - button [ref=e109] [cursor=pointer]:
                      - img
                - generic [ref=e111]:
                  - generic [ref=e112]:
                    - paragraph [ref=e113]: The enterprise software industry is experiencing rapid transformation driven by AI adoption, cloud migration, and regulatory changes. Key trends indicate accelerated digital transformation with 78% of companies prioritizing AI integration.
                    - generic [ref=e114]:
                      - generic [ref=e115]:
                        - generic [ref=e116]: 78%
                        - generic [ref=e117]: AI Adoption Rate
                        - generic [ref=e118]: Enterprise pilots
                      - generic [ref=e119]:
                        - generic [ref=e120]: 45%
                        - generic [ref=e121]: Cloud Migration Increase
                        - generic [ref=e122]: Year over year
                      - generic [ref=e123]:
                        - generic [ref=e124]: "12"
                        - generic [ref=e125]: Regulatory Changes
                        - generic [ref=e126]: Impacting sector
                  - button "Read More" [ref=e128] [cursor=pointer]:
                    - generic [ref=e129]: Read More
                    - img
              - generic [ref=e133]:
                - generic [ref=e134]:
                  - generic [ref=e135]:
                    - img [ref=e137]
                    - generic [ref=e139]:
                      - heading "Competitor Landscape" [level=2] [ref=e140]
                      - paragraph [ref=e141]: Comprehensive analysis of competitive environment
                  - generic [ref=e142]:
                    - button [ref=e143] [cursor=pointer]:
                      - img
                    - button [ref=e144] [cursor=pointer]:
                      - img
                - generic [ref=e146]:
                  - heading "Executive Summary" [level=3] [ref=e148]:
                    - img [ref=e149]
                    - text: Executive Summary
                  - paragraph [ref=e152]: The competitive landscape analysis is being prepared. This will include insights on market leaders, emerging players, and recent funding activities in your industry.
                - generic [ref=e153]:
                  - heading "Key Metrics" [level=3] [ref=e154]
                  - generic [ref=e155]:
                    - generic [ref=e158]:
                      - generic [ref=e159]: Loading market share data...
                      - generic [ref=e160]: Top Player Market Share
                    - generic [ref=e163]:
                      - generic [ref=e164]: Analyzing emerging competitors...
                      - generic [ref=e165]: Emerging Players Added
                - button "Read More" [ref=e167] [cursor=pointer]:
                  - generic [ref=e168]: Read More
                  - img
              - generic [ref=e171]:
                - generic [ref=e173]:
                  - generic [ref=e174]:
                    - img [ref=e176]
                    - generic [ref=e179]:
                      - heading "Regulatory & Compliance Highlights" [level=2] [ref=e180]
                      - paragraph [ref=e181]: Current regulatory landscape and compliance requirements
                  - generic [ref=e182]:
                    - button [ref=e183] [cursor=pointer]:
                      - img
                    - button [ref=e184] [cursor=pointer]:
                      - img
                - generic [ref=e186]:
                  - generic [ref=e187]:
                    - heading "Executive Summary" [level=3] [ref=e188]
                    - paragraph [ref=e189]: The regulatory landscape for SaaS companies continues to evolve rapidly, with new compliance requirements emerging across multiple jurisdictions. Organizations must navigate an increasingly complex web of data protection, AI governance, and industry-specific regulations.
                  - heading "Key Regulatory Updates" [level=3] [ref=e191]
                  - button "Read More" [ref=e193] [cursor=pointer]:
                    - generic [ref=e194]: Read More
                    - img
              - generic [ref=e197]:
                - generic [ref=e198]:
                  - heading "Market Entry & Growth Strategy" [level=2] [ref=e199]:
                    - img [ref=e200]
                    - text: Market Entry & Growth Strategy
                  - button [ref=e204] [cursor=pointer]:
                    - img
                - generic [ref=e206]:
                  - paragraph [ref=e207]: No market entry data available
                  - button "Generate Report with Scout" [ref=e208] [cursor=pointer]:
                    - img
                    - text: Generate Report with Scout
    - region "Notifications (F8)":
      - list
  - region "Notifications (F8)":
    - list
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { loginAsTestUser } from '../helpers/login';
  3  | import { installApiMocks, installCatchAllApiMock } from '../fixtures/api-mocks';
  4  | import { maskDynamic } from '../helpers/mask-dynamic';
  5  | import { signalList } from '../fixtures/seed-data';
  6  | import { TEST_ORG_ID } from '../fixtures/identities';
  7  | 
  8  | test('signals feed loads, accept persists, snapshot stable', async ({ page }) => {
  9  |   await loginAsTestUser(page);
  10 | 
> 11 |   const actionRequest = page.waitForRequest('**/api/signal_action');
     |                              ^ Error: page.waitForRequest: Test ended.
  12 | 
  13 |   await installApiMocks(page, {
  14 |     '/api/fetch-signals': { signals: signalList(5) },
  15 |     '/api/signal_action': { status: 'success', signal_id: 'sig_00000000' },
  16 |   });
  17 |   await installCatchAllApiMock(page);
  18 | 
  19 |   // Step 1: Navigate to signals feed.
  20 |   await page.goto('/your-ai-team/scout/signals');
  21 |   await expect(page.getByText('Signals').first()).toBeVisible();
  22 |   await expect(page).toHaveScreenshot('01-signals-feed-loaded.png', { mask: maskDynamic(page) });
  23 | 
  24 |   // Step 2: Verify signals rendered.
  25 |   await expect(page.getByText('Test signal 0')).toBeVisible();
  26 |   await expect(page).toHaveScreenshot('02-signal-cards-visible.png', { mask: maskDynamic(page) });
  27 | 
  28 |   // Step 3: Click accept on first card.
  29 |   await page.getByRole('button', { name: /accept|approve/i }).first().click();
  30 | 
  31 |   // Step 4: Assert request fired correctly.
  32 |   const req = await actionRequest;
  33 |   const payload = req.postDataJSON();
  34 |   expect(payload.action).toBe('accept');
  35 |   expect(payload.org_id).toBe(TEST_ORG_ID);
  36 |   await expect(page).toHaveScreenshot('03-post-accept-loading.png', { mask: maskDynamic(page) });
  37 | 
  38 |   // Step 5: Final state.
  39 |   await expect(page).toHaveScreenshot('04-post-accept-final.png', { mask: maskDynamic(page) });
  40 | });
  41 | 
```