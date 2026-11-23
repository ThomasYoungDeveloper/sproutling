import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Guild name and account level shown next to players' names. Ids are looked up in small batches and cached for 10 minutes.
type Tag = { guild: string | null; level: number | null; at: number };
const cache = new Map<string, Tag>();
const queue = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  const ids = [...queue].slice(0, 300);
  ids.forEach((id) => queue.delete(id));
  if (!ids.length) return;
  supabase.rpc('name_tags', { p_ids: ids }).then(({ data, error }) => {
    if (error) return;
    const now = Date.now();
    ids.forEach((id) => cache.set(id, { guild: null, level: null, at: now }));
    ((data as any[]) ?? []).forEach((r) => cache.set(r.user_id, { guild: r.guild ?? null, level: r.level ?? null, at: now }));
    listeners.forEach((l) => l());
  });
  if (queue.size) timer = setTimeout(flush, 60);
}

function useTag(userId: string | null | undefined): Tag | undefined {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!userId) return;
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    const hit = cache.get(userId);
    if (!hit || Date.now() - hit.at > 10 * 60_000) {
      queue.add(userId);
      if (!timer) timer = setTimeout(flush, 60);
    }
    return () => {
      listeners.delete(l);
    };
  }, [userId]);
  return userId ? cache.get(userId) : undefined;
}

export const useGuildTag = (userId: string | null | undefined) => useTag(userId)?.guild ?? null;
export const usePlayerLevel = (userId: string | null | undefined) => useTag(userId)?.level ?? null;
/** Forget a cached tag (after joining or leaving a guild, or leveling up). */
export const dropTag = (userId: string) => cache.delete(userId);
