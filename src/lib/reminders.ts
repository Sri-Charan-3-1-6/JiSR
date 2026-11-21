// Deterministic reminder rules — no AI, no randomness. The ladder is bounded:
// at most MAX_SENDS_PER_CHECKIN sends per check-in, then it always stops.

export interface ReminderPrefs {
  remindAt: string;
  quietStart: string;
  quietEnd: string;
  maxPerDay: number;
  snoozeMinutes: number;
  ladderGapMinutes: number;
  ladderMissLimit: number;
  vibration: boolean;
}

export const DEFAULT_PREFS: ReminderPrefs = {
  remindAt: '09:00',
  quietStart: '22:00',
  quietEnd: '08:00',
  maxPerDay: 3,
  snoozeMinutes: 30,
  ladderGapMinutes: 120,
  ladderMissLimit: 3,
  vibration: false,
};

export const MAX_SENDS_PER_CHECKIN = 3;

export type LadderAction =
  | 'reminder'
  | 'soft_reminder'
  | 'escalate'
  | 'stop'
  | 'skip_quiet'
  | 'skip_cap'
  | 'wait';

export interface CheckinLike {
  state: string;
  dueAt: Date;
  remindersSent: number;
  consecutiveMisses: number;
  snoozedUntil?: Date | null;
}

function minutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function inQuietHours(prefs: ReminderPrefs, at: Date): boolean {
  const start = minutesOfDay(prefs.quietStart);
  const end = minutesOfDay(prefs.quietEnd);
  if (start === end) return false;
  // Quiet hours are UTC-based so behavior never depends on the server's TZ.
  const now = at.getUTCHours() * 60 + at.getUTCMinutes();
  return start < end ? now >= start && now < end : now >= start || now < end;
}

export function capReached(sentToday: number, prefs: ReminderPrefs): boolean {
  return sentToday >= prefs.maxPerDay;
}

export function decide(
  checkin: CheckinLike,
  prefs: ReminderPrefs,
  now: Date,
  sentToday: number,
): { action: LadderAction; missed: boolean } {
  const wait = { action: 'wait' as const, missed: false };
  if (checkin.state === 'completed' || checkin.state === 'stopped') return wait;
  if (checkin.remindersSent >= MAX_SENDS_PER_CHECKIN) return { action: 'stop', missed: false };

  const effectiveDue =
    checkin.state === 'snoozed' && checkin.snoozedUntil ? checkin.snoozedUntil : checkin.dueAt;
  if (now < effectiveDue) return wait;
  if (inQuietHours(prefs, now)) return { action: 'skip_quiet', missed: false };
  if (capReached(sentToday, prefs)) return { action: 'skip_cap', missed: false };

  const gapMs = prefs.ladderGapMinutes * 60_000;
  if (checkin.remindersSent === 0) return { action: 'reminder', missed: false };
  if (checkin.remindersSent === 1) {
    if (now.getTime() < checkin.dueAt.getTime() + gapMs) return wait;
    return { action: 'soft_reminder', missed: true };
  }
  if (now.getTime() < checkin.dueAt.getTime() + 2 * gapMs) return wait;
  return checkin.consecutiveMisses >= prefs.ladderMissLimit
    ? { action: 'escalate', missed: false }
    : { action: 'stop', missed: false };
}

export function snoozedDue(now: Date, minutes: number): Date {
  return new Date(now.getTime() + minutes * 60_000);
}