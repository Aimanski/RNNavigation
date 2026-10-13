-- Lockdown

-- Helpers
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select w.admin from public."weighApp" w where w.id = auth.uid()), false);
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Registration
create or replace function public.email_is_registered(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public."weighApp"
    where lower(email) = lower(trim(p_email))
  );
$$;

revoke all on function public.email_is_registered(text) from public;
grant execute on function public.email_is_registered(text) to anon, authenticated;

-- Policies
alter table public."weighApp" enable row level security;

drop policy if exists "Enable read access for all users" on public."weighApp";
drop policy if exists "Enable insert for authenticated users only" on public."weighApp";
drop policy if exists "Enable insert for users based on user_id" on public."weighApp";
drop policy if exists "update_row" on public."weighApp";
drop policy if exists "Enable delete for users based on user_id" on public."weighApp";
drop policy if exists "weighApp_select_own_or_admin" on public."weighApp";
drop policy if exists "weighApp_insert_own" on public."weighApp";
drop policy if exists "weighApp_update_own_or_admin" on public."weighApp";
drop policy if exists "weighApp_delete_own_or_admin" on public."weighApp";

create policy "weighApp_select_own_or_admin" on public."weighApp"
  for select to authenticated
  using ((select auth.uid()) = id or public.is_admin());

create policy "weighApp_insert_own" on public."weighApp"
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "weighApp_update_own_or_admin" on public."weighApp"
  for update to authenticated
  using ((select auth.uid()) = id or public.is_admin())
  with check ((select auth.uid()) = id or public.is_admin());

create policy "weighApp_delete_own_or_admin" on public."weighApp"
  for delete to authenticated
  using ((select auth.uid()) = id or public.is_admin());

-- Trigger
create or replace function public.protect_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.admin, false) then
      raise exception 'Only admins can create an admin account.' using errcode = '42501';
    end if;
  elsif new.admin is distinct from old.admin then
    raise exception 'Only admins can change admin status.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_admin_flag on public."weighApp";
create trigger protect_admin_flag
  before insert or update on public."weighApp"
  for each row execute function public.protect_admin_flag();
