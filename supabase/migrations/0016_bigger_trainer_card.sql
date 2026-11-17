-- Trainer cards now list all of a player's pets (up to 30), not just the top 6.
alter table public.profiles drop constraint if exists profiles_card_size;
alter table public.profiles add constraint profiles_card_size check (octet_length(card::text) < 24000);
