-- 005_gapfinder_views.sql — Layer 2 metrics as SQL views.
-- Rules honored: window functions + percentile_cont for medians; small-cell
-- suppression INSIDE the views (HAVING COUNT(*) >= 10); employer views expose
-- only aggregated anonymous counts.

-- Per-case funnel with demographics (internal, health-system use).
create view gapfinder_case_funnel as
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
       (c.followed_up_at is not null) as followed_up
from cases c
join residents r on r.id = c.resident_id;

-- Overall metrics. Medians use percentile_cont; crisis completion and adverse
-- events (missed crisis callbacks) are deterministic counts.
create view gapfinder_metrics as
select
  count(*) as cases_total,
  count(*) filter (where matched) as matched_total,
  round(count(*) filter (where matched)::numeric / nullif(count(*), 0), 4) as screen_to_match_rate,
  round(count(*) filter (where booked_in_sla)::numeric
        / nullif(count(*) filter (where matched), 0), 4) as match_to_booked_sla_rate,
  round(count(*) filter (where attended)::numeric
        / nullif(count(*) filter (where booked_in_sla), 0), 4) as booked_to_attended_rate,
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

-- Symptom improvement at 30 days: same instrument re-screened 25-35 days later.
create view gapfinder_improvement as
with pairs as (
  select s1.resident_id, s1.total_score as first_score, s2.total_score as later_score,
         row_number() over (
           partition by s1.resident_id, s1.instrument order by s2.created_at
         ) as rn
  from screenings s1
  join screenings s2
    on s2.resident_id = s1.resident_id
   and s2.instrument = s1.instrument
   and s2.created_at between s1.created_at + interval '25 days'
                         and s1.created_at + interval '35 days'
)
select count(*) as paired_residents,
       round(avg(first_score - later_score), 2) as avg_score_reduction,
       count(*) filter (where later_score < first_score) as improved,
       round(count(*) filter (where later_score < first_score)::numeric
             / nullif(count(*), 0), 4) as improvement_rate
from pairs
where rn = 1;

-- Fairness table: each group's conversion vs the best group in its dimension.
-- Suppression is enforced here (HAVING COUNT(*) >= 10), not only in the UI.
-- Best-group comparison uses a window function.
create view gapfinder_fairness as
with grouped as (
  select 'language' as dimension, language as group_value,
         count(*) as n,
         count(*) filter (where matched) as matched_n,
         count(*) filter (where booked_in_sla) as booked_n,
         count(*) filter (where attended) as attended_n,
         percentile_cont(0.5) within group (
           order by extract(epoch from (booked_at - created_at)) / 86400.0
         ) filter (where booked_at is not null) as median_waiting_days
  from gapfinder_case_funnel group by language having count(*) >= 10
  union all
  select 'age_band', age_band, count(*),
         count(*) filter (where matched), count(*) filter (where booked_in_sla),
         count(*) filter (where attended),
         percentile_cont(0.5) within group (
           order by extract(epoch from (booked_at - created_at)) / 86400.0
         ) filter (where booked_at is not null)
  from gapfinder_case_funnel group by age_band having count(*) >= 10
  union all
  select 'gender', gender, count(*),
         count(*) filter (where matched), count(*) filter (where booked_in_sla),
         count(*) filter (where attended),
         percentile_cont(0.5) within group (
           order by extract(epoch from (booked_at - created_at)) / 86400.0
         ) filter (where booked_at is not null)
  from gapfinder_case_funnel group by gender having count(*) >= 10
  union all
  select 'nationality', nationality, count(*),
         count(*) filter (where matched), count(*) filter (where booked_in_sla),
         count(*) filter (where attended),
         percentile_cont(0.5) within group (
           order by extract(epoch from (booked_at - created_at)) / 86400.0
         ) filter (where booked_at is not null)
  from gapfinder_case_funnel group by nationality having count(*) >= 10
  union all
  select 'area', area, count(*),
         count(*) filter (where matched), count(*) filter (where booked_in_sla),
         count(*) filter (where attended),
         percentile_cont(0.5) within group (
           order by extract(epoch from (booked_at - created_at)) / 86400.0
         ) filter (where booked_at is not null)
  from gapfinder_case_funnel group by area having count(*) >= 10
),
rates as (
  select dimension, group_value, n,
         round(matched_n::numeric / n, 4) as screen_to_match,
         round(booked_n::numeric / nullif(matched_n, 0), 4) as match_to_booked_sla,
         round(attended_n::numeric / nullif(booked_n, 0), 4) as booked_to_attended,
         round(median_waiting_days::numeric, 2) as median_waiting_days
  from grouped
)
select dimension, group_value, n, screen_to_match, match_to_booked_sla,
       booked_to_attended, median_waiting_days,
       max(screen_to_match) over (partition by dimension) as best_screen_to_match,
       (screen_to_match < 0.8 * max(screen_to_match) over (partition by dimension)) as is_gap
from rates;

-- Employer-facing views: ONLY aggregated anonymous counts.
-- Small groups (<10) never appear; the UI renders them as "<10".
create view employer_area_counts as
select area as group_value, count(*) as resident_count
from residents group by area having count(*) >= 10;

create view employer_language_counts as
select language as group_value, count(*) as resident_count
from residents group by language having count(*) >= 10;

create view employer_age_counts as
select age_band as group_value, count(*) as resident_count
from residents group by age_band having count(*) >= 10;

create view employer_screening_totals as
select count(*) as screenings_total,
       count(*) filter (where crisis_flag) as crisis_screens_total
from screenings
having count(*) >= 10;

grant select on employer_area_counts, employer_language_counts,
                employer_age_counts, employer_screening_totals to jisr_employer;