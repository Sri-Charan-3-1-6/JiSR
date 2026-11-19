-- 012_explanation_cache.sql — shared, non-personal explanation cache.
-- Keyed ONLY by (instrument, band, language). No resident data ever stored
-- here: explanations are generic per band, so one row serves everyone.

create table if not exists explanation_cache (
  instrument text not null check (instrument in ('PHQ9', 'GAD7')),
  band text not null check (band in ('minimal', 'mild', 'moderate', 'moderately_severe', 'severe', 'crisis')),
  language text not null check (language in ('en', 'ar', 'hi')),
  text text not null,
  source text not null check (source in ('llm', 'template')),
  model text,
  created_at timestamptz not null default sim_now(),
  primary key (instrument, band, language)
);

-- Non-personal, readable by the consent-bound role; writes are server-only.
alter table explanation_cache enable row level security;
alter table explanation_cache force row level security;
drop policy if exists explanation_cache_read on explanation_cache;
create policy explanation_cache_read on explanation_cache
  for select to jisr_app using (true);
grant select on explanation_cache to jisr_app;
revoke all on explanation_cache from jisr_employer;