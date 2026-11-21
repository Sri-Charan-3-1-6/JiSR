import { test, expect } from '@playwright/test';

const ROUTES = [
  '/',
  '/about',
  '/resident',
  '/resident/screen/PHQ9',
  '/resident/screen/GAD7',
  '/resident/consent',
  '/resident/summary',
  '/resident/wearable',
  '/resident/checkin',
  '/resident/calm',
  '/resident/companion',
  '/resident/trusted-contact',
  '/navigator',
  '/health-system',
  '/employer',
  '/emergency',
];

test('polish sweep: every page has title, synthetic badge, honest footer and zero console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${page.url()} console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`${page.url()} pageerror: ${e}`));

  for (const route of ROUTES) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    await expect(page, route).toHaveTitle(/JISR/);
    await expect(page.locator('header').getByText('Prototype — synthetic data').first(), route).toBeVisible();
    await expect(page.locator('footer').getByText('all data is synthetic'), route).toBeVisible();
    // Skeletons are text-less; wait until real content (or an honest empty/error state) renders.
    // /emergency portals its full-screen overlay to body, so main is empty by design.
    if (route === '/emergency') {
      await expect(page.locator('a[href="tel:998"]').first(), route).toBeVisible();
      await expect(page.locator('a[href="tel:8001717"]').first(), route).toBeVisible();
    } else {
      await expect(page.locator('main'), route).not.toHaveText(/^\s*$/, { timeout: 20_000 });
    }
  }

  expect(errors).toEqual([]);
});