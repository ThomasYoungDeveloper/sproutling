import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useFriends } from './FriendsContext';
import * as B from '../game/battle';

export type LiveStatus = 'invited' | 'active' | 'done' | 'declined' | 'cancelled';

interface Row {
  id: string;
  challenger: string;
  opponent: string;
  status: LiveStatus;
  seed: string;
  challenger_team: B.LiveTeam;
  opponent_team: B.LiveTeam | null;
  turn: number;
  challenger_action: B.Action | null;
  opponent_action: B.Action | null;
  history: B.LiveTurn[];
  challenger_react: { e: string; at: string } | null;
  opponent_react: { e: string; at: string } | null;
  winner: string | null;
  deadline: string;
  updated_at: string;
}

/** A live battle seen from your side. */
export interface LiveBattle {
  id: string;
  status: LiveStatus;
  iChallenged: boolean;
  friendId: string;
  friendName: string;
  turn: number;
  /** You already picked your action this turn. */
  iMoved: boolean;
  theyMoved: boolean;
  /** You need to do something: accept, or pick a move. */
  myTurn: boolean;
  won: boolean | null;
  deadline: string;
  theirReact: { e: string; at: string } | null;
  updatedAt: string;
  /** The battle from your side (null until accepted). */
  battle: B.Battle | null;
  /** The frames of the latest turn, from your side, to animate. */
  last: B.Frame[];
  myTeam: B.LiveTeam | null;
}

interface Ctx {
  battles: LiveBattle[];
  /** Battles waiting on you. */
  waiting: number;
  get: (id: string) => LiveBattle | undefined;
  challenge: (friendId: string, team: B.LiveTeam) => Promise<{ ok: boolean; id?: string; text: string }>;
  respond: (id: string, accept: boolean, team?: B.LiveTeam) => Promise<{ ok: boolean; text: string }>;
  move: (id: string, turn: number, action: B.Action) => Promise<{ ok: boolean; text: string }>;
  finish: (id: string, challengerWon: boolean) => Promise<void>;
  claimTimeout: (id: string) => Promise<string>;
  forfeit: (id: string) => Promise<void>;
  react: (id: string, emoji: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const LiveCtx = createContext<Ctx | null>(null);

const ERRORS: Record<string, string> = {
  not_friends: 'You can only battle friends.',
  already: 'You already have a battle going with this friend.',
  bad_team: 'Pick 1 to 3 pets.',
  not_found: 'That battle is gone.',
  not_invited: 'That challenge was already answered.',
  not_active: 'That battle is over.',
  wrong_turn: 'That turn already happened. Refreshing…',
  bad_action: 'That move didn’t work. Try again.',
};
const say = (code: string) => ERRORS[code] ?? 'Something went wrong. Try again.';

export function viewOf(r: Row, me: string, name: string): LiveBattle {
  const iChallenged = r.challenger === me;
  let battle: B.Battle | null = null;
  let last: B.Frame[] = [];
  if (r.opponent_team) {
    const rep = B.liveReplay(r.challenger_team, r.opponent_team, r.seed, r.history ?? []);
    battle = iChallenged ? rep.battle : B.flipBattle(rep.battle);
    last = iChallenged ? rep.last : B.flipFrames(rep.last);
  }
  const iMoved = !!(iChallenged ? r.challenger_action : r.opponent_action);
  const theyMoved = !!(iChallenged ? r.opponent_action : r.challenger_action);
  const won = r.status === 'done' && r.winner ? r.winner === me : battle?.over ? battle.over === 'win' : null;
  return {
    id: r.id,
    status: r.status,
    iChallenged,
    friendId: iChallenged ? r.opponent : r.challenger,
    friendName: name,
    turn: r.turn,
    iMoved,
    theyMoved,
    myTurn: (r.status === 'invited' && !iChallenged) || (r.status === 'active' && !iMoved && !battle?.over),
    won,
    deadline: r.deadline,
    theirReact: iChallenged ? r.opponent_react : r.challenger_react,
    updatedAt: r.updated_at,
    battle,
    last,
    myTeam: iChallenged ? r.challenger_team : r.opponent_team,
  };
}

export function LiveBattleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { friends } = useFriends();
  const [rows, setRows] = useState<Row[]>([]);
  const me = user?.id ?? '';

  const refresh = useCallback(async () => {
    if (!me) return;
    const since = new Date(Date.now() - 3 * 86400000).toISOString();
    const { data } = await supabase
      .from('live_battles')
      .select('*')
      .or(`status.in.(invited,active),updated_at.gt.${since}`)
      .order('updated_at', { ascending: false })
      .limit(30);
    if (data) setRows(data as Row[]);
  }, [me]);

  const upsert = (r: Row) =>
    setRows((list) => {
      const rest = list.filter((x) => x.id !== r.id);
      return [r, ...rest].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    });

  useEffect(() => {
    if (!me) return;
    refresh();
    // Row-level security means we only hear about our own battles.
    const ch = supabase
      .channel(`live-battles-${me}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_battles' }, (p: any) => {
        const r = p.new as Row;
        if (r?.id && (r.challenger === me || r.opponent === me)) upsert(r);
      })
      .subscribe();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    const t = setInterval(refresh, 60000);
    return () => {
      supabase.removeChannel(ch);
      sub.remove();
      clearInterval(t);
    };
  }, [me, refresh]);

  const nameOf = useCallback((id: string) => friends.find((f) => f.id === id)?.username ?? 'A friend', [friends]);
  const battles = useMemo(() => rows.map((r) => viewOf(r, me, nameOf(r.challenger === me ? r.opponent : r.challenger))), [rows, me, nameOf]);
  const byId = useRef(new Map<string, LiveBattle>());
  byId.current = new Map(battles.map((b) => [b.id, b]));

  const reload = async (id: string) => {
    const { data } = await supabase.from('live_battles').select('*').eq('id', id).maybeSingle();
    if (data) upsert(data as Row);
  };

  const challenge: Ctx['challenge'] = async (friendId, team) => {
    const { data, error } = await supabase.rpc('live_challenge', { friend: friendId, team });
    if (error) return { ok: false, text: say('') };
    const res = String(data);
    if (!/^[0-9a-f-]{36}$/.test(res)) return { ok: false, text: say(res) };
    await reload(res);
    return { ok: true, id: res, text: 'Challenge sent!' };
  };

  const respond: Ctx['respond'] = async (id, accept, team) => {
    const { data, error } = await supabase.rpc('live_respond', { battle: id, accept, team: team ?? null });
    await reload(id);
    if (error) return { ok: false, text: say('') };
    return data === 'ok' || data === 'declined' ? { ok: true, text: accept ? 'Battle on!' : 'Declined' } : { ok: false, text: say(String(data)) };
  };

  const move: Ctx['move'] = async (id, turn, action) => {
    const { data, error } = await supabase.rpc('live_move', { battle: id, at_turn: turn, action });
    await reload(id);
    if (error) return { ok: false, text: say('') };
    return data === 'resolved' || data === 'waiting' ? { ok: true, text: String(data) } : { ok: false, text: say(String(data)) };
  };

  const finish: Ctx['finish'] = async (id, challengerWon) => {
    await supabase.rpc('live_finish', { battle: id, challenger_won: challengerWon });
    await reload(id);
  };

  const claimTimeout: Ctx['claimTimeout'] = async (id) => {
    const { data } = await supabase.rpc('live_claim_timeout', { battle: id });
    await reload(id);
    return String(data);
  };

  const forfeit: Ctx['forfeit'] = async (id) => {
    await supabase.rpc('live_forfeit', { battle: id });
    await reload(id);
  };

  const react: Ctx['react'] = async (id, emoji) => {
    await supabase.rpc('live_react', { battle: id, emoji });
  };

  const waiting = battles.filter((b) => b.myTurn).length;
  return (
    <LiveCtx.Provider value={{ battles, waiting, get: (id) => byId.current.get(id), challenge, respond, move, finish, claimTimeout, forfeit, react, refresh }}>
      {children}
    </LiveCtx.Provider>
  );
}

export function useLive() {
  const c = useContext(LiveCtx);
  if (!c) throw new Error('useLive outside LiveBattleProvider');
  return c;
}
