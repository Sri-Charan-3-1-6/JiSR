-- 014_layer5_rls.sql — extend the consent ledger with 'reminders' and
-- 'trusted_contact', then gate every Layer 5 personal table with RLS.
-- Same model as 004: the app server connects as the table owner (trusted
-- server code, consent also checked in the API); jisr_app models a
-- consent-bound client and is what tests SET ROLE to.

-- Extend the scope check constraint (7 scopes now).
alter table consent_scopes drop constraint if exists consent_scopes_scope_check;
alter table consent_scopes add constraint consent_scopes_scope_check
  check (scope in ('store_results','share_with_primary_care',
                   'anonymous_aggregate_stats','wearable_signal',
                   'navigator_contact','reminders','trusted_contact'));

-- Reminders scope gates the schedule, check-ins and reminder audit trail.
alter table reminder_prefs enable row level security;
alter table reminder_prefs force row level security;
drop policy if exists reminder_prefs_consent on reminder_prefs;
create policy reminder_prefs_consent on reminder_prefs
  for select to jisr_app
  using (
    exists (select 1 from consent_scopes cs
            where cs.resident_id = reminder_prefs.resident_id
              and cs.scope = 'reminders' and cs.granted)
  );

alter table checkins enable row level security;
alter table checkins force row level security;
drop policy if exists checkins_consent on checkins;
create policy checkins_consent on checkins
  for select to jisr_app
  using (
    exists (select 1 from consent_scopes cs
            where cs.resident_id = checkins.resident_id
              and cs.scope = 'reminders' and cs.granted)
  );

alter table reminder_events enable row level security;
alter table reminder_events force row level security;
drop policy if exists reminder_events_consent on reminder_events;
create policy reminder_events_consent on reminder_events
  for select to jisr_app
  using (
    exists (select 1 from consent_scopes cs
            where cs.resident_id = reminder_events.resident_id
              and cs.scope = 'reminders' and cs.granted)
  );

-- Escalation tasks are navigator work about a resident: navigator_contact.
alter table navigator_tasks enable row level security;
alter table navigator_tasks force row level security;
drop policy if exists navigator_tasks_consent on navigator_tasks;
create policy navigator_tasks_consent on navigator_tasks
  for select to jisr_app
  using (
    exists (select 1 from consent_scopes cs
            where cs.resident_id = navigator_tasks.resident_id
              and cs.scope = 'navigator_contact' and cs.granted)
  );

-- Trusted contact data requires the explicit trusted_contact scope.
alter table trusted_contacts enable row level security;
alter table trusted_contacts force row level security;
drop policy if exists trusted_contacts_consent on trusted_contacts;
create policy trusted_contacts_consent on trusted_contacts
  for select to jisr_app
  using (
    exists (select 1 from consent_scopes cs
            where cs.resident_id = trusted_contacts.resident_id
              and cs.scope = 'trusted_contact' and cs.granted)
  );

alter table trusted_contact_events enable row level security;
alter table trusted_contact_events force row level security;
drop policy if exists trusted_contact_events_consent on trusted_contact_events;
create policy trusted_contact_events_consent on trusted_contact_events
  for select to jisr_app
  using (
    exists (select 1 from consent_scopes cs
            where cs.resident_id = trusted_contact_events.resident_id
              and cs.scope = 'trusted_contact' and cs.granted)
  );

-- Calm/companion session history follows store_results, like screenings.
alter table calm_sessions enable row level security;
alter table calm_sessions force row level security;
drop policy if exists calm_sessions_consent on calm_sessions;
create policy calm_sessions_consent on calm_sessions
  for select to jisr_app
  using (
    exists (select 1 from consent_scopes cs
            where cs.resident_id = calm_sessions.resident_id
              and cs.scope = 'store_results' and cs.granted)
  );

alter table companion_sessions enable row level security;
alter table companion_sessions force row level security;
drop policy if exists companion_sessions_consent on companion_sessions;
create policy companion_sessions_consent on companion_sessions
  for select to jisr_app
  using (
    exists (select 1 from consent_scopes cs
            where cs.resident_id = companion_sessions.resident_id
              and cs.scope = 'store_results' and cs.granted)
  );

-- Supportive lines are non-personal content: readable without consent.
alter table calm_lines enable row level security;
alter table calm_lines force row level security;
drop policy if exists calm_lines_read on calm_lines;
create policy calm_lines_read on calm_lines for select to jisr_app using (true);

grant select on reminder_prefs, companion_prefs, checkins, reminder_events,
                navigator_tasks, calm_lines, calm_sessions, companion_sessions,
                trusted_contacts, trusted_contact_events to jisr_app;
-- Identity sequences created after 004 need the same usage grant.
grant usage, select on all sequences in schema public to jisr_app;

-- Employer role: still NO access to any base table, Layer 5 included.
revoke all on reminder_prefs, companion_prefs, checkins, reminder_events,
              navigator_tasks, calm_lines, calm_sessions, companion_sessions,
              trusted_contacts, trusted_contact_events from jisr_employer;