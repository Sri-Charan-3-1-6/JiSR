import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { ProgressRing } from '@/components/ui/progress-ring';

function luminance(hex: string) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('accessible visual foundation', () => {
  it.each(['light', 'dark'])('%s semantic text colors meet WCAG AA', (theme) => {
    const css = readFileSync('src/app/globals.css', 'utf8');
    const block = theme === 'light' ? css.match(/:root \{([^}]+)\}/)![1] : css.match(/html\[data-theme="dark"\] \{([^}]+)\}/)![1];
    const tokens = Object.fromEntries([...block.matchAll(/--([\w-]+): (#[\da-f]{6});/gi)].map((m) => [m[1], m[2]]));
    for (const [text, background] of [
      ['foreground', 'background'], ['foreground', 'card'],
      ['muted', 'background'], ['muted', 'card'], ['muted', 'surface-2'],
      ['primary', 'background'], ['primary-strong', 'card'],
      ['primary-foreground', 'primary'], ['primary-foreground', 'primary-strong'],
      ['accent', 'background'], ['accent', 'card'],
      ['danger', 'danger-soft'], ['warning', 'warning-soft'], ['success', 'success-soft'],
    ]) {
      expect(contrast(tokens[text], tokens[background]), `${theme}: ${text} on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('activating the redesigned app shell removes the old palette cache', async () => {
    const handlers = new Map<string, (event: { waitUntil: (work: Promise<unknown>) => void }) => void>();
    const deleted: string[] = [];
    runInNewContext(readFileSync('public/sw.js', 'utf8'), {
      self: {
        addEventListener: (name: string, handler: (event: { waitUntil: (work: Promise<unknown>) => void }) => void) => handlers.set(name, handler),
        clients: { claim: async () => {} },
      },
      caches: {
        keys: async () => ['jisr-shell-v1'],
        delete: async (key: string) => { deleted.push(key); return true; },
      },
    });
    let activation!: Promise<unknown>;
    handlers.get('activate')!({ waitUntil: (work) => { activation = work; } });
    await activation;
    expect(deleted).toContain('jisr-shell-v1');
  });

  it('multiple score rings reference distinct gradients', () => {
    const props = { value: 5, max: 27, label: '5', sublabel: 'PHQ-9' };
    const html = renderToStaticMarkup(createElement('div', null,
      createElement(ProgressRing, props), createElement(ProgressRing, props),
    ));
    const ids = [...html.matchAll(/<linearGradient id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(html).toContain(`url(#${id})`);
  });
});
