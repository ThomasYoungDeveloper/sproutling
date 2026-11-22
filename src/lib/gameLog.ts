import { supabase } from './supabase';

/**
 * Writes one line to the private activity log (trades, pets added or removed, duplicate cleanup).
 * Players can't read it; it's there so bugs like a duplicated pet can be traced. Never blocks the game.
 */
export function logEvent(kind: string, data: Record<string, unknown> = {}): void {
  supabase
    .rpc('log_game_event', { p_kind: kind, p_data: data })
    .then(
      () => {},
      () => {},
    );
}
