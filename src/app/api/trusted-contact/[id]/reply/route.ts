import { NextRequest, NextResponse } from 'next/server';
import { one, query, simNow } from '@/lib/db';

// A reply is recorded ONLY as 'contact made'. It never marks the person as
// well and never changes the case risk level or state.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const contact = await one<{ resident_id: string }>(
    `select resident_id from trusted_contacts where id = $1`,
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
  const sent = await one<{ task_id: string | null }>(
    `select task_id from trusted_contact_events
     where contact_id = $1 and kind = 'simulated_sent'
     order by created_at desc, id desc limit 1`,
    [id],
  );
  if (!sent) {
    return NextResponse.json({ error: 'No simulated message to reply to' }, { status: 400 });
  }
  const now = await simNow();
  const rows = await query(
    `insert into trusted_contact_events
       (resident_id, contact_id, task_id, kind, message, created_at)
     values ($1, $2, $3, 'contact_made', 'Reply recorded: contact made.', $4) returning *`,
    [contact.resident_id, id, sent.task_id, now],
  );
  if (sent.task_id) {
    await query(
      `update navigator_tasks set resolved_at = $2 where id = $1 and resolved_at is null`,
      [sent.task_id, now],
    );
  }
  return NextResponse.json({ ok: true, kind: 'contact_made', event: rows[0] });
}