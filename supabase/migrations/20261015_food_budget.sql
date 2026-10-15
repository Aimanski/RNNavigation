-- Budget
alter table public.foods
  add column if not exists price_php numeric;

alter table public."weighApp"
  add column if not exists food_budget numeric;
