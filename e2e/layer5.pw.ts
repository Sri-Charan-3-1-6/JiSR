import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const HEALTH_WORDS = ['score', 'phq', 'gad', 'depress', 'anxie', 'mental', 'screening', 'result', 'crisis', 'symptom', 'therap', 'diagnos', 'mood', 'wellbeing'];

async function grant(page: Page, title: string) {
  const sw = page.getByRole('switch', { name: title });
  if ((await sw.getAttribute('aria-checked')) !== 'true') {
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
  }
}

async function createCheckin(request: APIRequestContext, id: string, now: string, daysAgo: number) {
  const dueAt = new Date(new Date(now).getTime() - daysAgo * 86400_000).toISOString();
  const res = await request.post(`/api/residents/${id}/checkins`, { data: { dueAt } });
  expect(res.ok()).toBeTruthy();
}

test('Layer 5 golden path: reminders, ladder, trusted contact, calm, companion crisis, revocation', async ({ page, request }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${page.url()} console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${page.url()} pageerror: ${e}`));

  // Create a resident with a non-crisis screening (item 9 stays 0).
  await page.goto('/resident/screen/PHQ9');
  for (let i = 0; i < 9; i++) {
    await page.getByRole('button', { name: 'Not at all', exact: true }).click();
  }
  await page.getByRole('button', { name: 'See my result', exact: true }).click();
  await page.waitForURL(/\/resident\/result\//);
  const id = await page.evaluate(() => localStorage.getItem('jisr_resident_id'));
  expect(id).toBeTruthy();
  const consentRes = await request.get(`/api/residents/${id}/consent`);
  const pseudoId = (await consentRes.json()).resident.pseudo_id as string;
  const clock = await (await request.get('/api/demo/clock')).json();
  const now = clock.now as string;

  // Granular consent: store results, reminders and trusted contact all ON.
  await page.goto('/resident/consent');
  await grant(page, 'Store my screening results');
  await grant(page, 'Check-in reminders');
  await grant(page, 'Trusted contact');

  // Quiet hours: a check-in due now is skipped while the quiet window covers the day.
  await page.goto('/resident/checkin');
  await page.getByLabel('Quiet hours start').fill('00:00');
  await page.getByLabel('Quiet hours end').fill('23:59');
  await page.getByLabel('Maximum reminders per day').fill('10');
  await page.getByRole('button', { name: 'Save schedule' }).click();
  await expect(page.getByText('Schedule saved')).toBeVisible();
  await createCheckin(request, id!, now, 1);
  await page.goto('/resident/checkin');
  await page.getByRole('button', { name: 'Check for reminders now' }).click();
  await expect(page.getByText('Skipped — quiet hours').first()).toBeVisible();

  // Quiet window away: a reminder lands in the center; mark read, snooze, complete.
  await page.getByLabel('Quiet hours start').fill('00:00');
  await page.getByLabel('Quiet hours end').fill('00:00');
  await page.getByLabel('Gap before a second reminder (minutes)').fill('15');
  await page.getByLabel('Missed check-ins before a human calls').fill('2');
  await page.getByRole('button', { name: 'Save schedule' }).click();
  await expect(page.getByText('Schedule saved')).toBeVisible();
  await page.getByRole('button', { name: 'Check for reminders now' }).click();
  await expect(page.getByText('Reminder', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Mark read' }).first().click();
  await page.getByRole('button', { name: 'Snooze' }).first().click();
  await expect(page.getByText('Snoozed', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'I checked in' }).first().click();
  await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your check-in audit log' })).toBeVisible();
  await expect(page.getByText('Checked in', { exact: true }).first()).toBeVisible();

  // Bounded ladder: two past-due check-ins climb reminder -> soft -> human task.
  await createCheckin(request, id!, now, 10);
  await createCheckin(request, id!, now, 9);
  let evalBody: { events: Array<{ kind: string }>; tasks: unknown[] } = { events: [], tasks: [] };
  for (let i = 0; i < 3; i++) {
    const r = await request.post(`/api/residents/${id}/checkins/evaluate`);
    expect(r.ok()).toBeTruthy();
    evalBody = await r.json();
  }
  const tasksRes = await request.get('/api/navigator/tasks');
  const tasks = (await tasksRes.json()).tasks as Array<{ id: string; resident_id: string; kind: string; reason: string }>;
  const ourTask = tasks.find((t) => t.resident_id === id && t.kind === 'checkin_escalation');
  expect(ourTask, `ladder must create a navigator escalation task; last events: ${JSON.stringify(evalBody.events.map((e) => e.kind))}`).toBeTruthy();
  expect(ourTask!.reason).toMatch(/consecutive missed check-ins/);

  // The escalation task is visible in the navigator queue.
  await page.goto('/navigator');
  await expect(page.getByRole('heading', { name: 'Escalation tasks' })).toBeVisible();
  await expect(page.getByText('Escalation', { exact: true }).first()).toBeVisible();

  // The human call fails -> trusted contact becomes eligible.
  const callRes = await request.post(`/api/navigator/tasks/${ourTask!.id}/call`, {
    data: { outcome: 'not_reached', note: 'E2E ladder call — no answer.' },
  });
  expect(callRes.ok()).toBeTruthy();

  await page.goto('/resident/trusted-contact');
  await page.getByLabel('Who is this person? (e.g. Sister, Friend)').fill('Sister');
  await page.getByLabel('Their phone number').fill('971500000000');
  await page.getByRole('button', { name: 'Save contact' }).click();
  await expect(page.getByText('Contact saved')).toBeVisible();
  await expect(page.getByText('call could not reach you', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Send the generic message' }).click();
  await expect(page.getByText('Simulated', { exact: true })).toBeVisible();
  const expectedMsg = `${pseudoId} asked us to let you know they'd appreciate a call.`;
  await expect(page.getByText(expectedMsg)).toBeVisible();
  expect(HEALTH_WORDS.some((w) => expectedMsg.toLowerCase().includes(w))).toBe(false);
  await expect(page.getByRole('link', { name: 'Open prefilled WhatsApp (demo)' })).toBeVisible();
  await page.getByRole('button', { name: 'Record a reply' }).click();
  await expect(page.getByText('Contact made', { exact: true }).first()).toBeVisible();

  // Calm Corner: breathing runs, a pre-written line shows, jokes are opt-in.
  await page.goto('/resident/calm');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('blockquote').first()).toBeVisible();
  const jokesSwitch = page.getByRole('switch', { name: 'Include jokes and light lines' });
  await expect(jokesSwitch).toHaveAttribute('aria-checked', 'false');
  expect(await page.locator('p.bg-surface-2').count()).toBe(0);
  await jokesSwitch.click();
  await expect(jokesSwitch).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('p.bg-surface-2').first()).toBeVisible();

  // Companion: a crisis keyword in free text opens the emergency flow.
  await page.goto('/resident/companion');
  await expect(page.getByText("I'm not a replacement for a professional", { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Today feels heavy' }).click();
  await page.getByRole('button', { name: 'Put it into words' }).click();
  await page.locator('#companion-free-text').fill('I want to kill myself');
  await page.getByRole('button', { name: 'Go to the Calm Corner' }).click();
  await page.waitForURL(/\/emergency/);
  await expect(page.getByText(/You are not alone/).first()).toBeVisible();

  // Revoking reminders stops everything: the center shows the consent-required state.
  await page.goto('/resident/consent');
  const remindersSwitch = page.getByRole('switch', { name: 'Check-in reminders' });
  await remindersSwitch.click();
  await expect(remindersSwitch).toHaveAttribute('aria-checked', 'false');
  await page.goto('/resident/checkin');
  await expect(page.getByText('Reminders are currently turned off', { exact: false })).toBeVisible();

  expect(errors, 'no console errors across the Layer 5 flow').toEqual([]);
});