import { NextRequest, NextResponse } from 'next/server';
import { one, query } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const kase = await one(
    `select c.*, r.pseudo_id, r.language, r.age_band, r.gender, r.nationality, r.area,
            s.instrument, s.answers, s.free_text, s.total_score, s.band as score_band,
            s.crisis_flag, s.crisis_reason, s.created_at as screened_at
     from cases c
     join residents r on r.id = c.resident_id
     left join screenings s on s.id = c.screening_id
     where c.id = $1`,
    [id],
  );
  if (!kase) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  const events = await query(
    `select * from case_events where case_id = $1 order by created_at, id`,
    [id],
  );
  const outreach = await query(
    `select * from outreach_attempts where case_id = $1 order by attempted_at, id`,
    [id],
  );
  const sla = await one(`select * from case_sla_status where id = $1`, [id]);
  return NextResponse.json({ case: kase, events, outreach, sla });
}