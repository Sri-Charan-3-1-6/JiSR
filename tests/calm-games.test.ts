// New Calm Corner games: constants plus REAL Postgres integration proving the
// widened exercise whitelist accepts 'bubbles' and 'echo' sessions end to end.
// One persistent SYNTHETIC fixture resident (idempotent upserts — no DELETE).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { Pool } from 'pg';
import { BUBBLE_GOAL, ECHO_ROUNDS, EXERCISES } from '@/lib/calm';
import { POST as calmSessionsPOST } from '@/app/api/calm/sessions/route';

const url = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5433/jisr';
const pool = new Pool({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
  max: 2,
});

let rid = '';

const req = (body: unknown) =>
  new NextRequest('http://localhost/api/calm/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

beforeAll(async () => {
  const r = await pool.query(
    `insert into residents (pseudo_id, language, age_band, gender, nationality, area)
     values ('JISR-T5-GAME','en','25-34','female','Group T5','Area T5')
     on conflict (pseudo_id) do update set language = 'en' returning id`,
  );
  rid = r.rows[0].id as string;
  await pool.query(
    `insert into consent_scopes (resident_id, scope, granted)
     values ($1, 'store_results', true)
     on conflict (resident_id, scope) do update set granted = true`,
    [rid],
  );
}, 30000);

afterAll(async () => {
  await pool.end();
});

describe('calm games constants', () => {
  it('exposes all five exercises including the two new games', () => {
    expect(EXERCISES).toEqual(['breathing', 'grounding', 'memory', 'bubbles', 'echo']);
  });

  it('bubble goal is gentle and echo rounds grow slowly', () => {
    expect(BUBBLE_GOAL).toBe(12);
    expect(ECHO_ROUNDS).toEqual([2, 3, 4]);
  });
});

describe('calm games sessions against real Postgres', () => {
  it('records a completed bubbles session', async () => {
    const res = await calmSessionsPOST(req({ residentId: rid, exercise: 'bubbles', seconds: 40, completed: true }));
    expect(res.status).toBe(200);
    const r = await pool.query(
      `select exercise, seconds, completed from calm_sessions where resident_id = $1 and exercise = 'bubbles' order by created_at desc limit 1`,
      [rid],
    );
    expect(r.rows[0]).toMatchObject({ exercise: 'bubbles', seconds: 40, completed: true });
  });

  it('records a completed echo session', async () => {
    const res = await calmSessionsPOST(req({ residentId: rid, exercise: 'echo', seconds: 55, completed: true }));
    expect(res.status).toBe(200);
    const r = await pool.query(
      `select exercise, seconds, completed from calm_sessions where resident_id = $1 and exercise = 'echo' order by created_at desc limit 1`,
      [rid],
    );
    expect(r.rows[0]).toMatchObject({ exercise: 'echo', seconds: 55, completed: true });
  });

  it('still rejects unknown exercises and bad durations', async () => {
    expect((await calmSessionsPOST(req({ residentId: rid, exercise: 'slots', seconds: 10, completed: true }))).status).toBe(400);
    expect((await calmSessionsPOST(req({ residentId: rid, exercise: 'bubbles', seconds: -1, completed: true }))).status).toBe(400);
    expect((await calmSessionsPOST(req({ residentId: rid, exercise: 'echo', seconds: 3601, completed: true }))).status).toBe(400);
  });

  it('requires store_results consent for the new games too', async () => {
    await pool.query(
      `update consent_scopes set granted = false where resident_id = $1 and scope = 'store_results'`,
      [rid],
    );
    const res = await calmSessionsPOST(req({ residentId: rid, exercise: 'bubbles', seconds: 10, completed: false }));
    expect(res.status).toBe(403);
    await pool.query(
      `update consent_scopes set granted = true where resident_id = $1 and scope = 'store_results'`,
      [rid],
    );
  });
});