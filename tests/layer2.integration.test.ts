// Layer 2 integration tests against a REAL Postgres. Requires migrations
// 001-007 applied. Every test runs inside BEGIN ... ROLLBACK with its own
// fixtures — no destructive cleanup, demo data untouched.
import { afterAll, describe, expect, it } from 'vitest';
import { Pool, type PoolClient } from 'pg';

const url = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5433/jisr';
const pool = new Pool({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
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

async function makeResident(c: PoolClient, pseudoId: string, area: string) {
  const r = await c.query(
    `insert into residents (pseudo_id, language, area) values ($1, 'en', $2) returning id`,
    [pseudoId, area],
  );
  const id = r.rows[0].id as string;
  // Aggregate views count only residents with anonymous_aggregate_stats ON.
  await c.query(
    `insert into consent_scopes (resident_id, scope, granted)
     values ($1, 'anonymous_aggregate_stats', true)`,
    [id],
  );
  return id;
}

async function makeScreeningCase(
  c: PoolClient,
  residentId: string,
  opts: { matched?: boolean } = {},
) {
  const now = (await c.query(`select sim_now() as t`)).rows[0].t;
  const s = await c.query(
    `insert into screenings (resident_id, instrument, answers, total_score, band, created_at)
     values ($1, 'PHQ9', '[]'::jsonb, 12, 'moderate', $2) returning id`,
    [residentId, now],
  );
  const k = await c.query(
    `insert into cases (resident_id, screening_id, risk_tier, state, created_at, matched_at)
     values ($1, $2, 'moderate', $3, $4, $5) returning id`,
    [residentId, s.rows[0].id, opts.matched ? 'MATCHED' : 'SCREENED', now, opts.matched ? now : null],
  );
  return { screeningId: s.rows[0].id as string, caseId: k.rows[0].id as string };
}

// One set-based statement per fixture group: fast over high-latency links.
async function makeAreaGroup(
  c: PoolClient,
  area: string,
  n: number,
  matchedN: number,
) {
  await c.query(
    `with ins_res as (
       insert into residents (pseudo_id, language, area)
       select $1 || '-' || i, 'en', $1 from generate_series(0, $2 - 1) i
       returning id, pseudo_id
     ), ins_consent as (
       insert into consent_scopes (resident_id, scope, granted)
       select id, 'anonymous_aggregate_stats', true from ins_res
       returning resident_id
     ), ins_scr as (
       insert into screenings (resident_id, instrument, answers, total_score, band, created_at)
       select id, 'PHQ9', '[]'::jsonb, 12, 'moderate', sim_now() from ins_res
       returning id, resident_id
     )
     insert into cases (resident_id, screening_id, risk_tier, state, created_at, matched_at)
     select s.resident_id, s.id, 'moderate',
            case when (split_part(r.pseudo_id, '-', array_length(string_to_array(r.pseudo_id, '-'), 1)))::int < $3
                 then 'MATCHED' else 'SCREENED' end,
            sim_now(),
            case when (split_part(r.pseudo_id, '-', array_length(string_to_array(r.pseudo_id, '-'), 1)))::int < $3
                 then sim_now() else null end
     from ins_scr s join ins_res r on r.id = s.resident_id`,
    [area, n, matchedN],
  );
}

afterAll(async () => {
  await pool.end();
});

describe('small-cell suppression (enforced inside the SQL views)', () => {
  it('employer views hide groups under 10 and show groups of exactly 10', async () => {
    await withFixture(async (c) => {
      for (let i = 0; i < 9; i++) {
        await makeResident(c, `TEST-SUP-SMALL-${i}`, 'TEST-SUP-SMALL');
      }
      for (let i = 0; i < 10; i++) {
        await makeResident(c, `TEST-SUP-BIG-${i}`, 'TEST-SUP-BIG');
      }
      const rows = (await c.query(
        `select group_value, resident_count from employer_area_counts
         where group_value = any($1::text[])`,
        [['TEST-SUP-SMALL', 'TEST-SUP-BIG']],
      )).rows;
      expect(rows.map((r) => r.group_value)).toEqual(['TEST-SUP-BIG']);
      expect(Number(rows[0].resident_count)).toBe(10);
    });
  });

  it('gapfinder_fairness hides groups with fewer than 10 cases', async () => {
    await withFixture(async (c) => {
      await makeAreaGroup(c, 'TEST-FAIR-SMALL', 9, 9);
      await makeAreaGroup(c, 'TEST-FAIR-BIG', 10, 10);
      const rows = (await c.query(
        `select group_value, n from gapfinder_fairness
         where dimension = 'area' and group_value = any($1::text[])`,
        [['TEST-FAIR-SMALL', 'TEST-FAIR-BIG']],
      )).rows;
      expect(rows.map((r) => r.group_value)).toEqual(['TEST-FAIR-BIG']);
      expect(Number(rows[0].n)).toBe(10);
    });
  });
});

describe('consent revocation takes effect immediately (RLS as jisr_app)', () => {
  it('revoking store_results blocks screenings and cases reads; re-granting restores them', async () => {
    await withFixture(async (c) => {
      const rid = await makeResident(c, 'TEST-CONSENT-1', 'Area 1');
      const { screeningId, caseId } = await makeScreeningCase(c, rid, { matched: true });
      await c.query(
        `insert into consent_scopes (resident_id, scope, granted) values ($1, 'store_results', true)`,
        [rid],
      );

      await c.query(`set local role jisr_app`);
      const visible = (await c.query(
        `select id from screenings where id = $1`, [screeningId],
      )).rows;
      expect(visible).toHaveLength(1);
      const caseVisible = (await c.query(`select id from cases where id = $1`, [caseId])).rows;
      expect(caseVisible).toHaveLength(1);

      // Revoke through the same role the app uses — takes effect immediately.
      await c.query(
        `update consent_scopes set granted = false where resident_id = $1 and scope = 'store_results'`,
        [rid],
      );
      const hidden = (await c.query(`select id from screenings where id = $1`, [screeningId])).rows;
      expect(hidden).toHaveLength(0);
      const caseHidden = (await c.query(`select id from cases where id = $1`, [caseId])).rows;
      expect(caseHidden).toHaveLength(0);

      await c.query(
        `update consent_scopes set granted = true where resident_id = $1 and scope = 'store_results'`,
        [rid],
      );
      const restored = (await c.query(`select id from screenings where id = $1`, [screeningId])).rows;
      expect(restored).toHaveLength(1);
      await c.query(`reset role`);
    });
  });

  it('default-off consent blocks reads even for existing rows', async () => {
    await withFixture(async (c) => {
      const rid = await makeResident(c, 'TEST-CONSENT-2', 'Area 1');
      const { screeningId } = await makeScreeningCase(c, rid);
      await c.query(
        `insert into consent_scopes (resident_id, scope) values ($1, 'store_results')`,
        [rid],
      );
      await c.query(`set local role jisr_app`);
      const rows = (await c.query(`select id from screenings where id = $1`, [screeningId])).rows;
      expect(rows).toHaveLength(0);
      await c.query(`reset role`);
    });
  });

  it('wearable_signal and share_with_primary_care scopes gate their tables', async () => {
    await withFixture(async (c) => {
      const rid = await makeResident(c, 'TEST-CONSENT-3', 'Area 1');
      await c.query(
        `insert into wearable_days (resident_id, day, sleep_hours, steps)
         values ($1, current_date, 6.5, 4000)`,
        [rid],
      );
      await c.query(
        `insert into health_flags (resident_id, sleep_flag) values ($1, true)`,
        [rid],
      );
      await c.query(
        `insert into consent_scopes (resident_id, scope, granted) values
           ($1, 'wearable_signal', false), ($1, 'share_with_primary_care', false)`,
        [rid],
      );
      await c.query(`set local role jisr_app`);
      expect((await c.query(`select 1 from wearable_days where resident_id = $1`, [rid])).rows).toHaveLength(0);
      expect((await c.query(`select 1 from health_flags where resident_id = $1`, [rid])).rows).toHaveLength(0);
      await c.query(
        `update consent_scopes set granted = true
         where resident_id = $1 and scope = any($2::text[])`,
        [rid, ['wearable_signal', 'share_with_primary_care']],
      );
      expect((await c.query(`select 1 from wearable_days where resident_id = $1`, [rid])).rows).toHaveLength(1);
      expect((await c.query(`select 1 from health_flags where resident_id = $1`, [rid])).rows).toHaveLength(1);
      await c.query(`reset role`);
    });
  });
});

describe('employer role can read ONLY aggregated views', () => {
  it('jisr_employer reads employer views but is denied base tables and fairness detail', async () => {
    await withFixture(async (c) => {
      await c.query(`set local role jisr_employer`);
      const agg = await c.query(`select group_value from employer_area_counts limit 1`);
      expect(agg.rows.length).toBeGreaterThanOrEqual(0);
      // Each denied query aborts the transaction; savepoints keep it usable.
      for (const sql of [
        `select id from residents limit 1`,
        `select id from screenings limit 1`,
        `select * from gapfinder_fairness limit 1`,
      ]) {
        await c.query(`savepoint denied`);
        await expect(c.query(sql)).rejects.toThrow(/permission denied/);
        await c.query(`rollback to savepoint denied`);
      }
      await c.query(`reset role`);
    });
  });
});

describe('aggregate views honor anonymous_aggregate_stats consent', () => {
  it('a resident with the scope OFF is excluded from employer counts and the funnel', async () => {
    await withFixture(async (c) => {
      // 10 consenting residents make the area visible; an 11th with consent
      // OFF must not be counted anywhere.
      for (let i = 0; i < 10; i++) {
        await makeResident(c, `TEST-AGG-ON-${i}`, 'TEST-AGG-AREA');
      }
      const off = await c.query(
        `insert into residents (pseudo_id, language, area)
         values ('TEST-AGG-OFF', 'en', 'TEST-AGG-AREA') returning id`,
      );
      const offId = off.rows[0].id;
      await c.query(
        `insert into consent_scopes (resident_id, scope, granted)
         values ($1, 'anonymous_aggregate_stats', false)`,
        [offId],
      );
      await makeScreeningCase(c, offId, { matched: true });

      const area = (await c.query(
        `select resident_count from employer_area_counts where group_value = 'TEST-AGG-AREA'`,
      )).rows;
      expect(Number(area[0].resident_count)).toBe(10);

      const funnel = (await c.query(
        `select 1 from gapfinder_case_funnel where resident_id = $1`, [offId],
      )).rows;
      expect(funnel).toHaveLength(0);

      // Revoking one of the ten drops the group below 10 -> fully suppressed.
      const one = (await c.query(
        `select id from residents where pseudo_id = 'TEST-AGG-ON-0'`,
      )).rows[0].id;
      await c.query(
        `update consent_scopes set granted = false
         where resident_id = $1 and scope = 'anonymous_aggregate_stats'`,
        [one],
      );
      const suppressed = (await c.query(
        `select 1 from employer_area_counts where group_value = 'TEST-AGG-AREA'`,
      )).rows;
      expect(suppressed).toHaveLength(0);
    });
  });
});

describe('seeded small nationality group is visibly suppressed', () => {
  it('Group S has 7 residents but never appears in employer or fairness views', async () => {
    const n = (await pool.query(
      `select count(*)::int as n from residents where nationality = 'Group S'`,
    )).rows[0].n;
    expect(n).toBe(7);
    const employer = (await pool.query(
      `select 1 from employer_nationality_counts where group_value = 'Group S'`,
    )).rows;
    expect(employer).toHaveLength(0);
    const fairness = (await pool.query(
      `select 1 from gapfinder_fairness where dimension = 'nationality' and group_value = 'Group S'`,
    )).rows;
    expect(fairness).toHaveLength(0);
    const otherGroups = (await pool.query(
      `select group_value from employer_nationality_counts order by group_value`,
    )).rows.map((r) => r.group_value);
    expect(otherGroups).toEqual(['Group A', 'Group B', 'Group C', 'Group D']);
  });
});

describe('fairness gap flag at <80% of the best group', () => {
  it('flags a group below 80% of best, not a group at/above 80%', async () => {
    await withFixture(async (c) => {
      // Best: 10/10 matched (1.0). Worst: 5/10 (0.5 < 0.8). OK: 9/10 (0.9 >= 0.8).
      await makeAreaGroup(c, 'TEST-GAP-BEST', 10, 10);
      await makeAreaGroup(c, 'TEST-GAP-WORST', 10, 5);
      await makeAreaGroup(c, 'TEST-GAP-OK', 10, 9);
      const rows = (await c.query(
        `select group_value, screen_to_match, best_screen_to_match, is_gap
         from gapfinder_fairness
         where dimension = 'area' and group_value = any($1::text[])`,
        [['TEST-GAP-BEST', 'TEST-GAP-WORST', 'TEST-GAP-OK']],
      )).rows;
      const byGroup = Object.fromEntries(rows.map((r) => [r.group_value, r]));
      expect(Number(byGroup['TEST-GAP-BEST'].best_screen_to_match)).toBe(1);
      expect(byGroup['TEST-GAP-BEST'].is_gap).toBe(false);
      expect(Number(byGroup['TEST-GAP-WORST'].screen_to_match)).toBe(0.5);
      expect(byGroup['TEST-GAP-WORST'].is_gap).toBe(true);
      expect(byGroup['TEST-GAP-OK'].is_gap).toBe(false);
    });
  });
});