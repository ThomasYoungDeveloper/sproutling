import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useGame } from './GameContext';
import { readCard, type PublicCard } from '../game/card';
import * as A from '../game/actions';
import * as Team from '../game/team';

export interface TeamMember {
  id: string;
  username: string;
  role: 'leader' | 'member';
  steps: number;
  card: PublicCard | null;
  me: boolean;
  raid: number;
}

export interface TeamInfo {
  id: string;
  name: string;
  emoji: string;
  code: string;
  week: string;
  members: TeamMember[];
  claimed: ('goal' | 'super' | 'raid')[];
  raid: { hp: number; damage: number; hits_left: number };
  /** Open guilds show up in Find a guild; spot guilds belong to a place with a QR code. */
  open?: boolean;
  city?: string | null;
  spot?: string | null;
  total: number;
  goal: number;
}

interface Ctx {
  team: TeamInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
  create: (name: string, emoji: string) => Promise<{ ok: boolean; text: string }>;
  /** Guild leader only. */
  rename: (name: string) => Promise<{ ok: boolean; text: string }>;
  join: (code: string) => Promise<{ ok: boolean; text: string }>;
  leave: () => Promise<void>;
  claim: (tier: 'goal' | 'super') => Promise<{ ok: boolean; text: string }>;
  raidHit: (amount: number) => Promise<'ok' | 'limit' | 'none'>;
  claimRaid: () => Promise<{ ok: boolean; text: string }>;
}

const TeamCtx = createContext<Ctx | null>(null);

const MESSAGES: Record<string, string> = {
  already_in_team: 'You’re already in a guild. Leave it first to start or join another.',
  bad_name: 'Give your guild a name (at least 2 letters).',
  not_found: 'No guild with that code. Check the letters?',
  full: 'That guild is full (20 players).',
  not_yet: 'Your guild hasn’t reached that goal yet. Keep walking!',
  already: 'You already opened this week’s chest.',
  signed_out: 'Sign in first.',
  not_leader: 'Only the guild leader can rename the guild.',
};

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { state, apply, loaded } = useGame();
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const steps = Team.weekSteps(state);
  // Your own Monday: steps are filed under the week they were walked in, wherever you live.
  const week = Team.weekStart(A.todayKey(state));
  const lastReported = useRef('');

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc('team_status');
    setLoading(false);
    if (error) return;
    if (!data) {
      setTeam(null);
      return;
    }
    const raw = data as any;
    const members: TeamMember[] = (raw.members ?? []).map((m: any) => ({ ...m, card: readCard(m.card) }));
    const total = members.reduce((a, m) => a + (m.steps || 0), 0);
    setTeam({ ...raw, members, total, goal: Team.teamGoal(members.length), claimed: raw.claimed ?? [], raid: raw.raid ?? { hp: 5000, damage: 0, hits_left: 5 } });
  }, [user?.id]);

  // Send your weekly steps to the team when they change (and you're on a team).
  useEffect(() => {
    const key = `${week}:${steps}`;
    if (!loaded || !team || key === lastReported.current) return;
    const t = setTimeout(async () => {
      lastReported.current = key;
      await supabase.rpc('report_team_steps', { week_steps: steps, p_week: week });
      refresh();
    }, 2500);
    return () => clearTimeout(t);
  }, [steps, week, loaded, !!team]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const rename = useCallback(
    async (name: string) => {
      const { data, error } = await supabase.rpc('rename_team', { team_name: name });
      if (error) return { ok: false, text: 'Couldn’t reach Sproutling. Try again in a moment.' };
      if (data !== 'ok') return { ok: false, text: MESSAGES[data as string] ?? 'Something went wrong.' };
      await refresh();
      return { ok: true, text: 'Guild renamed!' };
    },
    [refresh],
  );

  const create = useCallback(
    async (name: string, emoji: string) => {
      const { data, error } = await supabase.rpc('create_team', { team_name: name, team_emoji: emoji });
      if (error) return { ok: false, text: 'Couldn’t reach Sproutling. Try again in a moment.' };
      if (data !== 'ok') return { ok: false, text: MESSAGES[data as string] ?? 'Something went wrong.' };
      lastReported.current = '';
      await refresh();
      return { ok: true, text: 'Guild created! Share the code with friends.' };
    },
    [refresh],
  );

  const join = useCallback(
    async (code: string) => {
      const { data, error } = await supabase.rpc('join_team', { team_code: code });
      if (error) return { ok: false, text: 'Couldn’t reach Sproutling. Try again in a moment.' };
      if (data !== 'ok') return { ok: false, text: MESSAGES[data as string] ?? 'Something went wrong.' };
      lastReported.current = '';
      await refresh();
      return { ok: true, text: 'Welcome to the guild!' };
    },
    [refresh],
  );

  const leave = useCallback(async () => {
    await supabase.rpc('leave_team');
    setTeam(null);
    await refresh();
  }, [refresh]);

  const claim = useCallback(
    async (tier: 'goal' | 'super') => {
      const { data, error } = await supabase.rpc('claim_team_chest', { tier });
      if (error) return { ok: false, text: 'Couldn’t reach Sproutling. Try again in a moment.' };
      if (data !== 'ok') return { ok: false, text: MESSAGES[data as string] ?? 'Something went wrong.' };
      apply((s) => A.grantChest(s, tier === 'super' ? 'gold' : 'silver', tier === 'super' ? 'Guild super goal' : 'Guild weekly goal'));
      await refresh();
      return { ok: true, text: tier === 'super' ? 'Gold chest added! Open it on the Chests tab.' : 'Silver chest added! Open it on the Chests tab.' };
    },
    [refresh, apply],
  );

  const raidHit = useCallback(
    async (amount: number) => {
      if (!team || amount <= 0 || team.raid.damage >= team.raid.hp) return 'none' as const;
      const { data, error } = await supabase.rpc('raid_hit', { amount: Math.round(amount) });
      if (error || (data !== 'ok' && data !== 'limit')) return 'none' as const;
      refresh();
      return data as 'ok' | 'limit';
    },
    [team?.id, refresh],
  );

  const claimRaid = useCallback(async () => {
    const { data, error } = await supabase.rpc('claim_raid_chest');
    if (error) return { ok: false, text: 'Couldn’t reach Sproutling. Try again in a moment.' };
    if (data !== 'ok') return { ok: false, text: data === 'already' ? 'You already opened this week’s raid chest.' : MESSAGES[data as string] ?? 'Something went wrong.' };
    apply((s) => { const n = A.grantChest(s, 'gold', 'Guild boss raid'); return { ...n, coins: n.coins + 150 }; });
    await refresh();
    return { ok: true, text: 'Boss defeated! A Gold chest and 150 coins are yours.' };
  }, [refresh, apply]);

  return <TeamCtx.Provider value={{ team, loading, refresh, create, rename, join, leave, claim, raidHit, claimRaid }}>{children}</TeamCtx.Provider>;
}

export function useTeam(): Ctx {
  const c = useContext(TeamCtx);
  if (!c) throw new Error('useTeam must be used inside <TeamProvider>');
  return c;
}
