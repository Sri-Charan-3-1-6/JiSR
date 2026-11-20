import { test, expect, type Browser, type APIRequestContext } from '@playwright/test';
import path from 'node:path';

const OUT = path.join(__dirname, '..', 'docs', 'screenshots');
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

interface Seed {
  residentId: string;
  caseId: string;
}

async function seed(request: APIRequestContext): Promise<Seed> {
  const screen = await request.post(`${BASE}/api/screenings`, {
    data: {
      instrument: 'PHQ9',
      answers: [1, 1, 2, 1, 1, 1, 1, 1, 0],
      freeText: 'Feeling a bit stretched lately.',
      residentId: null,
    },
  });
  expect(screen.ok()).toBeTruthy();
  const s = await screen.json();
  const residentId: string = s.residentId;
  const caseId: string = s.caseId;

  for (const scope of ['store_results', 'navigator_contact', 'share_with_primary_care', 'wearable_signal']) {
    const r = await request.post(`${BASE}/api/residents/${residentId}/consent`, {
      data: { scope, granted: true },
    });
    expect(r.ok()).toBeTruthy();
  }
  const w = await request.post(`${BASE}/api/residents/${residentId}/wearable`);
  expect(w.ok()).toBeTruthy();
  return { residentId, caseId };
}

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '1440', width: 1440, height: 900 },
];
const LOCALES = ['en', 'ar'];

function screens(seedData: Seed) {
  return [
    { name: 'home', url: '/' },
    { name: 'resident', url: '/resident' },
    { name: 'screening', url: '/resident/screen/PHQ9' },
    { name: 'result', url: `/resident/result/${seedData.caseId}` },
    { name: 'consent', url: '/resident/consent' },
    { name: 'summary', url: '/resident/summary' },
    { name: 'wearable', url: '/resident/wearable' },
    { name: 'emergency', url: '/emergency' },
    { name: 'navigator', url: '/navigator' },
    { name: 'navigator-case', url: `/navigator/case/${seedData.caseId}` },
    { name: 'health-system', url: '/health-system' },
    { name: 'employer', url: '/employer' },
  ];
}

async function shoot(
  browser: Browser,
  seedData: Seed,
  locale: string,
  vp: { name: string; width: number; height: number },
  theme: 'light' | 'dark' = 'light'
) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  await context.addCookies([
    { name: 'jisr_locale', value: locale, url: BASE },
    { name: 'jisr_theme', value: theme, url: BASE },
  ]);
  await context.addInitScript((id: string) => {
    localStorage.setItem('jisr_resident_id', id);
  }, seedData.residentId);
  const page = await context.newPage();
  for (const s of screens(seedData)) {
    await page.goto(BASE + s.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const file = path.join(OUT, `${s.name}-${locale}-${vp.name}${theme === 'dark' ? '-dark' : ''}.png`);
    // The shared demo queue holds thousands of seeded cases; capture the viewport only.
    await page.screenshot({ path: file, fullPage: s.name !== 'navigator' });
  }
  await context.close();
}

test('capture all main screens in en and ar at 390px and 1440px', async ({ browser, request }) => {
  const seedData = await seed(request);
  for (const locale of LOCALES) {
    for (const vp of VIEWPORTS) {
      await shoot(browser, seedData, locale, vp);
    }
  }
  // Dark theme spot-checks
  await shoot(browser, seedData, 'en', VIEWPORTS[1], 'dark');
});