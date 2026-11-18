import { Platform } from 'react-native';
import { nativeProvider } from './healthNative';

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
  /** Glasses of water logged in Apple Health (250 ml each), if any. */
  water?: number;
  /** Activity rings as a fraction of each goal (1 = closed). */
  rings?: { move: number; exercise: number; stand: number };
  exerciseMin?: number;
  mindfulMin?: number;
}

export interface HealthProvider {
  source: HealthSource;
  /** Asks the player for permission. Resolves true when the game may read steps and sleep. */
  requestAccess(): Promise<boolean>;
  /** Steps and sleep for a local date (YYYY-MM-DD). */
  readDay(date: string): Promise<HealthDay | null>;
  /** Average steps a day over the last few weeks, for suggesting a goal. */
  averageSteps?(days: number): Promise<number | null>;
}

const manual: HealthProvider = {
  source: 'manual',
  requestAccess: async () => false,
  readDay: async () => null,
};

/** The provider for this device: Apple Health on iPhone, manual everywhere else (for now). */
export function healthProvider(): HealthProvider {
  if (Platform.OS === 'web' || !nativeProvider || skipped) return manual;
  return nativeProvider;
}

/** Apple Health is on this phone (whether or not the player chose to use it). */
export const healthAvailable = () => Platform.OS !== 'web' && !!nativeProvider;

/** Players who skip Apple Health in the intro type their habits in, like the web version. */
let skipped = false;
export function setHealthSkipped(v: boolean) {
  skipped = v;
}
/** The real provider, ignoring a skip (for the intro's Connect button). */
export const nativeHealth = (): HealthProvider | null => (Platform.OS === 'web' ? null : nativeProvider ?? null);

export const isVerified = (p: HealthProvider) => p.source !== 'manual';
