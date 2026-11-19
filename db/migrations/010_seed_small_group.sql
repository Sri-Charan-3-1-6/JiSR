-- 010_seed_small_group.sql — one deliberately small SYNTHETIC nationality
-- group (7 people, "Group S") so small-cell suppression is visible live:
-- it never appears in employer_nationality_counts or gapfinder_fairness
-- (both require COUNT(*) >= 10); the UIs render it as "<10".
-- Repeatable: fixed seed for any random attributes.

select setseed(0.42);

with ins_res as (
  insert into residents (pseudo_id, language, age_band, gender, nationality, area)
  select 'JISR-SYN-S' || lpad(i::text, 2, '0'),
         case i % 3 when 0 then 'en' when 1 then 'ar' else 'hi' end,
         case i % 3 when 0 then '25-34' when 1 then '35-44' else '18-24' end,
         case i % 2 when 0 then 'female' else 'male' end,
         'Group S',
         'Area ' || (1 + i % 5)
  from generate_series(1, 7) i
  returning id, pseudo_id
), ins_consent as (
  insert into consent_scopes (resident_id, scope, granted)
  select id, s.scope, true
  from ins_res, (values ('anonymous_aggregate_stats'), ('store_results')) as s(scope)
  returning resident_id
), ins_scr as (
  insert into screenings (resident_id, instrument, answers, total_score, band, created_at)
  select id, 'PHQ9', '[1,1,1,1,1,1,1,1,0]'::jsonb, 8, 'mild',
         sim_now() - interval '20 days'
  from ins_res
  returning id, resident_id
)
insert into cases (resident_id, screening_id, risk_tier, state, created_at,
                   matched_at, sla_contact_due)
select s.resident_id, s.id, 'mild',
       case when (right(r.pseudo_id, 2))::int <= 4 then 'MATCHED' else 'SCREENED' end,
       sim_now() - interval '20 days',
       case when (right(r.pseudo_id, 2))::int <= 4 then sim_now() - interval '19 days' else null end,
       sim_now() - interval '6 days'
from ins_scr s
join ins_res r on r.id = s.resident_id;