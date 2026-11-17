import { useEffect, useRef, useState } from 'react';
import { useGame } from '../state/GameContext';
import { healthProvider, isVerified } from './health';
import * as A from '../game/actions';
import { rollWalkFinds, type WalkFind } from '../game/walkFinds';
import { RARITY_INFO } from '../game/rarity';
import { FOOD_BY_ID } from '../game/food';
import { play } from './sound';

const CHEST_LABEL = { bronze: 'Bronze chest', silver: 'Silver chest', gold: 'Gold chest' } as const;

/** Rolls walking finds whenever today's steps cross a new 1,000, and returns a message to show. */
export function useWalkFinds(ready: boolean): [string | null, () => void] {
  const { state, apply } = useGame();
  const [note, setNote] = useState<string | null>(null);
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
    const pet = A.activePet(state)?.nickname ?? 'Your pet';
    const an = (w: string) => (/^[AEIOU]/.test(w) ? `an ${w}` : `a ${w}`);
    const what = (f: WalkFind) =>
      f.kind === 'food' ? `${FOOD_BY_ID[f.foodId]?.emoji ?? ''} ${FOOD_BY_ID[f.foodId]?.name ?? 'food'}` : an(f.kind === 'chest' ? CHEST_LABEL[f.chest] : `${RARITY_INFO[f.rarity].label} egg`);
    const icon = finds.some((f) => f.kind === 'egg') ? '🥚' : finds.some((f) => f.kind === 'chest') ? '🎁' : '🧺';
    setNote(`${icon} ${pet} found ${finds.map(what).join(' and ')} on your walk!`);
    play(finds.some((f) => f.kind === 'egg') ? 'crack' : 'chest');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), 6000);
  }, [ready, steps, state.activePetId]);

  return [note, () => setNote(null)];
}
