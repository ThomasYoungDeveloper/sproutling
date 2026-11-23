import { useEffect, useRef } from 'react';
import { useGame } from '../state/GameContext';
import * as A from '../game/actions';
import * as Team from '../game/team';
import { healthProvider, isVerified } from './health';
import { reportWeekSteps } from './ranks';

/** Keeps your leaderboard steps up to date. Only Apple Health steps count, so typed-in steps are never sent. */
export function useWeekStepsReport(ready: boolean) {
  const { state } = useGame();
  const week = Team.weekStart(A.todayKey(state));
  const steps = Team.weekSteps(state);
  const last = useRef('');
  useEffect(() => {
    if (!ready || !isVerified(healthProvider())) return;
    const key = `${week}:${steps}`;
    if (key === last.current) return;
    const t = setTimeout(() => {
      last.current = key;
      reportWeekSteps(week, steps).catch(() => {});
    }, 3000);
    return () => clearTimeout(t);
  }, [ready, week, steps]);
}
