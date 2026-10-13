-- Overview

-- Owner
alter table public.foods
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists foods_user_id_idx on public.foods (user_id);

-- Backfill
update public.foods f
set user_id = sf.user_id
from (
  select distinct on (food_id) food_id, user_id
  from public.selected_foods
  order by food_id, created_at asc
) sf
where f.id::text = sf.food_id::text
  and f.user_id is null
  and f.ingredients is null
  and f.created_at >= '2026-10-01';

-- Security
alter table public.foods enable row level security;

-- Cleanup
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'foods'
      and (cmd = 'SELECT' or policyname = 'Authenticated users can insert foods')
  loop
    execute format('drop policy %I on public.foods', p.policyname);
  end loop;
end $$;

drop policy if exists "foods_select_shared_or_own" on public.foods;
drop policy if exists "foods_insert_own"           on public.foods;
drop policy if exists "foods_admin_insert"         on public.foods;
drop policy if exists "foods_admin_update"         on public.foods;
drop policy if exists "foods_admin_delete"         on public.foods;

-- Reads
create policy "foods_select_shared_or_own" on public.foods
  for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));

-- Inserts
create policy "foods_insert_own" on public.foods
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Admins
create policy "foods_admin_insert" on public.foods
  for insert to authenticated
  with check (
    user_id is null
    and exists (select 1 from public."weighApp" w
                where w.id = (select auth.uid()) and w.admin = true)
  );

create policy "foods_admin_update" on public.foods
  for update to authenticated
  using (
    user_id is null
    and exists (select 1 from public."weighApp" w
                where w.id = (select auth.uid()) and w.admin = true)
  )
  with check (
    user_id is null
    and exists (select 1 from public."weighApp" w
                where w.id = (select auth.uid()) and w.admin = true)
  );

create policy "foods_admin_delete" on public.foods
  for delete to authenticated
  using (
    user_id is null
    and exists (select 1 from public."weighApp" w
                where w.id = (select auth.uid()) and w.admin = true)
  );

-- Check
select name, user_id, created_at
from public.foods
where ingredients is null
order by created_at;
