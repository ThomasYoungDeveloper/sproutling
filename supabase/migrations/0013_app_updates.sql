-- Update prompts: the lowest build allowed to keep playing, and release notes shown as "What's new".
-- To force everyone onto build N: update app_config set min_build = N;
create table if not exists public.app_config (
  id int primary key default 1 check (id = 1),
  min_build int not null default 0,
  update_url text not null default 'itms-beta://',
  updated_at timestamptz not null default now()
);
insert into public.app_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.release_notes (
  build int primary key,
  title text not null,
  notes text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
alter table public.release_notes enable row level security;
create policy "anyone can read app config" on public.app_config for select using (true);
create policy "anyone can read release notes" on public.release_notes for select using (true);
