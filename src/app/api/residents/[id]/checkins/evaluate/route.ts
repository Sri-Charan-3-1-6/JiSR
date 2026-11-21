import { NextRequest, NextResponse } from 'next/server';
import { one, query, simNow } from '@/lib/db';
import { DEFAULT_PREFS, decide, type ReminderPrefs } from '@/lib/reminders';

interface CheckinRow {
  id: string;
  state: string;
  due_at: Date;
  reminders_sent: number;
  consecutive_misses: number;
  snoozed_until: Date | null;
}

// Sweeps the resident's open check-ins against sim_now() and advances the
// bounded persistence ladder: reminder -> soft reminder -> human task, then
// stop. Quiet hours and the daily cap skip sends without marking misses.
// Revoked consent stops everything (403 before any read or write).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const consent = await one<{ granted: boolean }>(
    `select granted from consent_scopes where resident_id = $1 and scope = 'reminders'`,
    [id],
  );
  if (!consent?.granted) {
    return NextResponse.json(
      { error: 'Reminders consent required', consentRequired: true },
      { status: 403 },
    );
  }
  const now = await simNow();
  const p = await one<Record<string, unknown>>(
    `select remind_at::text as remind_at, quiet_start::text as quiet_start,
            quiet_end::text as quiet_end, max_per_day, snooze_minutes,
            ladder_gap_minutes, ladder_miss_limit, vibration
     from reminder_prefs where resident_id = $1`,
    [id],
  );
  const prefs: ReminderPrefs = p
    ? {
        remindAt: String(p.remind_at).slice(0, 5),
        quietStart: String(p.quiet_start).slice(0, 5),
        quietEnd: String(p.quiet_end).slice(0, 5),
        maxPerDay: Number(p.max_per_day),
        snoozeMinutes: Number(p.snooze_minutes),
        ladderGapMinutes: Number(p.ladder_gap_minutes),
        ladderMissLimit: Number(p.ladder_miss_limit),
        vibration: Boolean(p.vibration),
      }
    : DEFAULT_PREFS;

  // Both sides are pinned to UTC: a bare $2::date would parse the client-local
  // calendar date out of node-pg's serialized timestamp, while created_at::date
  // uses the session timezone — they disagree whenever local date != UTC date.
  const cap = await one<{ n: number }>(
    `select count(*)::int as n from reminder_events
     where resident_id = $1 and kind in ('reminder','soft_reminder')
       and (created_at at time zone 'UTC')::date = (($2::timestamptz) at time zone 'UTC')::date`,
    [id, now],
  );
  let sentToday = cap?.n ?? 0;

  const rows = await query<CheckinRow>(
    `select id, state, due_at, reminders_sent, consecutive_misses, snoozed_until
     from checkins
     where resident_id = $1 and state in ('pending','snoozed','missed')
     order by due_at`,
    [id],
  );

  const events: Record<string, unknown>[] = [];
  const tasks: Record<string, unknown>[] = [];

  const addEvent = async (checkinId: string | null, kind: string, note: string | null) => {
    const inserted = await query(
      `insert into reminder_events (resident_id, checkin_id, kind, note, created_at)
       values ($1, $2, $3, $4, $5) returning *`,
      [id, checkinId, kind, note, now],
    );
    events.push(inserted[0]);
  };

  for (const row of rows) {
    const { action, missed } = decide(
      {
        state: row.state,
        dueAt: row.due_at,
        remindersSent: row.reminders_sent,
        consecutiveMisses: row.consecutive_misses,
        snoozedUntil: row.snoozed_until,
      },
      prefs,
      now,
      sentToday,
    );
    if (action === 'wait') continue;
    if (action === 'skip_quiet') {
      await addEvent(row.id, 'skipped_quiet_hours', 'Quiet hours — no reminder sent.');
      continue;
    }
    if (action === 'skip_cap') {
      await addEvent(row.id, 'skipped_daily_cap', 'Daily reminder limit reached.');
      continue;
    }
    if (action === 'reminder') {
      await query(`update checkins set reminders_sent = reminders_sent + 1 where id = $1`, [row.id]);
      await addEvent(row.id, 'reminder', 'Check-in reminder.');
      sentToday++;
      continue;
    }
    if (action === 'soft_reminder' && missed) {
      // Streak spans check-ins: the previous check-in is the latest one due
      // before this one; a completed check-in resets the streak to zero.
      const prev = await one<{ consecutive_misses: number; missed_at: Date | null }>(
        `select consecutive_misses, missed_at from checkins
         where resident_id = $1 and id <> $2 and due_at < $3
           and state in ('missed','stopped','completed')
         order by due_at desc limit 1`,
        [id, row.id, row.due_at],
      );
      const streak = (prev?.missed_at ? prev.consecutive_misses : 0) + 1;
      await query(
        `update checkins
         set state = 'missed', missed_at = $2, consecutive_misses = $3,
             reminders_sent = reminders_sent + 1
         where id = $1`,
        [row.id, now, streak],
      );
      await addEvent(row.id, 'missed', 'Check-in missed.');
      await addEvent(row.id, 'soft_reminder', 'Gentle second reminder.');
      sentToday++;
      continue;
    }
    if (action === 'escalate') {
      const open = await one(
        `select 1 from navigator_tasks
         where resident_id = $1 and kind = 'checkin_escalation' and resolved_at is null`,
        [id],
      );
      if (open) {
        await query(`update checkins set state = 'stopped' where id = $1`, [row.id]);
        await addEvent(row.id, 'stopped', 'A navigator task is already open.');
        continue;
      }
      const reason = `${row.consecutive_misses} consecutive missed check-ins`;
      const inserted = await query(
        `insert into navigator_tasks
           (resident_id, case_id, kind, reason, consecutive_misses, created_at)
         values ($1,
           (select c.id from cases c where c.resident_id = $1
            order by c.created_at desc limit 1),
           'checkin_escalation', $2, $3, $4)
         returning *`,
        [id, reason, row.consecutive_misses, now],
      );
      tasks.push(inserted[0]);
      await query(
        `update checkins set state = 'stopped', reminders_sent = reminders_sent + 1 where id = $1`,
        [row.id],
      );
      await addEvent(row.id, 'escalated', reason);
      await addEvent(row.id, 'stopped', 'Reminder ladder stopped after escalation.');
      continue;
    }
    // action === 'stop': the ladder is exhausted for this check-in.
    await query(`update checkins set state = 'stopped' where id = $1`, [row.id]);
    await addEvent(row.id, 'stopped', 'Reminder ladder stopped after its limit.');
  }

  return NextResponse.json({ events, tasks });
}