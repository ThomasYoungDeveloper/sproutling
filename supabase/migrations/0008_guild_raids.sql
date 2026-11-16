-- Weekly guild boss raid. Every guild faces the same boss each week.
-- Damage comes from members' weekly steps (1 per 10 steps) plus battle hits (up to 5 a day, 400 each).
-- When the boss's HP hits zero, every member can open a raid chest once.

create table public.team_raid_hits (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  week date not null,
  damage integer not null default 0 check (damage >= 0),
  day date not null default current_date,
  hits_today integer not null default 0,
  primary key (team_id, user_id, week)
);
alter table public.team_raid_hits enable row level security;
revoke all on public.team_raid_hits from anon, authenticated;

alter table public.team_claims drop constraint team_claims_tier_check;
alter table public.team_claims add constraint team_claims_tier_check check (tier in ('goal', 'super', 'raid'));

-- 2,500 HP per member, at least 5,000.
create or replace function public.raid_hp(members integer) returns integer
language sql immutable set search_path = '' as $$ select greatest(5000, members * 2500) $$;

create or replace function public.raid_damage(tid uuid, wk date) returns integer
language sql stable security definer set search_path = '' as $$
  select (coalesce((select sum(steps) from public.team_week_steps where team_id = tid and week = wk), 0) / 10
        + coalesce((select sum(damage) from public.team_raid_hits where team_id = tid and week = wk), 0))::integer
$$;

-- Called after a battle. Returns 'ok', 'limit', 'not_in_team'.
create or replace function public.raid_hit(amount integer) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  tid uuid := public.my_team();
  wk date := public.team_week();
  dmg integer := least(greatest(coalesce(amount, 0), 0), 400);
  r public.team_raid_hits;
begin
  if tid is null then return 'not_in_team'; end if;
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

create or replace function public.claim_raid_chest() returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  tid uuid := public.my_team();
  wk date := public.team_week();
  members integer;
begin
  if tid is null then return 'not_in_team'; end if;
  select count(*) into members from public.team_members where team_id = tid;
  if public.raid_damage(tid, wk) < public.raid_hp(members) then return 'not_yet'; end if;
  insert into public.team_claims (team_id, user_id, week, tier) values (tid, me, wk, 'raid') on conflict do nothing;
  return case when found then 'ok' else 'already' end;
end $$;

-- team_status now also reports the raid.
create or replace function public.team_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  tid uuid := public.my_team();
  wk date := public.team_week();
  members integer;
  result jsonb;
begin
  if tid is null then return null; end if;
  select count(*) into members from public.team_members where team_id = tid;
  select jsonb_build_object(
    'id', t.id, 'name', t.name, 'emoji', t.emoji, 'code', t.code, 'week', wk,
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.user_id, 'username', coalesce(p.username, 'Trainer'), 'role', m.role,
        'steps', coalesce(s.steps, 0), 'card', p.card, 'me', m.user_id = me,
        'raid', coalesce(s.steps, 0) / 10 + coalesce(h.damage, 0)
      ) order by coalesce(s.steps, 0) desc), '[]'::jsonb)
      from public.team_members m
      join public.profiles p on p.id = m.user_id
      left join public.team_week_steps s on s.team_id = m.team_id and s.user_id = m.user_id and s.week = wk
      left join public.team_raid_hits h on h.team_id = m.team_id and h.user_id = m.user_id and h.week = wk
      where m.team_id = t.id
    ),
    'claimed', (
      select coalesce(jsonb_agg(c.tier), '[]'::jsonb) from public.team_claims c
       where c.team_id = t.id and c.user_id = me and c.week = wk
    ),
    'raid', jsonb_build_object(
      'hp', public.raid_hp(members),
      'damage', public.raid_damage(t.id, wk),
      'hits_left', coalesce((
        select case when h.day = current_date then greatest(0, 5 - h.hits_today) else 5 end
          from public.team_raid_hits h where h.team_id = t.id and h.user_id = me and h.week = wk
      ), 5)
    )
  ) into result
  from public.teams t where t.id = tid;
  return result;
end $$;

revoke execute on function public.raid_hp(integer) from public, anon, authenticated;
revoke execute on function public.raid_damage(uuid, date) from public, anon, authenticated;
revoke execute on function public.raid_hit(integer) from public, anon;
revoke execute on function public.claim_raid_chest() from public, anon;
revoke execute on function public.team_status() from public, anon;
grant execute on function public.raid_hit(integer) to authenticated;
grant execute on function public.claim_raid_chest() to authenticated;
grant execute on function public.team_status() to authenticated;
