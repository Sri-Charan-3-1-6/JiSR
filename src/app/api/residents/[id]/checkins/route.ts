import { NextRequest, NextResponse } from 'next/server';
import { one, query, simNow } from '@/lib/db';

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
    return NextResponse.json({ checkins: [], consentRequired: true });
  }
  const checkins = await query(
    `select * from checkins where resident_id = $1 order by due_at desc limit 50`,
    [id],
  );
  return NextResponse.json({ checkins });
}

export async function POST(
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
  const dueAt = new Date(body.dueAt);
  if (Number.isNaN(dueAt.getTime())) {
    return NextResponse.json({ error: 'dueAt must be a valid date' }, { status: 400 });
  }
  const now = await simNow();
  const rows = await query(
    `insert into checkins (resident_id, due_at, created_at) values ($1, $2, $3) returning *`,
    [id, dueAt, now],
  );
  return NextResponse.json({ checkin: rows[0] });
}