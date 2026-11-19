-- 011_seed_layer3.sql — SYNTHETIC primary-care flags and wearable signals
-- for the 8 demo residents. Wearable series are deterministic (no RNG):
-- 21 days, stable baseline; JISR-DEMO-004 shows a clear recent change so the
-- simulator can invite a check-in. Real wearable integration is future work.

insert into health_flags (resident_id, physical_conditions, sleep_flag, pain_flag)
select r.id, f.conditions, f.sleep, f.pain
from residents r
join (values
  ('JISR-DEMO-001', array['hypertension (self-reported)'], false, false),
  ('JISR-DEMO-002', array['type 2 diabetes (self-reported)'], true, false),
  ('JISR-DEMO-003', array[]::text[], false, true),
  ('JISR-DEMO-004', array['asthma (self-reported)'], true, false),
  ('JISR-DEMO-005', array[]::text[], false, false),
  ('JISR-DEMO-006', array['chronic back pain (self-reported)'], false, true),
  ('JISR-DEMO-007', array[]::text[], true, false),
  ('JISR-DEMO-008', array['hypertension (self-reported)', 'type 2 diabetes (self-reported)'], true, true)
) as f(pseudo_id, conditions, sleep, pain) on f.pseudo_id = r.pseudo_id
on conflict (resident_id) do nothing;

insert into wearable_days (resident_id, day, sleep_hours, steps, resting_hr)
select r.id,
       (sim_now()::date - (21 - i))::date,
       case when r.pseudo_id = 'JISR-DEMO-004' and i > 14
            then round((4.6 + 0.3 * sin(i))::numeric, 2)
            else round((7.0 + 0.4 * sin(i))::numeric, 2) end,
       case when r.pseudo_id = 'JISR-DEMO-004' and i > 14
            then (3200 + 400 * sin(i * 1.3))::int
            else (8000 + 900 * sin(i * 1.7))::int end,
       case when r.pseudo_id = 'JISR-DEMO-004' and i > 14
            then 70 + (2 * sin(i))::int
            else 62 + (3 * sin(i))::int end
from residents r, generate_series(1, 21) i
where r.pseudo_id like 'JISR-DEMO-%'
on conflict (resident_id, day) do nothing;