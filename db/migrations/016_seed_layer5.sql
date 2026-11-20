-- 016_seed_layer5.sql — SYNTHETIC Check-in Companion dataset.
-- Fixed seed for repeatability. Injected gap: Hindi speakers complete
-- check-ins at a visibly lower rate (~0.55 vs ~0.85 en). Group S (7 people)
-- is deliberately excluded so small-cell suppression stays visible.
-- Trusted-contact messages are the generic template with a pseudonymous
-- handle — never any health wording.

select setseed(0.5);

-- Pre-written supportive lines (never AI-generated). Observational,
-- non-prescribing, no toxic positivity. Jokes are mild and opt-in only.
insert into calm_lines (language, kind, exercise, body, reviewed, reviewed_by, reviewed_at) values
  ('en', 'support', 'breathing', 'You showed up today. That counts.', true, 'faculty-demo', sim_now() - interval '2 days'),
  ('en', 'support', 'grounding', 'There is no right way to feel right now.', true, 'faculty-demo', sim_now() - interval '2 days'),
  ('en', 'support', 'memory', 'Taking a pause is a reasonable thing to do.', true, 'faculty-demo', sim_now() - interval '2 days'),
  ('en', 'support', null, 'You can stop at any point. Nothing here is a test.', true, 'faculty-demo', sim_now() - interval '2 days'),
  ('en', 'support', null, 'Some days are heavier than others. That is allowed.', false, null, null),
  ('en', 'support', null, 'You know your situation better than any app does.', false, null, null),
  ('en', 'joke', null, 'Why did the scarecrow win an award? He was outstanding in his field.', false, null, null),
  ('en', 'joke', null, 'I told my calendar a joke. It did not get it — bad timing.', false, null, null),
  ('en', 'joke', null, 'Parallel lines have so much in common. It is a shame they will never meet.', false, null, null),
  ('ar', 'support', 'breathing', 'وجودك هنا اليوم خطوة بحد ذاتها.', true, 'faculty-demo', sim_now() - interval '2 days'),
  ('ar', 'support', 'grounding', 'لا توجد طريقة صحيحة للشعور في هذه اللحظة.', true, 'faculty-demo', sim_now() - interval '2 days'),
  ('ar', 'support', 'memory', 'أخذ استراحة قصيرة أمر معقول.', true, 'faculty-demo', sim_now() - interval '2 days'),
  ('ar', 'support', null, 'يمكنك التوقف في أي وقت. لا يوجد اختبار هنا.', true, 'faculty-demo', sim_now() - interval '2 days'),
  ('ar', 'support', null, 'بعض الأيام أثقل من غيرها. هذا مسموح.', false, null, null),
  ('ar', 'support', null, 'أنت أعرف بظروفك من أي تطبيق.', false, null, null),
  ('ar', 'joke', null, 'لماذا فاز الفزاعة بجائزة؟ لأنه كان بارزًا في حقله.', false, null, null),
  ('ar', 'joke', null, 'قلت للتقويم نكتة. لم يفهمها — توقيت سيئ.', false, null, null),
  ('ar', 'joke', null, 'الخطوط المتوازية بينها الكثير من القواسم المشتركة. من المؤسف أنها لن تلتقي أبدًا.', false, null, null),
  ('hi', 'support', 'breathing', 'आज आप यहाँ आए। यह अपने आप में एक कदम है।', true, 'faculty-demo', sim_now() - interval '2 days'),
  ('hi', 'support', 'grounding', 'इस समय कैसा महसूस हो रहा है, इसका कोई सही तरीका नहीं है।', true, 'faculty-demo', sim_now() - interval '2 days'),
  ('hi', 'support', 'memory', 'थोड़ा रुकना एक समझदारी भरा कदम हो सकता है।', true, 'faculty-demo', sim_now() - interval '2 days'),
  ('hi', 'support', null, 'आप कभी भी रुक सकते हैं। यहाँ कोई परीक्षा नहीं है।', true, 'faculty-demo', sim_now() - interval '2 days'),
  ('hi', 'support', null, 'कुछ दिन दूसरों से भारी होते हैं। यह ठीक है।', false, null, null),
  ('hi', 'support', null, 'आपकी स्थिति को आप किसी भी ऐप से बेहतर जानते हैं।', false, null, null),
  ('hi', 'joke', null, 'बिजूका को पुरस्कार क्यों मिला? क्योंकि वह अपने खेत में सबसे अलग खड़ा था।', false, null, null),
  ('hi', 'joke', null, 'मैंने कैलेंडर को चुटकुला सुनाया। उसे समझ नहीं आया — समय गलत था।', false, null, null),
  ('hi', 'joke', null, 'समांतर रेखाओं में बहुत कुछ साझा है। अफसोस है कि वे कभी नहीं मिलतीं।', false, null, null);

-- Demo residents get a schedule; jokes stay OFF by default for everyone.
insert into reminder_prefs (resident_id)
select id from residents where pseudo_id like 'JISR-DEMO-%'
on conflict (resident_id) do nothing;

insert into companion_prefs (resident_id)
select id from residents where pseudo_id like 'JISR-DEMO-%'
on conflict (resident_id) do nothing;

-- New consent scopes: reminders ~90% ON, trusted_contact ~30% ON (opt-in).
insert into consent_scopes (resident_id, scope, granted)
select r.id, s.scope,
  case s.scope when 'reminders' then random() < 0.90 else random() < 0.30 end
from residents r
cross join (values ('reminders'), ('trusted_contact')) as s(scope)
where r.pseudo_id like 'JISR-SYN-%'
on conflict (resident_id, scope) do nothing;

insert into consent_scopes (resident_id, scope, granted)
select r.id, s.scope, true
from residents r
cross join (values ('reminders'), ('trusted_contact')) as s(scope)
where r.pseudo_id like 'JISR-DEMO-%'
on conflict (resident_id, scope) do nothing;

-- Six check-ins per synthetic resident over 30 days. Completion correlates
-- with language (hi 0.55, ar 0.75, en 0.85) with small age/area penalties.
-- ~60% of misses are followed by a completed re-engagement check-in 6-66h
-- later, which feeds median_hours_to_reengage.
with base as (
  select r.id as rid, r.language, r.age_band, r.area, i,
         random() as r_done, random() as r_re, random() as r_h, random() as r_gap
  from residents r, generate_series(1, 6) i
  where r.pseudo_id ~ '^JISR-SYN-[0-9]{4}$'
),
sched as (
  select *,
    sim_now() - ((6 - i) * 5) * interval '1 day' - (r_h * 8) * interval '1 hour' as due,
    (r_done < (case when language = 'hi' then 0.55
                    when language = 'ar' then 0.75 else 0.85 end
               - case when age_band = '18-24' then 0.10 else 0 end
               - case when area = 'Area 3' then 0.05 else 0 end)) as done_f
  from base
),
ins_ci as (
  insert into checkins (resident_id, due_at, state, completed_at, missed_at,
                        consecutive_misses, reminders_sent, created_at)
  select rid, due,
    case when done_f then 'completed' else 'missed' end,
    case when done_f then due + (r_gap * 6) * interval '1 hour' end,
    case when not done_f then due + interval '2 hours' end,
    case when not done_f then 1 else 0 end,
    case when not done_f then 2 else 1 end,
    due - interval '1 day'
  from sched
  returning id, resident_id, due_at, state, missed_at
)
insert into checkins (resident_id, due_at, state, completed_at, reminders_sent, created_at)
select c.resident_id,
       c.missed_at + (6 + s.r_re * 60) * interval '1 hour',
       'completed',
       c.missed_at + (6 + s.r_re * 60) * interval '1 hour',
       1, c.missed_at
from ins_ci c
join sched s on s.rid = c.resident_id and s.due = c.due_at
where c.state = 'missed' and s.r_re < 0.60;

-- Audit trail for the seeded history: reminder + completion for completed
-- check-ins; reminder + soft reminder + miss for missed ones.
insert into reminder_events (resident_id, checkin_id, kind, created_at)
select c.resident_id, c.id, 'reminder', c.due_at
from checkins c
join residents r on r.id = c.resident_id
where r.pseudo_id ~ '^JISR-SYN-[0-9]{4}$';

insert into reminder_events (resident_id, checkin_id, kind, created_at)
select c.resident_id, c.id, 'completed', c.completed_at
from checkins c
join residents r on r.id = c.resident_id
where r.pseudo_id ~ '^JISR-SYN-[0-9]{4}$' and c.completed_at is not null;

insert into reminder_events (resident_id, checkin_id, kind, created_at)
select c.resident_id, c.id, k.kind, c.due_at + k.off * interval '1 hour'
from checkins c
join residents r on r.id = c.resident_id
cross join lateral (values ('soft_reminder', 2), ('missed', 2)) as k(kind, off)
where r.pseudo_id ~ '^JISR-SYN-[0-9]{4}$' and c.state = 'missed';

-- Escalations: residents with >=3 missed check-ins, sampled to ~35% so the
-- navigator task list stays realistic. 55% of calls reach the resident,
-- 25% fail (the ONLY trusted-contact precondition), 20% stay open.
with miss_stats as (
  select c.resident_id,
         count(*) filter (where c.state = 'missed') as miss_n,
         max(c.missed_at) as last_miss
  from checkins c
  join residents r on r.id = c.resident_id
  where r.pseudo_id ~ '^JISR-SYN-[0-9]{4}$'
  group by c.resident_id
),
picked as (
  select *, random() as r_pick, random() as r_call
  from miss_stats where miss_n >= 3
)
insert into navigator_tasks
  (resident_id, case_id, kind, reason, consecutive_misses, created_at,
   call_outcome, call_note, resolved_at)
select p.resident_id,
       (select c.id from cases c where c.resident_id = p.resident_id
        order by c.created_at desc limit 1),
       'checkin_escalation',
       p.miss_n || ' consecutive missed check-ins',
       p.miss_n,
       p.last_miss + interval '2 hours',
       case when p.r_call < 0.55 then 'reached'
            when p.r_call < 0.80 then 'not_reached' end,
       case when p.r_call < 0.55 then 'Synthetic demo call — resident answered.'
            when p.r_call < 0.80 then 'Synthetic demo call — no answer.' end,
       case when p.r_call < 0.55 then p.last_miss + interval '26 hours' end
from picked p
where p.r_pick < 0.35;

-- Opt-in trusted contacts (relationship labels only, synthetic numbers).
insert into trusted_contacts (resident_id, contact_label, contact_phone)
select r.id,
       (array['Sister','Brother','Friend','Partner','Parent'])
         [1 + (row_number() over (order by r.pseudo_id))::int % 5],
       '9715000' || lpad((row_number() over (order by r.pseudo_id))::text, 5, '0')
from residents r
where r.pseudo_id ~ '^JISR-SYN-[0-9]{4}$'
  and exists (select 1 from consent_scopes cs
              where cs.resident_id = r.id
                and cs.scope = 'trusted_contact' and cs.granted)
  and random() < 0.80
on conflict (resident_id) do nothing;

-- Simulated sends ONLY for failed calls with a consented contact; ~half get
-- a 'contact made' reply. Messages are the generic template, pseudonymous.
with eligible as (
  select t.id as task_id, t.resident_id, tc.id as contact_id, r.pseudo_id,
         t.created_at, random() as r_reply
  from navigator_tasks t
  join trusted_contacts tc on tc.resident_id = t.resident_id
  join residents r on r.id = t.resident_id
  where t.call_outcome = 'not_reached' and t.resolved_at is null
),
ins_sent as (
  insert into trusted_contact_events
    (resident_id, contact_id, task_id, kind, message, created_at)
  select resident_id, contact_id, task_id, 'simulated_sent',
         replace('[Name] asked us to let you know they''d appreciate a call.',
                 '[Name]', pseudo_id),
         created_at + interval '1 hour'
  from eligible
  returning task_id
)
insert into trusted_contact_events
  (resident_id, contact_id, task_id, kind, message, created_at)
select e.resident_id, e.contact_id, e.task_id, 'contact_made',
       'Reply recorded: contact made.', e.created_at + interval '4 hours'
from eligible e
join ins_sent s on s.task_id = e.task_id
where e.r_reply < 0.50;

-- A contact-made reply resolves the escalation task (human chain complete).
-- It NEVER touches case risk_tier or state.
update navigator_tasks t
set resolved_at = e.created_at
from trusted_contact_events e
where e.task_id = t.id and e.kind = 'contact_made' and t.resolved_at is null;

-- Escalation + stop events in the reminder audit trail.
insert into reminder_events (resident_id, kind, note, created_at)
select t.resident_id, 'escalated', t.reason, t.created_at
from navigator_tasks t where t.kind = 'checkin_escalation';

insert into reminder_events (resident_id, kind, note, created_at)
select t.resident_id, 'stopped', 'Reminder ladder stopped after escalation.',
       t.created_at + interval '1 minute'
from navigator_tasks t where t.kind = 'checkin_escalation';

-- Calm-corner usage (aggregate metrics only).
insert into calm_sessions (resident_id, exercise, seconds, completed, created_at)
select r.id,
       (array['breathing','grounding','memory'])[1 + (i % 3)],
       60 + (random() * 240)::int,
       random() < 0.80,
       sim_now() - (random() * 25) * interval '1 day'
from residents r, generate_series(1, 2) i
where r.pseudo_id ~ '^JISR-SYN-[0-9]{4}$' and random() < 0.15;

-- Companion sessions. mood_tag is aggregate-report-only; hi shows a higher
-- 'heavy' share. Crisis outcomes are deterministic rules, never AI.
with s as (
  select r.id as rid, r.language,
         random() as r_crisis, random() as r_out, random() as r_mood,
         random() as r_steps, random() as r_age
  from residents r
  where r.pseudo_id ~ '^JISR-SYN-[0-9]{4}$' and random() < 0.08
)
insert into companion_sessions (resident_id, steps, outcome, mood_tag, crisis_flag, created_at)
select rid,
       3 + (r_steps * 5)::int,
       case when r_crisis < 0.02 then 'crisis'
            when r_out < 0.30 then 'human'
            when r_out < 0.60 then 'calm' else 'checkin' end,
       case when language = 'hi'
            then (case when r_mood < 0.35 then 'heavy'
                       when r_mood < 0.70 then 'unsure' else 'steady' end)
            else (case when r_mood < 0.18 then 'heavy'
                       when r_mood < 0.50 then 'unsure' else 'steady' end) end,
       r_crisis < 0.02,
       sim_now() - (r_age * 25) * interval '1 day'
from s;

-- Demo residents: DEMO-001 has a missed + a pending check-in; everyone gets
-- a pending one; DEMO-002 has a failed-call escalation with a consented
-- contact and one simulated send, so the live flow is demonstrable.
insert into checkins (resident_id, due_at, state, missed_at,
                      consecutive_misses, reminders_sent, created_at)
select r.id, sim_now() - interval '2 days', 'missed',
       sim_now() - interval '2 days' + interval '2 hours', 2, 2,
       sim_now() - interval '3 days'
from residents r where r.pseudo_id = 'JISR-DEMO-001';

insert into checkins (resident_id, due_at, state, created_at)
select r.id, sim_now() + interval '1 day', 'pending', sim_now()
from residents r where r.pseudo_id like 'JISR-DEMO-%';

insert into checkins (resident_id, due_at, state, completed_at, reminders_sent, created_at)
select r.id, sim_now() - interval '5 days', 'completed',
       sim_now() - interval '5 days' + interval '1 hour', 1, sim_now() - interval '6 days'
from residents r
where r.pseudo_id like 'JISR-DEMO-%' and r.pseudo_id <> 'JISR-DEMO-001';

insert into reminder_events (resident_id, checkin_id, kind, created_at)
select c.resident_id, c.id, k.kind, c.due_at + k.off * interval '1 hour'
from checkins c
join residents r on r.id = c.resident_id
cross join lateral (values ('reminder', 0), ('soft_reminder', 2), ('missed', 2)) as k(kind, off)
where r.pseudo_id = 'JISR-DEMO-001' and c.state = 'missed';

insert into navigator_tasks
  (resident_id, case_id, reason, consecutive_misses, created_at, call_outcome, call_note)
select r.id,
       (select c.id from cases c where c.resident_id = r.id
        order by c.created_at desc limit 1),
       '3 consecutive missed check-ins', 3, sim_now() - interval '1 day',
       'not_reached', 'Synthetic demo call — no answer.'
from residents r where r.pseudo_id = 'JISR-DEMO-002';

insert into trusted_contacts (resident_id, contact_label, contact_phone)
select r.id, 'Sister', '971500000002'
from residents r where r.pseudo_id = 'JISR-DEMO-002'
on conflict (resident_id) do nothing;

insert into trusted_contact_events
  (resident_id, contact_id, task_id, kind, message, created_at)
select r.id, tc.id, t.id, 'simulated_sent',
       replace('[Name] asked us to let you know they''d appreciate a call.',
               '[Name]', r.pseudo_id),
       sim_now() - interval '20 hours'
from residents r
join trusted_contacts tc on tc.resident_id = r.id
join navigator_tasks t on t.resident_id = r.id and t.call_outcome = 'not_reached'
where r.pseudo_id = 'JISR-DEMO-002';