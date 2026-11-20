import { NextRequest, NextResponse } from 'next/server';
import { one, query } from '@/lib/db';

// In-app notification center. Revoked consent immediately empties the feed.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const consent = await one<{ granted: boolean }>(
    `select granted from consent_scopes where resident_id = $1 and scope = 'reminders'`,
    [id],
  );
  if (!consent?.granted) {
    return NextResponse.json({ events: [], unread: 0, consentRequired: true });
  }
  const events = await query(
    `select * from reminder_events where resident_id = $1
     order by created_at desc, id desc limit 50`,
    [id],
  );
  const unread = await one<{ n: number }>(
    `select count(*)::int as n from reminder_events
     where resident_id = $1 and read_at is null`,
    [id],
  );
  return NextResponse.json({ events, unread: unread?.n ?? 0 });
}