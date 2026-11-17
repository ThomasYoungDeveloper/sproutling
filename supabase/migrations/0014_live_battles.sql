-- Live battles between friends. Each turn both players pick an action; when both have picked,
-- the turn is added to the history. Both phones replay the history with the same seed, so they
-- see exactly the same battle. Notifications go out for challenges and "your turn".

create table if not exists public.live_battles (
  id uuid primary key default gen_random_uuid(),
  challenger uuid not null references public.profiles (id) on delete cascade,
  opponent uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'active', 'done', 'declined', 'cancelled')),
  seed text not null default replace(gen_random_uuid()::text, '-', ''),
  challenger_team jsonb not null,
  opponent_team jsonb,
  turn int not null default 0,
  challenger_action jsonb,
  opponent_action jsonb,
  history jsonb not null default '[]'::jsonb,
  challenger_react jsonb,
  opponent_react jsonb,
  winner uuid references public.profiles (id) on delete set null,
  deadline timestamptz not null default now() + interval '2 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (challenger <> opponent)
);
create index if not exists live_battles_challenger_idx on public.live_battles (challenger, status);
create index if not exists live_battles_opponent_idx on public.live_battles (opponent, status);

alter table public.live_battles enable row level security;
-- Players can read their own battles (all changes go through the functions below).
create policy "players read their live battles" on public.live_battles
  for select using (auth.uid() = challenger or auth.uid() = opponent);

-- Phones listen for changes so moves show up right away.
do $$ begin
  alter publication supabase_realtime add table public.live_battles;
exception when duplicate_object then null; end $$;

create or replace function public.live_valid_team(t jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(t) = 'object'
     and jsonb_typeof(t -> 'pets') = 'array'
     and jsonb_array_length(t -> 'pets') between 1 and 3
     and octet_length(t::text) < 20000;
$$;

-- Challenge a friend. Returns the battle id, or an error word.
create or replace function public.live_challenge(friend uuid, team jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); bid uuid;
begin
  if me is null then return 'not_signed_in'; end if;
  if not public.are_friends(me, friend) then return 'not_friends'; end if;
  if not public.live_valid_team(team) then return 'bad_team'; end if;
  if exists (select 1 from public.live_battles where status in ('invited', 'active')
             and ((challenger = me and opponent = friend) or (challenger = friend and opponent = me))) then
    return 'already';
  end if;
  insert into public.live_battles (challenger, opponent, challenger_team)
  values (me, friend, team) returning id into bid;
  perform public.push_to_user(friend, 'Battle challenge! ⚔️', public.push_name(me) || ' challenged you to a live battle.');
  return bid::text;
end $$;

-- Accept (with your team) or decline a challenge.
create or replace function public.live_respond(battle uuid, accept boolean, team jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); b public.live_battles;
begin
  select * into b from public.live_battles where id = battle for update;
  if b.id is null or b.opponent <> me then return 'not_found'; end if;
  if b.status <> 'invited' then return 'not_invited'; end if;
  if not accept then
    update public.live_battles set status = 'declined', updated_at = now() where id = battle;
    return 'declined';
  end if;
  if not public.live_valid_team(team) then return 'bad_team'; end if;
  update public.live_battles
     set status = 'active', opponent_team = team, deadline = now() + interval '24 hours', updated_at = now()
   where id = battle;
  perform public.push_to_user(b.challenger, 'Challenge accepted! ⚔️', public.push_name(me) || ' accepted. Pick your first move!');
  return 'ok';
end $$;

-- Pick your action for the current turn.
create or replace function public.live_move(battle uuid, at_turn int, action jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); b public.live_battles; is_c boolean; other uuid;
begin
  select * into b from public.live_battles where id = battle for update;
  if b.id is null or me not in (b.challenger, b.opponent) then return 'not_found'; end if;
  if b.status <> 'active' then return 'not_active'; end if;
  if b.turn <> at_turn then return 'wrong_turn'; end if;
  if jsonb_typeof(action) <> 'object' or action ->> 'type' not in ('move', 'switch') or octet_length(action::text) > 200 then return 'bad_action'; end if;
  is_c := me = b.challenger;
  other := case when is_c then b.opponent else b.challenger end;
  if (is_c and b.challenger_action is not null) or (not is_c and b.opponent_action is not null) then return 'already'; end if;
  if is_c then b.challenger_action := action; else b.opponent_action := action; end if;

  if b.challenger_action is not null and b.opponent_action is not null then
    update public.live_battles
       set history = b.history || jsonb_build_array(jsonb_build_object('c', b.challenger_action, 'o', b.opponent_action)),
           turn = b.turn + 1, challenger_action = null, opponent_action = null,
           deadline = now() + interval '24 hours', updated_at = now()
     where id = battle;
    perform public.push_to_user(other, 'Your turn! ⚔️', public.push_name(me) || ' made a move. What''s yours?');
    return 'resolved';
  end if;
  update public.live_battles
     set challenger_action = b.challenger_action, opponent_action = b.opponent_action, updated_at = now()
   where id = battle;
  perform public.push_to_user(other, 'Your turn! ⚔️', public.push_name(me) || ' picked a move. Your move!');
  return 'waiting';
end $$;

-- Both phones work out the same winner; the first report is kept.
create or replace function public.live_finish(battle uuid, challenger_won boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); b public.live_battles;
begin
  select * into b from public.live_battles where id = battle for update;
  if b.id is null or me not in (b.challenger, b.opponent) then return 'not_found'; end if;
  if b.status = 'done' then return 'done'; end if;
  if b.status <> 'active' then return 'not_active'; end if;
  update public.live_battles
     set status = 'done', winner = case when challenger_won then b.challenger else b.opponent end, updated_at = now()
   where id = battle;
  return 'ok';
end $$;

-- If the other player runs out of time on their turn (and you already moved), you win.
create or replace function public.live_claim_timeout(battle uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); b public.live_battles; is_c boolean; other uuid;
begin
  select * into b from public.live_battles where id = battle for update;
  if b.id is null or me not in (b.challenger, b.opponent) then return 'not_found'; end if;
  if b.deadline > now() then return 'not_yet'; end if;
  is_c := me = b.challenger;
  other := case when is_c then b.opponent else b.challenger end;
  if b.status = 'invited' then
    update public.live_battles set status = 'cancelled', updated_at = now() where id = battle;
    return 'expired';
  end if;
  if b.status <> 'active' then return 'not_active'; end if;
  if (is_c and b.challenger_action is null) or (not is_c and b.opponent_action is null) then return 'move_first'; end if;
  update public.live_battles set status = 'done', winner = me, updated_at = now() where id = battle;
  perform public.push_to_user(other, 'Battle over', 'Time ran out on your turn against ' || public.push_name(me) || '.');
  return 'won';
end $$;

-- Leave a battle (counts as a loss once it has started).
create or replace function public.live_forfeit(battle uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); b public.live_battles; other uuid;
begin
  select * into b from public.live_battles where id = battle for update;
  if b.id is null or me not in (b.challenger, b.opponent) then return 'not_found'; end if;
  other := case when me = b.challenger then b.opponent else b.challenger end;
  if b.status = 'invited' then
    update public.live_battles set status = 'cancelled', updated_at = now() where id = battle;
    return 'cancelled';
  end if;
  if b.status <> 'active' then return 'not_active'; end if;
  update public.live_battles set status = 'done', winner = other, updated_at = now() where id = battle;
  perform public.push_to_user(other, 'You win! 🏆', public.push_name(me) || ' left the battle.');
  return 'ok';
end $$;

-- A quick emoji reaction (no chat).
create or replace function public.live_react(battle uuid, emoji text) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); b public.live_battles;
begin
  if emoji not in ('😤', '😂', '👏', '😱', '🔥', '🙏') then return 'bad_emoji'; end if;
  select * into b from public.live_battles where id = battle;
  if b.id is null or me not in (b.challenger, b.opponent) then return 'not_found'; end if;
  if me = b.challenger then
    update public.live_battles set challenger_react = jsonb_build_object('e', emoji, 'at', now()) where id = battle;
  else
    update public.live_battles set opponent_react = jsonb_build_object('e', emoji, 'at', now()) where id = battle;
  end if;
  return 'ok';
end $$;

revoke all on function public.live_valid_team(jsonb) from public, anon, authenticated;
revoke all on function public.live_challenge(uuid, jsonb) from public, anon;
revoke all on function public.live_respond(uuid, boolean, jsonb) from public, anon;
revoke all on function public.live_move(uuid, int, jsonb) from public, anon;
revoke all on function public.live_finish(uuid, boolean) from public, anon;
revoke all on function public.live_claim_timeout(uuid) from public, anon;
revoke all on function public.live_forfeit(uuid) from public, anon;
revoke all on function public.live_react(uuid, text) from public, anon;
grant execute on function public.live_challenge(uuid, jsonb) to authenticated;
grant execute on function public.live_respond(uuid, boolean, jsonb) to authenticated;
grant execute on function public.live_move(uuid, int, jsonb) to authenticated;
grant execute on function public.live_finish(uuid, boolean) to authenticated;
grant execute on function public.live_claim_timeout(uuid) to authenticated;
grant execute on function public.live_forfeit(uuid) to authenticated;
grant execute on function public.live_react(uuid, text) to authenticated;
