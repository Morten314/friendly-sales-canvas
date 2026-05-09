# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: journeys/05-icp-create.spec.ts >> ICP create via Mission Control → appears in saved list
- Location: e2e/journeys/05-icp-create.spec.ts:7:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForRequest: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for request "**/api/customer_profile"
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
          - heading "Mission Control" [level=1] [ref=e54]
          - generic [ref=e55]: Tell Brewra about your business so it can work smarter for you
        - generic [ref=e57]:
          - img [ref=e58]
          - generic [ref=e62]: Test Org
      - main [ref=e63]:
        - generic [ref=e64]:
          - generic [ref=e65]:
            - generic [ref=e66]: "Completeness:"
            - progressbar [ref=e67]
            - generic [ref=e69]: 0%
          - generic [ref=e70]:
            - tablist [ref=e71]:
              - tab "Company Profile" [selected] [ref=e72] [cursor=pointer]:
                - img [ref=e73]
                - generic [ref=e77]: Company Profile
              - tab "Customer Profile 🔒" [disabled]:
                - img
                - generic: Customer Profile
                - generic: 🔒
              - tab "Data Sources 🔒" [disabled]:
                - img
                - generic: Data Sources
                - generic: 🔒
            - tabpanel "Company Profile" [ref=e78]:
              - generic [ref=e79]:
                - heading "Company Information" [level=3] [ref=e81]
                - generic [ref=e82]:
                  - generic [ref=e83]:
                    - generic [ref=e84]:
                      - text: Company Name *
                      - textbox "Company Name *" [ref=e85]:
                        - /placeholder: Enter company name
                    - generic [ref=e86]:
                      - text: Company URL
                      - textbox "Company URL" [ref=e87]:
                        - /placeholder: https://example.com
                    - generic [ref=e88]:
                      - text: Headquarters
                      - textbox "Headquarters" [ref=e89]:
                        - /placeholder: City, Country
                    - generic [ref=e90]:
                      - text: Employee Size
                      - combobox [ref=e91] [cursor=pointer]:
                        - generic: Select size
                        - img [ref=e92]
                    - generic [ref=e94]:
                      - text: Industry
                      - combobox [ref=e95] [cursor=pointer]:
                        - img [ref=e96]
                    - generic [ref=e98]:
                      - text: Revenue Band
                      - combobox [ref=e99] [cursor=pointer]:
                        - generic: Select revenue range
                        - img [ref=e100]
                    - generic [ref=e102]:
                      - text: GTM Model
                      - combobox [ref=e103] [cursor=pointer]:
                        - generic: Select GTM model
                        - img [ref=e104]
                  - generic [ref=e106]:
                    - heading "Goals" [level=3] [ref=e108]:
                      - button "Goals" [ref=e109] [cursor=pointer]:
                        - text: Goals
                        - img [ref=e110]
                    - heading "Market Positioning" [level=3] [ref=e113]:
                      - button "Market Positioning" [ref=e114] [cursor=pointer]:
                        - text: Market Positioning
                        - img [ref=e115]
                    - heading "Compliance & Constraints" [level=3] [ref=e118]:
                      - button "Compliance & Constraints" [ref=e119] [cursor=pointer]:
                        - text: Compliance & Constraints
                        - img [ref=e120]
                  - button "Save Changes" [ref=e122] [cursor=pointer]
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
  5  | import { icp } from '../fixtures/seed-data';
  6  | 
  7  | test('ICP create via Mission Control → appears in saved list', async ({ page }) => {
  8  |   await loginAsTestUser(page);
  9  | 
> 10 |   const createRequest = page.waitForRequest('**/api/customer_profile');
     |                              ^ Error: page.waitForRequest: Test timeout of 30000ms exceeded.
  11 | 
  12 |   // First load: empty list.
  13 |   let firstFetchHandled = false;
  14 |   await page.route('**/api/customer_profile**', async (route) => {
  15 |     if (route.request().method() === 'POST') {
  16 |       await route.fulfill({
  17 |         status: 201,
  18 |         contentType: 'application/json',
  19 |         body: JSON.stringify(icp({ name: 'New Test ICP' })),
  20 |       });
  21 |     } else {
  22 |       // GET: first time empty, second time has the new ICP.
  23 |       const profiles = firstFetchHandled
  24 |         ? [icp({ name: 'New Test ICP' })]
  25 |         : [];
  26 |       firstFetchHandled = true;
  27 |       await route.fulfill({
  28 |         status: 200,
  29 |         contentType: 'application/json',
  30 |         body: JSON.stringify({ profiles }),
  31 |       });
  32 |     }
  33 |   });
  34 |   await installApiMocks(page);
  35 |   await installCatchAllApiMock(page);
  36 | 
  37 |   // Step 1: Navigate to mission-control.
  38 |   await page.goto('/mission-control');
  39 |   await expect(page).toHaveScreenshot('01-mission-control-empty-icp.png', { mask: maskDynamic(page) });
  40 | 
  41 |   // Step 2: Click new ICP / create profile button.
  42 |   await page.getByRole('button', { name: /add|create|new.*icp|new.*profile/i }).first().click();
  43 |   await expect(page).toHaveScreenshot('02-icp-create-form-open.png', { mask: maskDynamic(page) });
  44 | 
  45 |   // Step 3: Fill in name.
  46 |   await page.getByLabel(/name/i).first().fill('New Test ICP');
  47 |   await page.getByRole('button', { name: /save|create|submit/i }).last().click();
  48 | 
  49 |   // Step 4: Assert request.
  50 |   const req = await createRequest;
  51 |   expect(req.method()).toBe('POST');
  52 |   await expect(page).toHaveScreenshot('03-icp-create-saving.png', { mask: maskDynamic(page) });
  53 | 
  54 |   // Step 5: Verify appears in list.
  55 |   await expect(page.getByText('New Test ICP')).toBeVisible({ timeout: 10000 });
  56 |   await expect(page).toHaveScreenshot('04-icp-in-saved-list.png', { mask: maskDynamic(page) });
  57 | });
  58 | 
```