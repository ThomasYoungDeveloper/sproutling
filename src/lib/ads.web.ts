/** Web build: no ads (AdMob is iPhone and Android only). Same functions as ads.ts, all doing nothing. */
export const TEST_ADS = true;
export const ads = (): typeof import('react-native-google-mobile-ads') | null => null;
export const adsAvailable = () => false;
export const unit = (_kind: 'banner' | 'rewarded') => '';
export const startAds = (_birthYear?: number) => Promise.resolve();
export const requestOptions = () => ({ requestNonPersonalizedAdsOnly: true });
export const showRewarded = () => Promise.resolve(false);
