import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameState } from '../game/types';
import { newGame } from '../game/seed';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const KEY = 'sproutling/game/v2';

export type SyncStatus = 'local' | 'syncing' | 'saved' | 'error';

interface Ctx {
  state: GameState;
  /** Apply a pure state transition (from game/actions) and persist it. */
  apply: (fn: (s: GameState) => GameState) => void;
  reset: () => void;
  loaded: boolean;
  sync: SyncStatus;
}

const GameCtx = createContext<Ctx | null>(null);

/** Rough "how far along is this save" score, used to pick between a device save and a cloud save. */
function progress(s: GameState): number {
  return s.pets.length * 1000 + s.pets.reduce((a, p) => a + p.xp, 0) + Object.keys(s.dex).length * 200 + Object.keys(s.days).length * 50;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<GameState>(newGame);
  const [loaded, setLoaded] = useState(false);
  const [sync, setSync] = useState<SyncStatus>('local');
  const cloudReady = useRef<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Load the device save.
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as GameState;
          if (parsed.version === 1) setState(parsed);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Save to the device on every change.
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  // When a player signs in, reconcile with their cloud save (keep whichever is further along).
  useEffect(() => {
    if (!loaded) return;
    if (!user) {
      cloudReady.current = null;
      setSync('local');
      return;
    }
    let cancelled = false;
    (async () => {
      setSync('syncing');
      const { data, error } = await supabase.from('game_saves').select('state').eq('user_id', user.id).maybeSingle();
      if (cancelled) return;
      if (error) {
        setSync('error');
        return;
      }
      const cloud = data?.state as GameState | undefined;
      const local = stateRef.current;
      if (cloud && cloud.version === 1 && progress(cloud) >= progress(local)) {
        setState(cloud);
      } else {
        const { error: upErr } = await supabase.from('game_saves').upsert({ user_id: user.id, state: local });
        if (upErr) {
          setSync('error');
          return;
        }
      }
      cloudReady.current = user.id;
      setSync('saved');
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, loaded]);

  // After that, push changes to the cloud (debounced).
  useEffect(() => {
    if (!user || cloudReady.current !== user.id) return;
    setSync('syncing');
    const t = setTimeout(async () => {
      const { error } = await supabase.from('game_saves').upsert({ user_id: user.id, state: stateRef.current });
      setSync(error ? 'error' : 'saved');
    }, 1500);
    return () => clearTimeout(t);
  }, [state, user?.id]);

  const apply = useCallback((fn: (s: GameState) => GameState) => setState((s) => fn(s)), []);
  const reset = useCallback(() => setState(newGame()), []);

  return <GameCtx.Provider value={{ state, apply, reset, loaded, sync }}>{children}</GameCtx.Provider>;
}

export function useGame(): Ctx {
  const c = useContext(GameCtx);
  if (!c) throw new Error('useGame must be used inside <GameProvider>');
  return c;
}
