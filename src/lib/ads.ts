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

/** Shows a rewarded ad. Resolves true only if the player watched it to the end. */
export function showRewarded(): Promise<boolean> {
  const m = ads();
  if (!m) return Promise.resolve(false);
  return new Promise((resolve) => {
    let earned = false;
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      subs.forEach((u) => u());
      resolve(v);
    };
    const ad = m.RewardedAd.createForAdRequest(unit('rewarded'), requestOptions());
    const subs = [
      ad.addAdEventListener(m.RewardedAdEventType.LOADED, () => ad.show().catch(() => finish(false))),
      ad.addAdEventListener(m.RewardedAdEventType.EARNED_REWARD, () => { earned = true; }),
      ad.addAdEventListener(m.AdEventType.CLOSED, () => finish(earned)),
      ad.addAdEventListener(m.AdEventType.ERROR, () => finish(false)),
    ];
    setTimeout(() => finish(earned), 60_000);
    ad.load();
  });
}
