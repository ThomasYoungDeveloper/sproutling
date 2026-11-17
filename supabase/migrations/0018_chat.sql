-- Friend and guild chat. Rooms: 'dm:<smaller uuid>:<larger uuid>' or 'team:<team uuid>'.
-- Messages go through chat_send, which checks who you can talk to, filters the text and limits spam.

alter table public.profiles add column if not exists chat_mode text not null default 'on' check (chat_mode in ('on', 'phrases', 'off'));
alter table public.profiles add column if not exists chat_push boolean not null default true;
alter table public.app_config add column if not exists admin_user uuid;

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  room text not null,
  sender uuid references public.profiles (id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'phrase', 'sticker', 'system')),
  body text not null,
  sticker jsonb,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_room_idx on public.chat_messages (room, created_at desc);

create table if not exists public.chat_reads (
  user_id uuid not null references public.profiles (id) on delete cascade,
  room text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, room)
);

create table if not exists public.chat_blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

create table if not exists public.chat_reports (
  id bigint generated always as identity primary key,
  reporter uuid references public.profiles (id) on delete set null,
  message_id bigint,
  sender uuid,
  room text,
  body text,
  reason text,
  created_at timestamptz not null default now(),
  reviewed boolean not null default false
);

alter table public.chat_messages enable row level security;
alter table public.chat_reads enable row level security;
alter table public.chat_blocks enable row level security;
alter table public.chat_reports enable row level security;

create or replace function public.chat_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chat_blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

-- Can this user read/write this room?
create or replace function public.chat_can(room text, u uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare a uuid; b uuid; t uuid;
begin
  if room like 'dm:%' then
    a := split_part(room, ':', 2)::uuid; b := split_part(room, ':', 3)::uuid;
    if u not in (a, b) then return false; end if;
    return true; -- reading old messages stays allowed; sending also needs friendship (checked in chat_send)
  elsif room like 'team:%' then
    t := split_part(room, ':', 2)::uuid;
    return exists (select 1 from public.team_members where team_id = t and user_id = u);
  end if;
  return false;
exception when others then return false;
end $$;

create policy "read my chat rooms" on public.chat_messages for select
  using (public.chat_can(room, auth.uid()) and (sender is null or not public.chat_blocked(auth.uid(), sender)));
create policy "my read marks" on public.chat_reads for select using (user_id = auth.uid());
create policy "my blocks" on public.chat_blocks for select using (blocker = auth.uid());

do $$ begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null; end $$;

-- Swear words become stars. Links, emails and phone numbers are refused.
create or replace function public.chat_clean(t text) returns text
language plpgsql immutable set search_path = '' as $$
declare w text; out text := t;
begin
  foreach w in array array['fuck','fucking','fucker','shit','shitty','bitch','bastard','asshole','dick','dickhead','cunt','piss','pissed','damn','crap','slut','whore','fag','faggot','retard','retarded','nigger','nigga','cock','pussy','twat','wanker','bollocks','motherfucker','douche','jackass','dumbass','hoe','stfu','wtf','kys']
  loop
    out := regexp_replace(out, '(^|[^a-zA-Z])(' || w || ')([^a-zA-Z]|$)', '\1' || repeat('*', length(w)) || '\3', 'gi');
  end loop;
  return out;
end $$;

create or replace function public.chat_has_contact(t text) returns boolean
language sql immutable set search_path = '' as $$
  select t ~* '(https?://|www\.|[a-z0-9-]+\.(com|net|org|io|gg|ly|app|xyz|tv)\y|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|(\d[\s().-]*){7,}|discord|snap(chat)?|insta(gram)?|tiktok|whatsapp)';
$$;

-- Send a message. kind: 'text' (typed), 'phrase' (quick phrase) or 'sticker' (your pet + a phrase).
create or replace function public.chat_send(p_room text, p_kind text, p_body text, p_sticker jsonb default null) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); other uuid; mode text; clean text; t uuid; recent int; last_at timestamptz; nm text;
begin
  if me is null then return 'not_signed_in'; end if;
  if p_kind not in ('text', 'phrase', 'sticker') then return 'bad_kind'; end if;
  if not public.chat_can(p_room, me) then return 'not_allowed'; end if;
  select chat_mode into mode from public.profiles where id = me;
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
  -- Keep 30 days of messages.
  delete from public.chat_messages where id in (select id from public.chat_messages where created_at < now() - interval '30 days' limit 200);

  nm := public.push_name(me);
  if other is not null then
    if (select chat_push from public.profiles where id = other) then
      perform public.push_to_user(other, nm, case when p_kind = 'sticker' then 'Sent a sticker' else clean end, 'chat');
    end if;
  else
    -- Guild: only notify when the chat was quiet for 5 minutes, so a busy chat doesn't buzz nonstop.
    if last_at is null or last_at < now() - interval '5 minutes' then
      t := split_part(p_room, ':', 2)::uuid;
      perform public.push_to_user(m.user_id, 'Guild chat', nm || ': ' || case when p_kind = 'sticker' then 'sent a sticker' else clean end, 'chat')
        from public.team_members m join public.profiles p on p.id = m.user_id
       where m.team_id = t and m.user_id <> me and p.chat_push and not public.chat_blocked(me, m.user_id);
    end if;
  end if;
  return 'ok';
end $$;

-- Your chats: latest message and unread count per room.
create or replace function public.chat_rooms() returns jsonb
language sql stable security definer set search_path = '' as $$
  with mine as (
    select 'team:' || team_id::text as room from public.team_members where user_id = auth.uid()
    union
    select distinct room from public.chat_messages where room like 'dm:%' and (split_part(room, ':', 2) = auth.uid()::text or split_part(room, ':', 3) = auth.uid()::text)
  )
  select coalesce(jsonb_agg(x order by x->>'at' desc nulls last), '[]'::jsonb) from (
    select jsonb_build_object(
      'room', m.room,
      'at', l.created_at,
      'last', case when l.kind = 'sticker' then 'Sent a sticker' else l.body end,
      'lastFrom', case when l.sender = auth.uid() then 'me' else coalesce(lp.username, '') end,
      'unread', (select count(*) from public.chat_messages c where c.room = m.room and c.sender is distinct from auth.uid()
                  and c.created_at > coalesce((select read_at from public.chat_reads r where r.user_id = auth.uid() and r.room = m.room), 'epoch')
                  and (c.sender is null or not public.chat_blocked(auth.uid(), c.sender)))
    ) as x
    from mine m
    left join lateral (select * from public.chat_messages c where c.room = m.room and (c.sender is null or not public.chat_blocked(auth.uid(), c.sender)) order by created_at desc limit 1) l on true
    left join public.profiles lp on lp.id = l.sender
  ) s;
$$;

create or replace function public.chat_mark_read(p_room text) returns void
language sql security definer set search_path = '' as $$
  insert into public.chat_reads (user_id, room, read_at) select auth.uid(), p_room, now() where public.chat_can(p_room, auth.uid())
  on conflict (user_id, room) do update set read_at = now();
$$;

-- Block: hides each other in chat, ends the friendship and stops new friend requests.
create or replace function public.chat_block(p_user uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null or p_user is null or p_user = me then return 'bad'; end if;
  insert into public.chat_blocks (blocker, blocked) values (me, p_user) on conflict do nothing;
  delete from public.friendships where (requester = me and addressee = p_user) or (requester = p_user and addressee = me);
  return 'ok';
end $$;

create or replace function public.chat_unblock(p_user uuid) returns text
language sql security definer set search_path = '' as $$
  delete from public.chat_blocks where blocker = auth.uid() and blocked = p_user returning 'ok';
$$;

create or replace function public.chat_blocked_list() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.blocked, 'name', coalesce(p.username, 'Trainer'))), '[]'::jsonb)
    from public.chat_blocks b left join public.profiles p on p.id = b.blocked where b.blocker = auth.uid();
$$;

-- Report a message. Saved for review and sent to the admin's phone.
create or replace function public.chat_report(p_message bigint, p_reason text) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); m public.chat_messages; admin uuid;
begin
  select * into m from public.chat_messages where id = p_message;
  if m.id is null or not public.chat_can(m.room, me) then return 'not_found'; end if;
  insert into public.chat_reports (reporter, message_id, sender, room, body, reason)
  values (me, m.id, m.sender, m.room, m.body, left(coalesce(p_reason, ''), 200));
  select admin_user into admin from public.app_config limit 1;
  if admin is not null then
    perform public.push_to_user(admin, 'Chat report', public.push_name(me) || ' reported ' || public.push_name(m.sender) || ': "' || left(m.body, 80) || '"', 'chat');
  end if;
  return 'ok';
end $$;

create or replace function public.chat_settings(p_mode text default null, p_push boolean default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r record;
begin
  if p_mode is not null and p_mode in ('on', 'phrases', 'off') then update public.profiles set chat_mode = p_mode where id = me; end if;
  if p_push is not null then update public.profiles set chat_push = p_push where id = me; end if;
  select chat_mode, chat_push into r from public.profiles where id = me;
  return jsonb_build_object('mode', r.chat_mode, 'push', r.chat_push);
end $$;

-- No friend requests between blocked trainers.
create or replace function public.chat_block_friend_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.chat_blocked(new.requester, new.addressee) then return null; end if;
  return new;
end $$;
drop trigger if exists chat_block_friend_guard on public.friendships;
create trigger chat_block_friend_guard before insert on public.friendships for each row execute function public.chat_block_friend_guard();

-- Guild news in guild chat: new members and boss hits.
create or replace function public.chat_guild_join() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.chat_messages (room, sender, kind, body) values ('team:' || new.team_id::text, null, 'system', public.push_name(new.user_id) || ' joined the guild');
  return new;
exception when others then return new;
end $$;
drop trigger if exists chat_guild_join on public.team_members;
create trigger chat_guild_join after insert on public.team_members for each row execute function public.chat_guild_join();

create or replace function public.chat_guild_hit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare d int;
begin
  d := new.damage - coalesce(case when tg_op = 'UPDATE' then old.damage end, 0);
  if d > 0 then
    insert into public.chat_messages (room, sender, kind, body) values ('team:' || new.team_id::text, null, 'system', public.push_name(new.user_id) || ' hit the guild boss for ' || d || ' damage');
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists chat_guild_hit on public.team_raid_hits;
create trigger chat_guild_hit after insert or update of damage on public.team_raid_hits for each row execute function public.chat_guild_hit();

revoke all on function public.chat_blocked(uuid, uuid) from public, anon;
revoke all on function public.chat_can(text, uuid) from public, anon;
revoke all on function public.chat_send(text, text, text, jsonb) from public, anon;
revoke all on function public.chat_rooms() from public, anon;
revoke all on function public.chat_mark_read(text) from public, anon;
revoke all on function public.chat_block(uuid) from public, anon;
revoke all on function public.chat_unblock(uuid) from public, anon;
revoke all on function public.chat_blocked_list() from public, anon;
revoke all on function public.chat_report(bigint, text) from public, anon;
revoke all on function public.chat_settings(text, boolean) from public, anon;
grant execute on function public.chat_blocked(uuid, uuid) to authenticated;
grant execute on function public.chat_can(text, uuid) to authenticated;
grant execute on function public.chat_send(text, text, text, jsonb) to authenticated;
grant execute on function public.chat_rooms() to authenticated;
grant execute on function public.chat_mark_read(text) to authenticated;
grant execute on function public.chat_block(uuid) to authenticated;
grant execute on function public.chat_unblock(uuid) to authenticated;
grant execute on function public.chat_blocked_list() to authenticated;
grant execute on function public.chat_report(bigint, text) to authenticated;
grant execute on function public.chat_settings(text, boolean) to authenticated;

-- Reports go to the admin's phone.
-- (set once: update public.app_config set admin_user = '<Tom''s user id>';)
