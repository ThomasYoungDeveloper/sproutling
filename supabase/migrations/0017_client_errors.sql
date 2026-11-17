-- Crash reports from the app: just the error text and the app build, no personal data.
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  build text,
  platform text,
  message text,
  stack text
);
alter table public.client_errors enable row level security;

create or replace function public.log_client_error(p_build text, p_platform text, p_message text, p_stack text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.client_errors where created_at > now() - interval '1 minute') > 60 then return; end if;
  insert into public.client_errors (build, platform, message, stack)
  values (left(p_build, 20), left(p_platform, 20), left(p_message, 1000), left(p_stack, 4000));
end $$;
revoke all on function public.log_client_error(text, text, text, text) from public;
grant execute on function public.log_client_error(text, text, text, text) to anon, authenticated;
