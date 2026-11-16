import type { HealthProvider } from './health';

/** Web and any platform without a native reader: habits are entered by hand. */
export const nativeProvider: HealthProvider | null = null;
