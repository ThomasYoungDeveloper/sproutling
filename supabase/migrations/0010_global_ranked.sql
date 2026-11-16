-- Ranked leaderboard for everyone: top 50 players this season plus your own rank.
-- The friends leaderboard stays as 'board'.
create index if not exists ranked_points_season_points on public.ranked_points (season, points desc);

create or replace function public.ranked_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  ssn date := public.ranked_season();
  prev date := (ssn - interval '1 month')::date;
  mine integer;
begin
  if me is null then return null; end if;
  select points into mine from public.ranked_points where user_id = me and season = ssn;
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
    ),
    'global', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'username', coalesce(x.username, 'Trainer'), 'points', x.points, 'me', x.id = me, 'card', x.card) order by x.points desc, x.username), '[]'::jsonb)
        from (
          select p.id, p.username, p.card, r.points
            from public.ranked_points r join public.profiles p on p.id = r.user_id
           where r.season = ssn and r.points > 0
           order by r.points desc, p.username
           limit 50
        ) x
    ),
    'rank', case when coalesce(mine, 0) > 0
      then (select count(*) + 1 from public.ranked_points where season = ssn and points > mine)
      else null end,
    'players', (select count(*) from public.ranked_points where season = ssn and points > 0)
  );
end $$;

revoke execute on function public.ranked_status() from public, anon;
grant execute on function public.ranked_status() to authenticated;
