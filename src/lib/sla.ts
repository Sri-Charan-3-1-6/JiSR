import { matchSupport, type RiskTier } from './matching';

export interface SlaDeadlines {
  contactDue: Date | null;
  bookDue: Date | null;
  attendDue: Date | null;
  followupDue: Date | null;
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export function computeDeadlines(tier: RiskTier, createdAt: Date): SlaDeadlines {
  const { sla } = matchSupport(tier);
  return {
    contactDue: sla.contactHours !== null ? new Date(createdAt.getTime() + sla.contactHours * HOUR) : null,
    bookDue: sla.bookHours !== null ? new Date(createdAt.getTime() + sla.bookHours * HOUR) : null,
    attendDue: null,
    followupDue: sla.followupDays !== null ? new Date(createdAt.getTime() + sla.followupDays * DAY) : null,
  };
}

export interface MilestoneStatus {
  milestone: 'contact' | 'book' | 'attend' | 'followup';
  due: Date;
}

// First pending (not yet reached) milestone with a deadline.
export function nextPendingMilestone(
  deadlines: SlaDeadlines,
  reached: { contactedAt: Date | null; bookedAt: Date | null; attendedAt: Date | null; followedUpAt: Date | null },
): MilestoneStatus | null {
  const ordered: Array<{ milestone: MilestoneStatus['milestone']; due: Date | null; done: Date | null }> = [
    { milestone: 'contact', due: deadlines.contactDue, done: reached.contactedAt },
    { milestone: 'book', due: deadlines.bookDue, done: reached.bookedAt },
    { milestone: 'attend', due: deadlines.attendDue, done: reached.attendedAt },
    { milestone: 'followup', due: deadlines.followupDue, done: reached.followedUpAt },
  ];
  for (const m of ordered) {
    if (m.due && !m.done) return { milestone: m.milestone, due: m.due };
  }
  return null;
}

export function isOverdue(
  deadlines: SlaDeadlines,
  reached: { contactedAt: Date | null; bookedAt: Date | null; attendedAt: Date | null; followedUpAt: Date | null },
  now: Date,
): boolean {
  const next = nextPendingMilestone(deadlines, reached);
  return next !== null && now.getTime() > next.due.getTime();
}