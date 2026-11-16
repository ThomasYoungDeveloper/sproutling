import * as N from './notifications';

/** Reminder setting shared by the Account screen, the tutorial and the scheduler. */
const listeners = new Set<(on: boolean) => void>();
export const remindersSupported = N.remindersSupported;
export const getRemindersOn = N.getRemindersOn;
export const scheduleReminders = N.scheduleReminders;
export async function setRemindersOn(on: boolean): Promise<boolean> {
  const r = await N.setRemindersOn(on);
  listeners.forEach((l) => l(r));
  return r;
}
export function onRemindersChange(l: (on: boolean) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
