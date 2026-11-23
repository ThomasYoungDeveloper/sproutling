import {
  isHealthDataAvailable,
  queryActivitySummary,
  queryQuantitySamples,
  queryCategorySamples,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import type { HealthDay, HealthLabel, HealthProvider } from './health';

// Wearable apps that write steps or sleep to Apple Health, by bundle id prefix. A phone sleep app is not a wearable.
const WEARABLES: [string, HealthLabel][] = [
  ['com.ouraring', 'oura'],
  ['com.garmin', 'garmin'],
  ['com.fitbit', 'fitbit'],
  ['com.whoop', 'wearable'],
  ['fi.polar', 'wearable'],
  ['com.withings', 'wearable'],
  ['com.huami', 'wearable'],
  ['com.zepp', 'wearable'],
  ['com.samsung', 'wearable'],
  ['com.suunto', 'wearable'],
  ['com.coros', 'wearable'],
];
const ORDER: HealthLabel[] = ['watch', 'oura', 'garmin', 'fitbit', 'wearable'];

/** One sample's wearable, if it came from one. */
function labelOf(x: any): HealthLabel | null {
  const model = String(x?.device?.model ?? '');
  const product = String(x?.sourceRevision?.productType ?? '');
  if (/watch/i.test(model) || /^Watch/.test(product)) return 'watch';
  const id = String(x?.sourceRevision?.source?.bundleIdentifier ?? '').toLowerCase();
  for (const [prefix, label] of WEARABLES) if (id.startsWith(prefix.toLowerCase())) return label;
  return null;
}

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

/** Water, mindful minutes and activity rings. Each part is optional: a missing permission just leaves it out. */
async function readExtras(date: string): Promise<Omit<HealthDay, 'steps' | 'sleepHours'>> {
  const day = { startDate: atLocal(date, 0), endDate: atLocal(date, 24) };
  const out: Omit<HealthDay, 'steps' | 'sleepHours'> = {};
  try {
    const water = await queryQuantitySamples('HKQuantityTypeIdentifierDietaryWater', { filter: { date: day }, limit: 0, unit: 'mL' });
    const ml = water.reduce((a, w) => a + (w.quantity ?? 0), 0);
    if (ml > 0) out.water = Math.floor(ml / 250);
  } catch {}
  try {
    const sessions = await queryCategorySamples('HKCategoryTypeIdentifierMindfulSession', { filter: { date: day }, limit: 0 });
    const ms = coveredMs(sessions.map((x) => [new Date(x.startDate).getTime(), new Date(x.endDate).getTime()] as [number, number]));
    if (ms > 0) out.mindfulMin = Math.round(ms / 60_000);
  } catch {}
  try {
    const [sum] = await queryActivitySummary({ date: day });
    if (sum) {
      const frac = (v?: { quantity: number }, g?: { quantity: number }) => (g && g.quantity > 0 && v ? v.quantity / g.quantity : 0);
      const byTime = Number(sum.activityMoveMode) === 2;
      out.rings = {
        move: byTime ? frac(sum.appleMoveTime, sum.appleMoveTimeGoal) : frac(sum.activeEnergyBurned, sum.activeEnergyBurnedGoal),
        exercise: frac(sum.appleExerciseTime, sum.appleExerciseTimeGoal),
        stand: frac(sum.appleStandHours, sum.appleStandHoursGoal),
      };
      out.exerciseMin = Math.round(sum.appleExerciseTime?.quantity ?? 0);
    }
  } catch {}
  return out;
}

/** Apple Health on iPhone: verified steps and sleep, plus water, mindful minutes and activity rings. */
export const nativeProvider: HealthProvider = {
  source: 'apple-health',
  async requestAccess() {
    try {
      if (!isHealthDataAvailable()) return false;
      await requestAuthorization({
        toRead: [
          'HKQuantityTypeIdentifierStepCount',
          'HKCategoryTypeIdentifierSleepAnalysis',
          'HKQuantityTypeIdentifierDietaryWater',
          'HKCategoryTypeIdentifierMindfulSession',
          'HKActivitySummaryTypeIdentifier',
        ],
      });
      return true;
    } catch {
      return false;
    }
  },
  async averageSteps(days: number): Promise<number | null> {
    try {
      const end = new Date();
      end.setHours(0, 0, 0, 0);
      const start = new Date(end.getTime() - days * 86_400_000);
      const stats = await queryStatisticsForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], {
        filter: { date: { startDate: start, endDate: end } },
        unit: 'count',
      });
      const total = stats.sumQuantity?.quantity ?? 0;
      return total > 0 ? Math.round(total / days) : null;
    } catch {
      return null;
    }
  },
  async detectLabel(): Promise<HealthLabel> {
    const found = new Set<HealthLabel>();
    const range = { startDate: new Date(Date.now() - 7 * 86_400_000), endDate: new Date() };
    try {
      const steps = await queryQuantitySamples('HKQuantityTypeIdentifierStepCount', { filter: { date: range }, limit: 400, unit: 'count' });
      steps.forEach((x) => {
        const l = labelOf(x);
        if (l) found.add(l);
      });
    } catch {}
    try {
      const sleep = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', { filter: { date: range }, limit: 300 });
      sleep.forEach((x) => {
        const l = labelOf(x);
        if (l) found.add(l);
      });
    } catch {}
    return ORDER.find((l) => found.has(l)) ?? 'health';
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
      // No sleep stages (no watch or sleep app)? Use the iPhone's "in bed" time from the Health bedtime schedule.
      let sleepMs = coveredMs(asleep);
      if (sleepMs === 0) sleepMs = coveredMs(samples.filter((s) => Number(s.value) === 0).map((s) => [new Date(s.startDate).getTime(), new Date(s.endDate).getTime()] as [number, number]));
      const sleepHours = Math.round((sleepMs / 3_600_000) * 2) / 2;
      const extras = await readExtras(date);
      return { steps, sleepHours, ...extras };
    } catch {
      return null;
    }
  },
};
