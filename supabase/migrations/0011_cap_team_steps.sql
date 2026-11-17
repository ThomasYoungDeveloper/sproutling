-- Guild steps: at most 60,000 per day of the guild week so far, so a stuck button can't flood the goal.
create or replace function public.report_team_steps(week_steps integer)
 returns text language plpgsql security definer set search_path to '' as $function$
declare
  me uuid := auth.uid();
  tid uuid := public.my_team();
  wk date := public.team_week();
  cap integer := 60000 * greatest(1, least(7, current_date - wk + 1));
begin
  if tid is null then return 'not_in_team'; end if;
  insert into public.team_week_steps (team_id, user_id, week, steps)
  values (tid, me, wk, least(greatest(week_steps, 0), cap))
  on conflict (team_id, user_id, week) do update
    set steps = least(greatest(public.team_week_steps.steps, excluded.steps), cap), updated_at = now();
  return 'ok';
end $function$;
