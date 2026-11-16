-- Trading between friends, and a log of battles so the defender hears about them.
--
-- Trade flow: A offers a pet -> B picks a pet to offer back -> A confirms -> completed.
-- Each player's app then swaps the pets in its own save (once per trade, tracked in the save).

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'offered' check (status in ('offered', 'countered', 'completed', 'declined', 'cancelled')),
  offer_pet jsonb not null,
  counter_pet jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_user <> to_user)
);
create index trades_from_idx on public.trades (from_user, status);
create index trades_to_idx on public.trades (to_user, status);
alter table public.trades enable row level security;
create policy "see own trades" on public.trades for select to authenticated
  using ((select auth.uid()) in (from_user, to_user));
grant select on public.trades to authenticated;
revoke all on public.trades from anon;
create trigger trades_touch before update on public.trades for each row execute function public.touch_updated_at();

-- A pet as sent in a trade: {id, speciesId, nickname, xp, shiny, hatchedOn}.
create or replace function public.valid_trade_pet(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
     and coalesce(p->>'id', '') ~ '^[A-Za-z0-9_-]{1,40}$'
     and coalesce(p->>'speciesId', '') ~ '^p[0-9]{2}$'
     and jsonb_typeof(p->'xp') = 'number' and (p->>'xp')::numeric between 0 and 10000000
     and jsonb_typeof(p->'shiny') = 'boolean'
     and jsonb_typeof(p->'nickname') = 'string' and length(p->>'nickname') between 1 and 24
     and octet_length(p::text) < 600;
$$;

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships
     where status = 'accepted' and least(requester, addressee) = least(a, b) and greatest(requester, addressee) = greatest(a, b)
  );
$$;

create or replace function public.create_trade(friend uuid, pet jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then return 'signed_out'; end if;
  if not public.are_friends(me, friend) then return 'not_friends'; end if;
  if not public.valid_trade_pet(pet) then return 'bad_pet'; end if;
  if (select count(*) from public.trades where me in (from_user, to_user) and status in ('offered', 'countered')) >= 5 then return 'too_many'; end if;
  if exists (
    select 1 from public.trades
     where status in ('offered', 'countered')
       and ((from_user = me and offer_pet->>'id' = pet->>'id') or (to_user = me and counter_pet->>'id' = pet->>'id'))
  ) then return 'pet_busy'; end if;
  insert into public.trades (from_user, to_user, offer_pet) values (me, friend, pet);
  return 'sent';
end $$;

create or replace function public.counter_trade(trade_id uuid, pet jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if not public.valid_trade_pet(pet) then return 'bad_pet'; end if;
  if exists (
    select 1 from public.trades
     where status in ('offered', 'countered')
       and ((from_user = me and offer_pet->>'id' = pet->>'id') or (to_user = me and counter_pet->>'id' = pet->>'id'))
  ) then return 'pet_busy'; end if;
  update public.trades set status = 'countered', counter_pet = pet
   where id = trade_id and to_user = me and status = 'offered' and public.are_friends(from_user, to_user);
  return case when found then 'ok' else 'not_found' end;
end $$;

create or replace function public.confirm_trade(trade_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  update public.trades set status = 'completed'
   where id = trade_id and from_user = me and status = 'countered' and public.are_friends(from_user, to_user);
  return case when found then 'ok' else 'not_found' end;
end $$;

-- Either player can back out before the trade completes.
create or replace function public.cancel_trade(trade_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  update public.trades
     set status = case when from_user = me then 'cancelled' else 'declined' end
   where id = trade_id and me in (from_user, to_user) and status in ('offered', 'countered');
  return case when found then 'ok' else 'not_found' end;
end $$;

-- Battles are played against a snapshot of the friend's team; the result is logged for them.
create table public.battles (
  id uuid primary key default gen_random_uuid(),
  attacker uuid not null references public.profiles(id) on delete cascade,
  defender uuid not null references public.profiles(id) on delete cascade,
  attacker_won boolean not null,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index battles_defender_idx on public.battles (defender) where seen_at is null;
alter table public.battles enable row level security;
create policy "see own battles" on public.battles for select to authenticated
  using ((select auth.uid()) in (attacker, defender));
grant select on public.battles to authenticated;
revoke all on public.battles from anon;

create or replace function public.record_battle(friend uuid, won boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if not public.are_friends(me, friend) then return 'not_friends'; end if;
  if (select count(*) from public.battles where attacker = me and created_at > now() - interval '1 day') >= 50 then return 'limit'; end if;
  insert into public.battles (attacker, defender, attacker_won) values (me, friend, won);
  return 'ok';
end $$;

-- Returns battles against your team you haven't seen yet, and marks them seen.
create or replace function public.claim_battle_news() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare news jsonb;
begin
  with seen as (
    update public.battles set seen_at = now()
     where defender = auth.uid() and seen_at is null
     returning attacker, attacker_won
  )
  select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(p.username, 'A friend'), 'theyWon', s.attacker_won)), '[]'::jsonb) into news
    from seen s join public.profiles p on p.id = s.attacker;
  return news;
end $$;

revoke execute on function public.valid_trade_pet(jsonb) from public, anon, authenticated;
revoke execute on function public.are_friends(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.create_trade(uuid, jsonb) from public, anon;
revoke execute on function public.counter_trade(uuid, jsonb) from public, anon;
revoke execute on function public.confirm_trade(uuid) from public, anon;
revoke execute on function public.cancel_trade(uuid) from public, anon;
revoke execute on function public.record_battle(uuid, boolean) from public, anon;
revoke execute on function public.claim_battle_news() from public, anon;
grant execute on function public.create_trade(uuid, jsonb) to authenticated;
grant execute on function public.counter_trade(uuid, jsonb) to authenticated;
grant execute on function public.confirm_trade(uuid) to authenticated;
grant execute on function public.cancel_trade(uuid) to authenticated;
grant execute on function public.record_battle(uuid, boolean) to authenticated;
grant execute on function public.claim_battle_news() to authenticated;
