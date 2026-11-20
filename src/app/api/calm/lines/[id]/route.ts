import { NextRequest, NextResponse } from 'next/server';
import { one, query, simNow } from '@/lib/db';

// Faculty moderation: mark a pre-written line as reviewed (demo operator
// action; the prototype has no authentication, same as the other portals).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const reviewed = Boolean(body.reviewed);
  const reviewedBy = typeof body.reviewedBy === 'string' ? body.reviewedBy.slice(0, 60) : 'faculty';
  const now = await simNow();
  const rows = await query(
    `update calm_lines
     set reviewed = $2, reviewed_by = $3, reviewed_at = $4
     where id = $1 returning *`,
    [id, reviewed, reviewed ? reviewedBy : null, reviewed ? now : null],
  );
  if (!rows[0]) return NextResponse.json({ error: 'Line not found' }, { status: 404 });
  return NextResponse.json({ line: rows[0] });
}