import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { mergeSaves, sameSave } from '../game/merge';
import type { GameState } from '../game/types';
import * as A from '../game/actions';
import { newGame } from '../game/seed';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { buildCard } from '../game/card';

const keyFor = (userId: string) => `sproutling/game/v3/${userId}`;

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

/** Mounted only for a signed-in player (keyed by their id), so each account has its own save. */
export function GameProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const KEY = keyFor(user?.id ?? 'none');
  const [state, setState] = useState<GameState>(newGame);
  const [loaded, setLoaded] = useState(false);
  const [sync, setSync] = useState<SyncStatus>('local');
  const cloudReady = useRef<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // The last cloud copy this device agreed with, so changes made on another device (the web app,
  // a second phone) are merged in instead of overwritten. See game/merge.ts.
  const baseRef = useRef<GameState | null>(null);
  const stampRef = useRef<string | null>(null);
  const busy = useRef(false);
  const again = useRef(false);
  const BASE_KEY = `${KEY}/base`;
  const saveBase = (b: GameState, stamp: string | null) => {
    baseRef.current = b;
    stampRef.current = stamp;
    AsyncStorage.setItem(BASE_KEY, JSON.stringify({ stamp, state: b })).catch(() => {});
  };

  // Load the device save (and the last agreed cloud copy).
  useEffect(() => {
    Promise.all([AsyncStorage.getItem(KEY), AsyncStorage.getItem(BASE_KEY)])
      .then(([raw, rawBase]) => {
        if (raw) {
          const parsed = JSON.parse(raw) as GameState;
          if (parsed.version === 1) setState(A.cleanSave(parsed));
        }
        if (rawBase) {
          const b = JSON.parse(rawBase) as { stamp: string | null; state: GameState };
          if (b?.state?.version === 1) {
            baseRef.current = b.state;
            stampRef.current = b.stamp;
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Save to the device on every change.
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  /** Bring a merged copy into the game without losing anything the player did meanwhile. */
  const adopt = (merged: GameState, from: GameState) => {
    if (sameSave(merged, from)) return;
    setState((cur) => A.cleanSave(cur === from ? merged : mergeSaves(from, cur, merged)));
  };

  /** Upload this device's save, merging in the cloud copy first if another device changed it. */
  const push = async (uid: string) => {
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    try {
      const local = stateRef.current;
      const { data, error } = await supabase.from('game_saves').select('state, updated_at').eq('user_id', uid).maybeSingle();
      if (error) throw error;
      const cloud = data?.state as GameState | undefined;
      const changedElsewhere = !!cloud && cloud.version === 1 && data!.updated_at !== stampRef.current;
      const merged = changedElsewhere ? A.cleanSave(mergeSaves(baseRef.current, local, cloud!)) : local;
      if (!changedElsewhere && baseRef.current && sameSave(merged, baseRef.current)) {
        setSync('saved');
        return; // Nothing new to upload.
      }
      const { data: up, error: upErr } = await supabase.from('game_saves').upsert({ user_id: uid, state: merged }).select('updated_at').single();
      if (upErr) throw upErr;
      saveBase(merged, up?.updated_at ?? null);
      adopt(merged, local);
      setSync('saved');
    } catch {
      setSync('error');
    } finally {
      busy.current = false;
      if (again.current) {
        again.current = false;
        push(uid);
      }
    }
  };

  /** Pick up changes made on another device (on sign-in and whenever the app comes back to the front). */
  const pull = async (uid: string, firstTime: boolean) => {
    if (busy.current) return;
    busy.current = true;
    try {
      setSync('syncing');
      const { data, error } = await supabase.from('game_saves').select('state, updated_at').eq('user_id', uid).maybeSingle();
      if (error) throw error;
      const cloud = data?.state as GameState | undefined;
      const local = stateRef.current;
      if (!cloud || cloud.version !== 1) {
        const { data: up, error: upErr } = await supabase.from('game_saves').upsert({ user_id: uid, state: local }).select('updated_at').single();
        if (upErr) throw upErr;
        saveBase(local, up?.updated_at ?? null);
      } else if (data!.updated_at !== stampRef.current) {
        let merged: GameState;
        if (baseRef.current) merged = mergeSaves(baseRef.current, local, cloud);
        // First time on this device: keep whichever copy is further along, as before.
        else merged = firstTime && progress(cloud) < progress(local) ? local : cloud;
        merged = A.cleanSave(merged);
        saveBase(cloud, data!.updated_at);
        adopt(merged, local);
      }
      setSync('saved');
    } catch {
      setSync('error');
    } finally {
      busy.current = false;
    }
  };

  // When a player signs in, reconcile with their cloud save.
  useEffect(() => {
    if (!loaded) return;
    if (!user) {
      cloudReady.current = null;
      setSync('local');
      return;
    }
    let cancelled = false;
    (async () => {
      await pull(user.id, true);
      if (!cancelled) cloudReady.current = user.id;
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, loaded]);

  // Coming back to the app (or the browser tab): pick up anything done on another device.
  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' && cloudReady.current === user.id) pull(user.id, false);
    });
    return () => sub.remove();
  }, [user?.id]);

  // After that, push changes to the cloud (debounced).
  useEffect(() => {
    if (!user || cloudReady.current !== user.id) return;
    setSync('syncing');
    const t = setTimeout(() => push(user.id), 1500);
    return () => clearTimeout(t);
  }, [state, user?.id]);

  // Publish the trainer card friends see, only when something on it changed.
  const cardJson = JSON.stringify(buildCard(state));
  const lastCard = useRef<string | null>(null);
  useEffect(() => {
    if (!user || cloudReady.current !== user.id || cardJson === lastCard.current) return;
    const t = setTimeout(async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ card: JSON.parse(cardJson), card_updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (!error) lastCard.current = cardJson;
    }, 2000);
    return () => clearTimeout(t);
  }, [cardJson, user?.id, sync === 'saved']);

  const apply = useCallback((fn: (s: GameState) => GameState) => setState((s) => fn(s)), []);
  const reset = useCallback(() => {
    // A deliberate reset should win over the cloud copy, not be merged with it.
    baseRef.current = null;
    stampRef.current = null;
    AsyncStorage.removeItem(BASE_KEY).catch(() => {});
    setState(newGame());
  }, []);

  return <GameCtx.Provider value={{ state, apply, reset, loaded, sync }}>{children}</GameCtx.Provider>;
}

export function useGame(): Ctx {
  const c = useContext(GameCtx);
  if (!c) throw new Error('useGame must be used inside <GameProvider>');
  return c;
}
