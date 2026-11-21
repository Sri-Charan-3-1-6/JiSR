// Timezone regression suite against a REAL Postgres (Supabase).
// The daily cap and quiet hours must be evaluated on a fixed UTC basis,
// independent of the client/server process timezone. node-pg serializes Date
// parameters as local wall time + offset; a bare `$n::date` cast parses the
// LOCAL calendar date out of that string, while `created_at::date` uses the
// session timezone — the two disagree whenever local date != UTC date.
// simNow is overridden with a controlled instant (the real query/one stay
// untouched), so no shared demo_clock shift is needed. On a UTC process no
// mismatch instant exists and these tests still verify same-day counting.
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Pool } from 'pg';
import { DEFAULT_PREFS } from '@/lib/reminders';

const { clock } = vi.hoisted(() => ({ clock: { now: new Date() } }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, simNow: async () => clock.now };
});

import { POST as evaluatePOST } from '@/app/api/residents/[id]/checkins/evaluate/route';

const url = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5433/jisr';
const pool = new Pool({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
  max: 2,
});

let rid = '';

const req = () =>
  new NextRequest('http://localhost/api/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  });
const ctx = () => ({ params: Promise.resolve({ id: rid }) });

// An instant whose local calendar date differs from its UTC date, if one
// exists today for this process timezone; otherwise 00:30 UTC today.
function mismatchInstant(): Date {
  const d = new Date();
  const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  for (let h = 0; h < 24; h++) {
    const t = new Date(dayStart + h * 3_600_000 + 30 * 60_000);
    if (
      t.getFullYear() !== t.getUTCFullYear() ||
      t.getMonth() !== t.getUTCMonth() ||
      t.getDate() !== t.getUTCDate()
    ) {
      return t;
    }
  }
  return new Date(dayStart + 30 * 60_000);
}

const utcHHMM = (d: Date) =>
  `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;

async function setPrefs(patch: Partial<typeof DEFAULT_PREFS>) {
  const p = { ...DEFAULT_PREFS, ...patch };
  await pool.query(
    `insert into reminder_prefs
       (resident_id, remind_at, quiet_start, quiet_end, max_per_day, snooze_minutes,
        ladder_gap_minutes, ladder_miss_limit, vibration, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
     on conflict (resident_id) do update set
       remind_at=$2, quiet_start=$3, quiet_end=$4, max_per_day=$5, snooze_minutes=$6,
       ladder_gap_minutes=$7, ladder_miss_limit=$8, vibration=$9, updated_at=now()`,
    [rid, p.remindAt, p.quietStart, p.quietEnd, p.maxPerDay, p.snoozeMinutes,
     p.ladderGapMinutes, p.ladderMissLimit, p.vibration],
  );
}

beforeEach(async () => {
  const r = await pool.query(
    `insert into residents (pseudo_id, language, age_band, gender, nationality, area)
     values ('JISR-T5-TZ','en','25-34','female','Group T5','Area T5')
     on conflict (pseudo_id) do update set language = 'en' returning id`,
  );
  rid = r.rows[0].id as string;
  await pool.query(
    `insert into consent_scopes (resident_id, scope, granted, updated_at)
     values ($1, 'reminders', true, now())
     on conflict (resident_id, scope) do update set granted = true, updated_at = now()`,
    [rid],
  );
  // Non-destructive reset (UPDATEs only, never DELETE).
  await pool.query(
    `update checkins set state = 'completed', completed_at = now(), consecutive_misses = 0,
            missed_at = null, due_at = now() - interval '30 days'
     where resident_id = $1`,
    [rid],
  );
  await pool.query(
    `update reminder_events set kind = 'completed'
     where resident_id = $1 and kind in ('reminder','soft_reminder')`,
    [rid],
  );
}, 30000);

afterAll(async () => {
  await pool.end();
});

describe('daily cap is UTC-day based, not client-local-date based', () => {
  it('counts a reminder sent earlier the same UTC day even when the local date differs', async () => {
    const target = mismatchInstant();
    clock.now = target;
    await setPrefs({ maxPerDay: 1, quietStart: '00:00', quietEnd: '00:00' });
    await pool.query(
      `insert into reminder_events (resident_id, kind, created_at) values ($1,'reminder',$2)`,
      [rid, target],
    );
    const ci = await pool.query(
      `insert into checkins (resident_id, due_at, created_at) values ($1,$2,$2) returning id`,
      [rid, new Date(target.getTime() - 600_000)],
    );
    const res = await evaluatePOST(req(), ctx());
    const body = await res.json();
    expect(body.events.some((e: { kind: string }) => e.kind === 'skipped_daily_cap')).toBe(true);
    const state = await pool.query(`select state, reminders_sent from checkins where id = $1`, [ci.rows[0].id]);
    expect(state.rows[0].state).toBe('pending');
    expect(state.rows[0].reminders_sent).toBe(0);
  }, 30000);
});

describe('quiet hours are UTC-based, not server-process-local', () => {
  it('skips sends inside a quiet window defined around the UTC time of day', async () => {
    const target = mismatchInstant();
    clock.now = target;
    await setPrefs({
      maxPerDay: 3,
      quietStart: utcHHMM(new Date(target.getTime() - 3_600_000)),
      quietEnd: utcHHMM(new Date(target.getTime() + 3_600_000)),
    });
    const ci = await pool.query(
      `insert into checkins (resident_id, due_at, created_at) values ($1,$2,$2) returning id`,
      [rid, new Date(target.getTime() - 600_000)],
    );
    const res = await evaluatePOST(req(), ctx());
    const body = await res.json();
    expect(body.events.some((e: { kind: string }) => e.kind === 'skipped_quiet_hours')).toBe(true);
    const state = await pool.query(`select state, reminders_sent from checkins where id = $1`, [ci.rows[0].id]);
    expect(state.rows[0].state).toBe('pending');
    expect(state.rows[0].reminders_sent).toBe(0);
  }, 30000);
});