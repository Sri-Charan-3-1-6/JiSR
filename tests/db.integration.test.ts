// Integration tests against a REAL Postgres (database rules: no claiming SQL
// works unless it was run). Requires migrations 001-003 applied.
// Default: postgres://postgres@127.0.0.1:5433/jisr
//
// Each test runs inside BEGIN ... ROLLBACK with its own fixtures, so tests
// never mutate the shipped demo dataset and need no destructive cleanup.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool, type PoolClient } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5433/jisr',
  max: 2,
});

async function withFixture(fn: (c: PoolClient) => Promise<void>) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await fn(c);
  } finally {
    await c.query('rollback');
    c.release();
  }
}

// Inserts a resident + case with explicit SLA offsets relative to sim_now().
async function makeCase(
  c: PoolClient,
  opts: {
    pseudoId: string;
    tier: string;
    contactDueHours?: number | null;
    bookDueHours?: number | null;
    followupDueDays?: number | null;
    ageHours?: number;
    contacted?: boolean;
  },
) {
  const r = await c.query(
    `insert into residents (pseudo_id, language) values ($1, 'en') returning id`,
    [opts.pseudoId],
  );
  const rid = r.rows[0].id;
  const age = opts.ageHours ?? 0;
  const iv = (h: number) => c.query(`select sim_now() - ($1 * interval '1 hour') as t`, [h]);
  const created = (await iv(age)).rows[0].t;
  const due = async (h: number | null | undefined, unit: 'hour' | 'day') => {
    if (h === null || h === undefined) return null;
    const mult = unit === 'day' ? 24 : 1;
    return (await c.query(`select $1::timestamptz + ($2 * interval '1 ${unit}') as t`, [created, h * mult])).rows[0].t;
  };
  const k = await c.query(
    `insert into cases (resident_id, risk_tier, state, created_at,
       sla_contact_due, sla_book_due, sla_followup_due, contacted_at)
     values ($1, $2, 'SCREENED', $3, $4, $5, $6, $7) returning id`,
    [rid, opts.tier, created,
     await due(opts.contactDueHours, 'hour'),
     await due(opts.bookDueHours, 'hour'),
     await due(opts.followupDueDays, 'day'),
     opts.contacted ? created : null],
  );
  return { residentId: rid, caseId: k.rows[0].id };
}

let clockBefore: string;

beforeAll(async () => {
  clockBefore = (await pool.query(`select now_offset::text as o from demo_clock where id`)).rows[0].o;
});

afterAll(async () => {
  await pool.end();
});

describe('SLA overdue query (real Postgres view)', () => {
  it('flags breached cases and only breached cases', async () => {
    await withFixture(async (c) => {
      const breached = await makeCase(c, {
        pseudoId: 'TEST-OVERDUE-1', tier: 'moderate', contactDueHours: 168, ageHours: 200,
      });
      const inside = await makeCase(c, {
        pseudoId: 'TEST-INSIDE-1', tier: 'moderate', contactDueHours: 168, ageHours: 100,
      });
      const done = await makeCase(c, {
        pseudoId: 'TEST-DONE-1', tier: 'severe', contactDueHours: 24, bookDueHours: 72, ageHours: 200, contacted: true,
      });
      const rows = (await c.query(
        `select o.id, o.is_overdue, o.next_milestone from case_sla_status o where o.id = any($1::uuid[])`,
        [[breached.caseId, inside.caseId, done.caseId]],
      )).rows;
      const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
      expect(byId[breached.caseId].is_overdue).toBe(true);
      expect(byId[breached.caseId].next_milestone).toBe('contact');
      expect(byId[inside.caseId].is_overdue).toBe(false);
      // Contacted on time; book deadline (72h) not yet breached at 200h? 200 > 72 => book breached.
      expect(byId[done.caseId].next_milestone).toBe('book');
      expect(byId[done.caseId].is_overdue).toBe(true);

      const overdue = (await c.query(
        `select id from overdue_cases where id = any($1::uuid[])`,
        [[breached.caseId, inside.caseId, done.caseId]],
      )).rows.map((r) => r.id);
      expect(overdue.sort()).toEqual([breached.caseId, done.caseId].sort());
    });
  });

  it('crisis case is overdue immediately (contact SLA = 0)', async () => {
    await withFixture(async (c) => {
      const k = await makeCase(c, { pseudoId: 'TEST-CRISIS-1', tier: 'crisis', contactDueHours: 0, ageHours: 0 });
      await c.query(`update demo_clock set now_offset = now_offset + interval '1 minute' where id`);
      const r = (await c.query(`select is_overdue from case_sla_status where id = $1`, [k.caseId])).rows[0];
      expect(r.is_overdue).toBe(true);
    });
  });

  it('navigator queue orders crisis before severe before moderate', async () => {
    await withFixture(async (c) => {
      const mod = await makeCase(c, { pseudoId: 'TEST-Q-MOD', tier: 'moderate', contactDueHours: 168 });
      const sev = await makeCase(c, { pseudoId: 'TEST-Q-SEV', tier: 'severe', contactDueHours: 24 });
      const cri = await makeCase(c, { pseudoId: 'TEST-Q-CRI', tier: 'crisis', contactDueHours: 0 });
      const rows = (await c.query(
        `select id from navigator_queue where id = any($1::uuid[])`,
        [[mod.caseId, sev.caseId, cri.caseId]],
      )).rows.map((r) => r.id);
      expect(rows).toEqual([cri.caseId, sev.caseId, mod.caseId]);
    });
  });
});

describe('demo time-travel (simulated clock drives SLA breach)', () => {
  it('+10 days breaches a 14-day SLA on a 5-day-old case; rollback restores it', async () => {
    await withFixture(async (c) => {
      const k = await makeCase(c, {
        pseudoId: 'TEST-TT-1', tier: 'mild', contactDueHours: 336, ageHours: 120,
      });
      const before = (await c.query(`select is_overdue from case_sla_status where id = $1`, [k.caseId])).rows[0];
      expect(before.is_overdue).toBe(false);

      await c.query(`update demo_clock set now_offset = now_offset + interval '7 days' where id`);
      const mid = (await c.query(`select is_overdue from case_sla_status where id = $1`, [k.caseId])).rows[0];
      expect(mid.is_overdue).toBe(false); // 5 + 7 = 12 days < 14

      await c.query(`update demo_clock set now_offset = now_offset + interval '3 days' where id`);
      const after = (await c.query(
        `select is_overdue, next_milestone from case_sla_status where id = $1`, [k.caseId],
      )).rows[0];
      expect(after.is_overdue).toBe(true); // 5 + 10 = 15 days > 14
      expect(after.next_milestone).toBe('contact');
    });
    // After rollback the global clock is untouched.
    const clock = (await pool.query(`select now_offset::text as o from demo_clock where id`)).rows[0];
    expect(clock.o).toBe(clockBefore);
  });
});

describe('state machine persistence (real Postgres)', () => {
  it('marking contact clears the contact SLA and moves to the book milestone', async () => {
    await withFixture(async (c) => {
      const k = await makeCase(c, {
        pseudoId: 'TEST-STATE-1', tier: 'severe', contactDueHours: 24, bookDueHours: 72, ageHours: 30,
      });
      const before = (await c.query(`select next_milestone, is_overdue from case_sla_status where id = $1`, [k.caseId])).rows[0];
      expect(before.next_milestone).toBe('contact');
      expect(before.is_overdue).toBe(true);

      const now = (await c.query(`select sim_now() as now`)).rows[0].now;
      await c.query(
        `update cases set state = 'NAVIGATOR_CONTACTED', contacted_at = $1 where id = $2`,
        [now, k.caseId],
      );
      const after = (await c.query(`select next_milestone, is_overdue from case_sla_status where id = $1`, [k.caseId])).rows[0];
      expect(after.next_milestone).toBe('book');
      expect(after.is_overdue).toBe(false); // 30h < 72h book SLA
    });
  });
});