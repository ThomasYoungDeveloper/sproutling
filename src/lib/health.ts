import { Platform } from 'react-native';

/**
 * Where the game gets steps and sleep from.
 *
 * Web preview: the player enters habits by hand (manual).
 * Phone app: Apple Health (iOS) and Health Connect (Android) will provide verified numbers.
 * The native readers are added with the first phone build (see NATIVE.md); until then
 * every platform reports 'manual' so the game keeps working exactly as it does today.
 */

export type HealthSource = 'manual' | 'apple-health' | 'health-connect';

export interface HealthDay {
  steps: number;
  sleepHours: number;
}

export interface HealthProvider {
  source: HealthSource;
  /** Asks the player for permission. Resolves true when the game may read steps and sleep. */
  requestAccess(): Promise<boolean>;
  /** Steps and sleep for a local date (YYYY-MM-DD). */
  readDay(date: string): Promise<HealthDay | null>;
}

const manual: HealthProvider = {
  source: 'manual',
  requestAccess: async () => false,
  readDay: async () => null,
};

/** The provider for this device. Native providers plug in here once the phone build adds them. */
export function healthProvider(): HealthProvider {
  if (Platform.OS === 'web') return manual;
  return manual;
}

export const isVerified = (p: HealthProvider) => p.source !== 'manual';
