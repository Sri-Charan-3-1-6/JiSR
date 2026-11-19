import { NextRequest, NextResponse } from 'next/server';
import { one, query, simNow } from '@/lib/db';
import { detectChange, type WearableDay } from '@/lib/wearable';

async function hasConsent(id: string) {
  const c = await one<{ granted: boolean }>(
    `select granted from consent_scopes where resident_id = $1 and scope = 'wearable_signal'`,
    [id],
  );
  return Boolean(c?.granted);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await hasConsent(id))) {
    return NextResponse.json({ consentRequired: true }, { status: 403 });
  }
  const days = await query<WearableDay>(
    `select day::text as day, sleep_hours, steps, resting_hr
     from wearable_days where resident_id = $1 order by day`,
    [id],
  );
  return NextResponse.json({ days, change: detectChange(days) });
}

// Loads deterministic SIMULATED data (same shape as the seeded demo series):
// 14 stable baseline days + 7 days with a clear sleep/activity change.
// Real wearable integration is future work.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await hasConsent(id))) {
    return NextResponse.json({ consentRequired: true }, { status: 403 });
  }
  const resident = await one(`select id from residents where id = $1`, [id]);
  if (!resident) return NextResponse.json({ error: 'Resident not found' }, { status: 404 });

  const now = await simNow();
  const base = new Date(now);
  for (let i = 1; i <= 21; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() - (21 - i));
    const day = d.toISOString().slice(0, 10);
    const changed = i > 14;
    const sleep = changed ? 4.6 + 0.3 * Math.sin(i) : 7.0 + 0.4 * Math.sin(i);
    const steps = changed ? 3200 + 400 * Math.sin(i * 1.3) : 8000 + 900 * Math.sin(i * 1.7);
    const hr = changed ? 70 + 2 * Math.sin(i) : 62 + 3 * Math.sin(i);
    await query(
      `insert into wearable_days (resident_id, day, sleep_hours, steps, resting_hr)
       values ($1, $2::date, $3, $4, $5)
       on conflict (resident_id, day) do nothing`,
      [id, day, Math.round(sleep * 100) / 100, Math.round(steps), Math.round(hr)],
    );
  }
  const days = await query<WearableDay>(
    `select day::text as day, sleep_hours, steps, resting_hr
     from wearable_days where resident_id = $1 order by day`,
    [id],
  );
  return NextResponse.json({ days, change: detectChange(days) });
}