import { describe, expect, it } from 'vitest';
import { EMERGENCY_CONTACTS, EMERGENCY_SOURCE_DATE } from '@/config/emergency';

describe('emergency contacts (official Abu Dhabi numbers)', () => {
  it('lists the five verified numbers with correct tap-to-call digits', () => {
    expect(EMERGENCY_CONTACTS.map((c) => [c.key, c.number, c.tel])).toEqual([
      ['ambulance', '998', '998'],
      ['police', '999', '999'],
      ['istijaba', '800 1717', '8001717'],
      ['hope', '800 4673', '8004673'],
      ['sakina', '800 725462', '800725462'],
    ]);
  });

  it('every tel href is digits only and matches the displayed number', () => {
    for (const c of EMERGENCY_CONTACTS) {
      expect(c.tel).toMatch(/^\d+$/);
      expect(c.number.replace(/\s/g, '')).toBe(c.tel);
    }
  });

  it('contains no placeholder or verification-warning text', () => {
    const json = JSON.stringify(EMERGENCY_CONTACTS);
    expect(json).not.toMatch(/PLACEHOLDER|VERIFY WITH|placeholder/i);
  });

  it('records the official source date', () => {
    expect(EMERGENCY_SOURCE_DATE).toBe('2026-11-21');
  });
});