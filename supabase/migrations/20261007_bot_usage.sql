-- Limits

create table if not exists public.bot_usage (
  user_id          uuid        not null references auth.users (id) on delete cascade,
  day              date        not null,
  message_count    integer     not null default 0,
  last_message_at  timestamptz,
  primary key (user_id, day)
);

alter table public.bot_usage enable row level security;
-- Policies

create or replace function public.bot_use_message(
  p_user uuid,
  p_limit integer,
  p_cooldown_seconds integer
)
returns table (allowed boolean, remaining integer, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Asia/Manila')::date;
  v_row public.bot_usage%rowtype;
begin
  insert into public.bot_usage (user_id, day, message_count, last_message_at)
  values (p_user, v_day, 0, null)
  on conflict (user_id, day) do nothing;

  -- Locking
  select * into v_row
  from public.bot_usage
  where user_id = p_user and day = v_day
  for update;

  if v_row.last_message_at is not null
     and v_row.last_message_at > now() - make_interval(secs => p_cooldown_seconds) then
    return query select false, greatest(p_limit - v_row.message_count, 0), 'cooldown'::text;
    return;
  end if;

  if v_row.message_count >= p_limit then
    return query select false, 0, 'daily_limit'::text;
    return;
  end if;

  update public.bot_usage
  set message_count = message_count + 1,
      last_message_at = now()
  where user_id = p_user and day = v_day;

  return query select true, p_limit - v_row.message_count - 1, 'ok'::text;
end;
$$;

revoke all on function public.bot_use_message(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.bot_use_message(uuid, integer, integer) to service_role;

-- Refund
create or replace function public.bot_refund_message(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.bot_usage
  set message_count = greatest(message_count - 1, 0),
      last_message_at = null
  where user_id = p_user
    and day = (now() at time zone 'Asia/Manila')::date;
$$;

revoke all on function public.bot_refund_message(uuid) from public, anon, authenticated;
grant execute on function public.bot_refund_message(uuid) to service_role;
