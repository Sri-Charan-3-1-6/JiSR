import { describe, expect, it } from 'vitest';
import { score, bandFor } from '@/lib/scoring';

describe('PHQ-9 bands (0-4 minimal, 5-9 mild, 10-14 moderate, 15-19 moderately severe, 20-27 severe)', () => {
  const cases: Array<[number, string]> = [
    [0, 'minimal'], [4, 'minimal'],
    [5, 'mild'], [9, 'mild'],
    [10, 'moderate'], [14, 'moderate'],
    [15, 'moderately_severe'], [19, 'moderately_severe'],
    [20, 'severe'], [27, 'severe'],
  ];
  for (const [total, band] of cases) {
    it(`total ${total} -> ${band}`, () => {
      expect(bandFor('PHQ9', total)).toBe(band);
    });
  }

  it('scores a full answer array', () => {
    const answers = [2, 2, 2, 3, 2, 2, 2, 1, 2]; // 18
    const r = score('PHQ9', answers);
    expect(r.total).toBe(18);
    expect(r.band).toBe('moderately_severe');
  });

  it('rejects wrong answer count', () => {
    expect(() => score('PHQ9', [1, 2])).toThrow();
  });

  it('rejects out-of-range answers', () => {
    expect(() => score('PHQ9', [0, 0, 0, 0, 0, 0, 0, 0, 4])).toThrow();
    expect(() => score('PHQ9', [0, 0, 0, 0, 0, 0, 0, 0, -1])).toThrow();
  });
});

describe('GAD-7 bands (0-4 minimal, 5-9 mild, 10-14 moderate, 15-21 severe)', () => {
  const cases: Array<[number, string]> = [
    [0, 'minimal'], [4, 'minimal'],
    [5, 'mild'], [9, 'mild'],
    [10, 'moderate'], [14, 'moderate'],
    [15, 'severe'], [21, 'severe'],
  ];
  for (const [total, band] of cases) {
    it(`total ${total} -> ${band}`, () => {
      expect(bandFor('GAD7', total)).toBe(band);
    });
  }

  it('scores a full answer array', () => {
    const r = score('GAD7', [3, 3, 3, 3, 3, 3, 3]);
    expect(r.total).toBe(21);
    expect(r.band).toBe('severe');
  });

  it('GAD-7 has no moderately_severe band', () => {
    expect(bandFor('GAD7', 16)).toBe('severe');
  });
});