-- Fewer battle notifications.
-- 1. Each battle's "Your turn" notification replaces the last one (collapseId), so the lock screen shows one per battle.
-- 2. No notification while the other player has the battle open: their app checks in every 20 seconds.

create or replace function public.push_to_user(p_user uuid, p_title text, p_body text, p_tab text default 'friends', p_collapse text default null)
returns void
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare
  msgs jsonb;
begin
  select jsonb_agg(
           jsonb_build_object('to', token, 'title', p_title, 'body', p_body, 'sound', 'default', 'data', jsonb_build_object('tab', p_tab))
           || case when p_collapse is null then '{}'::jsonb
                   else jsonb_build_object('collapseId', p_collapse, 'threadId', p_collapse, 'tag', p_collapse) end)
    into msgs from push_tokens where user_id = p_user;
  if msgs is null then return; end if;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := msgs,
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
  );
exception when others then
  raise warning 'push_to_user failed: %', sqlerrm;
end $$;
-- The old 4-argument version is replaced by the one above (its 5th argument is optional).
drop function if exists public.push_to_user(uuid, text, text, text);
revoke all on function public.push_to_user(uuid, text, text, text, text) from public, anon, authenticated;

alter table public.live_battles add column if not exists challenger_seen_at timestamptz;
alter table public.live_battles add column if not exists opponent_seen_at timestamptz;

-- The battle screen calls this while it's open (here = true) and when it closes or the app goes to the background (here = false).
create or replace function public.live_seen(battle uuid, here boolean default true) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  update public.live_battles
     set challenger_seen_at = case when challenger = me then (case when here then now() else null end) else challenger_seen_at end,
         opponent_seen_at = case when opponent = me then (case when here then now() else null end) else opponent_seen_at end
   where id = battle and me in (challenger, opponent);
  return case when found then 'ok' else 'not_found' end;
end $$;
revoke execute on function public.live_seen(uuid, boolean) from public, anon;
grant execute on function public.live_seen(uuid, boolean) to authenticated;

create or replace function public.live_move(battle uuid, at_turn integer, action jsonb)
returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); b public.live_battles; is_c boolean; other uuid; other_here boolean;
begin
  select * into b from public.live_battles where id = battle for update;
  if b.id is null or me not in (b.challenger, b.opponent) then return 'not_found'; end if;
  if b.status <> 'active' then return 'not_active'; end if;
  if b.turn <> at_turn then return 'wrong_turn'; end if;
  if jsonb_typeof(action) <> 'object' or action ->> 'type' not in ('move', 'switch') or octet_length(action::text) > 200 then return 'bad_action'; end if;
  is_c := me = b.challenger;
  other := case when is_c then b.opponent else b.challenger end;
  -- Is the other player looking at this battle right now? Then they'll see the move without a notification.
  other_here := coalesce(case when is_c then b.opponent_seen_at else b.challenger_seen_at end > now() - interval '45 seconds', false);
  if (is_c and b.challenger_action is not null) or (not is_c and b.opponent_action is not null) then return 'already'; end if;
  if is_c then b.challenger_action := action; else b.opponent_action := action; end if;

  if b.challenger_action is not null and b.opponent_action is not null then
    update public.live_battles
       set history = b.history || jsonb_build_array(jsonb_build_object('c', b.challenger_action, 'o', b.opponent_action)),
           turn = b.turn + 1, challenger_action = null, opponent_action = null,
           deadline = now() + interval '24 hours', updated_at = now()
     where id = battle;
    if not other_here then
      perform public.push_to_user(other, 'Your turn! ⚔️', public.push_name(me) || ' made a move. What''s yours?', 'friends', 'live-' || battle::text);
    end if;
    return 'resolved';
  end if;
  update public.live_battles
     set challenger_action = b.challenger_action, opponent_action = b.opponent_action, updated_at = now()
   where id = battle;
  if not other_here then
    perform public.push_to_user(other, 'Your turn! ⚔️', public.push_name(me) || ' picked a move. Your move!', 'friends', 'live-' || battle::text);
  end if;
  return 'waiting';
end $$;
