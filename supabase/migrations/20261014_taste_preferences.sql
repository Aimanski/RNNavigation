-- Tastes
alter table public."weighApp"
  add column if not exists taste_preferences jsonb;
