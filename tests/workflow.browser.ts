import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';

test('owner builds a catalog; customer configures, captures, and embeds one pricing block', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('Email address').fill(`owner-${Date.now()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('test owner password 123');
  await page.getByRole('button', { name: 'Create account →' }).click();
  await page.getByRole('button', { name: 'Create your first project →' }).click();
  await page.getByLabel('Project name', { exact: true }).fill('Acme Workspace');
  await page
    .getByLabel('Description', { exact: true })
    .fill('A workspace that fits the way you work.');
  await page.getByRole('button', { name: 'Create project →' }).click();
  await expect(
    page.getByRole('heading', { name: 'Your product, feature by feature.' }),
  ).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(7);
  await page.screenshot({ path: '/tmp/pricing-dashboard.png', fullPage: true });
  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  await page.getByLabel('New category').fill('Integrations');
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  await expect(page.getByText('Integrations', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Features', exact: true }).click();
  await page.getByRole('button', { name: '+ Add feature' }).click();
  await page.getByLabel('Feature name', { exact: true }).fill('CRM sync');
  await page.getByLabel('Short description').fill('Keep customer records connected.');
  await page.getByLabel('Category', { exact: true }).selectOption('Integrations');
  await page.getByLabel('Price (USD)').fill('5.00');
  await page.getByRole('button', { name: 'Save feature', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(8);
  await page.getByRole('button', { name: 'Pricing block', exact: true }).click();
  const preview = page.locator('.pricing-block');
  await expect(preview.getByRole('checkbox').first()).toBeDisabled();
  await preview.getByLabel('Search features', { exact: true }).fill('analytics');
  await expect(preview.locator('.feature-row')).toHaveCount(1);
  await preview.getByLabel('Search features', { exact: true }).fill('');
  await preview.getByRole('button', { name: 'Collaboration', exact: true }).click();
  await expect(preview.locator('.feature-row')).toHaveCount(1);
  await preview.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByRole('button', { name: 'Integration', exact: true }).click();
  const liveHref = await page
    .getByRole('link', { name: 'Open live pricing block ↗' })
    .getAttribute('href');
  const projectId = liveHref!.split('/').pop();
  const customer = await context.newPage();
  await customer.goto(liveHref!);
  const block = customer.locator('.pricing-block');
  await expect(block.locator('.total')).toContainText('$10.00');
  await block.getByRole('checkbox', { name: /Analytics/ }).check();
  await block.getByRole('checkbox', { name: /Team Members/ }).check();
  await block.getByRole('button', { name: 'Increase Team Members' }).click();
  await block.getByRole('button', { name: 'Increase Team Members' }).click();
  await expect(block.locator('.total')).toContainText('$24.00');
  await block.getByLabel('Your goals').fill('writing and brainstorming');
  await block.getByRole('button', { name: 'Suggest Features' }).click();
  await expect(block.locator('.suggestions')).toContainText('AI Assistant');
  await expect(block.getByRole('checkbox', { name: /AI Assistant/ })).not.toBeChecked();
  await block
    .locator('.suggestions')
    .getByRole('button', { name: 'Add to my package +' })
    .first()
    .click();
  await expect(block.locator('.total')).toContainText('$32.00');
  await block.getByRole('checkbox', { name: /Onboarding/ }).check();
  await expect(block.locator('.once-total')).toContainText('$25.00');
  await expect(block.locator('.due-now')).toContainText('$57.00');
  await customer.evaluate(() => window.scrollTo(0, 0));
  await customer.screenshot({ path: '/tmp/pricing-block.png', fullPage: true });
  await block.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(block.getByRole('status')).toContainText('Package captured.');
  await page.getByRole('button', { name: 'Analytics', exact: true }).click();
  await expect(page.locator('.stats-row')).toContainText('Pricing sessions1');
  await expect(page.locator('.stats-row')).toContainText('Captured packages1');
  await expect(page.locator('.captured')).toContainText('$32.00/month + $25.00 once');
  // Exercise the actual custom element on a separate origin, including its verified event bridge.
  const host = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(
      `<!doctype html><script src="http://127.0.0.1:3101/pricing.js" defer></script><smart-pricing project="${projectId}"></smart-pricing><script>document.querySelector('smart-pricing').addEventListener('configuration', e => { window.savedConfiguration = e.detail; });</script>`,
    );
  });
  await new Promise<void>((resolve) => host.listen(0, '127.0.0.1', resolve));
  try {
    const external = await context.newPage();
    const address = host.address() as { port: number };
    await external.goto(`http://127.0.0.1:${address.port}/`);
    const frame = external.frameLocator('smart-pricing iframe');
    await expect(frame.getByRole('heading', { name: 'Your package', exact: true })).toBeVisible();
    await frame.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect
      .poll(() =>
        external.evaluate(() => Boolean((window as any).savedConfiguration?.configurationId)),
      )
      .toBe(true);
    const event = await external.evaluate(() => (window as any).savedConfiguration);
    expect(event.projectId).toBe(projectId);
    expect(event.summary.monthlyCents).toBe(1000);
    await external.close();
  } finally {
    host.closeAllConnections();
    await new Promise<void>((resolve) => host.close(() => resolve()));
  }
  await customer.close();
  expect(errors).toEqual([]);
});

test('mobile workspace and feature create/edit/deactivate/delete stay usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByLabel('Email address').fill(`mobile-${Date.now()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('test mobile password 123');
  await page.getByRole('button', { name: 'Create account →' }).click();
  await page.getByRole('button', { name: 'Create your first project →' }).click();
  await page.getByLabel('Project name', { exact: true }).fill('Mobile product');
  await page.getByLabel('Start with sample features I can edit').uncheck();
  await page.getByRole('button', { name: 'Create project →' }).click();
  await page.getByRole('button', { name: '+ Add feature' }).click();
  await page.getByLabel('Feature name', { exact: true }).fill('Setup');
  await page.getByLabel('Billing type').selectOption('one_time');
  await page.getByLabel('Price (USD)').fill('12.50');
  await page.getByRole('button', { name: 'Save feature', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Feature name', { exact: true }).fill('Guided setup');
  await page.getByRole('button', { name: 'Save feature', exact: true }).click();
  await expect(page.locator('tbody')).toContainText('Guided setup');
  await page.getByRole('button', { name: 'Deactivate Guided setup' }).click();
  await expect(page.locator('tbody')).toContainText('Inactive');
  await page.getByRole('button', { name: 'Activate Guided setup' }).click();
  await page.getByRole('button', { name: 'Pricing block', exact: true }).click();
  await page
    .locator('.pricing-block')
    .getByRole('checkbox', { name: /Guided setup/ })
    .check();
  await expect(page.locator('.once-total')).toContainText('$12.50');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await page.screenshot({ path: '/tmp/pricing-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Features', exact: true }).click();
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(0);
});
