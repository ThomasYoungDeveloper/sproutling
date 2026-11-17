import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/**
 * Supabase project "Sproutling". The URL and publishable key are meant to ship inside the app;
 * Row Level Security on every table decides what each player can read or write.
 * Never put a secret / service_role key in this file.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseConfig';
export { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL };

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
    // On the web, opening the confirm-email or reset-password link signs the player straight in.
    detectSessionInUrl: Platform.OS === 'web',
  },
});
