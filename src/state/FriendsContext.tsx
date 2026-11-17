import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useGame } from './GameContext';
import { readCard, type PublicCard } from '../game/card';
import * as A from '../game/actions';
import * as T from '../game/trade';
import { useReveal } from '../components/RevealOverlay';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { play } from '../lib/sound';
import { buzz } from '../components/fx';

export interface Trainer {
  id: string;
  username: string;
  card: PublicCard | null;
  cardUpdatedAt: string | null;
}

export interface Friend extends Trainer {
  friendshipId: string;
  giftedToday: boolean;
}

export interface FriendRequest {
  id: string;
  from: Trainer;
}

export interface SentRequest {
  id: string;
  to: Trainer;
}

export type TradeStatus = 'offered' | 'countered' | 'completed' | 'declined' | 'cancelled';

export interface Trade {
  id: string;
  fromMe: boolean;
  friendId: string;
  friendName: string;
  status: TradeStatus;
  offer: T.TradePet;
  counter: T.TradePet | null;
  updatedAt: string;
}

export interface Notice {
  id: number;
  text: string;
}

interface Ctx {
  myCode: string | null;
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: SentRequest[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addFriend: (target: string) => Promise<{ ok: boolean; text: string }>;
  respond: (requestId: string, accept: boolean) => Promise<void>;
  remove: (friendshipId: string) => Promise<void>;
  gift: (friendId: string) => Promise<string>;
  giftsLeft: number;
  notice: Notice | null;
  dismissNotice: () => void;
  trades: Trade[];
  /** Your pets that are in an open trade. */
  busyPetIds: Set<string>;
  /** Trades waiting on you (an offer to answer, or a counter-offer to confirm). */
  tradesForMe: number;
  offerTrade: (friendId: string, petId: string) => Promise<{ ok: boolean; text: string }>;
  counterTrade: (tradeId: string, petId: string) => Promise<{ ok: boolean; text: string }>;
  confirmTrade: (tradeId: string) => Promise<{ ok: boolean; text: string }>;
  cancelTrade: (tradeId: string) => Promise<void>;
  recordBattle: (friendId: string, won: boolean) => void;
}

const FriendsCtx = createContext<Ctx | null>(null);

const utcDay = () => new Date().toISOString().slice(0, 10);

const ADD_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  sent: { ok: true, text: 'Request sent! You’ll be friends once they accept.' },
  accepted: { ok: true, text: 'They’d already asked you, so you’re friends now!' },
  already_friends: { ok: false, text: 'You’re already friends.' },
  already_sent: { ok: false, text: 'You already sent them a request.' },
  not_found: { ok: false, text: 'No trainer with that code or name. Check the spelling?' },
  self: { ok: false, text: 'That’s you! Share your code with a friend instead.' },
  full: { ok: false, text: 'Your friends list is full.' },
  signed_out: { ok: false, text: 'Sign in first.' },
};

/** Lives inside GameProvider so opened gifts can pay coins straight into the save. */
export function FriendsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { state, apply, loaded, sync } = useGame();
  const reveal = useReveal();
  const [trades, setTrades] = useState<Trade[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [myCode, setMyCode] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<SentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [giftsLeft, setGiftsLeft] = useState(A.GIFTS_PER_DAY);
  const claiming = useRef(false);

  const say = useCallback((text: string) => setNotice({ id: Date.now(), text }), []);

  /**
   * Tells you when someone accepts a request you sent, or sends you a new one.
   * Remembers what it has already told you (per account), so it also catches what happened while you were away.
   */
  const announce = useCallback(async (me: string, sent: { id: string; accepted: boolean; name: string }[], incomingNow: { id: string; name: string }[]) => {
    const key = `sproutling/friendseen/${me}`;
    let seen: { pending: string[]; incoming: string[] } | null = null;
    try {
      const raw = await AsyncStorage.getItem(key);
      seen = raw ? JSON.parse(raw) : null;
    } catch {}
    const next = { pending: sent.filter((r) => !r.accepted).map((r) => r.id), incoming: incomingNow.map((r) => r.id) };
    AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
    if (!seen) return; // First time on this device: just remember, don't replay old news.
    const accepted = sent.filter((r) => r.accepted && seen!.pending.includes(r.id)).map((r) => r.name);
    const fresh = incomingNow.filter((r) => !seen!.incoming.includes(r.id)).map((r) => r.name);
    const list = (n: string[]) => (n.length === 1 ? n[0] : n.length === 2 ? `${n[0]} and ${n[1]}` : `${n[0]} and ${n.length - 1} others`);
    if (accepted.length) {
      say(`🎉 ${list(accepted)} accepted your friend request! You can battle, trade and send gifts now.`);
      play('chime');
      buzz('success', 'none');
    } else if (fresh.length) {
      say(`👋 ${list(fresh)} sent you a friend request. Check the Social tab!`);
      play('pop');
    }
  }, [say]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const me = user.id;
    const [mine, links, sent, tradeRows] = await Promise.all([
      supabase.from('profiles').select('friend_code').eq('id', me).maybeSingle(),
      supabase.from('friendships').select('id, requester, addressee, status, created_at').order('created_at', { ascending: false }),
      supabase.from('gifts').select('recipient').eq('sender', me).eq('day', utcDay()),
      supabase.from('trades').select('id, from_user, to_user, status, offer_pet, counter_pet, updated_at').order('updated_at', { ascending: false }).limit(60),
    ]);
    if (links.error) {
      setError('Couldn’t load your friends. Try again in a moment.');
      setLoading(false);
      return;
    }
    setError(null);
    if (mine.data?.friend_code) setMyCode(mine.data.friend_code);
    const rows = links.data ?? [];
    const tRows = tradeRows.data ?? [];
    const otherIds = [...new Set([...rows.map((r) => (r.requester === me ? r.addressee : r.requester)), ...tRows.map((t) => (t.from_user === me ? t.to_user : t.from_user))])];
    const people: Record<string, Trainer> = {};
    if (otherIds.length) {
      const { data } = await supabase.from('profiles').select('id, username, card, card_updated_at').in('id', otherIds);
      (data ?? []).forEach((p) => {
        people[p.id] = { id: p.id, username: p.username ?? 'New trainer', card: readCard(p.card), cardUpdatedAt: p.card_updated_at };
      });
    }
    const gifted = new Set((sent.data ?? []).map((c) => c.recipient));
    setGiftsLeft(Math.max(0, A.GIFTS_PER_DAY - gifted.size));
    const f: Friend[] = [];
    const inc: FriendRequest[] = [];
    const out: SentRequest[] = [];
    rows.forEach((r) => {
      const otherId = r.requester === me ? r.addressee : r.requester;
      const t = people[otherId] ?? { id: otherId, username: 'Trainer', card: null, cardUpdatedAt: null };
      if (r.status === 'accepted') f.push({ ...t, friendshipId: r.id, giftedToday: gifted.has(otherId) });
      else if (r.addressee === me) inc.push({ id: r.id, from: t });
      else out.push({ id: r.id, to: t });
    });
    announce(me, rows.filter((r) => r.requester === me).map((r) => ({ id: r.id, accepted: r.status === 'accepted', name: (people[r.addressee] ?? { username: 'A trainer' }).username })), inc.map((r) => ({ id: r.id, name: r.from.username })));
    // Friends who played today first (most XP first), then everyone else by name.
    const today = new Date().toDateString();
    const xpToday = (t: Trainer) => (t.cardUpdatedAt && new Date(t.cardUpdatedAt).toDateString() === today ? (t.card?.todayXp ?? 0) + 1 : 0);
    f.sort((a, b) => xpToday(b) - xpToday(a) || a.username.localeCompare(b.username));
    // Keep open trades, finished trades that may still need swapping in, and recent declines for a day.
    const dayAgo = Date.now() - 86_400_000;
    setTrades(
      tRows
        .map((t) => {
          const otherId = t.from_user === me ? t.to_user : t.from_user;
          return {
            id: t.id,
            fromMe: t.from_user === me,
            friendId: otherId,
            friendName: people[otherId]?.username ?? 'A friend',
            status: t.status as TradeStatus,
            offer: t.offer_pet as T.TradePet,
            counter: (t.counter_pet as T.TradePet | null) ?? null,
            updatedAt: t.updated_at,
          };
        })
        .filter((t) => t.status === 'offered' || t.status === 'countered' || t.status === 'completed' || new Date(t.updatedAt).getTime() > dayAgo),
    );
    setFriends(f);
    setIncoming(inc);
    setOutgoing(out);
    setLoading(false);
  }, [user?.id]);

  // Open gifts friends sent while you were away.
  const claim = useCallback(async () => {
    if (!user || !loaded || claiming.current) return;
    claiming.current = true;
    const { data, error: err } = await supabase.rpc('claim_gifts');
    const news = await supabase.rpc('claim_battle_news');
    claiming.current = false;
    const battles = ((news.error ? [] : news.data) as { name: string; theyWon: boolean }[] | null) ?? [];
    if (battles.length) {
      const b = battles[battles.length - 1];
      const more = battles.length > 1 ? ` (+${battles.length - 1} more battle${battles.length > 2 ? 's' : ''})` : '';
      say(b.theyWon ? `⚔ ${b.name} battled your team and won! Time for a rematch?${more}` : `🛡 ${b.name} battled your team and your pets won!${more}`);
    }
    const names = (err ? [] : (data as string[] | null)) ?? [];
    if (!names.length) return;
    const opened = A.openGifts(stateRef.current, names.length);
    apply(() => opened.state);
    const who = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names[0]} and ${names.length - 1} others`;
    const extra = opened.chests ? ` and ${opened.chests === 1 ? 'a surprise Bronze chest' : `${opened.chests} surprise Bronze chests`}` : '';
    say(`🎁 ${who} sent you a gift! +${opened.coins} coins${extra}`);
  }, [user?.id, loaded, apply, say]);

  useEffect(() => {
    refresh();
    claim();
    const t = setInterval(() => {
      refresh();
      claim();
    }, 60_000);
    return () => clearInterval(t);
  }, [refresh, claim]);

  const addFriend = useCallback(
    async (target: string) => {
      const clean = target.trim();
      if (!clean) return { ok: false, text: 'Type a friend code or trainer name.' };
      const { data, error: err } = await supabase.rpc('send_friend_request', { target: clean });
      if (err) return { ok: false, text: 'Couldn’t reach Sproutling. Try again in a moment.' };
      await refresh();
      return ADD_MESSAGES[data as string] ?? { ok: false, text: 'Something went wrong. Try again.' };
    },
    [refresh],
  );

  const respond = useCallback(
    async (requestId: string, accept: boolean) => {
      setIncoming((list) => list.filter((r) => r.id !== requestId));
      await supabase.rpc('respond_friend_request', { request_id: requestId, accept });
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (friendshipId: string) => {
      setFriends((list) => list.filter((f) => f.friendshipId !== friendshipId));
      setOutgoing((list) => list.filter((r) => r.id !== friendshipId));
      await supabase.from('friendships').delete().eq('id', friendshipId);
      await refresh();
    },
    [refresh],
  );

  const gift = useCallback(async (friendId: string) => {
    setFriends((list) => list.map((f) => (f.id === friendId ? { ...f, giftedToday: true } : f)));
    setGiftsLeft((n) => Math.max(0, n - 1));
    const { data, error: err } = await supabase.rpc('send_gift', { friend: friendId });
    if (err || data === 'not_friends' || data === 'limit') {
      await refresh();
      return err ? 'error' : (data as string);
    }
    return data as string;
  }, [refresh]);

  // While a trade is open, check more often so the other player's move shows up quickly.
  const openTrades = trades.some((t) => t.status === 'offered' || t.status === 'countered');
  useEffect(() => {
    if (!openTrades) return;
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [openTrades, refresh]);

  // Swap in any finished trades this save hasn't applied yet (after the cloud save has loaded).
  const settled = loaded && (sync === 'saved' || sync === 'error');
  useEffect(() => {
    if (!settled) return;
    let s = stateRef.current;
    const done: { gave: T.TradePet | null; got: ReturnType<typeof T.applyTrade> & {}; friend: string }[] = [];
    trades
      .filter((t) => t.status === 'completed' && t.counter && !s.appliedTrades?.[t.id])
      .reverse()
      .forEach((t) => {
        const give = t.fromMe ? t.offer : t.counter!;
        const get = t.fromMe ? t.counter! : t.offer;
        const r = T.applyTrade(s, t.id, give.id, get);
        if (r) {
          s = r.state;
          done.push({ gave: give, got: r, friend: t.friendName });
        }
      });
    if (!done.length) return;
    apply(() => s);
    done.forEach((d) => reveal({ kind: 'trade', gave: d.gave, got: d.got.received, isNew: d.got.isNew, friend: d.friend }));
  }, [trades, settled]);

  const busyPetIds = new Set(
    trades.filter((t) => t.status === 'offered' || t.status === 'countered').flatMap((t) => (t.fromMe ? [t.offer.id] : t.counter ? [t.counter.id] : [])),
  );
  const tradesForMe = trades.filter((t) => (t.status === 'offered' && !t.fromMe) || (t.status === 'countered' && t.fromMe)).length;

  const TRADE_MESSAGES: Record<string, string> = {
    not_friends: 'You can only trade with friends.',
    bad_pet: 'That pet can’t be traded.',
    too_many: 'You have 5 open trades. Finish or cancel one first.',
    pet_busy: 'That pet is already in another trade.',
    not_found: 'That trade isn’t open anymore.',
  };

  const offerTrade = useCallback(
    async (friendId: string, petId: string) => {
      const s = stateRef.current;
      const check = T.canOffer(s, petId, busyPetIds);
      if (!check.ok) return { ok: false, text: check.reason };
      const pet = s.pets.find((p) => p.id === petId)!;
      const { data, error: err } = await supabase.rpc('create_trade', { friend: friendId, pet: T.toTradePet(pet) });
      await refresh();
      if (err) return { ok: false, text: 'Couldn’t reach Sproutling. Try again in a moment.' };
      return data === 'sent' ? { ok: true, text: 'Trade offer sent! They’ll pick a pet to offer back.' } : { ok: false, text: TRADE_MESSAGES[data as string] ?? 'Something went wrong.' };
    },
    [refresh, busyPetIds],
  );

  const counterTrade = useCallback(
    async (tradeId: string, petId: string) => {
      const s = stateRef.current;
      const check = T.canOffer(s, petId, busyPetIds);
      if (!check.ok) return { ok: false, text: check.reason };
      const pet = s.pets.find((p) => p.id === petId)!;
      const { data, error: err } = await supabase.rpc('counter_trade', { trade_id: tradeId, pet: T.toTradePet(pet) });
      await refresh();
      if (err) return { ok: false, text: 'Couldn’t reach Sproutling. Try again in a moment.' };
      return data === 'ok' ? { ok: true, text: 'Offer sent back! The trade happens when they confirm.' } : { ok: false, text: TRADE_MESSAGES[data as string] ?? 'Something went wrong.' };
    },
    [refresh, busyPetIds],
  );

  const confirmTrade = useCallback(
    async (tradeId: string) => {
      const { data, error: err } = await supabase.rpc('confirm_trade', { trade_id: tradeId });
      await refresh();
      if (err) return { ok: false, text: 'Couldn’t reach Sproutling. Try again in a moment.' };
      return data === 'ok' ? { ok: true, text: 'Trade complete!' } : { ok: false, text: TRADE_MESSAGES[data as string] ?? 'Something went wrong.' };
    },
    [refresh],
  );

  const cancelTrade = useCallback(
    async (tradeId: string) => {
      setTrades((list) => list.filter((t) => t.id !== tradeId));
      await supabase.rpc('cancel_trade', { trade_id: tradeId });
      await refresh();
    },
    [refresh],
  );

  const recordBattle = useCallback((friendId: string, won: boolean) => {
    supabase.rpc('record_battle', { friend: friendId, won }).then(() => {});
  }, []);

  return (
    <FriendsCtx.Provider
      value={{ myCode, friends, incoming, outgoing, loading, error, refresh, addFriend, respond, remove, gift, giftsLeft, notice, dismissNotice: () => setNotice(null), trades, busyPetIds, tradesForMe, offerTrade, counterTrade, confirmTrade, cancelTrade, recordBattle }}
    >
      {children}
    </FriendsCtx.Provider>
  );
}

export function useFriends(): Ctx {
  const c = useContext(FriendsCtx);
  if (!c) throw new Error('useFriends must be used inside <FriendsProvider>');
  return c;
}
