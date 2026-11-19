import { NextRequest, NextResponse } from 'next/server';
import { one, query } from '@/lib/db';

export async function GET() {
  const clock = await one<{ now: Date; offset: string }>(
    `select sim_now() as now, now_offset::text as offset from demo_clock where id`,
  );
  return NextResponse.json(clock);
}

// Demo time-travel: advance the simulated clock by whole days.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const days = Number(body.days);
  if (!Number.isInteger(days) || days < 1 || days > 30) {
    return NextResponse.json({ error: 'days must be an integer 1-30' }, { status: 400 });
  }
  await query(
    `update demo_clock set now_offset = now_offset + ($1 * interval '1 day'), updated_at = now() where id`,
    [days],
  );
  const clock = await one<{ now: Date; offset: string }>(
    `select sim_now() as now, now_offset::text as offset from demo_clock where id`,
  );
  return NextResponse.json(clock);
}