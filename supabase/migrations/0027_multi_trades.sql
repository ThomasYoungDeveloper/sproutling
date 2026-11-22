-- Multi-pet trades: up to 3 pets on each side, no coins. offer_pet / counter_pet keep the first pet so
-- older app versions still show something; they can't counter or accept a multi-pet trade.
alter table public.trades add column if not exists offer_pets jsonb;
alter table public.trades add column if not exists counter_pets jsonb;

create or replace function public.valid_trade_pets(arr jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(arr) = 'array'
     and jsonb_array_length(arr) between 1 and 3
     and (select bool_and(public.valid_trade_pet(e)) from jsonb_array_elements(arr) e)
     and (select count(distinct e->>'id') from jsonb_array_elements(arr) e) = jsonb_array_length(arr);
$$;

-- Is any of these pets already held by another open trade of mine?
create or replace function public.trade_pets_busy(me uuid, arr jsonb, skip uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.trades t, jsonb_array_elements(arr) p
     where t.id is distinct from skip and t.status in ('offered', 'countered')
       and (
         (t.from_user = me and (t.offer_pet->>'id' = p->>'id' or coalesce(t.offer_pets, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id', p->>'id'))))
         or (t.to_user = me and (t.counter_pet->>'id' = p->>'id' or coalesce(t.counter_pets, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id', p->>'id'))))
       )
  );
$$;

-- Offer up to 3 pets. With want: asking for one of the friend's pets (lasts 3 days).
create or replace function public.trade_offer(friend uuid, pets jsonb, want jsonb default null)
returns text language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then return 'signed_out'; end if;
  perform public.expire_trades();
  if not public.are_friends(me, friend) then return 'not_friends'; end if;
  if not public.valid_trade_pets(pets) or (want is not null and not public.valid_trade_pet(want)) then return 'bad_pet'; end if;
  if (select count(*) from public.trades where me in (from_user, to_user) and status in ('offered', 'countered')) >= 5 then return 'too_many'; end if;
  if public.trade_pets_busy(me, pets, null) then return 'pet_busy'; end if;
  if want is not null and exists (
    select 1 from public.trades where status = 'offered' and from_user = me and to_user = friend and want_pet->>'id' = want->>'id'
  ) then return 'already_asked'; end if;
  insert into public.trades (from_user, to_user, offer_pet, offer_pets, want_pet, expires_at)
  values (me, friend, pets->0, pets, want, case when want is null then null else now() + interval '3 days' end);
  return 'sent';
end $$;

-- Answer an offer with up to 3 of your pets, and (optionally) only some of the offered pets.
create or replace function public.trade_counter(trade_id uuid, pets jsonb, take_ids jsonb default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  t public.trades;
  offered jsonb;
  kept jsonb;
begin
  if me is null then return 'signed_out'; end if;
  perform public.expire_trades();
  if not public.valid_trade_pets(pets) then return 'bad_pet'; end if;
  if public.trade_pets_busy(me, pets, trade_id) then return 'pet_busy'; end if;
  select * into t from public.trades where id = trade_id and to_user = me and status = 'offered' for update;
  if not found or not public.are_friends(t.from_user, t.to_user) then return 'not_found'; end if;
  offered := coalesce(t.offer_pets, jsonb_build_array(t.offer_pet));
  if take_ids is null or jsonb_typeof(take_ids) <> 'array' or jsonb_array_length(take_ids) = 0 then
    kept := offered;
  else
    select coalesce(jsonb_agg(e), '[]'::jsonb) into kept from jsonb_array_elements(offered) e where take_ids ? (e->>'id');
    if jsonb_array_length(kept) = 0 then return 'bad_pet'; end if;
  end if;
  update public.trades
     set status = 'countered', counter_pet = pets->0, counter_pets = pets,
         offer_pet = kept->0, offer_pets = kept, want_pet = null
   where id = trade_id;
  return 'ok';
end $$;

-- Accept an offer that asked for one of your pets.
create or replace function public.trade_accept(trade_id uuid, pet jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then return 'signed_out'; end if;
  perform public.expire_trades();
  if not public.valid_trade_pet(pet) then return 'bad_pet'; end if;
  if public.trade_pets_busy(me, jsonb_build_array(pet), trade_id) then return 'pet_busy'; end if;
  update public.trades set status = 'completed', counter_pet = pet, counter_pets = jsonb_build_array(pet)
   where id = trade_id and to_user = me and status = 'offered' and want_pet is not null
     and want_pet->>'id' = pet->>'id' and public.are_friends(from_user, to_user);
  return case when found then 'ok' else 'not_found' end;
end $$;

-- Older app versions can't counter or accept a multi-pet trade (they'd only swap the first pet).
create or replace function public.counter_trade(trade_id uuid, pet jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  perform public.expire_trades();
  if not public.valid_trade_pet(pet) then return 'bad_pet'; end if;
  if public.trade_pets_busy(me, jsonb_build_array(pet), trade_id) then return 'pet_busy'; end if;
  update public.trades set status = 'countered', counter_pet = pet, counter_pets = jsonb_build_array(pet)
   where id = trade_id and to_user = me and status = 'offered' and want_pet is null
     and coalesce(jsonb_array_length(offer_pets), 1) <= 1 and public.are_friends(from_user, to_user);
  return case when found then 'ok' else 'not_found' end;
end $$;

create or replace function public.accept_trade_request(trade_id uuid, pet jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then return 'signed_out'; end if;
  perform public.expire_trades();
  if not public.valid_trade_pet(pet) then return 'bad_pet'; end if;
  if public.trade_pets_busy(me, jsonb_build_array(pet), trade_id) then return 'pet_busy'; end if;
  update public.trades set status = 'completed', counter_pet = pet, counter_pets = jsonb_build_array(pet)
   where id = trade_id and to_user = me and status = 'offered' and want_pet is not null
     and want_pet->>'id' = pet->>'id' and coalesce(jsonb_array_length(offer_pets), 1) <= 1
     and public.are_friends(from_user, to_user);
  return case when found then 'ok' else 'not_found' end;
end $$;

revoke all on function public.valid_trade_pets(jsonb) from public, anon;
revoke all on function public.trade_pets_busy(uuid, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.trade_offer(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.trade_counter(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.trade_accept(uuid, jsonb) from public, anon;
grant execute on function public.trade_offer(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.trade_counter(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.trade_accept(uuid, jsonb) to authenticated;
