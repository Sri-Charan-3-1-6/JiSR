import { test, expect, type APIRequestContext } from '@playwright/test';

async function seedCase(request: APIRequestContext) {
  const res = await request.post('/api/screenings', {
    data: { instrument: 'PHQ9', answers: [1, 1, 2, 1, 1, 1, 1, 1, 0], freeText: 'Interaction check.', residentId: null },
  });
  expect(res.ok()).toBeTruthy();
  const d = await res.json();
  return d.caseId as string;
}

test('interactive golden path: screen, accept, consent, theme, language, navigator, what-if', async ({ page, request }) => {
  test.setTimeout(240_000);

  await page.goto('/resident');
  await page.getByRole('link', { name: /Start PHQ-9/ }).click();
  for (let i = 0; i < 9; i++) {
    // item 9 (self-harm) must stay 0 or the fixed crisis rule routes to /emergency
    await page.getByRole('button', { name: i === 8 ? 'Not at all' : 'Several days', exact: true }).click();
  }
  await page.locator('textarea').fill('E2E interaction check.');
  await page.getByRole('button', { name: 'See my result', exact: true }).click();
  await page.waitForURL(/\/resident\/result\//);
  await expect(page.getByText(/screening, not a diagnosis/i).first()).toBeVisible();

  await page.getByRole('button', { name: /Community support group/ }).click();
  await page.getByRole('button', { name: /Accept — connect me with support/ }).click();
  await expect(page.getByText('Saved', { exact: true }).first()).toBeVisible();

  await page.goto('/resident/consent');
  const sw = page.getByRole('switch').first();
  const before = await sw.getAttribute('aria-checked');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', before ?? 'false');

  await page.getByRole('button', { name: 'Toggle dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Toggle dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.getByRole('button', { name: 'عربي', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

  const caseId = await seedCase(request);
  await page.goto(`/navigator/case/${caseId}`);
  await page.getByRole('button', { name: /^Mark as/ }).click();
  await expect(page.getByText('Saved', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Reached', exact: true }).click();
  await expect(page.getByText('Saved', { exact: true }).first()).toBeVisible();

  await page.goto('/health-system');
  const simTable = page.locator('table').last();
  const beforeSim = await simTable.textContent();
  await page.locator('input[type="checkbox"]').first().check();
  await page.waitForTimeout(800);
  const afterSim = await simTable.textContent();
  expect(afterSim).not.toBe(beforeSim);
});

test('positive self-harm answer routes to the calm emergency page', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/resident/screen/PHQ9');
  for (let i = 0; i < 9; i++) {
    await page.getByRole('button', { name: i === 8 ? 'Nearly every day' : 'Not at all', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Skip and see my result' }).click();
  await page.waitForURL(/\/emergency/);
  await expect(page.getByText(/You are not alone/).first()).toBeVisible();
});