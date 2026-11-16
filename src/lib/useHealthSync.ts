import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useGame } from '../state/GameContext';
import { healthProvider, isVerified } from './health';
import * as A from '../game/actions';

/**
 * On the phone app, pulls today's steps and last night's sleep from Apple Health
 * when the app opens and every time it comes back to the foreground.
 * Steps only ever go up (so eggs keep warming); sleep is replaced with the verified number.
 */
export function useHealthSync() {
  const { state, apply, loaded } = useGame();
  const asked = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const provider = healthProvider();
    if (!loaded || !isVerified(provider)) return;
    let busy = false;
    const sync = async () => {
      if (busy) return;
      busy = true;
      try {
        if (!asked.current) {
          asked.current = true;
          await provider.requestAccess();
        }
        const today = A.todayKey(stateRef.current);
        const day = await provider.readDay(today);
        if (!day) return;
        apply((s) => {
          if (A.todayKey(s) !== today) return s;
          const d = A.today(s);
          let next = s;
          if (day.steps > d.steps) next = A.addSteps(next, day.steps - d.steps);
          if (day.sleepHours > 0 && day.sleepHours !== d.sleepHours) next = A.setSleep(next, day.sleepHours);
          return next;
        });
      } finally {
        busy = false;
      }
    };
    sync();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && sync());
    const t = setInterval(sync, 5 * 60_000);
    return () => {
      sub.remove();
      clearInterval(t);
    };
  }, [loaded]);
}
