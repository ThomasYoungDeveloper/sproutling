import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Sproutling Spots: a cafe or other place with its own QR code (sproutling.vercel.app/?spot=CODE).
 * The code is kept until the player has seen the place and been offered its group.
 */
const KEY = 'sproutling/pending-spot';
export interface SpotInfo {
  code: string;
  name: string;
  photo: string | null;
  about: string;
  city: string | null;
  members: number;
  sprites: string[];
}

const fromLink = (link: string | null | undefined) => {
  const m = link?.match(/[?&]spot=([A-Za-z0-9_-]{2,24})/);
  return m ? m[1].toUpperCase() : null;
};

/** Reads a spot code from the address bar (web) or the link that opened the app (iPhone), and keeps it. */
export async function captureSpot(): Promise<string | null> {
  let code: string | null = null;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    code = fromLink(window.location.href);
    if (code) {
      const url = new URL(window.location.href);
      url.searchParams.delete('spot');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  } else {
    code = fromLink(await Linking.getInitialURL().catch(() => null));
  }
  if (code) await AsyncStorage.setItem(KEY, code).catch(() => {});
  return code ?? (await AsyncStorage.getItem(KEY).catch(() => null));
}

export const clearSpot = () => AsyncStorage.removeItem(KEY).catch(() => {});

export async function loadSpot(code: string): Promise<SpotInfo | null> {
  const { data, error } = await supabase.rpc('spot_info', { p_code: code });
  if (error || !data) return null;
  const d = data as any;
  return { code, name: d.name, photo: d.photo ?? null, about: d.about ?? '', city: d.city ?? null, members: d.members ?? 0, sprites: (d.sprites ?? []).filter(Boolean) };
}

/** The spot waiting to be shown, if the app was opened from a spot's QR code. Listens for links while open too. */
export function usePendingSpot(): [SpotInfo | null, () => void] {
  const [spot, setSpot] = useState<SpotInfo | null>(null);
  useEffect(() => {
    let alive = true;
    const show = async (code: string | null) => {
      if (!code) return;
      const info = await loadSpot(code);
      if (alive && info) setSpot(info);
      else if (!info) clearSpot();
    };
    captureSpot().then(show);
    const sub = Platform.OS === 'web' ? null : Linking.addEventListener('url', (e) => {
      const code = fromLink(e.url);
      if (code) AsyncStorage.setItem(KEY, code).then(() => show(code));
    });
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return [spot, () => {
    setSpot(null);
    clearSpot();
  }];
}

/** Joins the spot's group (the teen or adult one, made on first scan). Returns the group id, or an error code. */
export async function joinSpot(code: string): Promise<{ ok: true; id: string } | { ok: false; text: string }> {
  const { data, error } = await supabase.rpc('join_spot', { p_code: code });
  if (error) return { ok: false, text: 'Couldn’t reach Sproutling. Try again in a moment.' };
  const v = String(data);
  if (/^[0-9a-f-]{36}$/.test(v)) return { ok: true, id: v };
  return { ok: false, text: v === 'full' ? 'This group is full right now.' : 'Couldn’t join this group.' };
}
