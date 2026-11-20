import { NextRequest, NextResponse } from 'next/server';
import { one, query } from '@/lib/db';

// Unified activity log: every reminder, escalation step and contact message
// is visible to the resident. Companion mood tags are NEVER included here —
// they exist only in aggregate Gap Finder reports.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const granted = async (scope: string) =>
    Boolean(
      (await one<{ granted: boolean }>(
        `select granted from consent_scopes where resident_id = $1 and scope = $2`,
        [id, scope],
      ))?.granted,
    );

  const consent = await query(
    `select scope, action, actor, created_at from consent_audit
     where resident_id = $1 order by created_at desc, id desc limit 100`,
    [id],
  );
  const reminders = (await granted('reminders'))
    ? await query(
        `select id, checkin_id, kind, channel, note, read_at, created_at
         from reminder_events where resident_id = $1
         order by created_at desc, id desc limit 100`,
        [id],
      )
    : [];
  const contact = (await granted('trusted_contact'))
    ? await query(
        `select id, task_id, kind, message, created_at
         from trusted_contact_events where resident_id = $1
         order by created_at desc, id desc limit 100`,
        [id],
      )
    : [];
  const store = await granted('store_results');
  const calm = store
    ? await query(
        `select id, exercise, seconds, completed, created_at
         from calm_sessions where resident_id = $1 order by created_at desc limit 100`,
        [id],
      )
    : [];
  const companion = store
    ? await query(
        `select id, steps, outcome, crisis_flag, created_at
         from companion_sessions where resident_id = $1 order by created_at desc limit 100`,
        [id],
      )
    : [];
  return NextResponse.json({ consent, reminders, contact, calm, companion });
}