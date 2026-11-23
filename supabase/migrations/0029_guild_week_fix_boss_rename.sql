-- Phones say which week (their own Monday) the steps belong to, so a US Sunday evening
-- (already Monday in UTC) can't put last week's steps into the new week.
drop function if exists public.report_team_steps(integer);
create or replace function public.report_team_steps(week_steps integer, p_week date default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  tid uuid := public.my_team();
  server_wk date := public.team_week();
  wk date := coalesce(p_week, server_wk);
  cap integer;
begin
  if tid is null then return 'not_in_team'; end if;
  if extract(isodow from wk) <> 1 or wk < server_wk - 7 or wk > server_wk + 7 then return 'bad_week'; end if;
  cap := 60000 * greatest(1, least(7, current_date - wk + 2));
  insert into public.team_week_steps (team_id, user_id, week, steps)
  values (tid, me, wk, least(greatest(week_steps, 0), cap))
  on conflict (team_id, user_id, week) do update
    set steps = least(greatest(public.team_week_steps.steps, excluded.steps), cap), updated_at = now();
  return 'ok';
end $$;
revoke all on function public.report_team_steps(integer, date) from public, anon;
grant execute on function public.report_team_steps(integer, date) to authenticated;

-- Tougher boss: about 40,000 steps per member a week (roughly 5,700 a day), at least 80,000 steps.
create or replace function public.raid_hp(members integer)
returns integer language sql immutable set search_path = '' as $$ select greatest(8000, members * 4000) $$;

-- The guild leader can rename the guild.
create or replace function public.rename_team(team_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  tid uuid := public.my_team();
  clean text := left(regexp_replace(trim(coalesce(team_name, '')), '\s+', ' ', 'g'), 24);
begin
  if me is null then return 'signed_out'; end if;
  if tid is null then return 'not_in_team'; end if;
  if not exists (select 1 from public.team_members where team_id = tid and user_id = me and role = 'leader') then return 'not_leader'; end if;
  if length(clean) < 2 then return 'bad_name'; end if;
  update public.teams set name = clean where id = tid;
  return 'ok';
end $$;
revoke all on function public.rename_team(text) from public, anon;
grant execute on function public.rename_team(text) to authenticated;
