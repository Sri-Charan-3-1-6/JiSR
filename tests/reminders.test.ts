import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFS,
  MAX_SENDS_PER_CHECKIN,
  capReached,
  decide,
  inQuietHours,
  snoozedDue,
  type ReminderPrefs,
} from '@/lib/reminders';

const prefs: ReminderPrefs = { ...DEFAULT_PREFS };
const at = (h: number, m = 0) => new Date(2026, 0, 5, h, m, 0);
const due = at(9);
const base = { state: 'pending', dueAt: due, remindersSent: 0, consecutiveMisses: 0 };

describe('quiet hours', () => {
  it('wraps around midnight (22:00-08:00)', () => {
    expect(inQuietHours(prefs, at(23, 30))).toBe(true);
    expect(inQuietHours(prefs, at(0, 30))).toBe(true);
    expect(inQuietHours(prefs, at(7, 59))).toBe(true);
    expect(inQuietHours(prefs, at(8, 0))).toBe(false);
    expect(inQuietHours(prefs, at(12))).toBe(false);
    expect(inQuietHours(prefs, at(22, 0))).toBe(true);
  });

  it('handles a same-day window (01:00-05:00)', () => {
    const p = { ...prefs, quietStart: '01:00', quietEnd: '05:00' };
    expect(inQuietHours(p, at(2))).toBe(true);
    expect(inQuietHours(p, at(0, 30))).toBe(false);
    expect(inQuietHours(p, at(6))).toBe(false);
  });

  it('equal start and end means no quiet window', () => {
    const p = { ...prefs, quietStart: '08:00', quietEnd: '08:00' };
    expect(inQuietHours(p, at(8))).toBe(false);
    expect(inQuietHours(p, at(23))).toBe(false);
  });
});

describe('daily cap', () => {
  it('stops at max_per_day', () => {
    expect(capReached(0, prefs)).toBe(false);
    expect(capReached(2, prefs)).toBe(false);
    expect(capReached(3, prefs)).toBe(true);
    expect(capReached(9, prefs)).toBe(true);
  });
});

describe('persistence ladder (bounded, never loops)', () => {
  it('sends the first reminder at due time', () => {
    const r = decide(base, prefs, at(9, 1), 0);
    expect(r).toEqual({ action: 'reminder', missed: false });
  });

  it('waits before due time', () => {
    expect(decide(base, prefs, at(8, 59), 0).action).toBe('wait');
  });

  it('waits between the reminder and the soft gap', () => {
    const r = decide({ ...base, remindersSent: 1 }, prefs, at(10, 59), 1);
    expect(r.action).toBe('wait');
  });

  it('marks missed and sends the soft reminder after the gap', () => {
    const r = decide({ ...base, remindersSent: 1 }, prefs, at(11, 0), 1);
    expect(r).toEqual({ action: 'soft_reminder', missed: true });
  });

  it('escalates to a human task once the miss limit is reached', () => {
    const r = decide(
      { ...base, state: 'missed', remindersSent: 2, consecutiveMisses: prefs.ladderMissLimit },
      prefs,
      at(13, 0),
      2,
    );
    expect(r).toEqual({ action: 'escalate', missed: false });
  });

  it('stops after the limit when the streak is below the miss limit', () => {
    const r = decide(
      { ...base, state: 'missed', remindersSent: 2, consecutiveMisses: 1 },
      prefs,
      at(13, 0),
      2,
    );
    expect(r.action).toBe('stop');
  });

  it('never sends a fourth reminder for one check-in', () => {
    expect(MAX_SENDS_PER_CHECKIN).toBe(3);
    const r = decide(
      { ...base, state: 'missed', remindersSent: 3, consecutiveMisses: 9 },
      prefs,
      at(23, 0),
      0,
    );
    expect(r.action).toBe('stop');
  });

  it('skips inside quiet hours without marking missed', () => {
    const p = { ...prefs, quietStart: '00:00', quietEnd: '23:59' };
    const r = decide({ ...base, remindersSent: 1 }, p, at(12), 0);
    expect(r).toEqual({ action: 'skip_quiet', missed: false });
  });

  it('skips when the daily cap is reached', () => {
    const r = decide(base, prefs, at(9, 1), prefs.maxPerDay);
    expect(r).toEqual({ action: 'skip_cap', missed: false });
  });

  it('respects snooze: waits until snoozed_until, then resumes', () => {
    const snoozed = { ...base, state: 'snoozed', snoozedUntil: at(10) };
    expect(decide(snoozed, prefs, at(9, 30), 0).action).toBe('wait');
    expect(decide(snoozed, prefs, at(10, 0), 0).action).toBe('reminder');
  });

  it('does nothing for completed or stopped check-ins', () => {
    expect(decide({ ...base, state: 'completed' }, prefs, at(12), 0).action).toBe('wait');
    expect(decide({ ...base, state: 'stopped' }, prefs, at(12), 0).action).toBe('wait');
  });

  it('computes snooze deadlines', () => {
    expect(snoozedDue(at(9), 30).getTime()).toBe(at(9, 30).getTime());
  });
});