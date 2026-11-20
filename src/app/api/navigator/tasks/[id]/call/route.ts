import { NextRequest, NextResponse } from 'next/server';
import { one, query, simNow } from '@/lib/db';

// The navigator logs a human call. 'not_reached' is the ONLY precondition
// that makes a trusted-contact message eligible; it never changes risk.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const outcome = String(body.outcome ?? '');
  if (!['reached', 'not_reached'].includes(outcome)) {
    return NextResponse.json({ error: 'outcome must be reached or not_reached' }, { status: 400 });
  }
  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null;
  const now = await simNow();
  const rows = await query(
    `update navigator_tasks
     set call_outcome = $2, call_note = $3, resolved_at = $4
     where id = $1 returning *`,
    [id, outcome, note, outcome === 'reached' ? now : null],
  );
  if (!rows[0]) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  const task = rows[0] as { resident_id: string };
  const contact = await one(
    `select tc.id from trusted_contacts tc
     join consent_scopes cs on cs.resident_id = tc.resident_id and cs.scope = 'trusted_contact'
     where tc.resident_id = $1 and cs.granted`,
    [task.resident_id],
  );
  return NextResponse.json({
    task: rows[0],
    contactEligible: outcome === 'not_reached' && Boolean(contact),
  });
}