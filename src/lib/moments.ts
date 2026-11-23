import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { OwnedPet } from '../game/types';
import { SPECIES_BY_ID } from '../game/species';

/** Posts a hatch or a wild catch to your guild chat (does nothing if you're not in a guild). */
export function postMoment(type: 'hatch' | 'catch', pet: OwnedPet): void {
  const sp = SPECIES_BY_ID[pet.speciesId];
  if (!sp) return;
  supabase
    .rpc('post_moment', { p_type: type, p_species: pet.speciesId, p_rarity: sp.rarity, p_skin: pet.skin ?? null, p_shiny: !!pet.shiny })
    .then(
      () => {},
      () => {},
    );
}

/** Words for a moment card, e.g. "hatched an Omu!". */
export function momentText(type: string | undefined, speciesId: string, skin?: string, shiny?: boolean): string {
  const name = SPECIES_BY_ID[speciesId]?.name ?? 'a sprite';
  const look = shiny ? 'shiny ' : skin ? `${skin[0].toUpperCase()}${skin.slice(1)} ` : '';
  const full = `${look}${name}`;
  const article = /^[aeiou]/i.test(full) ? 'an' : 'a';
  return type === 'catch' ? `caught a wild ${full}!` : `hatched ${article} ${full}!`;
}

export const REACTIONS = ['🎉', '❤️', '😮', '🔥', '👏', '😂', '🙋', '😭'] as const;
export type Reaction = { emoji: string; n: number; mine: boolean };

/** Reaction counts for a chat room, refreshed when messages arrive and every 15 seconds while open. */
export function useRoomReactions(room: string, bump: number) {
  const [byMsg, setByMsg] = useState<Record<number, Reaction[]>>({});
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('room_reactions', { p_room: room });
    if (error || !Array.isArray(data)) return;
    const out: Record<number, Reaction[]> = {};
    (data as any[]).forEach((r) => {
      (out[r.message_id] ??= []).push({ emoji: r.emoji, n: r.n, mine: r.mine });
    });
    Object.values(out).forEach((l) => l.sort((a, b) => REACTIONS.indexOf(a.emoji as any) - REACTIONS.indexOf(b.emoji as any)));
    setByMsg(out);
  }, [room]);
  useEffect(() => {
    load();
  }, [load, bump]);
  useEffect(() => {
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);
  const toggle = useCallback(
    async (messageId: number, emoji: string) => {
      // Show it right away, then check with the server.
      setByMsg((b) => {
        const list = [...(b[messageId] ?? [])];
        const i = list.findIndex((x) => x.emoji === emoji);
        if (i >= 0 && list[i].mine) {
          const n = list[i].n - 1;
          if (n <= 0) list.splice(i, 1);
          else list[i] = { ...list[i], n, mine: false };
        } else if (i >= 0) list[i] = { ...list[i], n: list[i].n + 1, mine: true };
        else list.push({ emoji, n: 1, mine: true });
        return { ...b, [messageId]: list };
      });
      await supabase.rpc('toggle_reaction', { p_message: messageId, p_emoji: emoji });
      load();
    },
    [load],
  );
  return { byMsg, toggle };
}
