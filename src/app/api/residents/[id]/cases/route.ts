import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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