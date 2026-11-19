import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  const [metrics] = await query(`select * from gapfinder_metrics`);
  const [improvement] = await query(`select * from gapfinder_improvement`);
  const fairness = await query(
    `select * from gapfinder_fairness order by dimension, group_value`,
  );
  const [counts] = await query(
    `select count(*)::int as residents_total from residents`,
  );
  return NextResponse.json({ metrics, improvement, fairness, counts });
}