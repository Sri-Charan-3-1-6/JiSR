import { NextRequest, NextResponse } from 'next/server';
import { one, query, simNow } from '@/lib/db';
import { buildContactMessage, containsHealthData, waLink } from '@/lib/trusted-contact';

// Simulated send (no real WhatsApp API). Preconditions, all enforced here:
//  1. trusted_contact consent is ON
//  2. a navigator human call FAILED (call_outcome = 'not_reached')
//  3. no message was already sent for that task
// The message is the generic template with a pseudonymous handle and is
// re-checked for health wording before it is stored.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const contact = await one<{ resident_id: string; contact_phone: string; pseudo_id: string }>(
    `select tc.resident_id, tc.contact_phone, r.pseudo_id
     from trusted_contacts tc join residents r on r.id = tc.resident_id
     where tc.id = $1`,
    [id],
  );
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
  const consent = await one<{ granted: boolean }>(
    `select granted from consent_scopes where resident_id = $1 and scope = 'trusted_contact'`,
    [contact.resident_id],
  );
  if (!consent?.granted) {
    return NextResponse.json(
      { error: 'trusted_contact consent required', consentRequired: true },
      { status: 403 },
    );
  }
  const task = await one<{ id: string }>(
    `select id from navigator_tasks
     where resident_id = $1 and kind = 'checkin_escalation'
       and call_outcome = 'not_reached' and resolved_at is null
     order by created_at desc limit 1`,
    [contact.resident_id],
  );
  if (!task) {
    return NextResponse.json(
      { error: 'A navigator human call must fail before any contact message' },
      { status: 403 },
    );
  }
  const prior = await one(
    `select 1 from trusted_contact_events where task_id = $1 and kind = 'simulated_sent'`,
    [task.id],
  );
  if (prior) {
    return NextResponse.json({ error: 'A message was already sent for this task' }, { status: 409 });
  }
  const message = buildContactMessage(contact.pseudo_id);
  if (containsHealthData(message)) {
    return NextResponse.json({ error: 'Message failed the health-data guard' }, { status: 500 });
  }
  const now = await simNow();
  const rows = await query(
    `insert into trusted_contact_events
       (resident_id, contact_id, task_id, kind, message, created_at)
     values ($1, $2, $3, 'simulated_sent', $4, $5) returning *`,
    [contact.resident_id, id, task.id, message, now],
  );
  return NextResponse.json({
    message,
    waLink: waLink(contact.contact_phone, message),
    simulated: true,
    taskId: task.id,
    event: rows[0],
  });
}