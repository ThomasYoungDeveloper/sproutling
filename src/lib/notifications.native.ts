import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import type { Reminder } from '../game/reminders';

/** Local reminder notifications on the phone: scheduled on the device, no server needed. */

const KEY = 'sproutling/reminders';
export const remindersSupported = true;

// While the app is open, don't pop banners on top of the game.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function getRemindersOn(): Promise<boolean> {
  if ((await AsyncStorage.getItem(KEY)) !== '1') return false;
  const p = await Notifications.getPermissionsAsync();
  return p.granted;
}

/** Turning reminders on asks iPhone for permission the first time. Returns whether they're on now. */
export async function setRemindersOn(on: boolean): Promise<boolean> {
  if (!on) {
    await AsyncStorage.setItem(KEY, '0');
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    return false;
  }
  let p = await Notifications.getPermissionsAsync();
  if (!p.granted && p.canAskAgain) p = await Notifications.requestPermissionsAsync();
  await AsyncStorage.setItem(KEY, p.granted ? '1' : '0');
  return p.granted;
}

let last = '';
export async function scheduleReminders(list: Reminder[]): Promise<void> {
  // Skip the work if nothing changed (times rounded to the minute).
  const sig = JSON.stringify(list.map((r) => [r.id, Math.round(r.at / 60000), r.title, r.body]));
  if (sig === last) return;
  last = sig;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const r of list) {
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(r.at) },
      });
    }
  } catch (e) {
    last = '';
    console.warn('Could not schedule reminders', e);
  }
}
