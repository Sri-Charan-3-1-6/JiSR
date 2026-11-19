import { describe, expect, it } from 'vitest';
import { matchSupport, nextState, STATE_ORDER } from '@/lib/matching';

describe('stepped matching rules for every tier', () => {
  it('minimal -> self-help + re-screen in 30 days', () => {
    const m = matchSupport('minimal');
    expect(m.options.map((o) => o.key)).toContain('self_help');
    expect(m.sla.followupDays).toBe(30);
    expect(m.sla.contactHours).toBeNull();
  });

  it('mild -> self-help + community support, check-in 14 days', () => {
    const m = matchSupport('mild');
    expect(m.options.map((o) => o.key)).toEqual(
      expect.arrayContaining(['self_help', 'community_support']),
    );
    expect(m.sla.contactHours).toBe(14 * 24);
  });

  it('moderate -> primary care or tele-mental health, contact within 7 days', () => {
    const m = matchSupport('moderate');
    expect(m.options.map((o) => o.key)).toEqual(
      expect.arrayContaining(['primary_care', 'tele_mental_health']),
    );
    expect(m.sla.contactHours).toBe(7 * 24);
  });

  for (const tier of ['moderately_severe', 'severe'] as const) {
    it(`${tier} -> specialist/tele, contact 24h, appointment 72h`, () => {
      const m = matchSupport(tier);
      expect(m.options.map((o) => o.key)).toEqual(
        expect.arrayContaining(['specialist', 'tele_mental_health']),
      );
      expect(m.sla.contactHours).toBe(24);
      expect(m.sla.bookHours).toBe(72);
    });
  }

  it('crisis -> human immediately', () => {
    const m = matchSupport('crisis');
    expect(m.options[0].key).toBe('human_immediately');
    expect(m.sla.contactHours).toBe(0);
  });

  it('every option exposes eligibility and hand-off in plain words', () => {
    for (const tier of ['minimal', 'mild', 'moderate', 'moderately_severe', 'severe', 'crisis'] as const) {
      for (const opt of matchSupport(tier).options) {
        expect(opt.eligibility.length).toBeGreaterThan(10);
        expect(opt.handoff.length).toBeGreaterThan(10);
      }
    }
  });

  it('every tier explains "why this suggestion"', () => {
    for (const tier of ['minimal', 'mild', 'moderate', 'moderately_severe', 'severe', 'crisis'] as const) {
      expect(matchSupport(tier).why.length).toBeGreaterThan(20);
    }
  });
});

describe('case state machine', () => {
  it('walks SCREENED -> ... -> FOLLOWED_UP_30D in order', () => {
    let state: (typeof STATE_ORDER)[number] = 'SCREENED';
    const visited: string[] = [state];
    while (nextState(state)) {
      state = nextState(state)!;
      visited.push(state);
    }
    expect(visited).toEqual([...STATE_ORDER]);
  });

  it('has no state after FOLLOWED_UP_30D', () => {
    expect(nextState('FOLLOWED_UP_30D')).toBeNull();
  });
});