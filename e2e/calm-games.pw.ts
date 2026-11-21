import { test, expect } from '@playwright/test';

test('Bubble Calm: pop to the goal, done state, play again', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));

  await page.goto('/resident/calm');
  await page.getByRole('tab', { name: 'Bubble calm' }).click();
  await expect(page.getByText('Popped: 0 of 12')).toBeVisible();
  const bubbles = page.getByRole('button', { name: /Bubble \d/ });
  await expect(bubbles.first()).toBeVisible();
  for (let i = 0; i < 12; i++) {
    // Rotate across the six bubbles so a just-respawned one finishes its
    // scale-in before being clicked again; drift means no stability wait.
    await bubbles.nth(i % 6).click({ force: true });
    await expect(page.getByText(`Popped: ${i + 1} of 12`)).toBeVisible();
  }
  await expect(page.getByText('Popped: 12 of 12')).toBeVisible();
  await expect(page.getByText('Done', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByText('Popped: 0 of 12')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Pattern Echo: three rounds complete end to end (deterministic sequence)', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
  // Deterministic RNG: every sequence tile is Tile 1, so the play path is fixed.
  await page.addInitScript(() => { Math.random = () => 0; });

  await page.goto('/resident/calm');
  await page.getByRole('tab', { name: 'Pattern echo' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByText('Watch the pattern…')).toBeVisible();
  const tile = page.getByRole('button', { name: 'Tile 1' });
  // Rounds of 2, 3 and 4 taps; clicks auto-wait for the enabled (repeat) phase.
  for (let i = 0; i < 2 + 3 + 4; i++) {
    await tile.click();
  }
  await expect(page.getByText('Done', { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});