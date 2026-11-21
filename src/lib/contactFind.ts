import { sha256 } from 'js-sha256';
import { supabase } from './supabase';
import { readContactKeys } from './contactsDevice';

/**
 * Find friends from contacts. Phone numbers and emails are scrambled (SHA-256) on the phone before anything
 * is sent, the server only answers with matches, and nothing from your contacts is kept.
 */
const PEPPER = 'sproutling-v1:';

/** Digits only; a 10-digit number is treated as US/Canada (+1). */
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/[^0-9]/g, '');
  if (d.length === 10) return '1' + d;
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}
export const hashKey = (v: string) => sha256(PEPPER + v);
export const hashPhone = (raw: string) => {
  const n = normalizePhone(raw);
  return n ? hashKey(n) : null;
};
export const hashEmail = (raw: string) => hashKey(raw.trim().toLowerCase());

export { contactsSupported } from './contactsDevice';

export type ContactMatch = { id: string; username: string; card: any; contactName?: string };

/** Reads contacts (asks permission the first time), checks them, and returns the players found. */
export async function findContactFriends(): Promise<{ matches: ContactMatch[] } | { error: string }> {
  const keys = await readContactKeys();
  if ('error' in keys) return keys;
  const names = new Map<string, string>();
  for (const c of keys.contacts) {
    for (const p of c.phones) {
      const h = hashPhone(p);
      if (h) names.set(h, c.name);
    }
    for (const e of c.emails) names.set(hashEmail(e), c.name);
  }
  const hashes = [...names.keys()].slice(0, 2000);
  if (!hashes.length) return { matches: [] };
  const { data, error } = await supabase.rpc('match_contacts', { p_hashes: hashes });
  if (error) return { error: 'Couldn’t check right now. Try again in a moment.' };
  // We can't tell which contact matched from the server's answer (it never sends hashes back), so names stay off.
  return { matches: (data ?? []) as ContactMatch[] };
}

export async function getContactPrefs(): Promise<{ hasPhone: boolean; findable: boolean }> {
  const { data } = await supabase.rpc('contact_prefs');
  const row = Array.isArray(data) ? data[0] : null;
  return { hasPhone: !!row?.has_phone, findable: !!row?.findable };
}

/** Saves whether friends can find you, plus a new number if one is given (null keeps the saved one). */
export async function setContactPrefs(phone: string | null, findable: boolean, adult: boolean, clearPhone = false): Promise<'ok' | 'taken' | 'bad' | 'error'> {
  const h = phone ? hashPhone(phone) : null;
  if (phone && !h) return 'bad';
  const { data, error } = await supabase.rpc('set_contact_prefs', { p_phone_hash: h, p_findable: findable, p_adult: adult, p_clear_phone: clearPhone });
  if (error) return 'error';
  return (data as any) ?? 'error';
}
