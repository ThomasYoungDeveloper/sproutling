import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

/**
 * Supabase project "Sproutling". The URL and publishable key are meant to ship inside the app;
 * Row Level Security on every table decides what each player can read or write.
 * Never put a secret / service_role key in this file.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://ehqairqnilwycniuhdju.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_0t7WZehG6fdtdlY9o1qCCQ_1nvsQlSD';

const isSSR = typeof window === 'undefined';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: {
      getItem: (k: string) => (isSSR ? null : AsyncStorage.getItem(k)),
      setItem: (k: string, v: string) => (isSSR ? undefined : AsyncStorage.setItem(k, v)),
      removeItem: (k: string) => (isSSR ? undefined : AsyncStorage.removeItem(k)),
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
