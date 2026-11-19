import { NextRequest, NextResponse } from 'next/server';
import { one, query, simNow } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const channel = body.channel as string;
  const outcome = body.outcome as string;
  if (!['call', 'sms', 'message'].includes(channel) || !['reached', 'not_reached'].includes(outcome)) {
    return NextResponse.json({ error: 'Invalid channel or outcome' }, { status: 400 });
  }
  const kase = await one(`select id from cases where id = $1`, [id]);
  if (!kase) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

  const now = await simNow();
  await query(
    `insert into outreach_attempts (case_id, channel, outcome, note, attempted_at)
     values ($1, $2, $3, $4, $5)`,
    [id, channel, outcome, body.note ?? null, now],
  );
  await query(
    `insert into case_events (case_id, event_type, detail, created_at)
     values ($1, 'outreach', $2::jsonb, $3)`,
    [id, JSON.stringify({ channel, outcome, note: body.note ?? null }), now],
  );
  return NextResponse.json({ ok: true });
}