import { NextRequest, NextResponse } from 'next/server';
import { one, query, simNow } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const consent = await one<{ granted: boolean }>(
    `select granted from consent_scopes where resident_id = $1 and scope = 'trusted_contact'`,
    [id],
  );
  const granted = Boolean(consent?.granted);
  const contact = granted
    ? await one(`select * from trusted_contacts where resident_id = $1`, [id])
    : null;
  const eligibleTask = granted
    ? await one(
        `select * from navigator_tasks
         where resident_id = $1 and kind = 'checkin_escalation'
           and call_outcome = 'not_reached' and resolved_at is null
         order by created_at desc limit 1`,
        [id],
      )
    : null;
  const events = granted
    ? await query(
        `select * from trusted_contact_events where resident_id = $1
         order by created_at desc, id desc limit 50`,
        [id],
      )
    : [];
  return NextResponse.json({ contact, consent: granted, eligibleTask, events });
}

// Opt-in: the user chooses a contact and consents. Relationship label only.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const consent = await one<{ granted: boolean }>(
    `select granted from consent_scopes where resident_id = $1 and scope = 'trusted_contact'`,
    [id],
  );
  if (!consent?.granted) {
    return NextResponse.json(
      { error: 'trusted_contact consent required', consentRequired: true },
      { status: 403 },
    );
  }
  const body = await req.json();
  const label = String(body.contactLabel ?? '').trim();
  const phone = String(body.contactPhone ?? '').replace(/\D/g, '');
  if (!label || label.length > 40 || phone.length < 7 || phone.length > 15) {
    return NextResponse.json({ error: 'A label and a valid phone number are required' }, { status: 400 });
  }
  const now = await simNow();
  const rows = await query(
    `insert into trusted_contacts (resident_id, contact_label, contact_phone, created_at, updated_at)
     values ($1, $2, $3, $4, $4)
     on conflict (resident_id) do update set
       contact_label = excluded.contact_label, contact_phone = excluded.contact_phone,
       updated_at = excluded.updated_at
     returning *`,
    [id, label, phone, now],
  );
  return NextResponse.json({ contact: rows[0] });
}

// Removing your own contact is always allowed, even after revocation.
// Audit events survive (contact_id becomes null).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await query(`delete from trusted_contacts where resident_id = $1`, [id]);
  return NextResponse.json({ ok: true });
}