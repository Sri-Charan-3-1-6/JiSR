-- 001_schema.sql — JISR core schema.
-- Designed to support Layers 1-4: consent scopes, demographic fields for
-- fairness analysis, SLA timestamps, wearable baseline data, simulated clock.
-- All data is SYNTHETIC (prototype).

-- ---------------------------------------------------------------------------
-- Simulated clock: demo time-travel advances this offset, never the real clock.
-- ---------------------------------------------------------------------------
create table demo_clock (
  id boolean primary key default true check (id),
  now_offset interval not null default interval '0 seconds',
  updated_at timestamptz not null default now()
);
insert into demo_clock (id) values (true);

create or replace function sim_now() returns timestamptz
language sql stable as
$$ select now() + now_offset from demo_clock where id $$;

-- ---------------------------------------------------------------------------
-- Residents: pseudonymous only. No names, no ID numbers (hard rule 4).
-- Demographic fields exist for Layer 2 fairness analysis; all synthetic.
-- ---------------------------------------------------------------------------
create table residents (
  id uuid primary key default gen_random_uuid(),
  pseudo_id text not null unique,
  language text not null default 'en' check (language in ('en', 'ar', 'hi')),
  age_band text check (age_band in ('18-24','25-34','35-44','45-54','55-64','65+')),
  gender text check (gender in ('female','male','other','undisclosed')),
  nationality text,
  area text,
  is_synthetic boolean not null default true,
  created_at timestamptz not null default sim_now()
);

-- ---------------------------------------------------------------------------
-- Screenings: PHQ-9 / GAD-7. Scoring is deterministic application code;
-- the database stores answers and the computed result.
-- ---------------------------------------------------------------------------
create table screenings (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references residents(id),
  instrument text not null check (instrument in ('PHQ9','GAD7')),
  answers jsonb not null,
  free_text text,
  total_score integer not null check (total_score >= 0),
  band text not null,
  crisis_flag boolean not null default false,
  crisis_reason text check (crisis_reason in ('item9','keyword')),
  is_synthetic boolean not null default true,
  created_at timestamptz not null default sim_now()
);
create index screenings_resident_idx on screenings (resident_id, created_at);

-- ---------------------------------------------------------------------------
-- Cases: follow-up clock state machine with per-tier SLA deadlines.
-- SCREENED -> MATCHED -> NAVIGATOR_CONTACTED -> BOOKED -> ATTENDED -> FOLLOWED_UP_30D
-- ---------------------------------------------------------------------------
create table cases (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references residents(id),
  screening_id uuid references screenings(id),
  risk_tier text not null check (risk_tier in
    ('minimal','mild','moderate','moderately_severe','severe','crisis')),
  state text not null default 'SCREENED' check (state in
    ('SCREENED','MATCHED','NAVIGATOR_CONTACTED','BOOKED','ATTENDED','FOLLOWED_UP_30D')),
  matched_step text,
  -- SLA deadlines (Layer 1). NULL = no deadline for that milestone at this tier.
  sla_contact_due timestamptz,
  sla_book_due timestamptz,
  sla_attend_due timestamptz,
  sla_followup_due timestamptz,
  -- Milestone timestamps (also feed Layer 2 median/waiting-time metrics).
  created_at timestamptz not null default sim_now(),
  matched_at timestamptz,
  contacted_at timestamptz,
  booked_at timestamptz,
  attended_at timestamptz,
  followed_up_at timestamptz,
  is_synthetic boolean not null default true
);
create index cases_state_idx on cases (state);
create index cases_resident_idx on cases (resident_id);
create index cases_risk_idx on cases (risk_tier);

-- Timeline / audit events for a case.
create table case_events (
  id bigint generated always as identity primary key,
  case_id uuid not null references cases(id),
  event_type text not null,
  from_state text,
  to_state text,
  detail jsonb,
  created_at timestamptz not null default sim_now()
);
create index case_events_case_idx on case_events (case_id, created_at);

-- Navigator outreach attempts: reached / not reached.
create table outreach_attempts (
  id bigint generated always as identity primary key,
  case_id uuid not null references cases(id),
  channel text not null check (channel in ('call','sms','message')),
  outcome text not null check (outcome in ('reached','not_reached')),
  note text,
  attempted_at timestamptz not null default sim_now()
);
create index outreach_case_idx on outreach_attempts (case_id);

-- ---------------------------------------------------------------------------
-- Layer 2: granular consent ledger. Default OFF; every change is audited.
-- ---------------------------------------------------------------------------
create table consent_scopes (
  resident_id uuid not null references residents(id),
  scope text not null check (scope in
    ('store_results','share_with_primary_care','anonymous_aggregate_stats',
     'wearable_signal','navigator_contact')),
  granted boolean not null default false,
  updated_at timestamptz not null default sim_now(),
  primary key (resident_id, scope)
);

create table consent_audit (
  id bigint generated always as identity primary key,
  resident_id uuid not null references residents(id),
  scope text not null,
  action text not null check (action in ('grant','revoke')),
  actor text not null default 'resident',
  created_at timestamptz not null default sim_now()
);
create index consent_audit_resident_idx on consent_audit (resident_id, created_at);

-- ---------------------------------------------------------------------------
-- Layer 3: self-reported health flags for the primary-care summary.
-- ---------------------------------------------------------------------------
create table health_flags (
  resident_id uuid primary key references residents(id),
  physical_conditions text[] not null default '{}',
  sleep_flag boolean not null default false,
  pain_flag boolean not null default false,
  updated_at timestamptz not null default sim_now()
);

-- Layer 3: wearable opt-in simulator. Synthetic daily signals only.
create table wearable_days (
  id bigint generated always as identity primary key,
  resident_id uuid not null references residents(id),
  day date not null,
  sleep_hours numeric(4,2),
  steps integer,
  resting_hr integer,
  is_synthetic boolean not null default true,
  unique (resident_id, day)
);
create index wearable_resident_idx on wearable_days (resident_id, day);