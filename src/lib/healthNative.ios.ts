import {
  isHealthDataAvailable,
  queryCategorySamples,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import type { HealthDay, HealthProvider } from './health';

/** Sleep stages that count as asleep (not "in bed" or "awake"). */
const ASLEEP = new Set([1, 3, 4, 5]);

const atLocal = (date: string, hours: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, hours, 0, 0, 0);
};

/** Total time covered by possibly overlapping intervals (iPhone and Apple Watch both log sleep). */
function coveredMs(intervals: [number, number][]): number {
  const sorted = intervals.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const [a, b] of sorted) {
    if (!cur || a > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [a, b];
    } else cur[1] = Math.max(cur[1], b);
  }
  if (cur) total += cur[1] - cur[0];
  return total;
}

/** Apple Health on iPhone: verified steps and sleep. */
export const nativeProvider: HealthProvider = {
  source: 'apple-health',
  async requestAccess() {
    try {
      if (!isHealthDataAvailable()) return false;
      await requestAuthorization({ toRead: ['HKQuantityTypeIdentifierStepCount', 'HKCategoryTypeIdentifierSleepAnalysis'] });
      return true;
    } catch {
      return false;
    }
  },
  async readDay(date: string): Promise<HealthDay | null> {
    try {
      // Steps: midnight to midnight. Statistics merge iPhone and Watch without double counting.
      const stats = await queryStatisticsForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], {
        filter: { date: { startDate: atLocal(date, 0), endDate: atLocal(date, 24) } },
        unit: 'count',
      });
      const steps = Math.round(stats.sumQuantity?.quantity ?? 0);
      // Sleep: last night, from 6 pm the evening before until noon.
      const samples = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
        filter: { date: { startDate: atLocal(date, -6), endDate: atLocal(date, 12) } },
        limit: 0,
      });
      const asleep = samples
        .filter((s) => ASLEEP.has(Number(s.value)))
        .map((s) => [new Date(s.startDate).getTime(), new Date(s.endDate).getTime()] as [number, number]);
      const sleepHours = Math.round((coveredMs(asleep) / 3_600_000) * 2) / 2;
      return { steps, sleepHours };
    } catch {
      return null;
    }
  },
};
