-- A small activity log for tracking down bugs (trades applied, duplicate pets cleaned up, and so on).
-- Players can't read it; only the app's log function writes to it. Rows older than 60 days are trimmed.
create table if not exists public.game_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete cascade,
  kind text not null,
  data jsonb
);
alter table public.game_events enable row level security;
revoke all on public.game_events from anon, authenticated;
create index if not exists game_events_user_time on public.game_events (user_id, created_at desc);

create or replace function public.log_game_event(p_kind text, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then return; end if;
  if (select count(*) from public.game_events where user_id = me and created_at > now() - interval '1 minute') > 30 then return; end if;
  insert into public.game_events (user_id, kind, data) values (me, left(p_kind, 40), case when octet_length(p_data::text) > 4000 then null else p_data end);
end $$;
revoke all on function public.log_game_event(text, jsonb) from public, anon;
grant execute on function public.log_game_event(text, jsonb) to authenticated;
