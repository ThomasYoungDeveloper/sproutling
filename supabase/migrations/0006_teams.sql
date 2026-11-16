-- Family teams (guilds): up to 20 players, a shared weekly step goal and team chests.
-- Everything goes through the functions below; the tables aren't readable directly.

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 24),
  emoji text not null default '🌱' check (length(emoji) <= 8),
  code text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id),
  unique (user_id)
);

create table public.team_week_steps (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  week date not null,
  steps integer not null default 0 check (steps between 0 and 1000000),
  updated_at timestamptz not null default now(),
  primary key (team_id, user_id, week)
);

create table public.team_claims (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  week date not null,
  tier text not null check (tier in ('goal', 'super')),
  claimed_at timestamptz not null default now(),
  primary key (team_id, user_id, week, tier)
);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_week_steps enable row level security;
alter table public.team_claims enable row level security;
revoke all on public.teams, public.team_members, public.team_week_steps, public.team_claims from anon, authenticated;

create or replace function public.team_week() returns date
language sql stable set search_path = '' as $$
  select date_trunc('week', (now() at time zone 'utc'))::date;
$$;

-- 25,000 steps per member per week (about 3,500 a day), the super goal is double.
create or replace function public.team_goal(members integer) returns integer
language sql immutable set search_path = '' as $$
  select greatest(1, members) * 25000;
$$;

create or replace function public.my_team() returns uuid
language sql stable security definer set search_path = '' as $$
  select team_id from public.team_members where user_id = auth.uid();
$$;

create or replace function public.create_team(team_name text, team_emoji text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  new_code text;
  tid uuid;
begin
  if me is null then return 'signed_out'; end if;
  if public.my_team() is not null then return 'already_in_team'; end if;
  if length(trim(team_name)) < 2 then return 'bad_name'; end if;
  new_code := public.new_friend_code();
  while exists (select 1 from public.teams where code = new_code) loop
    new_code := public.new_friend_code();
  end loop;
  insert into public.teams (name, emoji, code, created_by)
  values (left(trim(team_name), 24), left(coalesce(nullif(team_emoji, ''), '🌱'), 8), new_code, me)
  returning id into tid;
  insert into public.team_members (team_id, user_id, role) values (tid, me, 'leader');
  return 'ok';
end $$;

create or replace function public.join_team(team_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  tid uuid;
begin
  if me is null then return 'signed_out'; end if;
  if public.my_team() is not null then return 'already_in_team'; end if;
  select id into tid from public.teams where code = upper(trim(team_code));
  if tid is null then return 'not_found'; end if;
  if (select count(*) from public.team_members where team_id = tid) >= 20 then return 'full'; end if;
  insert into public.team_members (team_id, user_id) values (tid, me);
  return 'ok';
end $$;

create or replace function public.leave_team() returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  tid uuid := public.my_team();
  was_leader boolean;
begin
  if tid is null then return 'not_in_team'; end if;
  select role = 'leader' into was_leader from public.team_members where team_id = tid and user_id = me;
  delete from public.team_members where team_id = tid and user_id = me;
  if not exists (select 1 from public.team_members where team_id = tid) then
    delete from public.teams where id = tid;
  elsif was_leader then
    update public.team_members set role = 'leader'
     where team_id = tid and user_id = (select user_id from public.team_members where team_id = tid order by joined_at limit 1);
  end if;
  return 'ok';
end $$;

-- Your steps so far this week (the app sends the total; it can only go up within a week).
create or replace function public.report_team_steps(week_steps integer) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  tid uuid := public.my_team();
begin
  if tid is null then return 'not_in_team'; end if;
  insert into public.team_week_steps (team_id, user_id, week, steps)
  values (tid, me, public.team_week(), least(greatest(week_steps, 0), 1000000))
  on conflict (team_id, user_id, week) do update
    set steps = greatest(public.team_week_steps.steps, excluded.steps), updated_at = now();
  return 'ok';
end $$;

create or replace function public.team_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  tid uuid := public.my_team();
  wk date := public.team_week();
  result jsonb;
begin
  if tid is null then return null; end if;
  select jsonb_build_object(
    'id', t.id, 'name', t.name, 'emoji', t.emoji, 'code', t.code, 'week', wk,
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.user_id, 'username', coalesce(p.username, 'Trainer'), 'role', m.role,
        'steps', coalesce(s.steps, 0), 'card', p.card, 'me', m.user_id = me
      ) order by coalesce(s.steps, 0) desc), '[]'::jsonb)
      from public.team_members m
      join public.profiles p on p.id = m.user_id
      left join public.team_week_steps s on s.team_id = m.team_id and s.user_id = m.user_id and s.week = wk
      where m.team_id = t.id
    ),
    'claimed', (
      select coalesce(jsonb_agg(c.tier), '[]'::jsonb) from public.team_claims c
       where c.team_id = t.id and c.user_id = me and c.week = wk
    )
  ) into result
  from public.teams t where t.id = tid;
  return result;
end $$;

-- Each member opens their own team chest once the team reaches the goal (and again at the super goal).
create or replace function public.claim_team_chest(tier text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  tid uuid := public.my_team();
  wk date := public.team_week();
  total integer;
  members integer;
  goal integer;
begin
  if tid is null then return 'not_in_team'; end if;
  if tier not in ('goal', 'super') then return 'bad_tier'; end if;
  select count(*) into members from public.team_members where team_id = tid;
  select coalesce(sum(steps), 0) into total from public.team_week_steps where team_id = tid and week = wk;
  goal := public.team_goal(members) * (case when tier = 'super' then 2 else 1 end);
  if total < goal then return 'not_yet'; end if;
  insert into public.team_claims (team_id, user_id, week, tier) values (tid, me, wk, tier) on conflict do nothing;
  return case when found then 'ok' else 'already' end;
end $$;

revoke execute on function public.team_week() from public, anon;
revoke execute on function public.team_goal(integer) from public, anon;
revoke execute on function public.my_team() from public, anon, authenticated;
revoke execute on function public.create_team(text, text) from public, anon;
revoke execute on function public.join_team(text) from public, anon;
revoke execute on function public.leave_team() from public, anon;
revoke execute on function public.report_team_steps(integer) from public, anon;
revoke execute on function public.team_status() from public, anon;
revoke execute on function public.claim_team_chest(text) from public, anon;
grant execute on function public.team_week() to authenticated;
grant execute on function public.team_goal(integer) to authenticated;
grant execute on function public.create_team(text, text) to authenticated;
grant execute on function public.join_team(text) to authenticated;
grant execute on function public.leave_team() to authenticated;
grant execute on function public.report_team_steps(integer) to authenticated;
grant execute on function public.team_status() to authenticated;
grant execute on function public.claim_team_chest(text) to authenticated;
