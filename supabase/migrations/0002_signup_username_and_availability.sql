-- Applied to project ehqairqnilwycniuhdju on 2026-11-16 (via Supabase MCP).
-- Save the trainer name chosen at sign-up, and let the sign-up form check names live.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wanted text := new.raw_user_meta_data->>'username';
begin
  if wanted is not null and wanted ~ '^[A-Za-z0-9_]{3,20}$' then
    begin
      insert into public.profiles (id, username) values (new.id, wanted);
      return new;
    exception when unique_violation then
      null;
    end;
  end if;
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

create or replace function public.username_available(name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select name ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles p where lower(p.username) = lower(name));
$$;
revoke execute on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
