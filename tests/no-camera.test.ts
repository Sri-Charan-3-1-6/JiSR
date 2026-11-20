import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

// Hard rule: NO camera use and NO facial analysis anywhere in shipped code.
// This test searches the whole source tree and fails if any capture API or
// face-analysis reference appears.
const BANNED = /getUserMedia|mediaDevices|MediaRecorder|FaceDetector|face-api|facial/i;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|js|jsx|mjs|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('no camera or face-analysis code exists', () => {
  it('src/ and the service worker are free of capture APIs', () => {
    const files = [...sourceFiles(join(process.cwd(), 'src')), join(process.cwd(), 'public', 'sw.js')];
    const offenders = files.filter((f) => BANNED.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});