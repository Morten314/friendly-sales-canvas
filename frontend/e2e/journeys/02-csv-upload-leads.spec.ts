import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/login';
import { installApiMocks, installCatchAllApiMock } from '../fixtures/api-mocks';
import { maskDynamic } from '../helpers/mask-dynamic';
import { leadList } from '../fixtures/seed-data';

test('CSV upload → leads appear in Scout lead stream', async ({ page }) => {
  await loginAsTestUser(page);

  // Capture the upload POST so we can assert it fired with right shape.
  const uploadRequest = page.waitForRequest('**/api/leads/batch-upload');

  // Mock the batch-upload response.
  await installApiMocks(page, {
    '/api/leads/batch-upload': {
      status: 'completed',
      file_id: 'file_test_001',
      lead_count: 3,
    },
    '/api/leads': { leads: leadList(3), total: 3 },
  });
  await installCatchAllApiMock(page);

  // Step 1: Navigate to the lead stream.
  await page.goto('/your-ai-team/scout/leads');
  await expect(page).toHaveScreenshot('01-lead-stream-empty.png', { mask: maskDynamic(page) });

  // Step 2: Click upload button (selector may need adjusting based on actual UI).
  await page.getByRole('button', { name: /upload|import|add leads/i }).first().click();
  await expect(page).toHaveScreenshot('02-upload-modal-open.png', { mask: maskDynamic(page) });

  // Step 3: Set the CSV file.
  const csvBuffer = Buffer.from(
    'company_name,contact_name,email\nAcme,Jane,jane@acme.test\nBeta,John,john@beta.test\n',
    'utf-8',
  );
  await page.setInputFiles('input[type="file"]', {
    name: 'test_leads.csv',
    mimeType: 'text/csv',
    buffer: csvBuffer,
  });

  // Step 4: Submit upload.
  await page.getByRole('button', { name: /upload|submit|confirm/i }).last().click();

  // Step 5: Confirm upload request fired with right payload.
  const req = await uploadRequest;
  expect(req.method()).toBe('POST');
  await expect(page).toHaveScreenshot('03-upload-in-progress.png', { mask: maskDynamic(page) });

  // Step 6: Wait for leads to render.
  await expect(page.getByText('Company 0')).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveScreenshot('04-leads-in-stream.png', { mask: maskDynamic(page) });

  // Step 7: Final state — multiple leads visible.
  await expect(page.getByText('Company 1')).toBeVisible();
  await expect(page).toHaveScreenshot('05-multiple-leads-visible.png', { mask: maskDynamic(page) });
});
