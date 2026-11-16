-- Cheers become gifts: up to 3 per day, one per friend. The recipient opens them in the app.
alter table public.cheers rename to gifts;
alter index public.cheers_recipient_idx rename to gifts_recipient_idx;
alter policy "see own cheers" on public.gifts rename to "see own gifts";
drop function public.send_cheer(uuid);
drop function public.claim_cheers();

create or replace function public.send_gift(friend uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
begin
  if not exists (
    select 1 from public.friendships
     where status = 'accepted'
       and least(requester, addressee) = least(me, friend)
       and greatest(requester, addressee) = greatest(me, friend)
  ) then return 'not_friends'; end if;
  if exists (select 1 from public.gifts where sender = me and recipient = friend and day = today) then return 'already'; end if;
  if (select count(*) from public.gifts where sender = me and day = today) >= 3 then return 'limit'; end if;
  insert into public.gifts (sender, recipient, day) values (me, friend, today) on conflict do nothing;
  return case when found then 'sent' else 'already' end;
end $$;

-- Marks your unopened gifts as opened and returns who sent them.
create or replace function public.claim_gifts() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare names jsonb;
begin
  with claimed as (
    update public.gifts set claimed_at = now()
     where recipient = auth.uid() and claimed_at is null
     returning sender
  )
  select coalesce(jsonb_agg(coalesce(p.username, 'A friend')), '[]'::jsonb) into names
    from claimed c join public.profiles p on p.id = c.sender;
  return names;
end $$;

revoke execute on function public.send_gift(uuid) from public, anon;
revoke execute on function public.claim_gifts() from public, anon;
grant execute on function public.send_gift(uuid) to authenticated;
grant execute on function public.claim_gifts() to authenticated;
