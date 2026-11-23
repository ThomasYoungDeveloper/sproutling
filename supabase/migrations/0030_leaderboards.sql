-- Leaderboards: weekly Apple Health steps by friends, guild, city and everyone, plus last week's titles.
-- Applied through the Supabase connector on 2026-11-23; see the live database for the exact text.
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists lb_hidden boolean not null default false;
create table if not exists public.step_weeks (user_id uuid not null references auth.users (id) on delete cascade, week date not null, steps integer not null default 0, updated_at timestamptz not null default now(), primary key (user_id, week));
create table if not exists public.rank_titles (user_id uuid not null references auth.users (id) on delete cascade, week date not null, scope text not null, place integer not null, label text not null, primary key (user_id, week, scope));
-- Functions: report_week_steps(date, int), leaderboard(text, date), set_lb_prefs(text, bool), lb_cities(text),
-- compute_rank_titles() (cron 'rank-titles', Mondays 12:05 UTC), current_titles().
