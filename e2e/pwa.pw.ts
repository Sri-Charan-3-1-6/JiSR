import { test, expect } from '@playwright/test';

const pngSize = (buf: Buffer) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

test('installable PWA: manifest, icons, service worker, offline app shell and demo', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null))
    .toContain('/sw.js');

  const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/');
  expect(manifest.name).toContain('JISR');
  expect(manifest.theme_color).toBeTruthy();
  const sizes = manifest.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`);
  expect(sizes).toContain('192x192:any');
  expect(sizes).toContain('512x512:any');
  expect(sizes).toContain('512x512:maskable');

  for (const [path, dim] of [
    ['/icons/icon-192.png', 192],
    ['/icons/icon-512.png', 512],
    ['/icons/icon-maskable-512.png', 512],
  ] as const) {
    const res = await page.request.get(path);
    expect(res.status()).toBe(200);
    const size = pngSize(Buffer.from(await res.body()));
    expect(size).toEqual({ w: dim, h: dim });
  }

  // Reload once online while controlled so every shell asset passes the SW,
  // and walk the story once so its page chunks are cached, then go offline.
  await page.reload();
  await page.getByRole('button', { name: 'Demo mode', exact: true }).click();
  const warmGuide = page.getByRole('region', { name: 'Demo guide' });
  await warmGuide.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('PHQ-9 score: 10')).toBeVisible();
  await warmGuide.getByRole('button', { name: 'Reset demo' }).click();
  await page.waitForTimeout(1500);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('link', { name: 'JISR' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Demo mode', exact: true })).toBeVisible();

  // The seeded demo story runs fully offline.
  await page.getByRole('button', { name: 'Demo mode', exact: true }).click();
  const guide = page.getByRole('region', { name: 'Demo guide' });
  await expect(guide.getByText('Step 1 of 6')).toBeVisible();
  await guide.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('PHQ-9 score: 10')).toBeVisible();
  await expect(page.getByText('moderate level of symptoms')).toBeVisible();
  await guide.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page).toHaveURL(/\/$/);

  await context.setOffline(false);
});