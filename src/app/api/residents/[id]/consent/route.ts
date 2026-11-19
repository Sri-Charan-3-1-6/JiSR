import { NextRequest, NextResponse } from 'next/server';
import { one, query, simNow } from '@/lib/db';

const SCOPES = [
  'store_results',
  'share_with_primary_care',
  'anonymous_aggregate_stats',
  'wearable_signal',
  'navigator_contact',
] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const resident = await one(`select id, pseudo_id from residents where id = $1`, [id]);
  if (!resident) return NextResponse.json({ error: 'Resident not found' }, { status: 404 });
  const scopes = await query(
    `select scope, granted, updated_at from consent_scopes where resident_id = $1 order by scope`,
    [id],
  );
  const audit = await query(
    `select scope, action, actor, created_at from consent_audit
     where resident_id = $1 order by created_at desc, id desc limit 100`,
    [id],
  );
  return NextResponse.json({ resident, scopes, audit });
}

// Toggle one scope. Revocation takes effect immediately (RLS reads the same
// row) and is written to the audit log shown to the user.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const scope = body.scope as string;
  const granted = Boolean(body.granted);
  if (!SCOPES.includes(scope as (typeof SCOPES)[number])) {
    return NextResponse.json({ error: 'Unknown scope' }, { status: 400 });
  }
  const resident = await one(`select id from residents where id = $1`, [id]);
  if (!resident) return NextResponse.json({ error: 'Resident not found' }, { status: 404 });

  const now = await simNow();
  await query(
    `insert into consent_scopes (resident_id, scope, granted, updated_at)
     values ($1, $2, $3, $4)
     on conflict (resident_id, scope)
     do update set granted = excluded.granted, updated_at = excluded.updated_at`,
    [id, scope, granted, now],
  );
  await query(
    `insert into consent_audit (resident_id, scope, action, actor, created_at)
     values ($1, $2, $3, 'resident', $4)`,
    [id, scope, granted ? 'grant' : 'revoke', now],
  );
  const updated = await query(
    `select scope, granted, updated_at from consent_scopes where resident_id = $1 order by scope`,
    [id],
  );
  return NextResponse.json({ scopes: updated });
}