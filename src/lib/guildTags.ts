import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Guild names for the [Guild Name] tag after players' names. Ids are looked up in small batches and cached for 10 minutes.
const cache = new Map<string, { name: string | null; at: number }>();
const queue = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  const ids = [...queue].slice(0, 300);
  ids.forEach((id) => queue.delete(id));
  if (!ids.length) return;
  supabase.rpc('guild_tags', { p_ids: ids }).then(({ data, error }) => {
    if (error) return;
    const now = Date.now();
    ids.forEach((id) => cache.set(id, { name: null, at: now }));
    ((data as any[]) ?? []).forEach((r) => cache.set(r.user_id, { name: r.name, at: now }));
    listeners.forEach((l) => l());
  });
  if (queue.size) timer = setTimeout(flush, 60);
}

export function useGuildTag(userId: string | null | undefined): string | null {
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
  return userId ? (cache.get(userId)?.name ?? null) : null;
}
