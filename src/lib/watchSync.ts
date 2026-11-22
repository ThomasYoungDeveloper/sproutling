import type { GameState } from '../game/types';
import type { WatchAction } from '../game/watch';

/** Web: there's no Apple Watch. The iPhone version is watchSync.native.ts. */
export function syncWatch(_s: GameState, _team?: { total: number; goal: number } | null): void {}
export function subscribeWatchActions(_on: (a: WatchAction[]) => void): () => void {
  return () => {};
}
