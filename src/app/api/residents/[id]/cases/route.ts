import { NextRequest, NextResponse } from 'next/server';
import { one, query } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // App-level consent gate (RLS enforces the same rule at the DB layer).
  const consent = await one<{ granted: boolean }>(
    `select granted from consent_scopes where resident_id = $1 and scope = 'store_results'`,
    [id],
  );
  if (!consent?.granted) {
    return NextResponse.json({ cases: [], consentRequired: true });
  }
  const rows = await query(
    `select c.*, s.instrument, s.total_score, s.band as score_band
     from cases c
     left join screenings s on s.id = c.screening_id
     where c.resident_id = $1
     order by c.created_at desc`,
    [id],
  );
  return NextResponse.json({ cases: rows });
}