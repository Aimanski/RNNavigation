-- History
create table if not exists public.body_history (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  age           numeric,
  height_cm     numeric,
  weight_kg     numeric,
  bmi           numeric,
  bmr           numeric,
  tdee          numeric,
  goal_calories numeric
);

create index if not exists body_history_user_time on public.body_history (user_id, created_at desc);

-- Access
alter table public.body_history enable row level security;
revoke all on public.body_history from anon, authenticated;
grant select on public.body_history to authenticated;

drop policy if exists "Users can read their own body history" on public.body_history;
create policy "Users can read their own body history"
  on public.body_history
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Recorder
create or replace function public.record_body_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  last_row public.body_history%rowtype;
begin
  -- Only complete profiles
  if new.age is null or new.height_cm is null or new.weight_kg is null
     or new.bmr is null or new.tdee is null or new.goal_calories is null then
    return new;
  end if;

  -- Only when a tracked number changed
  if tg_op = 'UPDATE'
     and old.age is not distinct from new.age
     and old.height_cm is not distinct from new.height_cm
     and old.weight_kg is not distinct from new.weight_kg
     and old.bmi is not distinct from new.bmi
     and old.bmr is not distinct from new.bmr
     and old.tdee is not distinct from new.tdee
     and old.goal_calories is not distinct from new.goal_calories then
    return new;
  end if;

  select * into last_row from public.body_history
   where user_id = new.id order by created_at desc, id desc limit 1;

  if found
     and last_row.age is not distinct from new.age
     and last_row.height_cm is not distinct from new.height_cm
     and last_row.weight_kg is not distinct from new.weight_kg
     and last_row.bmi is not distinct from new.bmi
     and last_row.bmr is not distinct from new.bmr
     and last_row.tdee is not distinct from new.tdee
     and last_row.goal_calories is not distinct from new.goal_calories then
    return new;
  end if;

  -- Quick follow-up saves (for example switching the goal right after) update the same entry
  if found and last_row.created_at > now() - interval '2 minutes' then
    update public.body_history
       set age = new.age, height_cm = new.height_cm, weight_kg = new.weight_kg, bmi = new.bmi,
           bmr = new.bmr, tdee = new.tdee, goal_calories = new.goal_calories, created_at = now()
     where id = last_row.id;
  else
    insert into public.body_history (user_id, age, height_cm, weight_kg, bmi, bmr, tdee, goal_calories)
    values (new.id, new.age, new.height_cm, new.weight_kg, new.bmi, new.bmr, new.tdee, new.goal_calories);
  end if;
  return new;
end;
$$;

revoke all on function public.record_body_history() from public, anon, authenticated;

drop trigger if exists body_history_recorder on public."weighApp";
create trigger body_history_recorder
  after insert or update on public."weighApp"
  for each row execute function public.record_body_history();

-- Existing users start with their current numbers
insert into public.body_history (user_id, created_at, age, height_cm, weight_kg, bmi, bmr, tdee, goal_calories)
select w.id, coalesce(w.updated_at, now()), w.age, w.height_cm, w.weight_kg, w.bmi, w.bmr, w.tdee, w.goal_calories
  from public."weighApp" w
 where w.age is not null and w.height_cm is not null and w.weight_kg is not null
   and w.bmr is not null and w.tdee is not null and w.goal_calories is not null
   and not exists (select 1 from public.body_history h where h.user_id = w.id);
