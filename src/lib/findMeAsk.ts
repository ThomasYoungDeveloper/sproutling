import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The one-time "Want friends to find you?" ask. Current players see it on their next open after the update,
 * new players the first time they open Social. "Not now" asks once more two weeks later, then never again.
 */
const KEY = 'sproutling/findme-ask';
const LAST2 = 'sproutling/contact-last2';
const CHECKED = 'sproutling/contacts-checked';
const TWO_WEEKS = 14 * 24 * 3600 * 1000;

type AskState = { existing: boolean; count: number; next: number; done?: boolean };

/** Set by the What's New card, so the two pop-ups never show in the same session. */
let whatsNewShown = false;
let askedThisSession = false;
export const noteWhatsNewShown = () => {
  whatsNewShown = true;
};

async function load(tutorialDone: boolean): Promise<AskState> {
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  if (raw) {
    try {
      return JSON.parse(raw) as AskState;
    } catch {}
  }
  // First time this runs: a player who already finished the yard tips counts as a current player.
  const fresh: AskState = { existing: tutorialDone, count: 0, next: 0 };
  await AsyncStorage.setItem(KEY, JSON.stringify(fresh)).catch(() => {});
  return fresh;
}

export async function shouldAsk(where: 'open' | 'social', tutorialDone: boolean, now = Date.now()): Promise<boolean> {
  if (askedThisSession || whatsNewShown) return false;
  const s = await load(tutorialDone);
  if (s.done || s.count >= 2 || now < s.next) return false;
  if (where === 'open' && !s.existing) return false;
  askedThisSession = true;
  return true;
}

export async function markAsk(result: 'later' | 'on' | 'never', now = Date.now()): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  const s: AskState = raw ? JSON.parse(raw) : { existing: true, count: 0, next: 0 };
  const next: AskState = result === 'later' ? { ...s, count: s.count + 1, next: now + TWO_WEEKS } : { ...s, done: true };
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

/** The last 2 digits of your number, kept only on this phone for the "ending in 23" label. */
export const getLast2 = () => AsyncStorage.getItem(LAST2).catch(() => null);
export const setLast2 = (v: string | null) => (v ? AsyncStorage.setItem(LAST2, v) : AsyncStorage.removeItem(LAST2)).catch(() => {});

/** When you last checked your contacts and how many players were found. */
export type LastCheck = { at: number; found: number; total: number };
export async function getLastCheck(): Promise<LastCheck | null> {
  const raw = await AsyncStorage.getItem(CHECKED).catch(() => null);
  try {
    return raw ? (JSON.parse(raw) as LastCheck) : null;
  } catch {
    return null;
  }
}
export const setLastCheck = (c: LastCheck) => AsyncStorage.setItem(CHECKED, JSON.stringify(c)).catch(() => {});
