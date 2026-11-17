import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';

/**
 * Real push notifications (friend requests, gifts, trades, battles, guild joins) come from the server.
 * This registers the phone's Expo push token for the signed-in player. It never asks for permission
 * itself: that happens when the player turns on Reminders.
 */
let lastSent = '';
export async function registerPushToken(userId: string | null): Promise<void> {
  if (!userId) return;
  try {
    const p = await Notifications.getPermissionsAsync();
    if (!p.granted) return;
    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const key = `${userId}:${token}`;
    if (!token || key === lastSent) return;
    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: 'ios' });
    if (!error) lastSent = key;
  } catch (e) {
    // Offline, simulator, or push not set up yet: try again next time the app opens.
    console.warn('Push token not registered', e);
  }
}

/** Called before signing out so the next person on this phone doesn't get your alerts. */
export async function unregisterPushToken(): Promise<void> {
  try {
    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (token) await supabase.rpc('unregister_push_token', { p_token: token });
  } catch {}
  lastSent = '';
}

/** Tapping a notification opens the tab it is about. */
export function onPushTap(open: (tab: string) => void): () => void {
  const handle = (r: Notifications.NotificationResponse | null | undefined) => {
    const tab = (r?.notification.request.content.data as any)?.tab;
    if (typeof tab === 'string') open(tab);
  };
  Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
