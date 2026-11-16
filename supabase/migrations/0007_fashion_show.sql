-- Weekly Pet Fashion Show: enter your dressed-up pet, friends vote (3 hearts each per week),
-- and after the week ends you claim a prize based on your place among you and your friends.

create table public.contest_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week date not null,
  pet jsonb not null check (octet_length(pet::text) < 800),
  votes integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, week)
);
create index contest_entries_week_idx on public.contest_entries (week);

create table public.contest_votes (
  voter uuid not null references public.profiles(id) on delete cascade,
  entry_id uuid not null references public.contest_entries(id) on delete cascade,
  week date not null,
  created_at timestamptz not null default now(),
  primary key (voter, entry_id)
);
create index contest_votes_voter_week_idx on public.contest_votes (voter, week);

create table public.contest_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  week date not null,
  place integer not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, week)
);

alter table public.contest_entries enable row level security;
alter table public.contest_votes enable row level security;
alter table public.contest_claims enable row level security;
revoke all on public.contest_entries, public.contest_votes, public.contest_claims from anon, authenticated;

-- An entry: {speciesId, nickname, xp, shiny, hat?, aura?, scene?}.
create or replace function public.valid_contest_pet(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
     and coalesce(p->>'speciesId', '') ~ '^p[0-9]{2}$'
     and jsonb_typeof(p->'nickname') = 'string' and length(p->>'nickname') between 1 and 24
     and jsonb_typeof(p->'xp') = 'number'
     and coalesce(p->>'hat', 'x') ~ '^[a-z0-9]{1,16}$'
     and coalesce(p->>'aura', 'x') ~ '^[a-z0-9]{1,16}$'
     and coalesce(p->>'scene', 'x') ~ '^[a-z0-9]{1,16}$';
$$;

-- You and your accepted friends.
create or replace function public.my_circle() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select auth.uid()
  union
  select case when requester = auth.uid() then addressee else requester end
    from public.friendships where status = 'accepted' and auth.uid() in (requester, addressee);
$$;

-- Enter (or change your outfit until someone votes). Returns 'entered' the first time.
create or replace function public.enter_contest(pet jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  wk date := public.team_week();
  existing public.contest_entries;
begin
  if me is null then return 'signed_out'; end if;
  if not public.valid_contest_pet(pet) then return 'bad_pet'; end if;
  select * into existing from public.contest_entries where user_id = me and week = wk;
  if found then
    if existing.votes > 0 then return 'locked'; end if;
    update public.contest_entries set pet = enter_contest.pet where id = existing.id;
    return 'updated';
  end if;
  insert into public.contest_entries (user_id, week, pet) values (me, wk, pet);
  return 'entered';
end $$;

create or replace function public.vote_contest(entry uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  wk date := public.team_week();
  owner uuid;
begin
  select user_id into owner from public.contest_entries where id = entry and week = wk;
  if owner is null then return 'not_found'; end if;
  if owner = me then return 'own'; end if;
  if not public.are_friends(me, owner) then return 'not_friends'; end if;
  if exists (select 1 from public.contest_votes where voter = me and entry_id = entry) then return 'already'; end if;
  if (select count(*) from public.contest_votes where voter = me and week = wk) >= 3 then return 'no_votes'; end if;
  insert into public.contest_votes (voter, entry_id, week) values (me, entry, wk);
  update public.contest_entries set votes = votes + 1 where id = entry;
  return 'ok';
end $$;

-- Your place last week among you and your friends (1 = most hearts; ties share a place).
create or replace function public.contest_place(wk date) returns integer
language sql stable security definer set search_path = '' as $$
  with circle as (select * from public.my_circle()),
  mine as (select votes from public.contest_entries where user_id = auth.uid() and week = wk)
  select case when not exists (select 1 from mine) then null
    else 1 + (select count(*) from public.contest_entries e
               where e.week = wk and e.user_id in (select * from circle) and e.votes > (select votes from mine))::integer
  end;
$$;

create or replace function public.contest_board() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  wk date := public.team_week();
  last date := public.team_week() - 7;
begin
  return jsonb_build_object(
    'week', wk,
    'entries', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'username', coalesce(p.username, 'Trainer'), 'pet', e.pet, 'votes', e.votes,
        'mine', e.user_id = me,
        'voted', exists (select 1 from public.contest_votes v where v.voter = me and v.entry_id = e.id)
      ) order by e.votes desc, e.created_at), '[]'::jsonb)
      from public.contest_entries e join public.profiles p on p.id = e.user_id
      where e.week = wk and e.user_id in (select * from public.my_circle())
    ),
    'votesLeft', 3 - (select count(*) from public.contest_votes where voter = me and week = wk),
    'last', (
      select jsonb_build_object('week', last, 'place', public.contest_place(last), 'votes', e.votes,
        'claimed', exists (select 1 from public.contest_claims c where c.user_id = me and c.week = last))
      from public.contest_entries e where e.user_id = me and e.week = last
    )
  );
end $$;

-- Claims last week's prize once. Returns the place (1, 2, 3 or more).
create or replace function public.claim_contest_prize() returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  last date := public.team_week() - 7;
  place integer := public.contest_place(last);
begin
  if place is null then return 'no_entry'; end if;
  insert into public.contest_claims (user_id, week, place) values (me, last, place) on conflict do nothing;
  if not found then return 'already'; end if;
  return place::text;
end $$;

revoke execute on function public.valid_contest_pet(jsonb) from public, anon, authenticated;
revoke execute on function public.my_circle() from public, anon, authenticated;
revoke execute on function public.contest_place(date) from public, anon, authenticated;
revoke execute on function public.enter_contest(jsonb) from public, anon;
revoke execute on function public.vote_contest(uuid) from public, anon;
revoke execute on function public.contest_board() from public, anon;
revoke execute on function public.claim_contest_prize() from public, anon;
grant execute on function public.enter_contest(jsonb) to authenticated;
grant execute on function public.vote_contest(uuid) to authenticated;
grant execute on function public.contest_board() to authenticated;
grant execute on function public.claim_contest_prize() to authenticated;
