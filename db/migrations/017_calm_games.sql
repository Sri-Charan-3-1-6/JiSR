-- Layer 5 extension: two new Calm Corner games (Bubble Calm, Pattern Echo).
-- Widens the exercise whitelist on calm_sessions. Atomic constraint swap:
-- no data is dropped or changed; the old constraint is replaced in the same
-- transaction with a superset of its allowed values.
alter table calm_sessions drop constraint calm_sessions_exercise_check;
alter table calm_sessions add constraint calm_sessions_exercise_check
  check (exercise in ('breathing','grounding','memory','bubbles','echo'));