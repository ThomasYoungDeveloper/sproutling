import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useFriends } from './FriendsContext';
import { useTeam } from './TeamContext';

export type ChatKind = 'text' | 'phrase' | 'sticker' | 'system';
export interface ChatMessage {
  id: number;
  room: string;
  sender: string | null;
  kind: ChatKind;
  body: string;
  sticker: { speciesId: string; skin?: string; name?: string } | null;
  created_at: string;
}
export interface ChatRoom {
  room: string;
  at: string | null;
  last: string | null;
  lastFrom: string | null;
  unread: number;
}
export type ChatMode = 'on' | 'phrases' | 'off';

interface Ctx {
  rooms: ChatRoom[];
  unread: number;
  mode: ChatMode;
  push: boolean;
  messages: (room: string) => ChatMessage[];
  open: (room: string) => Promise<void>;
  close: () => void;
  send: (room: string, kind: Exclude<ChatKind, 'system'>, body: string, sticker?: ChatMessage['sticker']) => Promise<string | null>;
  report: (id: number, reason: string) => Promise<boolean>;
  block: (userId: string) => Promise<boolean>;
  unblock: (userId: string) => Promise<void>;
  blocked: () => Promise<{ id: string; name: string }[]>;
  setSettings: (s: { mode?: ChatMode; push?: boolean }) => Promise<void>;
  /** Has this player agreed to the chat rules? (Shown once, before their first chat.) */
  rulesOk: boolean;
  acceptRules: () => Promise<void>;
  refresh: () => Promise<void>;
  dmRoom: (friendId: string) => string;
  nameOf: (userId: string | null) => string;
}

const ChatCtx = createContext<Ctx | null>(null);

export const QUICK_PHRASES = ['Good game!', 'Battle?', 'Nice pet!', 'Thanks!', 'Let’s go!', 'Good morning!', 'Good night!', 'Walking now'];

const SEND_ERRORS: Record<string, string> = {
  accept_rules: 'Agree to the chat rules first (open the chat again).',
  chat_off: 'Your chat is off. Turn it on in Account › Chat.',
  phrases_only: 'Your chat is set to quick phrases and stickers only.',
  bad_length: 'Messages can be up to 300 characters.',
  not_friends: 'You can only chat with friends.',
  blocked: 'You can’t chat with this trainer.',
  their_chat_off: 'They’ve turned their chat off.',
  slow_down: 'Slow down a little! Try again in a minute.',
  no_contact_info: 'Links, emails, phone numbers and other apps can’t be shared in chat.',
  not_allowed: 'You can’t send messages here.',
};

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const me = user?.id ?? '';
  const { friends } = useFriends();
  const { team } = useTeam();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [byRoom, setByRoom] = useState<Record<string, ChatMessage[]>>({});
  const [mode, setMode] = useState<ChatMode>('on');
  const [push, setPush] = useState(true);
  const [rulesOk, setRulesOk] = useState(true);
  const openRoom = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!me) return;
    const [{ data: r }, { data: st }] = await Promise.all([supabase.rpc('chat_rooms'), supabase.rpc('chat_settings', {})]);
    if (Array.isArray(r)) setRooms(r as ChatRoom[]);
    if (st && typeof st === 'object') {
      setMode(((st as any).mode ?? 'on') as ChatMode);
      setPush((st as any).push !== false);
      setRulesOk((st as any).rules !== false);
    }
  }, [me]);

  const loadRoom = useCallback(async (room: string) => {
    const { data } = await supabase.from('chat_messages').select('*').eq('room', room).order('created_at', { ascending: false }).limit(60);
    if (data) setByRoom((b) => ({ ...b, [room]: (data as ChatMessage[]).reverse() }));
  }, []);

  useEffect(() => {
    if (!me) return;
    refresh();
    // Row-level security means we only hear about rooms we're in.
    const ch = supabase
      .channel(`chat-${me}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (p: any) => {
        const m = p.new as ChatMessage;
        if (!m?.room) return;
        setByRoom((b) => (b[m.room] ? { ...b, [m.room]: [...b[m.room].filter((x) => x.id !== m.id), m].slice(-200) } : b));
        if (openRoom.current === m.room) supabase.rpc('chat_mark_read', { p_room: m.room }).then(() => {});
        refresh();
      })
      .subscribe();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      supabase.removeChannel(ch);
      sub.remove();
    };
  }, [me, refresh]);

  // Your guild's room shows even before anyone has written in it.
  useEffect(() => {
    if (team) refresh();
  }, [team?.id]);

  const open = async (room: string) => {
    openRoom.current = room;
    await loadRoom(room);
    await supabase.rpc('chat_mark_read', { p_room: room });
    setRooms((rs) => rs.map((r) => (r.room === room ? { ...r, unread: 0 } : r)));
  };
  const close = () => {
    openRoom.current = null;
    refresh();
  };

  const acceptRules = async () => {
    setRulesOk(true);
    const { data } = await supabase.rpc('chat_settings', { p_accept_rules: true });
    if (data && typeof data === 'object') setRulesOk((data as any).rules !== false);
  };

  const send: Ctx['send'] = async (room, kind, body, sticker) => {
    const { data, error } = await supabase.rpc('chat_send', { p_room: room, p_kind: kind, p_body: body, p_sticker: sticker ?? null });
    if (error) return 'Couldn’t send. Check your connection and try again.';
    if (data !== 'ok') return SEND_ERRORS[String(data)] ?? 'Couldn’t send that.';
    await loadRoom(room);
    return null;
  };

  const report: Ctx['report'] = async (id, reason) => {
    const { data } = await supabase.rpc('chat_report', { p_message: id, p_reason: reason });
    return data === 'ok';
  };
  const block: Ctx['block'] = async (userId) => {
    const { data } = await supabase.rpc('chat_block', { p_user: userId });
    await refresh();
    return data === 'ok';
  };
  const unblock: Ctx['unblock'] = async (userId) => {
    await supabase.rpc('chat_unblock', { p_user: userId });
  };
  const blocked: Ctx['blocked'] = async () => {
    const { data } = await supabase.rpc('chat_blocked_list');
    return Array.isArray(data) ? (data as { id: string; name: string }[]) : [];
  };
  const setSettings: Ctx['setSettings'] = async (s) => {
    const { data } = await supabase.rpc('chat_settings', { p_mode: s.mode ?? null, p_push: s.push ?? null });
    if (data && typeof data === 'object') {
      setMode(((data as any).mode ?? 'on') as ChatMode);
      setPush((data as any).push !== false);
    }
  };

  const dmRoom = (friendId: string) => {
    const [a, b] = [me, friendId].sort();
    return `dm:${a}:${b}`;
  };
  const names = useMemo(() => {
    const m = new Map<string, string>();
    friends.forEach((f) => m.set(f.id, f.username));
    team?.members?.forEach((x: any) => x?.id && m.set(x.id, x.username ?? x.name ?? 'Trainer'));
    return m;
  }, [friends, team]);
  const nameOf = (id: string | null) => (!id ? '' : id === me ? 'You' : names.get(id) ?? 'Trainer');

  const unread = rooms.reduce((a, r) => a + (r.unread || 0), 0);
  return (
    <ChatCtx.Provider value={{ rulesOk, acceptRules, rooms, unread, mode, push, messages: (room) => byRoom[room] ?? [], open, close, send, report, block, unblock, blocked, setSettings, refresh, dmRoom, nameOf }}>
      {children}
    </ChatCtx.Provider>
  );
}

export function useChat() {
  const c = useContext(ChatCtx);
  if (!c) throw new Error('useChat outside ChatProvider');
  return c;
}
