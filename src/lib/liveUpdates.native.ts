import { AppState } from 'react-native';
import { reportCrash } from './crashReport';

/**
 * Live updates (Expo Updates): app-code fixes reach phones without a new TestFlight build.
 * On start and whenever the app comes back to the front, look for a newer update and download it.
 * If one arrives in the first few seconds after starting, restart into it right away (before the
 * player is doing anything); otherwise it's used the next time the app opens.
 */
const startedAt = Date.now();
let busy = false;

async function check() {
  if (busy) return;
  busy = true;
  try {
    const Updates = require('expo-updates') as typeof import('expo-updates');
    if (__DEV__ || !Updates.isEnabled) return;
    const found = await Updates.checkForUpdateAsync();
    if (!found.isAvailable) return;
    const got = await Updates.fetchUpdateAsync();
    if (got.isNew && Date.now() - startedAt < 8000) await Updates.reloadAsync();
  } catch (e) {
    // No connection or no update server: never a reason to bother the player.
    if (!String((e as Error)?.message ?? e).match(/network|offline|timed out/i)) reportCrash(e, 'live-update');
  } finally {
    busy = false;
  }
}

export function startLiveUpdates(): () => void {
  check();
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'active') check();
  });
  return () => sub.remove();
}
