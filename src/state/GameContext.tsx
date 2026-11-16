import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameState } from '../game/types';
import { newGame } from '../game/seed';

const KEY = 'sproutling/game/v1';

interface Ctx {
  state: GameState;
  /** Apply a pure state transition (from game/actions) and persist it. */
  apply: (fn: (s: GameState) => GameState) => void;
  reset: () => void;
  loaded: boolean;
}

const GameCtx = createContext<Ctx | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(newGame);
  const [loaded, setLoaded] = useState(false);
  const first = useRef(true);

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

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (loaded) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  const apply = useCallback((fn: (s: GameState) => GameState) => setState((s) => fn(s)), []);
  const reset = useCallback(() => setState(newGame()), []);

  return <GameCtx.Provider value={{ state, apply, reset, loaded }}>{children}</GameCtx.Provider>;
}

export function useGame(): Ctx {
  const c = useContext(GameCtx);
  if (!c) throw new Error('useGame must be used inside <GameProvider>');
  return c;
}
