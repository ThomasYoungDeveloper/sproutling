-- Friends: friend codes, a public trainer card, friend requests and daily cheers.

-- Friend codes: 6 characters, no look-alike letters (no 0/O, 1/I/L).
create or replace function public.new_friend_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where friend_code = code);
  end loop;
  return code;
end $$;

alter table public.profiles
  add column friend_code text unique,
  add column card jsonb not null default '{}'::jsonb,
  add column card_updated_at timestamptz;
update public.profiles set friend_code = public.new_friend_code() where friend_code is null;
alter table public.profiles alter column friend_code set default public.new_friend_code();
alter table public.profiles alter column friend_code set not null;
alter table public.profiles add constraint profiles_card_size check (octet_length(card::text) < 8000);

-- Players may only change their name and card, never their id or friend code.
revoke insert, update on public.profiles from authenticated;
grant insert (id, username, card, card_updated_at) on public.profiles to authenticated;
grant update (username, card, card_updated_at) on public.profiles to authenticated;

-- Friendships: one row per pair. Created and accepted only through the functions below.
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references public.profiles(id) on delete cascade,
  addressee uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester <> addressee)
);
create unique index friendships_pair_idx on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index friendships_requester_idx on public.friendships (requester);
create index friendships_addressee_idx on public.friendships (addressee);
alter table public.friendships enable row level security;
create policy "see own friendships" on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester, addressee));
create policy "remove own friendships" on public.friendships for delete to authenticated
  using ((select auth.uid()) in (requester, addressee));
grant select, delete on public.friendships to authenticated;
revoke all on public.friendships from anon;

-- Cheers: one per friend per day. The recipient claims them for coins.
create table public.cheers (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references public.profiles(id) on delete cascade,
  recipient uuid not null references public.profiles(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  unique (sender, recipient, day)
);
create index cheers_recipient_idx on public.cheers (recipient) where claimed_at is null;
alter table public.cheers enable row level security;
create policy "see own cheers" on public.cheers for select to authenticated
  using ((select auth.uid()) in (sender, recipient));
grant select on public.cheers to authenticated;
revoke all on public.cheers from anon;

-- Send a request by friend code or trainer name. Accepts automatically if they already asked you.
create or replace function public.send_friend_request(target text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  them uuid;
  existing public.friendships;
begin
  if me is null then return 'signed_out'; end if;
  select id into them from public.profiles
   where friend_code = upper(trim(target)) or lower(username) = lower(trim(target))
   limit 1;
  if them is null then return 'not_found'; end if;
  if them = me then return 'self'; end if;
  select * into existing from public.friendships
   where least(requester, addressee) = least(me, them) and greatest(requester, addressee) = greatest(me, them);
  if found then
    if existing.status = 'accepted' then return 'already_friends'; end if;
    if existing.requester = me then return 'already_sent'; end if;
    update public.friendships set status = 'accepted', accepted_at = now() where id = existing.id;
    return 'accepted';
  end if;
  if (select count(*) from public.friendships where me in (requester, addressee)) >= 200 then return 'full'; end if;
  insert into public.friendships (requester, addressee) values (me, them);
  return 'sent';
end $$;

create or replace function public.respond_friend_request(request_id uuid, accept boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if accept then
    update public.friendships set status = 'accepted', accepted_at = now()
     where id = request_id and addressee = me and status = 'pending';
  else
    delete from public.friendships where id = request_id and addressee = me and status = 'pending';
  end if;
  return case when found then 'ok' else 'not_found' end;
end $$;

create or replace function public.send_cheer(friend uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if not exists (
    select 1 from public.friendships
     where status = 'accepted'
       and least(requester, addressee) = least(me, friend)
       and greatest(requester, addressee) = greatest(me, friend)
  ) then return 'not_friends'; end if;
  insert into public.cheers (sender, recipient) values (me, friend) on conflict do nothing;
  return case when found then 'sent' else 'already' end;
end $$;

-- Marks your unclaimed cheers as claimed and returns who sent them.
create or replace function public.claim_cheers() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare names jsonb;
begin
  with claimed as (
    update public.cheers set claimed_at = now()
     where recipient = auth.uid() and claimed_at is null
     returning sender
  )
  select coalesce(jsonb_agg(coalesce(p.username, 'A friend')), '[]'::jsonb) into names
    from claimed c join public.profiles p on p.id = c.sender;
  return names;
end $$;

revoke execute on function public.new_friend_code() from public, anon;
grant execute on function public.new_friend_code() to authenticated;
revoke execute on function public.send_friend_request(text) from public, anon;
revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.send_cheer(uuid) from public, anon;
revoke execute on function public.claim_cheers() from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.send_cheer(uuid) to authenticated;
grant execute on function public.claim_cheers() to authenticated;
