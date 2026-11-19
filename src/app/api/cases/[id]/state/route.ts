import { NextRequest, NextResponse } from 'next/server';
import { one, query, simNow } from '@/lib/db';
import { nextState, type CaseState } from '@/lib/matching';

const MILESTONE_COLUMN: Record<string, string> = {
  MATCHED: 'matched_at',
  NAVIGATOR_CONTACTED: 'contacted_at',
  BOOKED: 'booked_at',
  ATTENDED: 'attended_at',
  FOLLOWED_UP_30D: 'followed_up_at',
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const toState = body.toState as CaseState;
  const kase = await one<{ state: CaseState }>(`select state from cases where id = $1`, [id]);
  if (!kase) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

  const expected = nextState(kase.state);
  if (!expected || toState !== expected) {
    return NextResponse.json(
      { error: `Invalid transition ${kase.state} -> ${toState}; next valid state is ${expected ?? 'none'}` },
      { status: 400 },
    );
  }

  const now = await simNow();
  const col = MILESTONE_COLUMN[toState];
  await query(`update cases set state = $1, ${col} = $2 where id = $3`, [toState, now, id]);
  await query(
    `insert into case_events (case_id, event_type, from_state, to_state, created_at)
     values ($1, 'state_change', $2, $3, $4)`,
    [id, kase.state, toState, now],
  );
  const updated = await one(`select * from case_sla_status where id = $1`, [id]);
  return NextResponse.json({ case: updated });
}