-- 006_seed_gapfinder.sql — Layer 2 Gap Finder dataset.
-- ALL SYNTHETIC. Fixed seed (setseed) for repeatability. ~2000 residents with
-- deliberately injected gaps:
--   * Hindi speakers: lower screen-to-match (0.55 vs 0.90)
--   * Age 18-24: lower match (0.70) and attendance (0.65)
--   * Arabic speakers: lower navigator contact (0.75)
--   * Nationality Group C and Area 3: lower booking within SLA (0.50 / 0.55)
--   * ~2% crisis screens; ~15% of crisis cases miss the callback (adverse events)

select setseed(0.42);

with nums as (
  select i,
    random() as r_lang, random() as r_age, random() as r_gender,
    random() as r_nat, random() as r_area,
    random() as r_score1, random() as r_score2, random() as r_crisis,
    random() as r_matched, random() as r_contact, random() as r_book,
    random() as r_attend, random() as r_fu,
    random() as r_age_days, random() as r_contact_h, random() as r_book_h,
    random() as r_attend_d, random() as r_rescreen, random() as r_improve,
    random() as r_consent
  from generate_series(1, 2000) as i
),
demo as (
  select *,
    case when r_lang < 0.55 then 'en' when r_lang < 0.80 then 'ar' else 'hi' end as language,
    case when r_age < 0.20 then '18-24' when r_age < 0.50 then '25-34'
         when r_age < 0.75 then '35-44' when r_age < 0.90 then '45-54'
         when r_age < 0.97 then '55-64' else '65+' end as age_band,
    case when r_gender < 0.48 then 'female' when r_gender < 0.96 then 'male'
         when r_gender < 0.98 then 'other' else 'undisclosed' end as gender,
    case when r_nat < 0.40 then 'Group A' when r_nat < 0.70 then 'Group B'
         when r_nat < 0.90 then 'Group C' else 'Group D' end as nationality,
    case when r_area < 0.25 then 'Area 1' when r_area < 0.50 then 'Area 2'
         when r_area < 0.70 then 'Area 3' when r_area < 0.85 then 'Area 4'
         else 'Area 5' end as area,
    floor((r_score1 + r_score2) / 2 * 28)::int as total_score,
    (r_crisis < 0.02) as crisis
  from nums
),
banded as (
  select *,
    case when total_score <= 4 then 'minimal' when total_score <= 9 then 'mild'
         when total_score <= 14 then 'moderate' when total_score <= 19 then 'moderately_severe'
         else 'severe' end as score_band,
    case when crisis then 'crisis'
         when total_score <= 4 then 'minimal' when total_score <= 9 then 'mild'
         when total_score <= 14 then 'moderate' when total_score <= 19 then 'moderately_severe'
         else 'severe' end as tier
  from demo
),
flags as (
  select *,
    (r_matched < case when language = 'hi' then 0.55
                      when age_band = '18-24' then 0.70
                      else 0.90 end) as matched_f,
    (r_contact < case when language = 'ar' then 0.75 else 0.88 end) as contact_f,
    (r_book < case when nationality = 'Group C' then 0.50
                   when area = 'Area 3' then 0.55
                   else 0.80 end) as book_f,
    (r_attend < case when age_band = '18-24' then 0.65 else 0.85 end) as attend_f,
    sim_now() - (r_age_days * 60 * interval '1 day') as created
  from banded
),
state_calc as (
  select *,
    (case when tier = 'crisis' then contact_f
          else matched_f and contact_f end) as contacted_f,
    (tier in ('moderate','moderately_severe','severe')
      and matched_f and contact_f and book_f) as booked_f,
    (tier in ('moderate','moderately_severe','severe')
      and matched_f and contact_f and book_f and attend_f) as attended_f,
    ((tier = 'minimal' and r_fu < 0.70)
      or (tier in ('moderate','moderately_severe','severe')
          and matched_f and contact_f and book_f and attend_f and r_fu < 0.75))
    as followed_f
  from flags
),
ins_res as (
  insert into residents (pseudo_id, language, age_band, gender, nationality, area)
  select 'JISR-SYN-' || lpad(i::text, 4, '0'), language, age_band, gender, nationality, area
  from state_calc
  returning id, pseudo_id
),
joined as (
  select s.*, r.id as rid
  from state_calc s
  join ins_res r on r.pseudo_id = 'JISR-SYN-' || lpad(s.i::text, 4, '0')
),
ins_scr as (
  insert into screenings
    (resident_id, instrument, answers, free_text, total_score, band, crisis_flag, crisis_reason, created_at)
  select rid, 'PHQ9',
    (select jsonb_agg(least(3, total_score / 9 + case when g <= total_score % 9 then 1 else 0 end))
     from generate_series(1, 9) as g),
    null, total_score, score_band, crisis,
    case when crisis then 'item9' end,
    created
  from joined
  returning id, resident_id, created_at
),
ins_cases as (
  insert into cases
    (resident_id, screening_id, risk_tier, state, matched_step,
     sla_contact_due, sla_book_due, sla_followup_due,
     created_at, matched_at, contacted_at, booked_at, attended_at, followed_up_at)
  select j.rid, s.id, j.tier,
    case when j.followed_f and j.created <= sim_now() - interval '30 days' then 'FOLLOWED_UP_30D'
         when j.attended_f then 'ATTENDED'
         when j.booked_f then 'BOOKED'
         when j.contacted_f then 'NAVIGATOR_CONTACTED'
         when j.matched_f and j.tier <> 'crisis' then 'MATCHED'
         else 'SCREENED' end,
    case j.tier when 'minimal' then 'self_help' when 'mild' then 'community_support'
         when 'moderate' then 'primary_care' when 'crisis' then 'human_immediately'
         else 'specialist' end,
    case j.tier when 'crisis' then j.created
         when 'severe' then j.created + interval '24 hours'
         when 'moderately_severe' then j.created + interval '24 hours'
         when 'moderate' then j.created + interval '168 hours'
         when 'mild' then j.created + interval '336 hours'
         else null end,
    case when j.tier in ('severe','moderately_severe') then j.created + interval '72 hours' else null end,
    case when j.tier = 'minimal' then j.created + interval '30 days' else null end,
    j.created,
    case when j.matched_f and j.tier <> 'crisis' then j.created + interval '1 hour' end,
    case when j.contacted_f then j.created + (j.r_contact_h * 48) * interval '1 hour' end,
    case when j.booked_f then j.created + (j.r_contact_h * 48) * interval '1 hour' + (j.r_book_h * 72) * interval '1 hour' end,
    case when j.attended_f then j.created + (j.r_contact_h * 48) * interval '1 hour' + (j.r_book_h * 72) * interval '1 hour' + (1 + j.r_attend_d * 10) * interval '1 day' end,
    case when j.followed_f and j.created <= sim_now() - interval '30 days' then j.created + interval '30 days' end
  from joined j
  join ins_scr s on s.resident_id = j.rid
  returning resident_id, created_at
),
-- 30-day re-screens for a subset of attended residents (improvement metric).
rescreen as (
  select j.rid, j.total_score, j.r_improve, j.created
  from joined j
  where j.attended_f and j.r_rescreen < 0.40 and j.created <= sim_now() - interval '32 days'
)
insert into screenings
  (resident_id, instrument, answers, free_text, total_score, band, crisis_flag, created_at)
select rid, 'PHQ9',
  (select jsonb_agg(least(3, ns / 9 + case when g <= ns % 9 then 1 else 0 end))
   from generate_series(1, 9) as g),
  null, ns,
  case when ns <= 4 then 'minimal' when ns <= 9 then 'mild' when ns <= 14 then 'moderate'
       when ns <= 19 then 'moderately_severe' else 'severe' end,
  false, created + interval '30 days'
from (
  select rid, created,
    greatest(0, total_score + case when r_improve > 0.80 then 2 else -floor(r_improve * 8)::int end) as ns
  from rescreen
) t;

-- Consent for synthetic residents: aggregates ON (synthetic population),
-- store_results ON for ~70%, everything else OFF by default.
insert into consent_scopes (resident_id, scope, granted)
select r.id, s.scope,
  case s.scope
    when 'anonymous_aggregate_stats' then true
    when 'store_results' then (select random() < 0.70)
    else false
  end
from residents r
cross join (values ('store_results'), ('share_with_primary_care'),
                   ('anonymous_aggregate_stats'), ('wearable_signal'),
                   ('navigator_contact')) as s(scope)
where r.pseudo_id like 'JISR-SYN-%';