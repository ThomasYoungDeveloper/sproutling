-- Chat rules agreement (shown once, before the first chat) and an in-app "Help and support" form.

alter table public.profiles add column if not exists chat_rules_at timestamptz;

create or replace function public.chat_settings(p_mode text default null, p_push boolean default null, p_accept_rules boolean default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r record;
begin
  if p_mode is not null and p_mode in ('on', 'phrases', 'off') then update public.profiles set chat_mode = p_mode where id = me; end if;
  if p_push is not null then update public.profiles set chat_push = p_push where id = me; end if;
  if p_accept_rules then update public.profiles set chat_rules_at = coalesce(chat_rules_at, now()) where id = me; end if;
  select chat_mode, chat_push, chat_rules_at into r from public.profiles where id = me;
  return jsonb_build_object('mode', r.chat_mode, 'push', r.chat_push, 'rules', r.chat_rules_at is not null);
end $$;
drop function if exists public.chat_settings(text, boolean);
grant execute on function public.chat_settings(text, boolean, boolean) to authenticated;

create or replace function public.chat_send(p_room text, p_kind text, p_body text, p_sticker jsonb default null)
returns text language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); other uuid; mode text; rules timestamptz; clean text; t uuid; recent int; last_at timestamptz; nm text;
begin
  if me is null then return 'not_signed_in'; end if;
  if p_kind not in ('text', 'phrase', 'sticker') then return 'bad_kind'; end if;
  if not public.chat_can(p_room, me) then return 'not_allowed'; end if;
  select chat_mode, chat_rules_at into mode, rules from public.profiles where id = me;
  if rules is null then return 'accept_rules'; end if;
  if mode = 'off' then return 'chat_off'; end if;
  if mode = 'phrases' and p_kind = 'text' then return 'phrases_only'; end if;
  clean := btrim(coalesce(p_body, ''));
  if length(clean) = 0 or length(clean) > 300 then return 'bad_length'; end if;
  if p_sticker is not null and octet_length(p_sticker::text) > 400 then return 'bad_sticker'; end if;
  if p_room like 'dm:%' then
    other := case when split_part(p_room, ':', 2)::uuid = me then split_part(p_room, ':', 3)::uuid else split_part(p_room, ':', 2)::uuid end;
    if not public.are_friends(me, other) then return 'not_friends'; end if;
    if public.chat_blocked(me, other) then return 'blocked'; end if;
    if (select chat_mode from public.profiles where id = other) = 'off' then return 'their_chat_off'; end if;
  end if;
  select count(*) into recent from public.chat_messages where sender = me and created_at > now() - interval '1 minute';
  if recent >= 15 then return 'slow_down'; end if;
  if p_kind = 'text' and public.chat_has_contact(clean) then return 'no_contact_info'; end if;
  clean := public.chat_clean(clean);

  select max(created_at) into last_at from public.chat_messages where room = p_room;
  insert into public.chat_messages (room, sender, kind, body, sticker) values (p_room, me, p_kind, clean, p_sticker);
  insert into public.chat_reads (user_id, room, read_at) values (me, p_room, now())
    on conflict (user_id, room) do update set read_at = now();
  delete from public.chat_messages where id in (select id from public.chat_messages where created_at < now() - interval '30 days' limit 200);

  nm := public.push_name(me);
  if other is not null then
    if (select chat_push from public.profiles where id = other) then
      perform public.push_to_user(other, nm, case when p_kind = 'sticker' then 'Sent a sticker' else clean end, 'chat');
    end if;
  else
    if last_at is null or last_at < now() - interval '5 minutes' then
      t := split_part(p_room, ':', 2)::uuid;
      perform public.push_to_user(m.user_id, 'Guild chat', nm || ': ' || case when p_kind = 'sticker' then 'sent a sticker' else clean end, 'chat')
        from public.team_members m join public.profiles p on p.id = m.user_id
       where m.team_id = t and m.user_id <> me and p.chat_push and not public.chat_blocked(me, m.user_id);
    end if;
  end if;
  return 'ok';
end $$;

create table if not exists public.support_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  app_build text,
  created_at timestamptz not null default now(),
  handled boolean not null default false
);
alter table public.support_messages enable row level security;
-- No select/insert policies: players write only through support_send; Tom reads it in the dashboard.

create or replace function public.support_send(p_body text, p_build text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); b text := btrim(coalesce(p_body, '')); admin uuid; n int;
begin
  if me is null then return 'not_signed_in'; end if;
  if length(b) = 0 or length(b) > 2000 then return 'bad_length'; end if;
  select count(*) into n from public.support_messages where user_id = me and created_at > now() - interval '1 hour';
  if n >= 5 then return 'slow_down'; end if;
  insert into public.support_messages (user_id, body, app_build) values (me, b, left(p_build, 40));
  select admin_user into admin from public.app_config limit 1;
  if admin is not null then
    perform public.push_to_user(admin, 'Support message', public.push_name(me) || ': ' || left(b, 120), 'account');
  end if;
  return 'ok';
end $$;
revoke all on function public.support_send(text, text) from public, anon;
grant execute on function public.support_send(text, text) to authenticated;
