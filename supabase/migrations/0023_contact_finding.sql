-- Find friends from contacts. Players can add a phone number and opt in to "Let friends find me".
-- Only scrambled (SHA-256) phone numbers and emails are stored; the contacts a player checks are never saved.
create table if not exists public.contact_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  phone_hash text unique,
  email_hash text,
  findable boolean not null default false,
  adult boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.contact_keys enable row level security;
-- Nobody reads this table directly; everything goes through the functions below.
revoke all on public.contact_keys from anon, authenticated;

create index if not exists contact_keys_email_hash on public.contact_keys (email_hash) where findable and adult;

-- Your own settings (without the hashes).
create or replace function public.contact_prefs()
returns table (has_phone boolean, findable boolean)
language sql security definer set search_path = public as $$
  select phone_hash is not null, findable from public.contact_keys where user_id = auth.uid();
$$;

-- Save your number (already scrambled on the phone) and whether friends can find you.
-- The email hash is worked out here from your account email, so nobody can claim someone else's.
-- Returns 'ok' or 'taken' (that number is on another account).
create or replace function public.set_contact_prefs(p_phone_hash text, p_findable boolean, p_adult boolean)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  mail text;
begin
  if me is null then return 'signed_out'; end if;
  if p_phone_hash is not null and p_phone_hash !~ '^[0-9a-f]{64}$' then return 'bad'; end if;
  if p_phone_hash is not null and exists (select 1 from public.contact_keys where phone_hash = p_phone_hash and user_id <> me) then
    return 'taken';
  end if;
  select lower(email) into mail from auth.users where id = me;
  insert into public.contact_keys (user_id, phone_hash, email_hash, findable, adult, updated_at)
  values (me, p_phone_hash, case when mail is null then null else encode(digest('sproutling-v1:' || mail, 'sha256'), 'hex') end, coalesce(p_findable, false), coalesce(p_adult, false), now())
  on conflict (user_id) do update set phone_hash = excluded.phone_hash, email_hash = excluded.email_hash, findable = excluded.findable, adult = excluded.adult, updated_at = now();
  return 'ok';
end;
$$;

-- Check scrambled contacts against players who opted in. Keeps nothing; returns trainer names and pet cards only.
-- Only adults who turned on "Let friends find me" can be found. At most 2,000 contacts per check, 50 matches back.
create or replace function public.match_contacts(p_hashes text[])
returns table (id uuid, username text, card jsonb)
language sql security definer set search_path = public as $$
  select p.id, p.username, p.card
  from public.contact_keys k
  join public.profiles p on p.id = k.user_id
  where auth.uid() is not null
    and k.user_id <> auth.uid()
    and k.findable and k.adult
    and coalesce(array_length(p_hashes, 1), 0) <= 2000
    and (k.phone_hash = any (p_hashes) or k.email_hash = any (p_hashes))
  limit 50;
$$;

revoke all on function public.contact_prefs() from public, anon;
revoke all on function public.set_contact_prefs(text, boolean, boolean) from public, anon;
revoke all on function public.match_contacts(text[]) from public, anon;
grant execute on function public.contact_prefs() to authenticated;
grant execute on function public.set_contact_prefs(text, boolean, boolean) to authenticated;
grant execute on function public.match_contacts(text[]) to authenticated;

-- (applied as a follow-up) Passing no number keeps the saved one; p_clear_phone removes it.
drop function if exists public.set_contact_prefs(text, boolean, boolean);
create or replace function public.set_contact_prefs(p_phone_hash text, p_findable boolean, p_adult boolean, p_clear_phone boolean default false)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  mail text;
begin
  if me is null then return 'signed_out'; end if;
  if p_phone_hash is not null and p_phone_hash !~ '^[0-9a-f]{64}$' then return 'bad'; end if;
  if p_phone_hash is not null and exists (select 1 from public.contact_keys where phone_hash = p_phone_hash and user_id <> me) then
    return 'taken';
  end if;
  select lower(email) into mail from auth.users where id = me;
  insert into public.contact_keys (user_id, phone_hash, email_hash, findable, adult, updated_at)
  values (me, p_phone_hash, case when mail is null then null else encode(digest('sproutling-v1:' || mail, 'sha256'), 'hex') end, coalesce(p_findable, false), coalesce(p_adult, false), now())
  on conflict (user_id) do update set
    phone_hash = case when p_clear_phone then null else coalesce(excluded.phone_hash, contact_keys.phone_hash) end,
    email_hash = excluded.email_hash, findable = excluded.findable, adult = excluded.adult, updated_at = now();
  return 'ok';
end;
$$;
revoke all on function public.set_contact_prefs(text, boolean, boolean, boolean) from public, anon;
grant execute on function public.set_contact_prefs(text, boolean, boolean, boolean) to authenticated;
