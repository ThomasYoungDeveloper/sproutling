-- Guild boss: walking does most of the damage, battles add a little (80 max per win, 5 a day),
-- nothing hits a boss that's already beaten, and chat gets milestones instead of a line per hit.
create or replace function public.raid_hit(amount integer)
returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  tid uuid := public.my_team();
  wk date := public.team_week();
  dmg integer := least(greatest(coalesce(amount, 0), 0), 80);
  members integer;
  r public.team_raid_hits;
begin
  if tid is null then return 'not_in_team'; end if;
  select count(*) into members from public.team_members where team_id = tid;
  if public.raid_damage(tid, wk) >= public.raid_hp(members) then return 'beaten'; end if;
  insert into public.team_raid_hits (team_id, user_id, week) values (tid, me, wk) on conflict do nothing;
  select * into r from public.team_raid_hits where team_id = tid and user_id = me and week = wk for update;
  if r.day <> current_date then
    r.day := current_date; r.hits_today := 0;
  end if;
  if r.hits_today >= 5 then return 'limit'; end if;
  update public.team_raid_hits
     set damage = damage + dmg, day = r.day, hits_today = r.hits_today + 1
   where team_id = tid and user_id = me and week = wk;
  return 'ok';
end $$;

-- No more "X hit the guild boss for N damage" lines.
create or replace function public.chat_guild_hit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  return new;
end $$;

-- Milestones posted once each per guild per week: half HP, a quarter left, defeated.
create table if not exists public.team_raid_marks (
  team_id uuid not null references public.teams (id) on delete cascade,
  week date not null,
  mark integer not null,
  primary key (team_id, week, mark)
);
alter table public.team_raid_marks enable row level security;
revoke all on public.team_raid_marks from anon, authenticated;

create or replace function public.raid_post_marks(tid uuid, wk date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  members integer;
  hp integer;
  done integer;
  pct integer;
  m integer;
  msg text;
begin
  select count(*) into members from public.team_members where team_id = tid;
  hp := public.raid_hp(members);
  done := public.raid_damage(tid, wk);
  pct := (done * 100) / greatest(hp, 1);
  foreach m in array array[50, 75, 100] loop
    if pct >= m then
      insert into public.team_raid_marks (team_id, week, mark) values (tid, wk, m) on conflict do nothing;
      if found then
        msg := case m
          when 50 then 'The guild boss is down to half HP. Keep walking!'
          when 75 then 'Only a quarter of the boss’s HP left!'
          else 'Your guild beat this week’s boss! Open your guild to claim a Gold chest.'
        end;
        insert into public.chat_messages (room, sender, kind, body) values ('team:' || tid::text, null, 'system', msg);
      end if;
    end if;
  end loop;
exception when others then null;
end $$;

create or replace function public.raid_marks_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.raid_post_marks(new.team_id, new.week);
  return new;
exception when others then return new;
end $$;

create or replace trigger raid_marks_hits after insert or update on public.team_raid_hits
  for each row execute function public.raid_marks_trigger();
create or replace trigger raid_marks_steps after insert or update on public.team_week_steps
  for each row execute function public.raid_marks_trigger();

revoke all on function public.raid_post_marks(uuid, date) from public, anon, authenticated;
revoke all on function public.raid_marks_trigger() from public, anon, authenticated;

-- Milestones a guild has already passed this week count as posted (no surprise messages today).
insert into public.team_raid_marks (team_id, week, mark)
select t.id, public.team_week(), m
from public.teams t, unnest(array[50, 75, 100]) m
where (public.raid_damage(t.id, public.team_week()) * 100)
      / greatest(public.raid_hp((select count(*)::int from public.team_members tm where tm.team_id = t.id)), 1) >= m
on conflict do nothing;
