import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { Button, ProgressBar } from './ui';
import { buzz, PopIn } from './fx';
import { supabase } from '../lib/supabase';
import { useGame } from '../state/GameContext';
import * as A from '../game/actions';
import type { ChestKind } from '../game/types';

type Quest = { id: string; kind: 'together' | 'teamwork' | 'monthly'; progress: number; target: number; done: boolean; claimed: boolean };

const INFO: Record<string, { name: string; text: (t: number) => string; unit?: string }> = {
  moon: { name: 'Steps to the Moon', text: (t) => `Walk ${t.toLocaleString()} steps together this week.`, unit: 'steps' },
  fullhouse: { name: 'Full house', text: () => 'Every member walks at least 3 days this week (1,000+ steps).', unit: 'members' },
  hatch: { name: 'Hatch party', text: (t) => `Hatch ${t} eggs together.`, unit: 'eggs' },
  water: { name: 'Hydration station', text: (t) => `Log ${t} glasses of water together.`, unit: 'glasses' },
  sleep: { name: 'Sleep squad', text: (t) => `Get ${t} nights of 7+ hours of sleep together.`, unit: 'nights' },
  explore: { name: 'Explorers’ week', text: (t) => `Finish ${t} pet trips together.`, unit: 'trips' },
  power: { name: 'Power hour', text: (t) => `${t} of you walk in the same hour. Open the app while you walk so it counts.`, unit: 'walking at once' },
  early: { name: 'Early birds', text: (t) => `${t} of you each get 2,000 steps before 9am on the same day.`, unit: 'early birds' },
  relay: { name: 'Relay', text: (t) => `${t} of you each walk 5,000 steps on the same day.`, unit: 'walkers' },
  rally: { name: 'Weekend rally', text: () => 'Beat Saturday’s guild step total on Sunday.', unit: 'steps' },
  bosses: { name: 'Boss streak', text: () => 'Beat the guild boss 3 weeks in a row.', unit: 'weeks' },
  levelup: { name: 'Everyone levels up', text: () => 'Every member gains an account level this month.', unit: 'members' },
};
const LABEL = { together: 'Together', teamwork: 'Teamwork', monthly: 'Monthly' };

/** Guild hall: this week's 3 quests and this month's 2, with progress and a chest for everyone who helped. */
export default function GuildQuests() {
  const { apply } = useGame();
  const [data, setData] = useState<{ quests: Quest[]; helped: boolean } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => {
    supabase.rpc('guild_quests').then(({ data: d }) => d && setData(d as any));
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);
  if (!data) return null;
  const claim = async (q: Quest) => {
    const { data: r } = await supabase.rpc('claim_guild_quest', { p_quest: q.id });
    if (r === 'bronze' || r === 'silver' || r === 'gold') {
      apply((s) => ({ ...A.grantChest(s, r as ChestKind, `Guild quest: ${INFO[q.id].name}`), coins: s.coins + 50 }));
      buzz('success', 'chest');
      setMsg(`${INFO[q.id].name} done! A ${r[0].toUpperCase()}${r.slice(1)} chest and 50 coins are yours.`);
    } else setMsg(r === 'not_helped' ? 'Walk or log something this week to share in your guild’s quest chests.' : r === 'already' ? 'You already opened this one.' : 'Not quite done yet.');
    load();
  };
  const fmt = (q: Quest, n: number) => (q.id === 'moon' || q.id === 'rally' ? Math.round(n).toLocaleString() : String(Math.round(n)));
  return (
    <View style={styles.box}>
      <Text style={styles.head}>Guild quests</Text>
      <Text style={styles.sub}>New quests every Monday. Each one gives guild XP and a chest to everyone who helped.</Text>
      {data.quests.map((q) => {
        const info = INFO[q.id];
        if (!info) return null;
        const team = q.kind !== 'together';
        return (
          <View key={q.id} style={[styles.quest, q.done && styles.questDone, team && !q.done && styles.questTeam]}>
            <View style={styles.row}>
              <View style={[styles.tag, team && styles.tagTeam, q.kind === 'monthly' && styles.tagMonth]}>
                <Text style={[styles.tagText, team && { color: '#4A3200' }, q.kind === 'monthly' && { color: '#FFFFFF' }]}>{LABEL[q.kind]}</Text>
              </View>
              <Text style={styles.name} numberOfLines={1}>{info.name}</Text>
              {q.done ? <Text style={styles.doneText}>Done</Text> : null}
            </View>
            <Text style={styles.text}>{info.text(q.target)}</Text>
            <ProgressBar value={q.target ? q.progress / q.target : 0} height={8} color={q.done ? '#8FE3C0' : '#F2C14E'} />
            <Text style={styles.meta}>
              {fmt(q, q.progress)} / {fmt(q, q.target)} {info.unit}
            </Text>
            {q.done && !q.claimed ? (
              <PopIn>
                <Button primary label={q.kind === 'monthly' ? 'Open Gold chest' : 'Open guild chest'} onPress={() => claim(q)} />
              </PopIn>
            ) : null}
          </View>
        );
      })}
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#2A3366', borderRadius: 18, padding: 14, gap: 10 },
  head: { fontSize: 17, fontWeight: '800', color: '#FFF6D8' },
  sub: { fontSize: 12, fontWeight: '600', color: '#B9C2E8', marginTop: -6 },
  quest: { backgroundColor: '#232A55', borderRadius: 16, padding: 12, gap: 6, borderWidth: 2, borderColor: '#3D4785' },
  questTeam: { borderColor: '#F2C14E' },
  questDone: { borderColor: '#8FE3C0' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tag: { backgroundColor: '#3D4785', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  tagTeam: { backgroundColor: '#F2C14E' },
  tagMonth: { backgroundColor: '#8B6BD8' },
  tagText: { fontSize: 11, fontWeight: '600', color: '#C9D3FF' },
  name: { flex: 1, fontSize: 15, fontWeight: '700', color: '#FFF6D8' },
  doneText: { fontSize: 12, fontWeight: '600', color: '#8FE3C0' },
  text: { fontSize: 12, fontWeight: '600', color: '#B9C2E8' },
  meta: { fontSize: 11, fontWeight: '600', color: '#B9C2E8' },
  msg: { fontSize: 13, fontWeight: '600', color: '#8FE3C0' },
});
