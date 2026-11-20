import { mkdirSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

const SHOTS = 'docs/screenshots/demo';
const ANSWERS = [2, 1, 2, 1, 1, 1, 1, 1, 0];
const LABELS = ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'];

async function runStory(page: Page, width: number, height: number, interact: boolean) {
  mkdirSync(SHOTS, { recursive: true });
  const apiCalls: string[] = [];
  const consoleErrors: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) apiCalls.push(r.url());
  });
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  await page.setViewportSize({ width, height });
  await page.goto('/');
  await page.getByRole('button', { name: 'Demo mode', exact: true }).click();
  const guide = page.getByRole('region', { name: 'Demo guide' });
  const shot = (k: number) => page.screenshot({ path: `${SHOTS}/step-${k}-${width}.png` });

  // Step 1 — screening
  await expect(guide.getByText('Step 1 of 8')).toBeVisible();
  await expect(page).toHaveURL(/\/resident\/screen\/PHQ9/);
  if (interact) {
    for (const a of ANSWERS) {
      await page.getByRole('button', { name: LABELS[a], exact: true }).click();
    }
    await page.getByRole('button', { name: 'Skip and see my result' }).click();
    await expect(page).toHaveURL(/\/resident\/result\/demo-case/);
  }
  await shot(1);

  // Step 2 — result + plain-language explanation
  await guide.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(guide.getByText('Step 2 of 8')).toBeVisible();
  await expect(page).toHaveURL(/\/resident\/result\/demo-case/);
  await expect(page.getByText('PHQ-9 score: 10')).toBeVisible();
  await expect(page.getByText('moderate level of symptoms')).toBeVisible();
  await expect(page.getByText('this is a screening, not a diagnosis', { exact: false }).first()).toBeVisible();
  await shot(2);

  // Step 3 — matched support step, accept
  await guide.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(guide.getByText('Step 3 of 8')).toBeVisible();
  if (interact) {
    await page.getByRole('button', { name: 'Accept — connect me with support' }).click();
    await expect(page.getByText('Matched', { exact: true }).first()).toBeVisible();
  }
  await shot(3);

  // Step 4 — missed follow-up, overdue queue
  await guide.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(guide.getByText('Step 4 of 8')).toBeVisible();
  await expect(page).toHaveURL(/\/navigator$/);
  await expect(page.getByRole('tab', { name: 'Overdue (1)' })).toBeVisible();
  await expect(page.getByText('OVERDUE', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('12 days', { exact: false }).first()).toBeVisible();
  await shot(4);

  // Step 5 — navigator logs a call
  await guide.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(guide.getByText('Step 5 of 8')).toBeVisible();
  await expect(page).toHaveURL(/\/navigator\/case\/demo-case/);
  await expect(page.getByText('SLA BREACHED', { exact: false })).toBeVisible();
  if (interact) {
    await page.getByRole('textbox').fill('Hindi speaker; evening call worked.');
    await page.getByRole('button', { name: 'Reached', exact: true }).click();
    await expect(page.getByText('Hindi speaker; evening call worked.')).toBeVisible();
    await page.getByRole('button', { name: 'Mark as Navigator contacted' }).click();
    await expect(page.getByText('Navigator contacted', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('SLA BREACHED', { exact: false })).toHaveCount(0);
  }
  await shot(5);

  // Step 6 — Gap Finder language gap + what-if
  await guide.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(guide.getByText('Step 6 of 8')).toBeVisible();
  await expect(page).toHaveURL(/\/health-system/);
  await expect(page.getByText('GAP: matching').first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'hi', exact: true }).first()).toBeVisible();
  if (interact) {
    await page.getByRole('checkbox', { name: /Language-matched navigator outreach/ }).check();
    await expect(page.getByText('79.6%').first()).toBeVisible({ timeout: 10_000 });
  }
  await shot(6);

  // Step 7 — check-in companion: schedule, bounded ladder, notification center
  await guide.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(guide.getByText('Step 7 of 8')).toBeVisible();
  await expect(page).toHaveURL(/\/resident\/checkin/);
  await expect(page.getByRole('heading', { name: 'Check-in companion', level: 1 })).toBeVisible();
  await expect(page.getByText('Consecutive misses: 3')).toBeVisible();
  await expect(page.getByText('Navigator task created').first()).toBeVisible();
  if (interact) {
    await page.getByRole('button', { name: 'Check for reminders now' }).click();
    await expect(page.getByRole('button', { name: 'Mark read' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Mark read' }).first().click();
    await page.getByRole('button', { name: 'I checked in' }).first().click();
    await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible();
  }
  await shot(7);

  // Step 8 — trusted contact: simulated generic message, no health data
  await guide.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(guide.getByText('Step 8 of 8')).toBeVisible();
  await expect(page).toHaveURL(/\/resident\/trusted-contact/);
  await expect(page.getByRole('heading', { name: 'Trusted contact', level: 1 })).toBeVisible();
  await expect(page.getByText('call could not reach you', { exact: false })).toBeVisible();
  if (interact) {
    await page.getByRole('button', { name: 'Send the generic message' }).click();
    await expect(page.getByText('Simulated', { exact: true })).toBeVisible();
    await expect(
      page.getByText("JISR-DEMO-099 asked us to let you know they'd appreciate a call."),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open prefilled WhatsApp (demo)' })).toBeVisible();
    await page.getByRole('button', { name: 'Record a reply' }).click();
    await expect(page.getByText('Contact made', { exact: true }).first()).toBeVisible();
  }
  await shot(8);

  // Finish — back home, demo badge gone, live fetch restored
  await guide.getByRole('button', { name: 'Finish demo' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('region', { name: 'Demo guide' })).toHaveCount(0);
  await expect(page.getByText('Demo mode', { exact: true }).first()).toBeVisible(); // home button again

  expect(apiCalls, 'demo story must not make any live API call').toEqual([]);
  expect(consoleErrors, 'no console errors during the demo story').toEqual([]);
}

test('demo story: full interactive run at 390px, zero API calls', async ({ page }) => {
  await runStory(page, 390, 844, true);
});

test('demo story: guided run at 1440px with screenshots', async ({ page }) => {
  await runStory(page, 1440, 900, true);
});