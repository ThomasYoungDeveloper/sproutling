-- Ranked battle seasons: one season per calendar month (UTC).
-- Friend battles: win +20, loss -8 (only the first 3 battles against each friend per day count).
-- Wild battles: win +5 (5 a day). Points never drop below 0.
-- After a season ends, each player claims a reward once for the tier they finished in.

create table public.ranked_points (
  user_id uuid not null references public.profiles(id) on delete cascade,
  season date not null,
  points integer not null default 0 check (points >= 0),
  wins integer not null default 0,
  losses integer not null default 0,
  claimed boolean not null default false,
  primary key (user_id, season)
);

create table public.ranked_daily (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  opponent text not null,
  battles integer not null default 0,
  primary key (user_id, day, opponent)
);

alter table public.ranked_points enable row level security;
alter table public.ranked_daily enable row level security;
revoke all on public.ranked_points, public.ranked_daily from anon, authenticated;

create or replace function public.ranked_season() returns date
language sql stable set search_path = '' as $$ select date_trunc('month', now() at time zone 'utc')::date $$;

-- Returns the points change (0 when it didn't count), or null if not allowed.
create or replace function public.ranked_result(friend uuid, won boolean) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  ssn date := public.ranked_season();
  opp text := coalesce(friend::text, 'wild');
  cap integer := case when friend is null then 5 else 3 end;
  delta integer;
  n integer;
begin
  if me is null then return null; end if;
  if friend is not null and not public.are_friends(me, friend) then return null; end if;
  if friend is null and not won then return 0; end if;
  insert into public.ranked_daily (user_id, day, opponent) values (me, current_date, opp) on conflict do nothing;
  update public.ranked_daily set battles = battles + 1
   where user_id = me and day = current_date and opponent = opp and battles < cap
   returning battles into n;
  if n is null then return 0; end if;
  delta := case when friend is null then 5 when won then 20 else -8 end;
  insert into public.ranked_points (user_id, season) values (me, ssn) on conflict do nothing;
  update public.ranked_points
     set points = greatest(0, points + delta),
         wins = wins + (case when won then 1 else 0 end),
         losses = losses + (case when won then 0 else 1 end)
   where user_id = me and season = ssn;
  return delta;
end $$;

-- My season, last season's result, and a leaderboard of me and my friends.
create or replace function public.ranked_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  ssn date := public.ranked_season();
  prev date := (ssn - interval '1 month')::date;
begin
  if me is null then return null; end if;
  return jsonb_build_object(
    'season', ssn,
    'me', (select jsonb_build_object('points', points, 'wins', wins, 'losses', losses)
             from public.ranked_points where user_id = me and season = ssn),
    'last', (select jsonb_build_object('season', season, 'points', points, 'claimed', claimed)
               from public.ranked_points where user_id = me and season = prev),
    'board', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'username', coalesce(p.username, 'Trainer'), 'points', coalesce(r.points, 0),
               'me', p.id = me, 'card', p.card) order by coalesce(r.points, 0) desc, p.username), '[]'::jsonb)
        from public.profiles p
        left join public.ranked_points r on r.user_id = p.id and r.season = ssn
       where p.id = me or public.are_friends(me, p.id)
    )
  );
end $$;

-- Claim last season's reward once. Returns the final points, or -1 if nothing to claim.
create or replace function public.claim_season_reward() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  prev date := (public.ranked_season() - interval '1 month')::date;
  pts integer;
begin
  update public.ranked_points set claimed = true
   where user_id = me and season = prev and not claimed
   returning points into pts;
  return coalesce(pts, -1);
end $$;

revoke execute on function public.ranked_season() from public, anon, authenticated;
revoke execute on function public.ranked_result(uuid, boolean) from public, anon;
revoke execute on function public.ranked_status() from public, anon;
revoke execute on function public.claim_season_reward() from public, anon;
grant execute on function public.ranked_result(uuid, boolean) to authenticated;
grant execute on function public.ranked_status() to authenticated;
grant execute on function public.claim_season_reward() to authenticated;
