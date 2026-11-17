-- Players can delete their own account from inside the app (required by the App Store).
-- Their guild goes to the longest-standing member (or is removed if they were the last one),
-- then the login is deleted; every table that points at the player is removed with it (on delete cascade).
create or replace function public.delete_my_account()
returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if public.my_team() is not null then perform public.leave_team(); end if;
  delete from auth.users where id = me;
  return 'ok';
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
