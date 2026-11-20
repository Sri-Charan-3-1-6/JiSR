import { NextRequest, NextResponse } from 'next/server';
import { one, query, simNow } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const residentId = String(body.residentId ?? '');
  const exercise = String(body.exercise ?? '');
  const seconds = Number(body.seconds);
  if (!['breathing', 'grounding', 'memory'].includes(exercise)) {
    return NextResponse.json({ error: 'Unknown exercise' }, { status: 400 });
  }
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) {
    return NextResponse.json({ error: 'seconds must be an integer 0-3600' }, { status: 400 });
  }
  const consent = await one<{ granted: boolean }>(
    `select granted from consent_scopes where resident_id = $1 and scope = 'store_results'`,
    [residentId],
  );
  if (!consent?.granted) {
    return NextResponse.json(
      { error: 'store_results consent required', consentRequired: true },
      { status: 403 },
    );
  }
  const now = await simNow();
  await query(
    `insert into calm_sessions (resident_id, exercise, seconds, completed, created_at)
     values ($1, $2, $3, $4, $5)`,
    [residentId, exercise, seconds, Boolean(body.completed), now],
  );
  return NextResponse.json({ ok: true });
}