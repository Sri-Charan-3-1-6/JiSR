import { NextRequest, NextResponse } from 'next/server';
import { one, query } from '@/lib/db';

// Jokes are a content preference, not personal data: off by default, opt-in
// only. No consent scope is required to change it.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await one<{ jokes_opt_in: boolean }>(
    `select jokes_opt_in from companion_prefs where resident_id = $1`,
    [id],
  );
  return NextResponse.json({ jokesOptIn: Boolean(row?.jokes_opt_in) });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  if (typeof body.jokesOptIn !== 'boolean') {
    return NextResponse.json({ error: 'jokesOptIn must be a boolean' }, { status: 400 });
  }
  const resident = await one(`select id from residents where id = $1`, [id]);
  if (!resident) return NextResponse.json({ error: 'Resident not found' }, { status: 404 });
  await query(
    `insert into companion_prefs (resident_id, jokes_opt_in) values ($1, $2)
     on conflict (resident_id) do update set jokes_opt_in = excluded.jokes_opt_in`,
    [id, body.jokesOptIn],
  );
  return NextResponse.json({ jokesOptIn: body.jokesOptIn });
}