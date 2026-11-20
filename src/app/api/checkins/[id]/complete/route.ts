import { NextRequest, NextResponse } from 'next/server';
import { one, query, simNow } from '@/lib/db';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const checkin = await one<{ resident_id: string }>(
    `select resident_id from checkins where id = $1`,
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
  const now = await simNow();
  const rows = await query(
    `update checkins
     set state = 'completed', completed_at = $2, consecutive_misses = 0, snoozed_until = null
     where id = $1 returning *`,
    [id, now],
  );
  await query(
    `insert into reminder_events (resident_id, checkin_id, kind, created_at)
     values ($1, $2, 'completed', $3)`,
    [checkin.resident_id, id, now],
  );
  return NextResponse.json({ ok: true, checkin: rows[0] });
}