-- 002_seed_synthetic.sql — Layer 1 demo seed. ALL DATA IS SYNTHETIC.
-- Fixed seed for repeatability. Layer 2 adds the ~2000-resident Gap Finder
-- dataset in a later migration (006_seed_gapfinder.sql).

select setseed(0.42);

-- Demo residents (pseudonymous, no names / no ID numbers).
insert into residents (pseudo_id, language, age_band, gender, nationality, area) values
  ('JISR-DEMO-001', 'en', '25-34', 'female',   'Group A', 'Area 1'),
  ('JISR-DEMO-002', 'ar', '18-24', 'male',     'Group B', 'Area 2'),
  ('JISR-DEMO-003', 'hi', '35-44', 'male',     'Group C', 'Area 3'),
  ('JISR-DEMO-004', 'en', '45-54', 'female',   'Group A', 'Area 1'),
  ('JISR-DEMO-005', 'ar', '25-34', 'female',   'Group B', 'Area 2'),
  ('JISR-DEMO-006', 'en', '55-64', 'male',     'Group D', 'Area 4'),
  ('JISR-DEMO-007', 'hi', '18-24', 'undisclosed', 'Group C', 'Area 3'),
  ('JISR-DEMO-008', 'en', '35-44', 'female',   'Group D', 'Area 4');

-- Helper: screening rows. Answers are arrays of 0..3 per item.
-- PHQ-9 item 9 > 0 => crisis. Scores computed by the same bands as lib/scoring.ts.
with r as (select id, pseudo_id from residents)
insert into screenings (resident_id, instrument, answers, free_text, total_score, band, crisis_flag, crisis_reason, created_at)
select r.id, s.instrument, s.answers::jsonb, s.free_text, s.score, s.band, s.crisis, s.reason,
       sim_now() - s.age
from r
join (values
  ('JISR-DEMO-001', 'PHQ9', '[0,0,0,1,0,0,0,0,0]', null,                 1,  'minimal', false, null,   interval '40 days'),
  ('JISR-DEMO-002', 'PHQ9', '[2,2,2,3,2,2,2,1,2]', null,                18,  'moderately_severe', false, null, interval '3 days'),
  ('JISR-DEMO-003', 'PHQ9', '[1,2,1,2,1,1,1,1,0]', 'feeling low lately', 10,  'moderate', false, null, interval '8 days'),
  ('JISR-DEMO-004', 'GAD7', '[1,1,1,0,1,0,1]',     null,                 5,  'mild', false, null,    interval '5 days'),
  ('JISR-DEMO-005', 'PHQ9', '[1,1,1,1,1,1,1,1,1]', null,                 9,  'mild', false, null,    interval '2 days'),
  ('JISR-DEMO-006', 'PHQ9', '[3,3,3,3,3,3,3,3,2]', null,                26,  'severe', false, null,  interval '2 days'),
  ('JISR-DEMO-007', 'PHQ9', '[1,1,1,1,1,1,1,1,1]', 'sometimes I think about suicide', 9, 'mild', true, 'keyword', interval '6 hours'),
  ('JISR-DEMO-008', 'GAD7', '[3,3,3,3,3,3,3]',     null,                21,  'severe', false, null,  interval '1 day')
) as s(pseudo_id, instrument, answers, free_text, score, band, crisis, reason, age)
  on s.pseudo_id = r.pseudo_id;

-- Cases in various states; several deliberately past SLA so the Overdue queue
-- is non-empty at demo time. Deadlines follow the stepped-care SLA rules.
with r as (select id, pseudo_id from residents),
     s as (select id, resident_id, row_number() over (partition by resident_id order by created_at) rn from screenings)
insert into cases (resident_id, screening_id, risk_tier, state, matched_step,
                   sla_contact_due, sla_book_due, sla_followup_due,
                   created_at, matched_at, contacted_at, booked_at, attended_at, followed_up_at)
select r.id, s.id, c.tier, c.state, c.step,
       case when c.contact_h is not null then sim_now() - c.age + (c.contact_h || ' hours')::interval end,
       case when c.book_h    is not null then sim_now() - c.age + (c.book_h    || ' hours')::interval end,
       case when c.fu_d      is not null then sim_now() - c.age + (c.fu_d      || ' days')::interval end,
       sim_now() - c.age,
       case when c.matched_lag_h is not null then sim_now() - c.age + (c.matched_lag_h || ' hours')::interval end,
       case when c.contacted_lag_h is not null then sim_now() - c.age + (c.contacted_lag_h || ' hours')::interval end,
       case when c.booked_lag_h is not null then sim_now() - c.age + (c.booked_lag_h || ' hours')::interval end,
       case when c.attended_lag_h is not null then sim_now() - c.age + (c.attended_lag_h || ' hours')::interval end,
       case when c.fu_lag_d is not null then sim_now() - c.age + (c.fu_lag_d || ' days')::interval end
from r
join (values
  -- pseudo_id, tier, state, step, age, contactSLA(h), bookSLA(h), fuSLA(d), matchedLag(h), contactedLag(h), bookedLag(h), attendedLag(h), fuLag(d)
  ('JISR-DEMO-001', 'minimal', 'FOLLOWED_UP_30D', 'self_help',        interval '40 days', null, null, 30, 1, null, null, null, 31),
  ('JISR-DEMO-002', 'moderately_severe', 'NAVIGATOR_CONTACTED', 'specialist', interval '3 days', 24, 72, null, 1, 20, null, null, null),
  ('JISR-DEMO-003', 'moderate', 'SCREENED', null,                    interval '8 days', 168, null, null, null, null, null, null, null),
  ('JISR-DEMO-004', 'mild', 'MATCHED', 'community_support',          interval '5 days', 336, null, null, 2, null, null, null, null),
  ('JISR-DEMO-005', 'mild', 'MATCHED', 'community_support',          interval '2 days', 336, null, null, 1, null, null, null, null),
  ('JISR-DEMO-006', 'severe', 'BOOKED', 'specialist',                interval '2 days', 24, 72, null, 1, 10, 40, null, null),
  ('JISR-DEMO-007', 'crisis', 'SCREENED', 'human_immediately',       interval '6 hours', 0, null, null, null, null, null, null, null),
  ('JISR-DEMO-008', 'severe', 'MATCHED', 'tele_mental_health',       interval '1 day', 24, 72, null, 1, null, null, null, null)
) as c(pseudo_id, tier, state, step, age, contact_h, book_h, fu_d, matched_lag_h, contacted_lag_h, booked_lag_h, attended_lag_h, fu_lag_d)
  on c.pseudo_id = r.pseudo_id
join s on s.resident_id = r.id and s.rn = 1;

-- Timeline events for seeded cases (state changes + one outreach log).
insert into case_events (case_id, event_type, from_state, to_state, detail, created_at)
select c.id, 'state_change', 'SCREENED', c.state, '{"seed": true}'::jsonb, c.created_at
from cases c where c.state <> 'SCREENED';

insert into outreach_attempts (case_id, channel, outcome, note, attempted_at)
select c.id, 'call', 'reached', 'Seeded demo outreach (synthetic).', c.contacted_at
from cases c where c.contacted_at is not null;

-- Consent scopes exist for every resident, all OFF by default (Layer 2 UI).
insert into consent_scopes (resident_id, scope, granted)
select r.id, s.scope, false
from residents r
cross join (values ('store_results'), ('share_with_primary_care'),
                   ('anonymous_aggregate_stats'), ('wearable_signal'),
                   ('navigator_contact')) as s(scope);