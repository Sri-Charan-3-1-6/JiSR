import { NextRequest, NextResponse } from 'next/server';
import { one, query, simNow } from '@/lib/db';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const event = await one<{ resident_id: string }>(
    `select resident_id from reminder_events where id = $1`,
    [id],
  );
  if (!event) return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
  const consent = await one<{ granted: boolean }>(
    `select granted from consent_scopes where resident_id = $1 and scope = 'reminders'`,
    [event.resident_id],
  );
  if (!consent?.granted) {
    return NextResponse.json(
      { error: 'Reminders consent required', consentRequired: true },
      { status: 403 },
    );
  }
  const now = await simNow();
  await query(`update reminder_events set read_at = $2 where id = $1`, [id, now]);
  return NextResponse.json({ ok: true });
}