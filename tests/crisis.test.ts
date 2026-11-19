import { describe, expect, it } from 'vitest';
import { detectCrisis } from '@/lib/crisis';

const zeros = Array(9).fill(0);

describe('PHQ-9 item 9 crisis trigger (fixed rule, no AI)', () => {
  it('item 9 = 0 does not trigger', () => {
    expect(detectCrisis('PHQ9', zeros).crisis).toBe(false);
  });
  for (const v of [1, 2, 3]) {
    it(`item 9 = ${v} triggers crisis with reason item9`, () => {
      const answers = [...zeros];
      answers[8] = v;
      const r = detectCrisis('PHQ9', answers);
      expect(r.crisis).toBe(true);
      expect(r.reason).toBe('item9');
    });
  }
  it('item 9 trigger fires even when total score is minimal', () => {
    const answers = [...zeros];
    answers[8] = 1; // total 1 => minimal band, but still crisis
    expect(detectCrisis('PHQ9', answers).crisis).toBe(true);
  });
  it('GAD-7 has no item 9 rule', () => {
    expect(detectCrisis('GAD7', Array(7).fill(3)).crisis).toBe(false);
  });
});

describe('keyword crisis trigger in free text', () => {
  it('detects English keywords case-insensitively', () => {
    const r = detectCrisis('PHQ9', zeros, 'Sometimes I think about SUICIDE');
    expect(r.crisis).toBe(true);
    expect(r.reason).toBe('keyword');
  });
  it('detects "kill myself"', () => {
    expect(detectCrisis('GAD7', Array(7).fill(0), 'I want to kill myself').crisis).toBe(true);
  });
  it('detects Arabic keywords', () => {
    expect(detectCrisis('PHQ9', zeros, 'أفكر في انتحار').crisis).toBe(true);
  });
  it('detects Hindi keywords', () => {
    expect(detectCrisis('PHQ9', zeros, 'मैं आत्महत्या के बारे में सोचता हूँ').crisis).toBe(true);
  });
  it('does not trigger on ordinary text', () => {
    expect(detectCrisis('PHQ9', zeros, 'feeling a bit low and tired').crisis).toBe(false);
  });
  it('handles null/empty free text', () => {
    expect(detectCrisis('PHQ9', zeros, null).crisis).toBe(false);
    expect(detectCrisis('PHQ9', zeros, '').crisis).toBe(false);
  });
});