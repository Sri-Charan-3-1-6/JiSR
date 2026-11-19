import { Pool } from 'pg';

// Raw SQL only, parameterized queries only (database rules — no ORM).
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5433/jisr',
  max: 5,
});

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

export async function one<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function simNow(): Promise<Date> {
  const row = await one<{ now: Date }>('select sim_now() as now');
  return row!.now;
}