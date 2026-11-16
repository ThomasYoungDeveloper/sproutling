import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useGame } from './GameContext';
import { readCard, type PublicCard } from '../game/card';
import * as R from '../game/ranked';

export interface RankedRow {
  username: string;
  points: number;
  me: boolean;
  card: PublicCard | null;
}

export interface RankedInfo {
  season: string;
  points: number;
  wins: number;
  losses: number;
  last: { season: string; points: number; claimed: boolean } | null;
  board: RankedRow[];
  global: RankedRow[];
  rank: number | null;
  players: number;
}

interface Ctx {
  ranked: RankedInfo | null;
  refresh: () => Promise<void>;
  /** Records a ranked result; returns the points change (0 when it didn't count). */
  report: (friendId: string | null, won: boolean) => Promise<number | null>;
  claimSeason: () => Promise<{ ok: boolean; text: string }>;
}

const RankedCtx = createContext<Ctx | null>(null);

export function RankedProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { apply } = useGame();
  const [ranked, setRanked] = useState<RankedInfo | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc('ranked_status');
    if (error || !data) return;
    const raw = data as any;
    setRanked({
      season: raw.season,
      points: raw.me?.points ?? 0,
      wins: raw.me?.wins ?? 0,
      losses: raw.me?.losses ?? 0,
      last: raw.last ?? null,
      board: (raw.board ?? []).map((r: any) => ({ ...r, card: readCard(r.card) })),
      global: (raw.global ?? []).map((r: any) => ({ ...r, card: readCard(r.card) })),
      rank: raw.rank ?? null,
      players: raw.players ?? 0,
    });
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const report = useCallback(
    async (friendId: string | null, won: boolean) => {
      if (!user) return null;
      const { data, error } = await supabase.rpc('ranked_result', { friend: friendId, won });
      if (error) return null;
      refresh();
      return typeof data === 'number' ? data : null;
    },
    [user?.id, refresh],
  );

  const claimSeason = useCallback(async () => {
    const { data, error } = await supabase.rpc('claim_season_reward');
    if (error) return { ok: false, text: 'Couldn’t reach Sproutling. Try again in a moment.' };
    const pts = data as number;
    if (pts < 0) return { ok: false, text: 'Nothing to claim yet.' };
    let tier: R.Tier = R.tierFor(pts);
    apply((s) => {
      const r = R.seasonReward(s, pts);
      tier = r.tier;
      return r.state;
    });
    await refresh();
    return { ok: true, text: `${tier.emoji} ${tier.name} reward: ${tier.coins} coins${tier.chest ? ` and a ${tier.chest[0].toUpperCase() + tier.chest.slice(1)} chest` : ''}${tier.id === 'legend' ? ' plus the Champion Laurel!' : '!'}` };
  }, [apply, refresh]);

  return <RankedCtx.Provider value={{ ranked, refresh, report, claimSeason }}>{children}</RankedCtx.Provider>;
}

export function useRanked(): Ctx {
  const c = useContext(RankedCtx);
  if (!c) throw new Error('useRanked must be used inside <RankedProvider>');
  return c;
}
