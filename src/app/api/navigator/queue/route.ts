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
  const tasks = await query(
    `select t.*, r.pseudo_id, r.language,
            tc.id as contact_id, tc.contact_label, tc.contact_phone,
            coalesce(tcc.granted, false) and tc.id is not null as contact_available
     from navigator_tasks t
     join residents r on r.id = t.resident_id
     left join trusted_contacts tc on tc.resident_id = t.resident_id
     left join consent_scopes tcc
       on tcc.resident_id = t.resident_id and tcc.scope = 'trusted_contact'
     where t.resolved_at is null
     order by t.created_at desc
     limit 50`,
  );
  return NextResponse.json({ cases: rows, clock, tasks });
}