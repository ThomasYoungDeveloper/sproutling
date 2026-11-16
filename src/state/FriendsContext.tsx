import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useGame } from './GameContext';
import { readCard, type PublicCard } from '../game/card';
import * as A from '../game/actions';

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
  const { state, apply, loaded } = useGame();
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

  const refresh = useCallback(async () => {
    if (!user) return;
    const me = user.id;
    const [mine, links, sent] = await Promise.all([
      supabase.from('profiles').select('friend_code').eq('id', me).maybeSingle(),
      supabase.from('friendships').select('id, requester, addressee, status, created_at').order('created_at', { ascending: false }),
      supabase.from('gifts').select('recipient').eq('sender', me).eq('day', utcDay()),
    ]);
    if (links.error) {
      setError('Couldn’t load your friends. Try again in a moment.');
      setLoading(false);
      return;
    }
    setError(null);
    if (mine.data?.friend_code) setMyCode(mine.data.friend_code);
    const rows = links.data ?? [];
    const otherIds = [...new Set(rows.map((r) => (r.requester === me ? r.addressee : r.requester)))];
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
    // Friends who played today first (most XP first), then everyone else by name.
    const today = new Date().toDateString();
    const xpToday = (t: Trainer) => (t.cardUpdatedAt && new Date(t.cardUpdatedAt).toDateString() === today ? (t.card?.todayXp ?? 0) + 1 : 0);
    f.sort((a, b) => xpToday(b) - xpToday(a) || a.username.localeCompare(b.username));
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
    claiming.current = false;
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

  return (
    <FriendsCtx.Provider
      value={{ myCode, friends, incoming, outgoing, loading, error, refresh, addFriend, respond, remove, gift, giftsLeft, notice, dismissNotice: () => setNotice(null) }}
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
