-- Activity log: delete lines older than 60 days, every day at 08:17 UTC.
create extension if not exists pg_cron;
select cron.schedule('game-events-cleanup', '17 8 * * *', $$delete from public.game_events where created_at < now() - interval '60 days'$$);
