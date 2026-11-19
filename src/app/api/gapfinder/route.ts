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
  // Groups below the suppression threshold: names only, never counts.
  const suppressed = await query(
    `select dimension, group_value from (
       select 'language' as dimension, language as group_value, count(*) as n
         from gapfinder_case_funnel group by language
       union all
       select 'age_band', age_band, count(*) from gapfinder_case_funnel group by age_band
       union all
       select 'gender', gender, count(*) from gapfinder_case_funnel group by gender
       union all
       select 'nationality', nationality, count(*) from gapfinder_case_funnel group by nationality
       union all
       select 'area', area, count(*) from gapfinder_case_funnel group by area
     ) t where n < 10 order by dimension, group_value`,
  );
  return NextResponse.json({ metrics, improvement, fairness, counts, suppressed });
}