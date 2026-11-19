-- 007_funnel_fix.sql — booked-to-attended must divide by ALL booked cases,
-- not only booked-within-SLA (late bookings can still be attended).
-- Also flags booking-conversion gaps (<80% of best group) per dimension.
-- CREATE OR REPLACE keeps existing column order; new columns are appended.

create or replace view gapfinder_case_funnel as
select c.id as case_id, c.resident_id,
       r.language, r.age_band, r.gender, r.nationality, r.area,
       c.risk_tier, c.state, c.created_at,
       c.matched_at, c.contacted_at, c.booked_at, c.attended_at, c.followed_up_at,
       c.sla_contact_due, c.sla_book_due,
       (c.matched_at is not null) as matched,
       (c.contacted_at is not null
         and (c.sla_contact_due is null or c.contacted_at <= c.sla_contact_due)) as contacted_in_sla,
       (c.booked_at is not null
         and (c.sla_book_due is null or c.booked_at <= c.sla_book_due)) as booked_in_sla,
       (c.attended_at is not null) as attended,
       (c.followed_up_at is not null) as followed_up,
       (c.booked_at is not null) as booked
from cases c
join residents r on r.id = c.resident_id;

create or replace view gapfinder_metrics as
select
  count(*) as cases_total,
  count(*) filter (where matched) as matched_total,
  round(count(*) filter (where matched)::numeric / nullif(count(*), 0), 4) as screen_to_match_rate,
  round(count(*) filter (where booked_in_sla)::numeric
        / nullif(count(*) filter (where matched), 0), 4) as match_to_booked_sla_rate,
  round(count(*) filter (where attended)::numeric
        / nullif(count(*) filter (where booked), 0), 4) as booked_to_attended_rate,
  percentile_cont(0.5) within group (
    order by extract(epoch from (followed_up_at - created_at)) / 86400.0
  ) filter (where followed_up_at is not null) as median_days_to_followup,
  percentile_cont(0.5) within group (
    order by extract(epoch from (booked_at - created_at)) / 86400.0
  ) filter (where booked_at is not null) as median_waiting_days,
  count(*) filter (where risk_tier = 'crisis') as crisis_total,
  count(*) filter (where risk_tier = 'crisis' and contacted_at is not null) as crisis_responded,
  round(count(*) filter (where risk_tier = 'crisis' and contacted_at is not null)::numeric
        / nullif(count(*) filter (where risk_tier = 'crisis'), 0), 4) as crisis_response_completion,
  count(*) filter (
    where risk_tier = 'crisis' and contacted_at is null
      and sla_contact_due is not null and sim_now() > sla_contact_due
  ) as adverse_missed_crisis_callbacks
from gapfinder_case_funnel;

create or replace view gapfinder_fairness as
with grouped as (
  select 'language' as dimension, language as group_value,
         count(*) as n,
         count(*) filter (where matched) as matched_n,
         count(*) filter (where booked_in_sla) as booked_sla_n,
         count(*) filter (where booked) as booked_n,
         count(*) filter (where attended) as attended_n,
         percentile_cont(0.5) within group (
           order by extract(epoch from (booked_at - created_at)) / 86400.0
         ) filter (where booked_at is not null) as median_waiting_days
  from gapfinder_case_funnel group by language having count(*) >= 10
  union all
  select 'age_band', age_band, count(*),
         count(*) filter (where matched), count(*) filter (where booked_in_sla),
         count(*) filter (where booked), count(*) filter (where attended),
         percentile_cont(0.5) within group (
           order by extract(epoch from (booked_at - created_at)) / 86400.0
         ) filter (where booked_at is not null)
  from gapfinder_case_funnel group by age_band having count(*) >= 10
  union all
  select 'gender', gender, count(*),
         count(*) filter (where matched), count(*) filter (where booked_in_sla),
         count(*) filter (where booked), count(*) filter (where attended),
         percentile_cont(0.5) within group (
           order by extract(epoch from (booked_at - created_at)) / 86400.0
         ) filter (where booked_at is not null)
  from gapfinder_case_funnel group by gender having count(*) >= 10
  union all
  select 'nationality', nationality, count(*),
         count(*) filter (where matched), count(*) filter (where booked_in_sla),
         count(*) filter (where booked), count(*) filter (where attended),
         percentile_cont(0.5) within group (
           order by extract(epoch from (booked_at - created_at)) / 86400.0
         ) filter (where booked_at is not null)
  from gapfinder_case_funnel group by nationality having count(*) >= 10
  union all
  select 'area', area, count(*),
         count(*) filter (where matched), count(*) filter (where booked_in_sla),
         count(*) filter (where booked), count(*) filter (where attended),
         percentile_cont(0.5) within group (
           order by extract(epoch from (booked_at - created_at)) / 86400.0
         ) filter (where booked_at is not null)
  from gapfinder_case_funnel group by area having count(*) >= 10
),
rates as (
  select dimension, group_value, n,
         round(matched_n::numeric / n, 4) as screen_to_match,
         round(booked_sla_n::numeric / nullif(matched_n, 0), 4) as match_to_booked_sla,
         round(attended_n::numeric / nullif(booked_n, 0), 4) as booked_to_attended,
         round(median_waiting_days::numeric, 2) as median_waiting_days
  from grouped
)
select dimension, group_value, n, screen_to_match, match_to_booked_sla,
       booked_to_attended, median_waiting_days,
       max(screen_to_match) over (partition by dimension) as best_screen_to_match,
       (screen_to_match < 0.8 * max(screen_to_match) over (partition by dimension)) as is_gap,
       max(match_to_booked_sla) over (partition by dimension) as best_match_to_booked,
       (match_to_booked_sla < 0.8 * max(match_to_booked_sla) over (partition by dimension)) as is_gap_booked
from rates;