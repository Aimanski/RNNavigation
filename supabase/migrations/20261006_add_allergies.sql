-- Allergies
alter table public."weighApp"
  add column if not exists allergies text[];
