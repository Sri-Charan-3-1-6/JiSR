import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const BASE = process.env.LH_BASE_URL;
const PREFIX = process.env.LH_PREFIX || 'layer5-preview';
const CHROME = '/c/Program Files/Google/Chrome/Application/chrome.exe';
const routes = [
  ['home', '/'],
  ['resident', '/resident'],
  ['navigator', '/navigator'],
  ['health-system', '/health-system'],
  ['employer', '/employer'],
];
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const summary = {};

for (const [name, path] of routes) {
  const perf = [];
  const a11y = [];
  const files = [];
  for (let i = 1; i <= 3; i++) {
    const out = `docs/lighthouse/${PREFIX}-${name}-mobile-run${i}.json`;
    const r = spawnSync('npx', [
      '--yes', 'lighthouse@12', `${BASE}${path}`,
      '--output=json', `--output-path=${out}`,
      '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
      '--form-factor=mobile', '--screenEmulation.mobile',
      '--only-categories=performance,accessibility', '--quiet',
    ], { env: { ...process.env, CHROME_PATH: CHROME }, encoding: 'utf8', shell: true });
    if (r.status !== 0) {
      console.error(`${name} run${i} FAILED`, r.stderr?.slice(-500));
      process.exit(1);
    }
    const j = JSON.parse(readFileSync(out, 'utf8'));
    const p = Math.round(j.categories.performance.score * 100);
    const a = Math.round(j.categories.accessibility.score * 100);
    perf.push(p); a11y.push(a); files.push(out);
    console.log(`${name} run${i}: perf ${p} a11y ${a}`);
  }
  const mp = median(perf);
  const ma = median(a11y);
  const medIdx = perf.indexOf(mp);
  copyFileSync(files[medIdx], `docs/lighthouse/${PREFIX}-${name}-mobile.json`);
  summary[name] = { perfRuns: perf, a11yRuns: a11y, perfMedian: mp, a11yMedian: ma, pass: mp >= 85 && ma >= 95 };
}

writeFileSync(`docs/lighthouse/${PREFIX}-summary.json`, JSON.stringify(summary, null, 2) + '\n');
console.log('\n=== MEDIAN GATES (perf>=85, a11y>=95) ===');
for (const [name, s] of Object.entries(summary)) {
  console.log(`${name.padEnd(14)} perf ${s.perfMedian} (runs ${s.perfRuns}) a11y ${s.a11yMedian} (runs ${s.a11yRuns}) ${s.pass ? 'PASS' : 'FAIL'}`);
}
const allPass = Object.values(summary).every((s) => s.pass);
console.log(allPass ? 'ALL GATES PASS' : 'GATE FAILURE');
process.exit(allPass ? 0 : 2);