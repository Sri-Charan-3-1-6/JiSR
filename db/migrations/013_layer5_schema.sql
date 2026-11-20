-- 013_layer5_schema.sql — Check-in Companion tables. ALL SYNTHETIC.
-- Consent scopes 'reminders' and 'trusted_contact' are added in 014.
-- Every timestamp defaults to sim_now() so demo time-travel applies.

-- User-owned reminder schedule. Nothing here forces completion; the consent
-- ledger (scope 'reminders') is the master switch and is checked in the API.
create table reminder_prefs (
  resident_id uuid primary key references residents(id),
  remind_at time not null default '09:00',
  quiet_start time not null default '22:00',
  quiet_end time not null default '08:00',
  max_per_day integer not null default 3 check (max_per_day between 1 and 10),
  snooze_minutes integer not null default 30 check (snooze_minutes between 5 and 240),
  ladder_gap_minutes integer not null default 120 check (ladder_gap_minutes between 15 and 1440),
  ladder_miss_limit integer not null default 3 check (ladder_miss_limit between 2 and 7),
  vibration boolean not null default false,
  updated_at timestamptz not null default sim_now()
);

-- Jokes/memes are OPT-IN and off by default.
create table companion_prefs (
  resident_id uuid primary key references residents(id),
  jokes_opt_in boolean not null default false,
  updated_at timestamptz not null default sim_now()
);

create table checkins (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references residents(id),
  case_id uuid references cases(id),
  due_at timestamptz not null,
  state text not null default 'pending'
    check (state in ('pending','completed','missed','snoozed','stopped')),
  snoozed_until timestamptz,
  completed_at timestamptz,
  missed_at timestamptz,
  consecutive_misses integer not null default 0 check (consecutive_misses >= 0),
  reminders_sent integer not null default 0 check (reminders_sent >= 0),
  created_at timestamptz not null default sim_now()
);
create index checkins_resident_due on checkins (resident_id, due_at);

-- One row per reminder/ladder step: this IS the user-visible audit trail.
create table reminder_events (
  id bigint generated always as identity primary key,
  resident_id uuid not null references residents(id),
  checkin_id uuid references checkins(id),
  kind text not null check (kind in
    ('reminder','soft_reminder','snoozed','completed','missed','escalated',
     'stopped','skipped_quiet_hours','skipped_daily_cap')),
  channel text not null default 'in_app' check (channel in ('in_app','push_simulated')),
  note text,
  read_at timestamptz,
  created_at timestamptz not null default sim_now()
);
create index reminder_events_resident on reminder_events (resident_id, created_at desc);

-- Gentle persistence ladder endpoint: a human call task in the navigator
-- queue after N consecutive misses. call_outcome 'not_reached' is the ONLY
-- precondition that makes a trusted-contact message eligible.
create table navigator_tasks (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references residents(id),
  case_id uuid references cases(id),
  kind text not null default 'checkin_escalation' check (kind in ('checkin_escalation')),
  reason text not null,
  consecutive_misses integer not null,
  created_at timestamptz not null default sim_now(),
  call_outcome text check (call_outcome in ('reached','not_reached')),
  call_note text,
  resolved_at timestamptz
);
create index navigator_tasks_resident on navigator_tasks (resident_id, created_at desc);

-- Pre-written supportive lines, never AI-generated. 'reviewed' lets faculty
-- mark lines as reviewed; jokes are a separate kind behind an opt-in.
create table calm_lines (
  id bigint generated always as identity primary key,
  language text not null check (language in ('en','ar','hi')),
  kind text not null default 'support' check (kind in ('support','joke')),
  exercise text check (exercise in ('breathing','grounding','memory')),
  body text not null,
  reviewed boolean not null default false,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default sim_now()
);

create table calm_sessions (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references residents(id),
  exercise text not null check (exercise in ('breathing','grounding','memory')),
  seconds integer not null check (seconds >= 0),
  completed boolean not null default false,
  created_at timestamptz not null default sim_now()
);

-- Scripted companion sessions. mood_tag is a simple self-reported tag from
-- tree choices; it is surfaced ONLY in aggregate reports, never to the user.
-- No camera, no facial analysis, no free text leaves the device.
create table companion_sessions (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references residents(id),
  steps integer not null check (steps >= 0),
  outcome text not null check (outcome in ('calm','human','checkin','crisis','capped')),
  mood_tag text check (mood_tag in ('steady','heavy','unsure')),
  crisis_flag boolean not null default false,
  created_at timestamptz not null default sim_now()
);

-- Opt-in trusted contact. Relationship label only — never a real name.
create table trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null unique references residents(id),
  contact_label text not null,
  contact_phone text not null,
  created_at timestamptz not null default sim_now(),
  updated_at timestamptz not null default sim_now()
);

-- Simulated sends and 'contact made' replies. Messages are generic by
-- construction (guard in src/lib/trusted-contact.ts); a reply NEVER changes
-- risk or marks the person as well. Events survive contact deletion.
create table trusted_contact_events (
  id bigint generated always as identity primary key,
  resident_id uuid not null references residents(id),
  contact_id uuid references trusted_contacts(id) on delete set null,
  task_id uuid references navigator_tasks(id),
  kind text not null check (kind in ('simulated_sent','contact_made')),
  message text not null,
  created_at timestamptz not null default sim_now()
);
create index trusted_contact_events_resident on trusted_contact_events (resident_id, created_at desc);