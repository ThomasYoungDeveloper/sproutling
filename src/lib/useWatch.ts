import { useEffect, useRef } from 'react';
import { useGame } from '../state/GameContext';
import { useTeam } from '../state/TeamContext';
import { applyWatchAction } from '../game/watch';
import { syncWatch, subscribeWatchActions } from './watchSync';
import { logEvent } from './gameLog';

/** Keeps the Apple Watch app in step with the game, and applies Feed and +1 water pressed on the watch. */
export function useWatch(ready: boolean) {
  const { state, apply } = useGame();
  const { team } = useTeam();
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => syncWatch(state, team ? { total: team.total, goal: team.goal } : null), 1000);
    return () => clearTimeout(t);
  }, [state, team?.total, team?.goal, ready]);

  useEffect(() => {
    if (!ready) return;
    return subscribeWatchActions((list) => {
      const fresh = list.filter((a) => !seen.current.has(a.id));
      if (!fresh.length) return;
      fresh.forEach((a) => seen.current.add(a.id));
      apply((s) => fresh.reduce(applyWatchAction, s));
      logEvent('watch_actions', { kinds: fresh.map((a) => a.kind) });
    });
  }, [ready]);
}
