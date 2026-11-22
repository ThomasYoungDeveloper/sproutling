-- Guild boss is walking-only: battle hits are ignored (older app versions may still send them).
create or replace function public.raid_hit(amount integer)
returns text language plpgsql security definer set search_path = '' as $$
begin
  return 'off';
end $$;
