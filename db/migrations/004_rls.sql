-- 004_rls.sql — consent enforced with row-level security.
-- The app server connects as the table owner (trusted server code); the
-- jisr_app role models a consent-bound client and is what tests SET ROLE to.
-- jisr_employer can read ONLY aggregated employer views, never base tables.

-- Roles (idempotent).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'jisr_app') then
    create role jisr_app nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'jisr_employer') then
    create role jisr_employer nologin;
  end if;
end $$;

grant usage on schema public to jisr_app, jisr_employer;

-- Consent-bound reads: screenings require store_results.
alter table screenings enable row level security;
alter table screenings force row level security;
drop policy if exists screenings_store_results on screenings;
create policy screenings_store_results on screenings
  for select to jisr_app
  using (
    exists (
      select 1 from consent_scopes cs
      where cs.resident_id = screenings.resident_id
        and cs.scope = 'store_results' and cs.granted
    )
  );

-- Cases follow the same store_results consent.
alter table cases enable row level security;
alter table cases force row level security;
drop policy if exists cases_store_results on cases;
create policy cases_store_results on cases
  for select to jisr_app
  using (
    exists (
      select 1 from consent_scopes cs
      where cs.resident_id = cases.resident_id
        and cs.scope = 'store_results' and cs.granted
    )
  );

-- Wearable signals require wearable_signal consent.
alter table wearable_days enable row level security;
alter table wearable_days force row level security;
drop policy if exists wearable_consent on wearable_days;
create policy wearable_consent on wearable_days
  for select to jisr_app
  using (
    exists (
      select 1 from consent_scopes cs
      where cs.resident_id = wearable_days.resident_id
        and cs.scope = 'wearable_signal' and cs.granted
    )
  );

-- Primary-care summary data requires share_with_primary_care consent.
alter table health_flags enable row level security;
alter table health_flags force row level security;
drop policy if exists health_flags_consent on health_flags;
create policy health_flags_consent on health_flags
  for select to jisr_app
  using (
    exists (
      select 1 from consent_scopes cs
      where cs.resident_id = health_flags.resident_id
        and cs.scope = 'share_with_primary_care' and cs.granted
    )
  );

-- Residents can always see their own pseudonymous record; consent ledger and
-- audit are readable so the user can see exactly what is on/off.
alter table residents enable row level security;
alter table residents force row level security;
drop policy if exists residents_read on residents;
create policy residents_read on residents for select to jisr_app using (true);

alter table consent_scopes enable row level security;
alter table consent_scopes force row level security;
drop policy if exists consent_read on consent_scopes;
create policy consent_read on consent_scopes for select to jisr_app using (true);
drop policy if exists consent_update on consent_scopes;
create policy consent_update on consent_scopes for update to jisr_app using (true);

alter table consent_audit enable row level security;
alter table consent_audit force row level security;
drop policy if exists consent_audit_read on consent_audit;
create policy consent_audit_read on consent_audit for select to jisr_app using (true);

grant select on residents, screenings, cases, consent_scopes, consent_audit,
                wearable_days, health_flags to jisr_app;
grant update on consent_scopes to jisr_app;
-- Sequence usage for audit inserts made under jisr_app in tests.
grant usage, select on all sequences in schema public to jisr_app;

-- Employer role: NO grants on base tables. Aggregated views are granted in
-- 005_gapfinder_views.sql after they exist.
revoke all on residents, screenings, cases, consent_scopes, consent_audit,
              wearable_days, health_flags, case_events, outreach_attempts from jisr_employer;