import { requireOptionalNativeModule } from 'expo';
import type { GameState } from '../game/types';
import { watchSnapshot, type WatchAction } from '../game/watch';
import { reportCrash } from './crashReport';

type Bridge = {
  isAvailable(): boolean;
  updateContext(json: string): void;
  takePending(): string[];
  addListener(name: 'onWatchAction', fn: () => void): { remove(): void };
};

// Only builds made after the watch app was added have this; older builds just skip it.
const bridge = requireOptionalNativeModule<Bridge>('WatchBridge');
let lastJson = '';

/** Sends what the watch shows whenever it changes. */
export function syncWatch(s: GameState, team?: { total: number; goal: number } | null): void {
  if (!bridge) return;
  try {
    if (!bridge.isAvailable()) return;
    const snap = watchSnapshot(s, team);
    // Round the trip end so a ticking clock doesn't resend every second.
    const json = JSON.stringify({ ...snap, trip: snap.trip ? { ...snap.trip, endAt: Math.round(snap.trip.endAt / 30000) * 30000 } : null });
    if (json === lastJson) return;
    lastJson = json;
    bridge.updateContext(json);
  } catch (e) {
    reportCrash(e, 'watch-sync');
  }
}

/** Feed and +1 water pressed on the watch. Calls back with any that are waiting, now and as they arrive. */
export function subscribeWatchActions(on: (a: WatchAction[]) => void): () => void {
  if (!bridge) return () => {};
  const drain = () => {
    try {
      const raw = bridge.takePending();
      const list = raw
        .map((r) => {
          try {
            return JSON.parse(r) as WatchAction;
          } catch {
            return null;
          }
        })
        .filter((a): a is WatchAction => !!a && (a.kind === 'feed' || a.kind === 'water'));
      if (list.length) on(list);
    } catch (e) {
      reportCrash(e, 'watch-actions');
    }
  };
  drain();
  const sub = bridge.addListener('onWatchAction', drain);
  return () => sub.remove();
}
