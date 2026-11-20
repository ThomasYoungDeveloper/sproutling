-- Gifts: up to 10 a day (was 3), still one per friend.
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
  if (select count(*) from public.gifts where sender = me and day = today) >= 10 then return 'limit'; end if;
  insert into public.gifts (sender, recipient, day) values (me, friend, today) on conflict do nothing;
  return case when found then 'sent' else 'already' end;
end $$;
