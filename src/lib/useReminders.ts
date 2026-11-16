import { useEffect, useState } from 'react';
import { useGame } from '../state/GameContext';
import { useTeam } from '../state/TeamContext';
import { planReminders } from '../game/reminders';
import { getRemindersOn, onRemindersChange, scheduleReminders } from './remindersState';

/** Keeps the phone's scheduled reminders in step with the game (re-planned a moment after anything changes). */
export function useReminders() {
  const { state } = useGame();
  const { team } = useTeam();
  const [on, setOn] = useState(false);
  useEffect(() => {
    getRemindersOn().then(setOn);
    return onRemindersChange(setOn);
  }, []);
  useEffect(() => {
    if (!on) return;
    const t = setTimeout(() => {
      scheduleReminders(planReminders(state, { inGuild: !!team, raidHitsLeft: team?.raid.hits_left }));
    }, 1500);
    return () => clearTimeout(t);
  }, [on, state, team]);
}
