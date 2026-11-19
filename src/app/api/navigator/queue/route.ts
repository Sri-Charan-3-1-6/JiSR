import { NextResponse } from 'next/server';
import { query, one } from '@/lib/db';

export async function GET() {
  const rows = await query(
    `select q.*, r.pseudo_id, r.language, r.age_band, r.area,
            s.instrument, s.total_score, s.band as score_band
     from navigator_queue q
     join residents r on r.id = q.resident_id
     left join screenings s on s.id = q.screening_id`,
  );
  const clock = await one<{ now: Date; offset: string }>(
    `select sim_now() as now, now_offset::text as offset from demo_clock where id`,
  );
  return NextResponse.json({ cases: rows, clock });
}