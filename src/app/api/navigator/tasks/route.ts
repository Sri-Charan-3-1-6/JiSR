import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Escalation tasks from the persistence ladder. Contact details are joined
// only when the resident's trusted_contact consent is ON.
export async function GET() {
  const tasks = await query(
    `select t.*, r.pseudo_id, r.language,
            tc.id as contact_id, tc.contact_label, tc.contact_phone,
            coalesce(tcc.granted, false) and tc.id is not null as contact_available
     from navigator_tasks t
     join residents r on r.id = t.resident_id
     left join trusted_contacts tc on tc.resident_id = t.resident_id
     left join consent_scopes tcc
       on tcc.resident_id = t.resident_id and tcc.scope = 'trusted_contact'
     order by t.resolved_at is null desc, t.created_at desc
     limit 100`,
  );
  return NextResponse.json({ tasks });
}