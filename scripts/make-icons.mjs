import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = 'public/icons';
mkdirSync(OUT, { recursive: true });

const svg = (px) => `
<svg width="${px}" height="${px}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="4" y1="40" x2="44" y2="8" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0e7c74"/><stop offset="1" stop-color="#5b5bd6"/>
    </linearGradient>
  </defs>
  <path d="M6 38 C6 18 18 8 24 8 C30 8 42 18 42 38" stroke="url(#g)" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M4 38 H44" stroke="url(#g)" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M15 38 V27 M24 38 V20 M33 38 V27" stroke="url(#g)" stroke-width="3" stroke-linecap="round" opacity="0.55"/>
</svg>`;

const variants = [
  { file: 'icon-192.png', size: 192, scale: 0.72 },
  { file: 'icon-512.png', size: 512, scale: 0.72 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.56 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.72 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const v of variants) {
  await page.setViewportSize({ width: v.size, height: v.size });
  await page.setContent(
    `<body style="margin:0"><div id="i" style="width:${v.size}px;height:${v.size}px;background:#ffffff;display:flex;align-items:center;justify-content:center">${svg(Math.round(v.size * v.scale))}</div></body>`,
  );
  await page.locator('#i').screenshot({ path: `${OUT}/${v.file}` });
  console.log(`wrote ${OUT}/${v.file} (${v.size}x${v.size})`);
}
await browser.close();