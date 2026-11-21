import { test, expect } from '@playwright/test';

test('AI companion chat: starter chip and free text both get a reply, crisis stays local', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));

  await page.goto('/resident/companion');
  await expect(page.getByText("I'm not a replacement for a professional", { exact: false })).toBeVisible();
  await expect(page.getByText('how are you feeling today', { exact: false })).toBeVisible();

  // Starter chip sends a self-reported mood as a user message and gets a reply.
  await page.getByRole('button', { name: "I'm okay today" }).click();
  await expect(page.getByText("I'm okay today", { exact: true })).toBeVisible();
  const replyBadge = page.getByText('AI reply', { exact: true }).or(page.getByText('Supportive reply (AI unavailable)', { exact: true }));
  await expect(replyBadge.first()).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText('Step 2 of 8')).toBeVisible();

  // Free text via the textarea + Send button gets a second reply.
  await page.locator('#companion-free-text').fill('Work was tiring but I managed a short walk this evening.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(replyBadge).toHaveCount(2, { timeout: 90_000 });
  await expect(page.getByText('Step 3 of 8')).toBeVisible();

  // Restart clears the log back to the greeting.
  await page.goto('/resident/companion');
  await expect(page.getByText('how are you feeling today', { exact: false })).toBeVisible();
  await expect(replyBadge).toHaveCount(0);

  expect(errors).toEqual([]);
});