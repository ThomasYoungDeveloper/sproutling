-- Trade requests: A browses a friend's pets, picks one they want, and offers one of their own.
-- The friend accepts (the swap happens right away) or declines. Requests expire after 3 days.
--
-- Stored on the same trades table: want_pet is the friend's pet being asked for.
-- On accept, the friend's app sends a fresh copy of that pet as counter_pet and the trade completes,
-- so both apps swap with the existing "completed" flow.

alter table public.trades add column if not exists want_pet jsonb;
alter table public.trades add column if not exists expires_at timestamptz;
alter table public.trades drop constraint if exists trades_status_check;
alter table public.trades add constraint trades_status_check check (status in ('offered', 'countered', 'completed', 'declined', 'cancelled', 'expired'));

-- Close requests that ran out of time.
create or replace function public.expire_trades() returns void
language sql security definer set search_path = '' as $$
  update public.trades set status = 'expired'
   where status = 'offered' and expires_at is not null and expires_at < now();
$$;

create or replace function public.request_trade(friend uuid, want jsonb, pet jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then return 'signed_out'; end if;
  perform public.expire_trades();
  if not public.are_friends(me, friend) then return 'not_friends'; end if;
  if not public.valid_trade_pet(pet) or not public.valid_trade_pet(want) then return 'bad_pet'; end if;
  if (select count(*) from public.trades where me in (from_user, to_user) and status in ('offered', 'countered')) >= 5 then return 'too_many'; end if;
  if exists (
    select 1 from public.trades
     where status in ('offered', 'countered')
       and ((from_user = me and offer_pet->>'id' = pet->>'id') or (to_user = me and counter_pet->>'id' = pet->>'id'))
  ) then return 'pet_busy'; end if;
  if exists (
    select 1 from public.trades
     where status = 'offered' and from_user = me and to_user = friend and want_pet->>'id' = want->>'id'
  ) then return 'already_asked'; end if;
  insert into public.trades (from_user, to_user, offer_pet, want_pet, expires_at)
  values (me, friend, pet, want, now() + interval '3 days');
  return 'sent';
end $$;

-- The friend accepts: their app sends the asked-for pet (it must be the same pet) and the trade completes.
create or replace function public.accept_trade_request(trade_id uuid, pet jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then return 'signed_out'; end if;
  perform public.expire_trades();
  if not public.valid_trade_pet(pet) then return 'bad_pet'; end if;
  if exists (
    select 1 from public.trades
     where id <> trade_id and status in ('offered', 'countered')
       and ((from_user = me and offer_pet->>'id' = pet->>'id') or (to_user = me and counter_pet->>'id' = pet->>'id'))
  ) then return 'pet_busy'; end if;
  update public.trades set status = 'completed', counter_pet = pet
   where id = trade_id and to_user = me and status = 'offered' and want_pet is not null
     and want_pet->>'id' = pet->>'id' and public.are_friends(from_user, to_user);
  return case when found then 'ok' else 'not_found' end;
end $$;

-- The classic flow (offer first, they pick) can't be used to answer a request.
create or replace function public.counter_trade(trade_id uuid, pet jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  perform public.expire_trades();
  if not public.valid_trade_pet(pet) then return 'bad_pet'; end if;
  if exists (
    select 1 from public.trades
     where status in ('offered', 'countered')
       and ((from_user = me and offer_pet->>'id' = pet->>'id') or (to_user = me and counter_pet->>'id' = pet->>'id'))
  ) then return 'pet_busy'; end if;
  update public.trades set status = 'countered', counter_pet = pet
   where id = trade_id and to_user = me and status = 'offered' and want_pet is null and public.are_friends(from_user, to_user);
  return case when found then 'ok' else 'not_found' end;
end $$;

create or replace function public.create_trade(friend uuid, pet jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then return 'signed_out'; end if;
  perform public.expire_trades();
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

-- Notifications, now aware of requests.
create or replace function public.push_on_trade() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  if tg_op = 'INSERT' and new.status = 'offered' then
    if new.want_pet is not null then
      perform push_to_user(new.to_user, 'Trade offer', push_name(new.from_user) || ' offered ' || (new.offer_pet->>'nickname') || ' for your ' || (new.want_pet->>'nickname') || '.');
    else
      perform push_to_user(new.to_user, 'Trade offer', push_name(new.from_user) || ' wants to trade pets with you.');
    end if;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'countered' then
      perform push_to_user(new.from_user, 'Trade counter-offer', push_name(new.to_user) || ' answered your trade with an offer.');
    elsif new.status = 'completed' and new.want_pet is not null then
      perform push_to_user(new.from_user, 'Trade accepted', push_name(new.to_user) || ' accepted! ' || (new.want_pet->>'nickname') || ' is on the way to you.');
    elsif new.status = 'completed' then
      perform push_to_user(new.to_user, 'Trade complete', 'Your trade with ' || push_name(new.from_user) || ' went through. Meet your new pet!');
    elsif new.status = 'declined' and new.want_pet is not null then
      perform push_to_user(new.from_user, 'Trade offer', push_name(new.to_user) || ' passed on your offer for ' || (new.want_pet->>'nickname') || '.');
    end if;
  end if;
  return new;
end $$;

revoke execute on function public.expire_trades() from public, anon, authenticated;
revoke execute on function public.request_trade(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.accept_trade_request(uuid, jsonb) from public, anon;
grant execute on function public.request_trade(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.accept_trade_request(uuid, jsonb) to authenticated;
revoke execute on function public.counter_trade(uuid, jsonb) from public, anon;
revoke execute on function public.create_trade(uuid, jsonb) from public, anon;
grant execute on function public.counter_trade(uuid, jsonb) to authenticated;
grant execute on function public.create_trade(uuid, jsonb) to authenticated;
