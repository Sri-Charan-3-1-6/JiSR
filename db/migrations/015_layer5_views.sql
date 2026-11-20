-- 015_layer5_views.sql — Gap Finder check-in metrics as SQL views.
-- Same rules as Layer 2: consent filter (anonymous_aggregate_stats) inside
-- the funnel, percentile_cont for medians, small-cell suppression INSIDE the
-- views (HAVING COUNT(*) >= 10), fairness gap < 80% of the best group via a
-- window function. Companion mood tags appear ONLY as aggregates here.

-- Per-check-in funnel with demographics and time-to-re-engage after a miss:
-- hours until the resident's next completed check-in.
create view checkin_funnel as
select ci.id as checkin_id, ci.resident_id,
       r.language, r.age_band, r.gender, r.nationality, r.area,
       ci.state, ci.due_at, ci.created_at, ci.completed_at, ci.missed_at,
       (ci.state = 'completed') as completed,
       (ci.missed_at is not null) as missed,
       (select extract(epoch from (min(c2.completed_at) - ci.missed_at)) / 3600.0
        from checkins c2
        where c2.resident_id = ci.resident_id
          and c2.completed_at is not null
          and ci.missed_at is not null
          and c2.completed_at > ci.missed_at) as reengage_hours
from checkins ci
join residents r on r.id = ci.resident_id
where exists (
  select 1 from consent_scopes cs
  where cs.resident_id = r.id
    and cs.scope = 'anonymous_aggregate_stats' and cs.granted
);

-- Overall check-in metrics. An escalation counts as resolved by a human when
-- the navigator call reached the resident OR a trusted contact made contact.
create view gapfinder_checkin_metrics as
with tasks as (
  select t.id,
         (t.call_outcome = 'reached'
           or exists (select 1 from trusted_contact_events e
                      where e.task_id = t.id and e.kind = 'contact_made')) as resolved_by_human
  from navigator_tasks t
  where t.kind = 'checkin_escalation'
    and exists (
      select 1 from consent_scopes cs
      where cs.resident_id = t.resident_id
        and cs.scope = 'anonymous_aggregate_stats' and cs.granted
    )
)
select
  (select count(*) from checkin_funnel) as checkins_total,
  (select count(*) filter (where completed) from checkin_funnel) as completed_total,
  (select count(*) filter (where missed) from checkin_funnel) as missed_total,
  (select round(count(*) filter (where completed)::numeric / nullif(count(*), 0), 4)
   from checkin_funnel) as completion_rate,
  (select round((percentile_cont(0.5) within group (order by reengage_hours)
           filter (where reengage_hours is not null))::numeric, 2)
   from checkin_funnel) as median_hours_to_reengage,
  count(*) as escalations_total,
  count(*) filter (where resolved_by_human) as escalations_resolved_human,
  round(count(*) filter (where resolved_by_human)::numeric / nullif(count(*), 0), 4)
    as escalations_human_share
from tasks;

-- Check-in fairness: completion rate per group vs the best group in the same
-- dimension. Suppression enforced here (HAVING COUNT(*) >= 10).
create view gapfinder_checkin_fairness as
with grouped as (
  select 'language' as dimension, language as group_value,
         count(*) as n,
         count(*) filter (where completed) as completed_n,
         percentile_cont(0.5) within group (order by reengage_hours)
           filter (where reengage_hours is not null) as median_reengage
  from checkin_funnel group by language having count(*) >= 10
  union all
  select 'age_band', age_band, count(*),
         count(*) filter (where completed),
         percentile_cont(0.5) within group (order by reengage_hours)
           filter (where reengage_hours is not null)
  from checkin_funnel group by age_band having count(*) >= 10
  union all
  select 'gender', gender, count(*),
         count(*) filter (where completed),
         percentile_cont(0.5) within group (order by reengage_hours)
           filter (where reengage_hours is not null)
  from checkin_funnel group by gender having count(*) >= 10
  union all
  select 'nationality', nationality, count(*),
         count(*) filter (where completed),
         percentile_cont(0.5) within group (order by reengage_hours)
           filter (where reengage_hours is not null)
  from checkin_funnel group by nationality having count(*) >= 10
  union all
  select 'area', area, count(*),
         count(*) filter (where completed),
         percentile_cont(0.5) within group (order by reengage_hours)
           filter (where reengage_hours is not null)
  from checkin_funnel group by area having count(*) >= 10
),
rates as (
  select dimension, group_value, n,
         round(completed_n::numeric / n, 4) as completion_rate,
         round(median_reengage::numeric, 2) as median_hours_to_reengage
  from grouped
)
select dimension, group_value, n, completion_rate, median_hours_to_reengage,
       max(completion_rate) over (partition by dimension) as best_completion_rate,
       (completion_rate < 0.8 * max(completion_rate) over (partition by dimension)) as is_gap
from rates;

-- Aggregate-only companion report. mood_tag is NEVER exposed per resident;
-- this view is the only place it surfaces, as a population share.
create view gapfinder_companion_report as
select count(*) as sessions_total,
       count(*) filter (where mood_tag = 'heavy') as heavy_total,
       round(count(*) filter (where mood_tag = 'heavy')::numeric
             / nullif(count(*), 0), 4) as heavy_share,
       count(*) filter (where crisis_flag) as crisis_sessions
from companion_sessions cs
where exists (
  select 1 from consent_scopes csc
  where csc.resident_id = cs.resident_id
    and csc.scope = 'anonymous_aggregate_stats' and csc.granted
);