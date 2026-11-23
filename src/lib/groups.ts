import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export type GroupKind = 'cafe' | 'club' | 'work' | 'pets' | 'other';
export interface Group {
  id: string;
  name: string;
  about: string;
  kind: GroupKind;
  city: string | null;
  spot: boolean;
  photo?: string | null;
  logo?: string | null;
  pinned: string | null;
  members: number;
  live: number;
  joined: boolean;
  owner: boolean;
}
export interface GroupPage extends Group {
  board: { id: string; username: string; steps: number; card: unknown }[];
}
export const GROUP_LEVEL = 3;
export const KINDS: { id: GroupKind; label: string; color: string }[] = [
  { id: 'cafe', label: 'Cafe', color: '#C98042' },
  { id: 'club', label: 'Club', color: '#E0607E' },
  { id: 'work', label: 'Work', color: '#5A7BD8' },
  { id: 'pets', label: 'Pets', color: '#8B6BD8' },
  { id: 'other', label: 'Other', color: '#2FA58A' },
];
export const kindOf = (k: GroupKind) => KINDS.find((x) => x.id === k) ?? KINDS[4];

const ERR: Record<string, string> = {
  level_low: `Starting a group opens at account level ${GROUP_LEVEL}.`,
  no_age: 'Add your birth year first (it keeps teen and adult groups apart).',
  made_enough: 'You’ve started 3 groups already.',
  bad_name: 'Group names are 3 to 24 letters, numbers and spaces.',
  bad_word: 'That name or description isn’t allowed. Try another.',
  full: 'This group is full right now.',
  not_found: 'That group isn’t available.',
};
export const groupError = (code: string) => ERR[code] ?? 'Something went wrong. Try again.';

// Your groups, shared by every screen that shows them.
let mine: Group[] | null = null;
const subs = new Set<() => void>();
export async function refreshMyGroups() {
  const { data, error } = await supabase.rpc('my_groups');
  if (!error) {
    mine = (data as Group[]) ?? [];
    subs.forEach((f) => f());
  }
}
export function useMyGroups(): Group[] | null {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    subs.add(f);
    refreshMyGroups();
    return () => {
      subs.delete(f);
    };
  }, []);
  return mine;
}

export function useFindGroups(scope: 'nearby' | 'popular', kind: GroupKind | null) {
  const [list, setList] = useState<Group[] | null>(null);
  const load = useCallback(() => {
    setList(null);
    supabase.rpc('find_groups', { p_scope: scope, p_kind: kind }).then(({ data }) => setList((data as Group[]) ?? []));
  }, [scope, kind]);
  useEffect(load, [load]);
  return { list, reload: load };
}

export async function joinGroup(id: string) {
  const { data, error } = await supabase.rpc('join_group', { p_id: id });
  if (error) return { ok: false, text: 'Couldn’t reach Sproutling.' };
  if (data !== 'ok') return { ok: false, text: groupError(String(data)) };
  await refreshMyGroups();
  return { ok: true, text: '' };
}
export async function leaveGroup(id: string) {
  await supabase.rpc('leave_group', { p_id: id });
  await refreshMyGroups();
}
export async function createGroup(name: string, about: string, kind: GroupKind) {
  const { data, error } = await supabase.rpc('create_group', { p_name: name, p_about: about, p_kind: kind });
  if (error) return { ok: false as const, text: 'Couldn’t reach Sproutling.' };
  const v = String(data);
  if (!/^[0-9a-f-]{36}$/.test(v)) return { ok: false as const, text: groupError(v) };
  await refreshMyGroups();
  return { ok: true as const, id: v };
}
export async function loadGroup(id: string): Promise<GroupPage | null> {
  const { data } = await supabase.rpc('group_info', { p_id: id });
  return (data as GroupPage) ?? null;
}
export async function setPin(id: string, text: string) {
  const { data } = await supabase.rpc('set_group_pin', { p_id: id, p_text: text });
  return data === 'ok';
}
