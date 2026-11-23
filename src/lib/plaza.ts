import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useGame } from '../state/GameContext';
import { isTeen } from '../game/intro';

export interface PlazaRoom {
  room: string;
  title: string;
}
const cityKey = (c: string) => c.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'everywhere';

/**
 * The Plaza rooms you can use: your city's and Everywhere, in the 18+ or Teen room by the birth year you gave.
 * Also tells the server your age band (teen or adult) the first time.
 */
export function usePlaza(): { rooms: PlazaRoom[]; band: 'teen' | 'adult' | null } {
  const { state } = useGame();
  const year = state.onboard?.birthYear;
  const band: 'teen' | 'adult' | null = year ? (isTeen(year) ? 'teen' : 'adult') : null;
  const [info, setInfo] = useState<{ city: string | null } | null>(null);
  useEffect(() => {
    if (!band) return;
    supabase.rpc('set_age_band', { p_band: band }).then(() => {});
    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user.id;
      if (!id) return;
      supabase
        .from('profiles')
        .select('city')
        .eq('id', id)
        .single()
        .then(({ data: p }) => setInfo({ city: (p as any)?.city ?? null }));
    });
  }, [band]);
  if (!band || !info) return { rooms: [], band };
  // Adults see a plain room name; teens see 'Teen' so they know it's their own room.
  const label = band === 'teen' ? ' Teen' : '';
  const rooms: PlazaRoom[] = [];
  if (info.city) rooms.push({ room: `plaza:${band}:${cityKey(info.city)}`, title: `${info.city}${label} Plaza` });
  rooms.push({ room: `plaza:${band}:everywhere`, title: `Everywhere${label} Plaza` });
  return { rooms, band };
}
