-- 003_views.sql — Layer 1 views: SLA status, overdue detection, navigator queue.
-- Layer 2 Gap Finder / employer views are added in 005_gapfinder_views.sql.
-- All deadlines are evaluated against sim_now() so demo time-travel works.

-- Next pending SLA milestone per case, and whether it is breached.
create view case_sla_status as
select c.*,
       p.milestone as next_milestone,
       p.due       as next_due,
       coalesce(p.due is not null and sim_now() > p.due, false) as is_overdue,
       greatest(interval '0 seconds', sim_now() - p.due)        as overdue_by
from cases c
left join lateral (
  select m.milestone, m.due
  from (values
    ('contact',  c.sla_contact_due,  c.contacted_at,   1),
    ('book',     c.sla_book_due,     c.booked_at,      2),
    ('attend',   c.sla_attend_due,   c.attended_at,    3),
    ('followup', c.sla_followup_due, c.followed_up_at, 4)
  ) as m(milestone, due, done_at, ord)
  where m.due is not null and m.done_at is null
  order by m.ord
  limit 1
) p on true;

-- Overdue queue: cases whose next SLA milestone is breached.
create view overdue_cases as
select * from case_sla_status where is_overdue;

-- Navigator queue: risk first, then overdue time, then age of case.
create view navigator_queue as
select s.*,
       case s.risk_tier
         when 'crisis' then 0
         when 'severe' then 1
         when 'moderately_severe' then 2
         when 'moderate' then 3
         when 'mild' then 4
         when 'minimal' then 5
       end as risk_rank
from case_sla_status s
order by risk_rank,
         is_overdue desc,
         overdue_by desc,
         created_at;