import { describe, expect, it } from 'vitest';
import { computeDeadlines, isOverdue, nextPendingMilestone } from '@/lib/sla';

const t0 = new Date('2026-01-01T00:00:00Z');
const none = { contactedAt: null, bookedAt: null, attendedAt: null, followedUpAt: null };
const H = 3600_000;

describe('SLA deadlines by tier', () => {
  it('crisis: contact due immediately', () => {
    const d = computeDeadlines('crisis', t0);
    expect(d.contactDue!.getTime()).toBe(t0.getTime());
    expect(isOverdue(d, none, new Date(t0.getTime() + 1000))).toBe(true);
  });

  it('severe: contact 24h, book 72h', () => {
    const d = computeDeadlines('severe', t0);
    expect(d.contactDue!.getTime()).toBe(t0.getTime() + 24 * H);
    expect(d.bookDue!.getTime()).toBe(t0.getTime() + 72 * H);
    expect(isOverdue(d, none, new Date(t0.getTime() + 23 * H))).toBe(false);
    expect(isOverdue(d, none, new Date(t0.getTime() + 25 * H))).toBe(true);
  });

  it('contact on time removes the contact SLA; book SLA still applies', () => {
    const d = computeDeadlines('severe', t0);
    const reached = { ...none, contactedAt: new Date(t0.getTime() + 20 * H) };
    expect(nextPendingMilestone(d, reached)!.milestone).toBe('book');
    expect(isOverdue(d, reached, new Date(t0.getTime() + 71 * H))).toBe(false);
    expect(isOverdue(d, reached, new Date(t0.getTime() + 73 * H))).toBe(true);
  });

  it('moderate: contact 7 days', () => {
    const d = computeDeadlines('moderate', t0);
    expect(isOverdue(d, none, new Date(t0.getTime() + 6 * 24 * H))).toBe(false);
    expect(isOverdue(d, none, new Date(t0.getTime() + 8 * 24 * H))).toBe(true);
  });

  it('mild: check-in 14 days', () => {
    const d = computeDeadlines('mild', t0);
    expect(isOverdue(d, none, new Date(t0.getTime() + 13 * 24 * H))).toBe(false);
    expect(isOverdue(d, none, new Date(t0.getTime() + 15 * 24 * H))).toBe(true);
  });

  it('minimal: re-screen 30 days', () => {
    const d = computeDeadlines('minimal', t0);
    expect(d.contactDue).toBeNull();
    expect(nextPendingMilestone(d, none)!.milestone).toBe('followup');
    expect(isOverdue(d, none, new Date(t0.getTime() + 29 * 24 * H))).toBe(false);
    expect(isOverdue(d, none, new Date(t0.getTime() + 31 * 24 * H))).toBe(true);
  });

  it('fully followed-up case is never overdue', () => {
    const d = computeDeadlines('severe', t0);
    const all = {
      contactedAt: new Date(t0.getTime() + H),
      bookedAt: new Date(t0.getTime() + 2 * H),
      attendedAt: new Date(t0.getTime() + 3 * H),
      followedUpAt: new Date(t0.getTime() + 4 * H),
    };
    expect(isOverdue(d, all, new Date(t0.getTime() + 1000 * 24 * H))).toBe(false);
  });
});