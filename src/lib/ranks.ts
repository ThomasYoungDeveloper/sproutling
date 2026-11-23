import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { readCard, type PublicCard } from '../game/card';

export type RankScope = 'friends' | 'guild' | 'city' | 'everyone';
export interface RankRow {
  id: string;
  place: number;
  steps: number;
  username: string;
  card: PublicCard | null;
  me: boolean;
}
export interface Board {
  rows: RankRow[];
  mine: { place: number; steps: number; next: number | null } | null;
  city: string | null;
}

/** Sends this week's Apple Health steps (never typed-in steps) for the leaderboards. */
export async function reportWeekSteps(week: string, steps: number): Promise<void> {
  await supabase.rpc('report_week_steps', { p_week: week, steps });
}

export async function loadBoard(scope: RankScope, week: string): Promise<Board | null> {
  const { data, error } = await supabase.rpc('leaderboard', { scope, p_week: week });
  if (error || !data) return null;
  const raw = data as any;
  return {
    rows: (raw.rows ?? []).map((r: any) => ({ ...r, card: readCard(r.card) })),
    mine: raw.mine ?? null,
    city: raw.city ?? null,
  };
}

export async function saveRankPrefs(city: string | null, hidden: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('set_lb_prefs', { p_city: city ?? '', p_hidden: hidden });
  if (!error && data === 'ok') titlesAt = 0;
  return !error && data === 'ok';
}

export async function citySuggestions(q: string): Promise<string[]> {
  if (q.trim().length < 2) return [];
  const { data } = await supabase.rpc('lb_cities', { q });
  return ((data as string[] | null) ?? []).filter(Boolean);
}

// Last week's titles ("#1 Orlando", "Top 10 Everywhere"), shared by every screen that shows names.
export interface RankTitle {
  place: number;
  label: string;
}
let titles: Record<string, RankTitle> = {};
let titlesAt = 0;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function loadTitles(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    const { data, error } = await supabase.rpc('current_titles');
    if (!error && Array.isArray(data)) {
      titles = Object.fromEntries((data as any[]).map((t) => [t.user_id, { place: t.place, label: t.label }]));
      titlesAt = Date.now();
      listeners.forEach((l) => l());
    }
    loading = null;
  })();
  return loading;
}

/** The title a player earned last week, if any. Refreshes at most every 30 minutes. */
export function useRankTitle(userId: string | null | undefined): RankTitle | null {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    if (Date.now() - titlesAt > 30 * 60_000) loadTitles();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return userId ? (titles[userId] ?? null) : null;
}
