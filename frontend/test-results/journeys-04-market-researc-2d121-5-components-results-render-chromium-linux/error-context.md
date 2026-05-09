# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: journeys/04-market-research-5-components.spec.ts >> market research kicks off all 5 components, results render
- Location: e2e/journeys/04-market-research-5-components.spec.ts:14:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/market_size_opportunity Title/i)
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByText(/market_size_opportunity Title/i)

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
              - generic [ref=e74]: Showing cached data from 11:32:29 PM
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
  5  | 
  6  | const COMPONENTS = [
  7  |   'market_size_opportunity',
  8  |   'industry_trends',
  9  |   'competitor_landscape',
  10 |   'regulatory_compliance',
  11 |   'market_entry',
  12 | ];
  13 | 
  14 | test('market research kicks off all 5 components, results render', async ({ page }) => {
  15 |   await loginAsTestUser(page);
  16 | 
  17 |   // Mock per-component responses.
  18 |   for (const component of COMPONENTS) {
  19 |     await page.route(`**/api/market-research**`, async (route) => {
  20 |       const reqBody = route.request().postDataJSON();
  21 |       await route.fulfill({
  22 |         status: 200,
  23 |         contentType: 'application/json',
  24 |         body: JSON.stringify({
  25 |           component_name: reqBody?.component_name || component,
  26 |           status: 'completed',
  27 |           result: {
  28 |             title: `${component} Title`,
  29 |             summary: `${component} summary text.`,
  30 |             key_findings: ['F1', 'F2', 'F3'],
  31 |             sources: [{ url: 'https://example.test', title: 'Source 1' }],
  32 |           },
  33 |           cached: false,
  34 |         }),
  35 |       });
  36 |     });
  37 |   }
  38 |   await installApiMocks(page);
  39 |   await installCatchAllApiMock(page);
  40 | 
  41 |   // Step 1: Navigate to market research.
  42 |   await page.goto('/your-ai-team/scout/market-research');
  43 |   await expect(page).toHaveScreenshot('01-market-research-initial.png', { mask: maskDynamic(page) });
  44 | 
  45 |   // Step 2: Trigger the research flow.
  46 |   // Selectors here depend on actual UI — adjust on first run.
  47 |   const startButton = page.getByRole('button', { name: /start|run|generate|research/i }).first();
  48 |   if (await startButton.isVisible()) {
  49 |     await startButton.click();
  50 |   }
  51 |   await expect(page).toHaveScreenshot('02-research-in-progress.png', { mask: maskDynamic(page) });
  52 | 
  53 |   // Step 3: Wait for first component result.
> 54 |   await expect(page.getByText(/market_size_opportunity Title/i)).toBeVisible({ timeout: 15000 });
     |                                                                  ^ Error: expect(locator).toBeVisible() failed
  55 |   await expect(page).toHaveScreenshot('03-component-1-loaded.png', { mask: maskDynamic(page) });
  56 | 
  57 |   // Step 4: Wait for second component.
  58 |   await expect(page.getByText(/industry_trends Title/i)).toBeVisible({ timeout: 15000 });
  59 |   await expect(page).toHaveScreenshot('04-component-2-loaded.png', { mask: maskDynamic(page) });
  60 | 
  61 |   // Step 5: Wait for third.
  62 |   await expect(page.getByText(/competitor_landscape Title/i)).toBeVisible({ timeout: 15000 });
  63 |   await expect(page).toHaveScreenshot('05-component-3-loaded.png', { mask: maskDynamic(page) });
  64 | 
  65 |   // Step 6: Wait for fourth.
  66 |   await expect(page.getByText(/regulatory_compliance Title/i)).toBeVisible({ timeout: 15000 });
  67 |   await expect(page).toHaveScreenshot('06-component-4-loaded.png', { mask: maskDynamic(page) });
  68 | 
  69 |   // Step 7: Wait for fifth.
  70 |   await expect(page.getByText(/market_entry Title/i)).toBeVisible({ timeout: 15000 });
  71 |   await expect(page).toHaveScreenshot('07-component-5-loaded.png', { mask: maskDynamic(page) });
  72 | 
  73 |   // Step 8: All-loaded final state.
  74 |   await expect(page).toHaveScreenshot('08-all-components-loaded.png', { mask: maskDynamic(page) });
  75 | });
  76 | 
```