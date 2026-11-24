import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/**
 * Small "new" dots on features players haven't opened yet. Each one goes away for good once opened.
 * Keys: groups, plaza, guild, ranks, level, badges.
 */
const KEY = 'sproutling/seen-new';
let seen: Set<string> | null = null;
const subs = new Set<() => void>();
const load = async () => {
  if (seen) return;
  try {
    seen = new Set(JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]'));
  } catch {
    seen = new Set();
  }
  subs.forEach((f) => f());
};

export function markSeenNew(k: string) {
  if (!seen || seen.has(k)) return;
  seen.add(k);
  AsyncStorage.setItem(KEY, JSON.stringify([...seen])).catch(() => {});
  subs.forEach((f) => f());
}

/** True while this feature still has its "new" dot (false until we know, so nothing flashes). */
export function useIsNew(...keys: string[]): boolean {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    subs.add(f);
    load();
    return () => {
      subs.delete(f);
    };
  }, []);
  return !!seen && keys.some((k) => !seen!.has(k));
}

