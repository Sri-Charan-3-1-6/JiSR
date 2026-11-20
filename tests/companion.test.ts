import { describe, expect, it } from 'vitest';
import {
  COMPANION_TREE,
  SESSION_STEP_CAP,
  scanFreeText,
  sessionOver,
} from '@/lib/companion';

describe('scripted companion tree (no LLM, no external calls)', () => {
  it('every option points at an existing node', () => {
    for (const node of Object.values(COMPANION_TREE)) {
      for (const opt of node.options) {
        expect(COMPANION_TREE[opt.next], `${node.id} -> ${opt.next}`).toBeDefined();
      }
    }
  });

  it('every node is reachable from start', () => {
    const seen = new Set<string>(['start']);
    const queue = ['start'];
    while (queue.length) {
      const node = COMPANION_TREE[queue.shift()!];
      for (const opt of node.options) {
        if (!seen.has(opt.next)) {
          seen.add(opt.next);
          queue.push(opt.next);
        }
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(COMPANION_TREE).sort());
  });

  it('has terminal outcomes for calm, human and check-in', () => {
    const terminals = Object.values(COMPANION_TREE)
      .filter((n) => n.terminal)
      .map((n) => n.terminal)
      .sort();
    expect(terminals).toEqual(['calm', 'checkin', 'human']);
  });

  it('offers one optional free-text node', () => {
    const free = Object.values(COMPANION_TREE).filter((n) => n.freeText);
    expect(free.length).toBe(1);
  });

  it('contains no URLs or model references (fully local script)', () => {
    const json = JSON.stringify(COMPANION_TREE);
    expect(json).not.toMatch(/https?:|openai|openrouter|llm|gpt/i);
  });

  it('caps session length', () => {
    expect(SESSION_STEP_CAP).toBe(8);
    expect(sessionOver(7)).toBe(false);
    expect(sessionOver(8)).toBe(true);
    expect(sessionOver(99)).toBe(true);
  });
});

describe('local crisis keyword scan (never leaves the device)', () => {
  it('flags English crisis keywords', () => {
    expect(scanFreeText('I want to die')).toEqual({ crisis: true, reason: 'keyword' });
    expect(scanFreeText('thinking about self-harm')).toEqual({ crisis: true, reason: 'keyword' });
  });

  it('flags Arabic crisis keywords', () => {
    expect(scanFreeText('أريد أن أموت').crisis).toBe(true);
  });

  it('flags Hindi crisis keywords', () => {
    expect(scanFreeText('मरना चाहता हूँ').crisis).toBe(true);
  });

  it('does not flag benign text or empty input', () => {
    expect(scanFreeText('had a tough day at work')).toEqual({ crisis: false, reason: null });
    expect(scanFreeText('')).toEqual({ crisis: false, reason: null });
  });
});