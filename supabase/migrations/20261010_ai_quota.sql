-- Quota

create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_admin_read" on public.app_settings;
drop policy if exists "app_settings_admin_insert" on public.app_settings;
drop policy if exists "app_settings_admin_update" on public.app_settings;

create policy "app_settings_admin_read" on public.app_settings
  for select to authenticated using (public.is_admin());

create policy "app_settings_admin_insert" on public.app_settings
  for insert to authenticated with check (public.is_admin());

create policy "app_settings_admin_update" on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Window
create or replace function public.ai_quota_status()
returns table (window_start timestamptz, next_reset timestamptz, calls bigint, tokens bigint)
language sql
stable
security definer
set search_path = public
as $$
  with w as (
    select
      (date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles') as s,
      ((date_trunc('day', now() at time zone 'America/Los_Angeles') + interval '1 day') at time zone 'America/Los_Angeles') as n
  )
  select w.s, w.n, count(u.id)::bigint, coalesce(sum(u.total_tokens), 0)::bigint
  from w
  left join public.ai_usage u on u.created_at >= w.s
  where public.is_admin()
  group by w.s, w.n;
$$;

revoke all on function public.ai_quota_status() from public, anon;
grant execute on function public.ai_quota_status() to authenticated;
