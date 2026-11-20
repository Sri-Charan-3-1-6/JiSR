import { test, expect } from '@playwright/test';

test('empty resident storage shows the not-yet-screened state', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('jisr_resident_id', ''));
  await page.goto('/resident');
  await expect(page.getByText('No screenings yet. Your results and follow-up steps will appear here.', { exact: true })).toBeVisible();
});

test('mounted resident screen keeps its original identity through a pending response', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('jisr_resident_id', 'resident-a'));
  const requests: string[] = [];
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/residents/*/cases', async (route) => {
    requests.push(new URL(route.request().url()).pathname);
    await pending;
    await route.fulfill({ json: { cases: [], consentRequired: false } });
  });
  await page.goto('/resident');
  await expect.poll(() => requests.length).toBe(1);
  await page.evaluate(() => localStorage.setItem('jisr_resident_id', 'resident-b'));
  release();
  await expect(page.getByText('No screenings yet. Your results and follow-up steps will appear here.', { exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(requests).toEqual(['/api/residents/resident-a/cases']);
});

for (const initialId of ['', 'resident-before-screening']) {
  test(`returning to a cached resident page refreshes its ${initialId ? 'existing' : 'new'} identity`, async ({ page }) => {
    await page.addInitScript((id) => localStorage.setItem('jisr_resident_id', id), initialId);
    const requests: string[] = [];
    await page.route('**/api/residents/*/consent', (route) => route.fulfill({
      json: { resident: { pseudo_id: 'JISR-CACHED-TEST' }, scopes: [], audit: [] },
    }));
    await page.route('**/api/residents/*/cases', async (route) => {
      const path = new URL(route.request().url()).pathname;
      requests.push(path);
      await route.fulfill({ json: {
        cases: path.includes('resident-after-screening')
          ? [{ id: 'cached-return-case', risk_tier: 'minimal', state: 'screened', created_at: '2026-11-20T12:00:00Z', instrument: 'PHQ9', total_score: 3 }]
          : [],
        consentRequired: false,
      } });
    });
    await page.goto('/resident');
    await expect(page.getByText('No screenings yet. Your results and follow-up steps will appear here.', { exact: true })).toBeVisible();
    await page.getByRole('heading', { level: 1 }).evaluate((el) => el.setAttribute('data-cache-proof', 'first-visit'));
    const nav = page.getByRole('navigation', { name: 'Resident', exact: true });
    await nav.getByRole('link', { name: 'Consent', exact: true }).click();
    await expect(page).toHaveURL(/\/resident\/consent$/);
    await expect(page.getByRole('heading', { name: 'Privacy & consent', exact: true })).toBeVisible();
    await page.evaluate(() => localStorage.setItem('jisr_resident_id', 'resident-after-screening'));
    requests.length = 0;
    await nav.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(page).toHaveURL(/\/resident$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveAttribute('data-cache-proof', 'first-visit');
    await expect(page.locator('a[href="/resident/result/cached-return-case"]')).toBeVisible();
    expect(requests).toEqual(['/api/residents/resident-after-screening/cases']);
  });
}

test('mobile navigation leaves room for content without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/resident');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const header = await page.getByRole('banner').boundingBox();
  expect(header!.height).toBeLessThanOrEqual(144);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByRole('navigation', { name: 'Resident', exact: true })).toBeVisible();
});

test('resident navigation remains usable on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/resident');
  const nav = page.getByRole('navigation', { name: 'Resident', exact: true });
  await expect(nav).toBeVisible({ timeout: 5000 });
  await nav.getByRole('link', { name: 'Consent', exact: true }).click();
  await expect(page).toHaveURL(/\/resident\/consent$/);
  await expect(nav.getByRole('link', { name: 'Consent', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('keyboard users can bypass the header and focus the main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content', exact: true });
  await expect(skip).toBeFocused({ timeout: 5000 });
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('privacy dialog traps keyboard focus and restores its trigger', async ({ page }) => {
  await page.goto('/employer');
  const trigger = page.getByRole('button', { name: 'Suppressed: fewer than 10 people in this group', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('primary routes fit narrow mobile, tablet and desktop viewports', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/resident', '/resident/screen/PHQ9', '/resident/checkin', '/navigator', '/health-system', '/employer']) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
      await page.waitForLoadState('networkidle');
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${route} at ${width}px`).toBeLessThanOrEqual(width);
    }
  }
  expect(errors).toEqual([]);
});

test('screening text input retains a high-contrast keyboard focus ring', async ({ page }) => {
  await page.goto('/resident/screen/PHQ9');
  for (let i = 0; i < 9; i++) {
    await page.getByRole('button', { name: 'Not at all', exact: true }).click();
  }
  const input = page.locator('textarea');
  await input.focus();
  const style = await input.evaluate((el) => {
    const s = getComputedStyle(el);
    const hex = getComputedStyle(document.documentElement).getPropertyValue('--ring').trim();
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return { outline: s.outlineColor, ring: `rgb(${rgb.join(', ')})`, width: parseFloat(s.outlineWidth) };
  });
  expect(style.width).toBeGreaterThanOrEqual(2);
  expect(style.outline).toBe(style.ring);
});

test('dark mode, Arabic RTL, Hindi and reduced motion remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/resident');
  await page.getByRole('button', { name: 'Toggle dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'عربي', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.goto('/resident/screen/PHQ9');
  await expect(page.getByRole('button', { name: 'عربي', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'हिन्दी', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(await page.locator('.btn').first().evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThanOrEqual(0.001);
});

test('navigator task loading does not move the case queue', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/navigator/queue', async (route) => {
    await pending;
    await route.fulfill({ json: {
      cases: [],
      clock: { now: '2026-11-20T12:00:00Z', offset: '00:00:00' },
      tasks: Array.from({ length: 5 }, (_, i) => ({
        id: `layout-task-${i}`, pseudo_id: `JISR-LAYOUT-${i}`, reason: '3 consecutive missed check-ins',
        call_outcome: null, call_note: null, contact_id: null, contact_label: null,
        contact_available: false, created_at: '2026-11-20T12:00:00Z',
      })),
    } });
  });
  await page.goto('/navigator');
  const queue = page.getByRole('tablist', { name: 'Navigator console', exact: true });
  try {
    await expect(queue).toBeVisible();
    const before = await queue.boundingBox();
    release();
    await expect(page.getByText('JISR-LAYOUT-4', { exact: true })).toBeVisible();
    const after = await queue.boundingBox();
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
    const tasks = page.getByRole('region', { name: 'Escalation tasks', exact: true });
    const lastCall = tasks.getByRole('button', { name: 'Log a human call', exact: true }).last();
    await lastCall.focus();
    await expect(lastCall).toBeFocused();
    expect(await tasks.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  } finally {
    release();
  }
});

test('health-system heading appears before its metrics response', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/gapfinder', async (route) => {
    await pending;
    await route.fulfill({ json: { metrics: null, improvement: null, fairness: [], suppressed: [] } });
  });
  await page.route('**/api/calm/lines**', (route) => route.fulfill({ json: { lines: [] } }));
  await page.goto('/health-system');
  try {
    await expect(page.getByRole('heading', { name: 'Gap Finder — Health-System dashboard', exact: true })).toBeVisible();
  } finally {
    release();
  }
});

test('faculty accent badges retain AA contrast in both themes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/health-system');
  const badge = page.getByText('Joke', { exact: true }).first();
  await expect(badge).toBeVisible({ timeout: 30_000 });
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Toggle dark mode', exact: true }).click();
    await expect.poll(() => badge.evaluate((el) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      const luminance = (rgba: Uint8ClampedArray) => {
        const c = Array.from(rgba.slice(0, 3), (v) => v / 255)
          .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
      };
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1, 1);
      const ancestors: Element[] = [];
      for (let node: Element | null = el; node; node = node.parentElement) ancestors.push(node);
      for (const node of ancestors.reverse()) {
        ctx.fillStyle = getComputedStyle(node).backgroundColor;
        ctx.fillRect(0, 0, 1, 1);
      }
      const background = luminance(ctx.getImageData(0, 0, 1, 1).data);
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = getComputedStyle(el).color;
      ctx.fillRect(0, 0, 1, 1);
      const foreground = luminance(ctx.getImageData(0, 0, 1, 1).data);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    }), { message: `${theme} accent badge contrast` }).toBeGreaterThanOrEqual(4.5);
  }
});

test('resolving a scrolled task does not displace surviving cards', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  let remaining = Array.from({ length: 5 }, (_, i) => ({
    id: `motion-task-${i}`, pseudo_id: `JISR-MOTION-${i}`, reason: '3 consecutive missed check-ins',
    call_outcome: null, call_note: null, contact_id: null, contact_label: null,
    contact_available: false, created_at: '2026-11-20T12:00:00Z',
  }));
  await page.route('**/api/navigator/queue', (route) => route.fulfill({ json: {
    cases: [], tasks: remaining, clock: { now: '2026-11-20T12:00:00Z', offset: '00:00:00' },
  } }));
  await page.route('**/api/navigator/tasks/*/call', (route) => {
    remaining = remaining.slice(0, -1);
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto('/navigator');
  const tasks = page.getByRole('region', { name: 'Escalation tasks', exact: true });
  await expect(tasks.locator('li')).toHaveCount(5);
  await expect.poll(() => tasks.locator('li').evaluateAll((els) =>
    els.every((el) => getComputedStyle(el).transform === 'none'),
  )).toBe(true);
  const lastCall = tasks.getByRole('button', { name: 'Log a human call', exact: true }).last();
  await lastCall.scrollIntoViewIfNeeded();
  expect(await tasks.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  const samples = tasks.evaluate(async (region) => {
    const contentY = (el: Element) => el.getBoundingClientRect().top + region.scrollTop - region.getBoundingClientRect().top;
    const survivors = Array.from(region.querySelectorAll('li')).slice(0, -1);
    const baseline = survivors.map(contentY);
    let maxDrift = 0;
    let sampledFrames = 0;
    for (let frame = 0; frame < 360; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (region.querySelectorAll('li').length !== 4) continue;
      maxDrift = Math.max(maxDrift, ...survivors.map((el, i) => Math.abs(contentY(el) - baseline[i])));
      if (++sampledFrames === 24) break;
    }
    return { maxDrift, sampledFrames };
  });
  await lastCall.click();
  await expect(tasks.locator('li')).toHaveCount(4);
  const result = await samples;
  expect(result.sampledFrames).toBe(24);
  expect(result.maxDrift).toBeLessThanOrEqual(1);
});

test('home hero copy has no additional entrance animation', async ({ page }) => {
  await page.goto('/');
  const copy = page.getByRole('heading', { level: 1 }).locator('..');
  expect(await copy.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
});
