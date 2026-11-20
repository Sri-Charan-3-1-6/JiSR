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

  // Layer 5: check-in metrics, fairness and the aggregate-only companion
  // report. Suppression counts check-ins per demographic group (groups with
  // fewer than 10 check-ins — including zero — are named, never counted).
  const [checkinMetrics] = await query(`select * from gapfinder_checkin_metrics`);
  const checkinFairness = await query(
    `select * from gapfinder_checkin_fairness order by dimension, group_value`,
  );
  const [companion] = await query(`select * from gapfinder_companion_report`);
  const checkinSuppressed = await query(
    `select dimension, group_value from (
       select 'language' as dimension, r.language as group_value, count(ci.id) as n
         from residents r left join checkins ci on ci.resident_id = r.id
         where exists (select 1 from consent_scopes cs where cs.resident_id = r.id
                        and cs.scope = 'anonymous_aggregate_stats' and cs.granted)
         group by r.language
       union all
       select 'age_band', r.age_band, count(ci.id)
         from residents r left join checkins ci on ci.resident_id = r.id
         where exists (select 1 from consent_scopes cs where cs.resident_id = r.id
                        and cs.scope = 'anonymous_aggregate_stats' and cs.granted)
         group by r.age_band
       union all
       select 'gender', r.gender, count(ci.id)
         from residents r left join checkins ci on ci.resident_id = r.id
         where exists (select 1 from consent_scopes cs where cs.resident_id = r.id
                        and cs.scope = 'anonymous_aggregate_stats' and cs.granted)
         group by r.gender
       union all
       select 'nationality', r.nationality, count(ci.id)
         from residents r left join checkins ci on ci.resident_id = r.id
         where exists (select 1 from consent_scopes cs where cs.resident_id = r.id
                        and cs.scope = 'anonymous_aggregate_stats' and cs.granted)
         group by r.nationality
       union all
       select 'area', r.area, count(ci.id)
         from residents r left join checkins ci on ci.resident_id = r.id
         where exists (select 1 from consent_scopes cs where cs.resident_id = r.id
                        and cs.scope = 'anonymous_aggregate_stats' and cs.granted)
         group by r.area
     ) t where n < 10 order by dimension, group_value`,
  );
  return NextResponse.json({
    metrics,
    improvement,
    fairness,
    counts,
    suppressed,
    checkin: {
      metrics: checkinMetrics,
      fairness: checkinFairness,
      suppressed: checkinSuppressed,
      companion,
    },
  });
}