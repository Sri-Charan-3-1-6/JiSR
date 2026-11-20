import { NextRequest, NextResponse } from 'next/server';
import { one, query, simNow } from '@/lib/db';
import { DEFAULT_PREFS, type ReminderPrefs } from '@/lib/reminders';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

async function loadPrefs(residentId: string): Promise<ReminderPrefs> {
  const row = await one<Record<string, unknown>>(
    `select remind_at::text as remind_at, quiet_start::text as quiet_start,
            quiet_end::text as quiet_end, max_per_day, snooze_minutes,
            ladder_gap_minutes, ladder_miss_limit, vibration
     from reminder_prefs where resident_id = $1`,
    [residentId],
  );
  if (!row) return DEFAULT_PREFS;
  return {
    remindAt: String(row.remind_at).slice(0, 5),
    quietStart: String(row.quiet_start).slice(0, 5),
    quietEnd: String(row.quiet_end).slice(0, 5),
    maxPerDay: Number(row.max_per_day),
    snoozeMinutes: Number(row.snooze_minutes),
    ladderGapMinutes: Number(row.ladder_gap_minutes),
    ladderMissLimit: Number(row.ladder_miss_limit),
    vibration: Boolean(row.vibration),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const consent = await one<{ granted: boolean }>(
    `select granted from consent_scopes where resident_id = $1 and scope = 'reminders'`,
    [id],
  );
  const prefs = await loadPrefs(id);
  return NextResponse.json({ prefs, consent: Boolean(consent?.granted), defaults: DEFAULT_PREFS });
}

// The user owns their schedule. Nothing is forced: saving is optional and
// the reminders consent scope is the master switch.
export async function PUT(
  req: NextRequest,
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
  const body = await req.json();
  const prefs: ReminderPrefs = { ...DEFAULT_PREFS, ...body };
  if (
    !TIME_RE.test(prefs.remindAt) ||
    !TIME_RE.test(prefs.quietStart) ||
    !TIME_RE.test(prefs.quietEnd) ||
    !Number.isInteger(prefs.maxPerDay) || prefs.maxPerDay < 1 || prefs.maxPerDay > 10 ||
    !Number.isInteger(prefs.snoozeMinutes) || prefs.snoozeMinutes < 5 || prefs.snoozeMinutes > 240 ||
    !Number.isInteger(prefs.ladderGapMinutes) || prefs.ladderGapMinutes < 15 || prefs.ladderGapMinutes > 1440 ||
    !Number.isInteger(prefs.ladderMissLimit) || prefs.ladderMissLimit < 2 || prefs.ladderMissLimit > 7
  ) {
    return NextResponse.json({ error: 'Invalid reminder preferences' }, { status: 400 });
  }
  const now = await simNow();
  const rows = await query(
    `insert into reminder_prefs
       (resident_id, remind_at, quiet_start, quiet_end, max_per_day, snooze_minutes,
        ladder_gap_minutes, ladder_miss_limit, vibration, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (resident_id) do update set
       remind_at = excluded.remind_at, quiet_start = excluded.quiet_start,
       quiet_end = excluded.quiet_end, max_per_day = excluded.max_per_day,
       snooze_minutes = excluded.snooze_minutes, ladder_gap_minutes = excluded.ladder_gap_minutes,
       ladder_miss_limit = excluded.ladder_miss_limit, vibration = excluded.vibration,
       updated_at = excluded.updated_at
     returning resident_id`,
    [id, prefs.remindAt, prefs.quietStart, prefs.quietEnd, prefs.maxPerDay,
     prefs.snoozeMinutes, prefs.ladderGapMinutes, prefs.ladderMissLimit,
     Boolean(prefs.vibration), now],
  );
  return NextResponse.json({ prefs, saved: Boolean(rows[0]) });
}