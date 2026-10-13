-- Usage

create table if not exists public.ai_usage (
  id             bigint generated always as identity primary key,
  user_id        uuid references auth.users (id) on delete set null,
  feature        text not null,            -- Features
  model          text,
  prompt_tokens  integer not null default 0,
  output_tokens  integer not null default 0,
  total_tokens   integer not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists ai_usage_created_at_idx on public.ai_usage (created_at desc);
create index if not exists ai_usage_user_id_idx on public.ai_usage (user_id);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_admin_read" on public.ai_usage;
create policy "ai_usage_admin_read" on public.ai_usage
  for select to authenticated
  using (exists (
    select 1 from public."weighApp" w
    where w.id = (select auth.uid()) and w.admin = true
  ));

-- Daily
create or replace function public.ai_usage_summary(p_days integer default 30)
returns table (
  day date,
  feature text,
  calls bigint,
  prompt_tokens bigint,
  output_tokens bigint,
  total_tokens bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (u.created_at at time zone 'Asia/Manila')::date as day,
    u.feature,
    count(*)::bigint,
    coalesce(sum(u.prompt_tokens), 0)::bigint,
    coalesce(sum(u.output_tokens), 0)::bigint,
    coalesce(sum(u.total_tokens), 0)::bigint
  from public.ai_usage u
  where exists (
          select 1 from public."weighApp" w
          where w.id = (select auth.uid()) and w.admin = true
        )
    and u.created_at >= now() - make_interval(days => p_days)
  group by 1, 2
  order by 1 desc, 2;
$$;

-- Heaviest
create or replace function public.ai_usage_by_user(p_days integer default 30, p_limit integer default 10)
returns table (user_id uuid, username text, calls bigint, total_tokens bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.user_id,
    max(w.username) as username,
    count(*)::bigint,
    coalesce(sum(u.total_tokens), 0)::bigint as total_tokens
  from public.ai_usage u
  left join public."weighApp" w on w.id = u.user_id
  where exists (
          select 1 from public."weighApp" a
          where a.id = (select auth.uid()) and a.admin = true
        )
    and u.created_at >= now() - make_interval(days => p_days)
  group by u.user_id
  order by total_tokens desc
  limit p_limit;
$$;

revoke all on function public.ai_usage_summary(integer) from public, anon;
revoke all on function public.ai_usage_by_user(integer, integer) from public, anon;
grant execute on function public.ai_usage_summary(integer) to authenticated;
grant execute on function public.ai_usage_by_user(integer, integer) to authenticated;
