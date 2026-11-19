-- 009_consent_views.sql — Gap Finder and employer aggregates count ONLY
-- residents whose anonymous_aggregate_stats consent is ON. Revocation takes
-- effect immediately because the views read consent_scopes live.
-- CREATE OR REPLACE keeps existing column order (new columns append only).

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
join residents r on r.id = c.resident_id
where exists (
  select 1 from consent_scopes cs
  where cs.resident_id = r.id
    and cs.scope = 'anonymous_aggregate_stats' and cs.granted
);

-- gapfinder_metrics and gapfinder_fairness read the funnel, so they inherit
-- the consent filter automatically. Improvement reads screenings directly:
create or replace view gapfinder_improvement as
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
  where exists (
    select 1 from consent_scopes cs
    where cs.resident_id = s1.resident_id
      and cs.scope = 'anonymous_aggregate_stats' and cs.granted
  )
)
select count(*) as paired_residents,
       round(avg(first_score - later_score), 2) as avg_score_reduction,
       count(*) filter (where later_score < first_score) as improved,
       round(count(*) filter (where later_score < first_score)::numeric
             / nullif(count(*), 0), 4) as improvement_rate
from pairs
where rn = 1;

create or replace view employer_area_counts as
select r.area as group_value, count(*) as resident_count
from residents r
where exists (
  select 1 from consent_scopes cs
  where cs.resident_id = r.id
    and cs.scope = 'anonymous_aggregate_stats' and cs.granted
)
group by r.area having count(*) >= 10;

create or replace view employer_language_counts as
select r.language as group_value, count(*) as resident_count
from residents r
where exists (
  select 1 from consent_scopes cs
  where cs.resident_id = r.id
    and cs.scope = 'anonymous_aggregate_stats' and cs.granted
)
group by r.language having count(*) >= 10;

create or replace view employer_age_counts as
select r.age_band as group_value, count(*) as resident_count
from residents r
where exists (
  select 1 from consent_scopes cs
  where cs.resident_id = r.id
    and cs.scope = 'anonymous_aggregate_stats' and cs.granted
)
group by r.age_band having count(*) >= 10;

create or replace view employer_screening_totals as
select count(*) as screenings_total,
       count(*) filter (where s.crisis_flag) as crisis_screens_total
from screenings s
where exists (
  select 1 from consent_scopes cs
  where cs.resident_id = s.resident_id
    and cs.scope = 'anonymous_aggregate_stats' and cs.granted
)
having count(*) >= 10;

-- New employer dimension so the seeded small nationality group is visibly
-- suppressed ("<10") on the employer page. Aggregates only, same rules.
create view employer_nationality_counts as
select r.nationality as group_value, count(*) as resident_count
from residents r
where exists (
  select 1 from consent_scopes cs
  where cs.resident_id = r.id
    and cs.scope = 'anonymous_aggregate_stats' and cs.granted
)
group by r.nationality having count(*) >= 10;

grant select on employer_nationality_counts to jisr_employer;