-- Weekly Sky Tower: how high each player climbed, so guild members can see each other on the tower.
create table if not exists public.tower_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week date not null,
  floor int not null default 0 check (floor between 0 and 10),
  updated_at timestamptz not null default now(),
  primary key (user_id, week)
);
alter table public.tower_progress enable row level security;

-- Save the highest floor you've cleared this week (it can only go up).
create or replace function public.tower_report(p_week date, p_floor int) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then return 'not_signed_in'; end if;
  if p_floor < 0 or p_floor > 10 then return 'bad_floor'; end if;
  if p_week < current_date - 8 or p_week > current_date + 1 then return 'bad_week'; end if;
  insert into public.tower_progress (user_id, week, floor) values (me, p_week, p_floor)
  on conflict (user_id, week) do update set floor = greatest(public.tower_progress.floor, excluded.floor), updated_at = now();
  return 'ok';
end $$;

-- Your guild mates' floors this week (not including you).
create or replace function public.tower_guild(p_week date) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(p.username, 'A friend'), 'floor', coalesce(tp.floor, 0)) order by coalesce(tp.floor, 0) desc), '[]'::jsonb)
    from public.team_members me
    join public.team_members m on m.team_id = me.team_id and m.user_id <> me.user_id
    join public.profiles p on p.id = m.user_id
    left join public.tower_progress tp on tp.user_id = m.user_id and tp.week = p_week
   where me.user_id = auth.uid();
$$;

revoke all on function public.tower_report(date, int) from public, anon;
revoke all on function public.tower_guild(date) from public, anon;
grant execute on function public.tower_report(date, int) to authenticated;
grant execute on function public.tower_guild(date) to authenticated;
