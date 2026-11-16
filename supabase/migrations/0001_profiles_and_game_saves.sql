-- Applied to project ehqairqnilwycniuhdju on 2026-11-16 (via Supabase MCP).
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);
create table public.game_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.game_saves enable row level security;
create policy "profiles readable by signed-in users" on public.profiles for select to authenticated using (true);
create policy "insert own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "read own save" on public.game_saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own save" on public.game_saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own save" on public.game_saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create trigger game_saves_touch before update on public.game_saves for each row execute function public.touch_updated_at();
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles (id) values (new.id) on conflict do nothing; return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
-- grant_api_access
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.game_saves to authenticated;
revoke all on public.profiles from anon;
revoke all on public.game_saves from anon;
-- lock_down_trigger_functions
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
