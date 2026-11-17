-- Real push notifications: each phone registers its Expo push token; database triggers send
-- a notification through Expo's push service when something happens to a player while the app is closed.

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null default 'ios',
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
-- Players manage only their own phones' tokens. Nobody can read other players' tokens.
create policy "own tokens: read" on public.push_tokens for select using (auth.uid() = user_id);
create policy "own tokens: delete" on public.push_tokens for delete using (auth.uid() = user_id);

-- Register (or move) a token to the signed-in player. A phone that changes accounts moves its token.
create or replace function public.register_push_token(p_token text, p_platform text default 'ios')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_token is null or p_token !~ '^ExponentPushToken\[[A-Za-z0-9_-]+\]$' then raise exception 'bad token'; end if;
  insert into push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), coalesce(p_platform, 'ios'), now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;
revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

create or replace function public.unregister_push_token(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from push_tokens where token = p_token and user_id = auth.uid();
$$;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;

-- Send one notification to every phone of a player. Runs inside triggers; never blocks or fails the write.
create or replace function public.push_to_user(p_user uuid, p_title text, p_body text, p_tab text default 'friends')
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  msgs jsonb;
begin
  select jsonb_agg(jsonb_build_object('to', token, 'title', p_title, 'body', p_body, 'sound', 'default', 'data', jsonb_build_object('tab', p_tab)))
    into msgs from push_tokens where user_id = p_user;
  if msgs is null then return; end if;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := msgs,
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
  );
exception when others then
  raise warning 'push_to_user failed: %', sqlerrm;
end $$;
revoke all on function public.push_to_user(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.push_name(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select username from profiles where id = p_user), 'A friend');
$$;
revoke all on function public.push_name(uuid) from public, anon, authenticated;

-- Friend requests and accepted requests
create or replace function public.push_on_friendship() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform push_to_user(new.addressee, 'New friend request', push_name(new.requester) || ' wants to be friends on Sproutling.');
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform push_to_user(new.requester, 'Friend request accepted', push_name(new.addressee) || ' is now your friend. Say hi with a gift!');
  end if;
  return new;
end $$;
drop trigger if exists push_friendship on public.friendships;
create trigger push_friendship after insert or update of status on public.friendships
  for each row execute function public.push_on_friendship();

-- Gifts
create or replace function public.push_on_gift() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform push_to_user(new.recipient, 'You got a gift! 🎁', push_name(new.sender) || ' sent you a gift. Open Sproutling to collect it.');
  return new;
end $$;
drop trigger if exists push_gift on public.gifts;
create trigger push_gift after insert on public.gifts for each row execute function public.push_on_gift();

-- Trades: a new offer, a counter-offer, and a finished trade
create or replace function public.push_on_trade() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'offered' then
    perform push_to_user(new.to_user, 'Trade offer', push_name(new.from_user) || ' wants to trade pets with you.');
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'countered' then
      perform push_to_user(new.from_user, 'Trade counter-offer', push_name(new.to_user) || ' answered your trade with an offer.');
    elsif new.status = 'completed' then
      perform push_to_user(new.to_user, 'Trade complete', 'Your trade with ' || push_name(new.from_user) || ' went through. Meet your new pet!');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists push_trade on public.trades;
create trigger push_trade after insert or update of status on public.trades
  for each row execute function public.push_on_trade();

-- Someone battled your team
create or replace function public.push_on_battle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform push_to_user(new.defender, 'Your team was challenged ⚔️',
    push_name(new.attacker) || case when new.attacker_won then ' beat your team. Train up and battle back!' else ' battled your team and lost. Nice defending!' end);
  return new;
end $$;
drop trigger if exists push_battle on public.battles;
create trigger push_battle after insert on public.battles for each row execute function public.push_on_battle();

-- Someone joined your guild
create or replace function public.push_on_guild_join() returns trigger
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  for m in select user_id from team_members where team_id = new.team_id and user_id <> new.user_id loop
    perform push_to_user(m.user_id, 'New guild member',
      push_name(new.user_id) || ' joined ' || coalesce((select name from teams where id = new.team_id), 'your guild') || '.', 'friends');
  end loop;
  return new;
end $$;
drop trigger if exists push_guild_join on public.team_members;
create trigger push_guild_join after insert on public.team_members for each row execute function public.push_on_guild_join();

-- Trigger functions run only from their triggers, never through the API.
revoke all on function public.push_on_friendship() from public, anon, authenticated;
revoke all on function public.push_on_gift() from public, anon, authenticated;
revoke all on function public.push_on_trade() from public, anon, authenticated;
revoke all on function public.push_on_battle() from public, anon, authenticated;
revoke all on function public.push_on_guild_join() from public, anon, authenticated;
