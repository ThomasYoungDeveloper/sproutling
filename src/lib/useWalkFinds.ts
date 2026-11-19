import { useEffect, useRef, useState } from 'react';
import { useGame } from '../state/GameContext';
import { healthProvider, isVerified } from './health';
import * as A from '../game/actions';
import { rollWalkFinds, type WalkFind } from '../game/walkFinds';
import { RARITY_INFO } from '../game/rarity';
import { FOOD_BY_ID } from '../game/food';
import { SPECIES_BY_ID } from '../game/species';
import { play } from './sound';

const CHEST_LABEL = { bronze: 'Bronze chest', silver: 'Silver chest', gold: 'Gold chest', rainbow: 'Rainbow Chest' } as const;
// Bright versions of the rarity colors, readable on the dark notice.
const ON_DARK = { common: '#C9D3D6', uncommon: '#62D99C', rare: '#62B6F5', epic: '#C9A2F7', legendary: '#FFCF4D' } as const;
const CHEST_COLOR = { bronze: '#E8A066', silver: '#D6DEE3', gold: '#FFD24D', rainbow: '#E0B8FF' } as const;

/** One line in the "Found on your walk" list. */
export type FindRow = { key: string; icon: string; label: string; count: number; color: string };

/** Groups finds into rows like "🥕 Carrot ×2", colored by rarity. */
export function findRows(finds: WalkFind[]): FindRow[] {
  const rows = new Map<string, FindRow>();
  for (const f of finds) {
    const row: Omit<FindRow, 'count'> =
      f.kind === 'food'
        ? { key: `food:${f.foodId}`, icon: FOOD_BY_ID[f.foodId]?.emoji ?? '🍽️', label: FOOD_BY_ID[f.foodId]?.name ?? 'Food', color: ON_DARK[FOOD_BY_ID[f.foodId]?.rarity ?? 'common'] }
        : f.kind === 'chest'
          ? { key: `chest:${f.chest}`, icon: '🎁', label: CHEST_LABEL[f.chest], color: CHEST_COLOR[f.chest] }
          : f.kind === 'potion'
            ? { key: 'potion', icon: '🧪', label: 'Small Potion', color: '#FF8FB4' }
            : f.kind === 'wild'
              ? { key: `wild:${f.wild.id}`, icon: '⚔️', label: `Wild ${SPECIES_BY_ID[f.wild.speciesId]?.name ?? 'pet'} appeared`, color: ON_DARK[f.wild.rarity] }
              : { key: `egg:${f.rarity}`, icon: '🥚', label: `${RARITY_INFO[f.rarity].label} egg`, color: ON_DARK[f.rarity] };
    const had = rows.get(row.key);
    rows.set(row.key, { ...row, count: (had?.count ?? 0) + 1 });
  }
  return [...rows.values()];
}

/** Rolls walking finds whenever today's steps cross a new 1,000, and returns what was found to show. */
export function useWalkFinds(ready: boolean): [FindRow[] | null, () => void] {
  const { state, apply } = useGame();
  const [note, setNote] = useState<FindRow[] | null>(null);
  const steps = A.today(state).steps;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!ready || !state.activePetId) return;
    const verified = isVerified(healthProvider());
    const { finds } = rollWalkFinds(state, verified);
    const checkedBefore = state.walkFinds?.day === A.todayKey(state) ? state.walkFinds.checked : -1;
    if (Math.floor(steps / 1000) <= checkedBefore) return;
    apply((s) => rollWalkFinds(s, verified).state);
    if (!finds.length) return;
    setNote(findRows(finds));
    play(finds.some((f) => f.kind === 'egg') ? 'crack' : 'chest');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), 7000);
  }, [ready, steps, state.activePetId]);

  return [note, () => setNote(null)];
}
