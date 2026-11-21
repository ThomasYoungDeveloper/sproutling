import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OwnedPet } from '../game/types';

/**
 * The pet a new player hatches before making an account (play-first intro). Kept on this phone until
 * they sign up and confirm their email, then moved into their game.
 */
export interface PendingStarter {
  pet: OwnedPet;
  /** Which of the three meadow eggs they picked (for its colors). */
  look: number;
  birthYear?: number;
}

const KEY = 'sproutling/pending-starter';

export async function loadPendingStarter(): Promise<PendingStarter | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingStarter) : null;
  } catch {
    return null;
  }
}

export async function savePendingStarter(p: PendingStarter): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

export async function clearPendingStarter(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}
