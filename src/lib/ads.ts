import { Platform, TurboModuleRegistry } from 'react-native';

/**
 * Ads (AdMob). Only works in an iPhone build that includes the AdMob native module; everywhere
 * else (web, older builds getting a live update) every function here quietly does nothing.
 *
 * TEST_ADS: friends-and-family builds use Google's test ad units, which look real but pay nothing
 * and can't get the AdMob account flagged. Flip to false (and fill in REAL_UNITS) for the App Store.
 */
export const TEST_ADS = true;
const REAL_UNITS = { banner: '', rewarded: '' };

type Mod = typeof import('react-native-google-mobile-ads');
let mod: Mod | null | undefined;

export function ads(): Mod | null {
  if (mod !== undefined) return mod;
  try {
    if (Platform.OS === 'web' || !TurboModuleRegistry.get('RNGoogleMobileAdsModule')) return (mod = null);
    mod = require('react-native-google-mobile-ads') as Mod;
  } catch {
    mod = null;
  }
  return mod;
}

export const adsAvailable = () => !!ads();

export function unit(kind: 'banner' | 'rewarded'): string {
  const m = ads();
  if (!m) return '';
  if (TEST_ADS || !REAL_UNITS[kind]) return kind === 'banner' ? m.TestIds.BANNER : m.TestIds.REWARDED;
  return REAL_UNITS[kind];
}

let personalized = false;
let started: Promise<void> | null = null;

/**
 * Starts AdMob once. Players 13 to 17 only ever get non-personalized, teen-rated ads and no tracking prompt.
 * Adults are asked by iPhone's "Allow tracking" prompt the first time; saying no still shows ads, just untailored.
 */
export function startAds(birthYear?: number): Promise<void> {
  const m = ads();
  if (!m) return Promise.resolve();
  if (started) return started;
  const age = birthYear ? new Date().getFullYear() - birthYear : 0;
  const teen = !birthYear || age < 18;
  started = (async () => {
    try {
      if (!teen) {
        try {
          const T = require('expo-tracking-transparency') as typeof import('expo-tracking-transparency');
          const r = await T.requestTrackingPermissionsAsync();
          personalized = r.granted;
        } catch {
          personalized = false;
        }
      }
      await m.default().setRequestConfiguration({
        maxAdContentRating: teen ? m.MaxAdContentRating.T : m.MaxAdContentRating.PG,
        tagForUnderAgeOfConsent: teen,
      });
      await m.default().initialize();
    } catch {
      // Ads are optional; the game carries on without them.
    }
  })();
  return started;
}

export const requestOptions = () => ({ requestNonPersonalizedAdsOnly: !personalized });

export type AdResult = { ok: boolean; error?: string };

/** Loads one rewarded ad. Resolves once it's watched (or skipped, or fails). */
function playOnce(m: Mod): Promise<AdResult> {
  return new Promise((resolve) => {
    let earned = false;
    let shown = false;
    let done = false;
    const finish = (r: AdResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      subs.forEach((u) => u());
      resolve(r);
    };
    const ad = m.RewardedAd.createForAdRequest(unit('rewarded'), requestOptions());
    const subs = [
      ad.addAdEventListener(m.RewardedAdEventType.LOADED, () => {
        shown = true;
        clearTimeout(timer);
        ad.show().catch((e: any) => finish({ ok: false, error: `show: ${e?.message ?? e}` }));
      }),
      ad.addAdEventListener(m.RewardedAdEventType.EARNED_REWARD, () => { earned = true; }),
      ad.addAdEventListener(m.AdEventType.CLOSED, () => finish({ ok: earned, ...(earned ? {} : { error: 'closed early' }) })),
      ad.addAdEventListener(m.AdEventType.ERROR, (e: any) => finish({ ok: false, error: `${shown ? 'play' : 'load'}: ${e?.message ?? e}` })),
    ];
    // Loading shouldn't take long; once it's playing there's no timer.
    const timer = setTimeout(() => { if (!shown) finish({ ok: false, error: 'load: timed out' }); }, 15_000);
    try {
      ad.load();
    } catch (e: any) {
      finish({ ok: false, error: `load: ${e?.message ?? e}` });
    }
  });
}

/**
 * Shows a rewarded ad. ok is true only if the player watched it to the end.
 * Waits for AdMob to finish starting (an ad requested too early fails), and tries loading once more if the first load fails.
 */
export async function showRewarded(): Promise<AdResult> {
  const m = ads();
  if (!m) return { ok: false, error: 'ads not in this build' };
  if (started) await started;
  const first = await playOnce(m);
  if (first.ok || !first.error?.startsWith('load')) return first;
  return playOnce(m);
}
