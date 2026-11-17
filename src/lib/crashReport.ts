import { Platform } from 'react-native';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseConfig';

/** Sends an error to the server (error text and app build only) so we can see what broke on a phone. */
export function reportCrash(error: unknown, build: string | null = null): void {
  try {
    const e = error instanceof Error ? error : new Error(String(error));
    fetch(`${SUPABASE_URL}/rest/v1/rpc/log_client_error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({ p_build: build ?? '', p_platform: Platform.OS, p_message: e.message, p_stack: e.stack ?? '' }),
    }).catch(() => {});
  } catch {
    // Never let reporting itself break anything.
  }
}
