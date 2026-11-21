import { NextRequest, NextResponse } from 'next/server';
import { one, query, simNow } from '@/lib/db';
import { SESSION_STEP_CAP } from '@/lib/companion';

// Records a companion chat session (metrics only, never conversation text).
// mood_tag is SELF-REPORTED and stored for AGGREGATE reports only; it is
// never echoed back to the resident.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const residentId = String(body.residentId ?? '');
  const outcome = String(body.outcome ?? '');
  const moodTag = body.moodTag == null ? null : String(body.moodTag);
  const steps = Math.min(SESSION_STEP_CAP, Math.max(0, Number(body.steps) || 0));
  if (!['calm', 'human', 'checkin', 'crisis', 'capped'].includes(outcome)) {
    return NextResponse.json({ error: 'Unknown outcome' }, { status: 400 });
  }
  if (moodTag !== null && !['steady', 'heavy', 'unsure'].includes(moodTag)) {
    return NextResponse.json({ error: 'Unknown mood tag' }, { status: 400 });
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
    `insert into companion_sessions (resident_id, steps, outcome, mood_tag, crisis_flag, created_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [residentId, steps, outcome, moodTag, Boolean(body.crisisFlag), now],
  );
  return NextResponse.json({ ok: true });
}