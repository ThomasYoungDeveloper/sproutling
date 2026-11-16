import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Reminder } from '../game/reminders';

/**
 * Reminder notifications. The web version can't notify when the tab is closed, so here it only
 * remembers the setting; the Account screen still previews what the phone would schedule.
 * The phone app uses notifications.native.ts.
 */

const KEY = 'sproutling/reminders';
export const remindersSupported = false;

export async function getRemindersOn(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === '1';
}

export async function setRemindersOn(on: boolean): Promise<boolean> {
  await AsyncStorage.setItem(KEY, on ? '1' : '0');
  return on;
}

export async function scheduleReminders(_list: Reminder[]): Promise<void> {}
