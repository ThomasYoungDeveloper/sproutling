import * as Application from 'expo-application';

/** This phone's installed build number (e.g. 7), or null if it can't be read. */
export const appBuild = (): number | null => {
  const n = Number(Application.nativeBuildVersion);
  return Number.isFinite(n) && n > 0 ? n : null;
};
