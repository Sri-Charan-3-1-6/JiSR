import { NextRequest, NextResponse } from 'next/server';
import { one, query, simNow } from '@/lib/db';
import { DEFAULT_PREFS, snoozedDue } from '@/lib/reminders';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const checkin = await one<{ resident_id: string; state: string }>(
    `select resident_id, state from checkins where id = $1`,
    [id],
  );
  if (!checkin) return NextResponse.json({ error: 'Check-in not found' }, { status: 404 });
  const consent = await one<{ granted: boolean }>(
    `select granted from consent_scopes where resident_id = $1 and scope = 'reminders'`,
    [checkin.resident_id],
  );
  if (!consent?.granted) {
    return NextResponse.json(
      { error: 'Reminders consent required', consentRequired: true },
      { status: 403 },
    );
  }
  if (checkin.state !== 'pending' && checkin.state !== 'snoozed') {
    return NextResponse.json({ error: 'Only open check-ins can be snoozed' }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const pref = await one<{ snooze_minutes: number }>(
    `select snooze_minutes from reminder_prefs where resident_id = $1`,
    [checkin.resident_id],
  );
  const minutes = Number(body.minutes ?? pref?.snooze_minutes ?? DEFAULT_PREFS.snoozeMinutes);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 240) {
    return NextResponse.json({ error: 'minutes must be an integer 5-240' }, { status: 400 });
  }
  const now = await simNow();
  const due = snoozedDue(now, minutes);
  const rows = await query(
    `update checkins set state = 'snoozed', snoozed_until = $2, due_at = $2 where id = $1 returning *`,
    [id, due],
  );
  await query(
    `insert into reminder_events (resident_id, checkin_id, kind, note, created_at)
     values ($1, $2, 'snoozed', $3, $4)`,
    [checkin.resident_id, id, `Snoozed ${minutes} minutes.`, now],
  );
  return NextResponse.json({ ok: true, checkin: rows[0] });
}