import { AdCard } from '../components/Ads';
import { useResetIn } from '../lib/useResetIn';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import { useTeam } from '../state/TeamContext';
import { Button, ProgressBar } from '../components/ui';
import { useReveal } from '../components/RevealOverlay';
import { useOverlay } from '../components/Overlay';
import { colors, font, space } from '../theme';
import { CHESTS, oddsFor, RAINBOW_STREAK } from '../game/loot';
import { RARITIES, RARITY_INFO } from '../game/rarity';
import { dailyQuests } from '../game/scoring';
import { FIND_EVERY, MAX_FINDS_PER_DAY, walkFindsToday } from '../game/walkFinds';
import * as A from '../game/actions';
import type { ChestKind } from '../game/types';
import ChestIcon from '../components/ChestIcon';

const CHEST_COLORS: Record<ChestKind, [string, string]> = {
  bronze: ['#C98A54', '#A86B3A'],
  silver: ['#C9D3DA', '#9AA8B2'],
  gold: ['#FFD25E', '#E3A81E'],
  rainbow: ['#FF9AD8', '#8A6BFF'],
};
const CHEST_SOFT: Record<ChestKind, string> = { bronze: '#FFE9D6', silver: '#E9EEF3', gold: '#FFF4CC', rainbow: '#F3E8FF' };
const BAR: Record<ChestKind | 'walk', string> = { bronze: '#E0924F', silver: '#8FA3B5', gold: '#E5A800', rainbow: '#B45FE0', walk: colors.mint };
const RANK: Record<ChestKind, number> = { bronze: 0, silver: 1, gold: 2, rainbow: 3 };

function ChestArt({ kind, size = 64 }: { kind: ChestKind; size?: number }) {
  return <ChestIcon kind={kind} size={size} />;
}

const WAYS: Record<ChestKind, string[]> = {
  bronze: ['Finish all 3 daily habits', 'Daily login, days 3 and 6', 'Walking finds and expeditions'],
  silver: ['Every 7-day streak', 'Daily login, day 7', 'Moon Mountain expeditions and lucky walking finds'],
  gold: ['Beat the weekly guild raid boss', 'Very lucky walking finds', 'Platinum in a ranked season'],
  rainbow: ['Every 30-day streak', 'Reach the top of the weekly Sky Tower', 'Diamond or Legend in a ranked season', 'A 1 in 40 chance when you open any Gold chest'],
};

function HowToEarnSheet({ onClose }: { onClose: () => void }) {
  const [odds, setOdds] = useState<ChestKind | null>(null);
  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <Text style={font.title}>How to earn chests</Text>
        <Text style={font.small}>Chests come from being active. They can never be bought.</Text>
        <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ gap: space.sm }}>
          {(Object.keys(CHESTS) as ChestKind[]).map((k) => (
            <View key={k} style={styles.howCard}>
              <View style={styles.howHead}>
                <View style={[styles.iconBox, { backgroundColor: CHEST_SOFT[k] }]}><ChestArt kind={k} size={34} /></View>
                <Text style={[font.h2, { flex: 1 }]}>{CHESTS[k].label}</Text>
                <Button small label={odds === k ? 'Hide odds' : 'See odds'} onPress={() => setOdds(odds === k ? null : k)} />
              </View>
              {WAYS[k].map((w) => (
                <Text key={w} style={styles.way}>✓  {w}</Text>
              ))}
              {odds === k ? (
                <View style={styles.odds}>
                  <Text style={font.small}>Coins: {CHESTS[k].coins[0]}–{CHESTS[k].coins[1]} · Egg chance: {CHESTS[k].eggChance}%{k === 'gold' ? ' · 1–2 Training Crystals' : k === 'silver' ? ' · 40% chance of a Training Crystal' : ''}</Text>
                  {RARITIES.map((r) => (
                    <View key={r} style={{ flexDirection: 'row' }}>
                      <Text style={[font.small, { color: RARITY_INFO[r].color, width: 90 }]}>{RARITY_INFO[r].label}</Text>
                      <Text style={[font.small, { color: colors.ink }]}>{oddsFor(k)[r]}% per chest</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </ScrollView>
        <Button primary label="Got it" onPress={onClose} />
      </View>
    </View>
  );
}

interface NextRow {
  key: string;
  kind: ChestKind | 'walk';
  title: string;
  count: string;
  pct: number;
  hint: string;
}

export default function ChestsScreen() {
  const { state, apply } = useGame();
  const { team } = useTeam();
  const reveal = useReveal();
  const overlay = useOverlay();
  const today = A.todayKey(state);

  const openOne = (id: string) => {
    const c = state.chests.find((x) => x.id === id);
    const r = A.openChestById(state, id);
    if (!c || !r) return;
    apply(() => r.state);
    reveal({ kind: 'chest', chest: c.kind, result: r.result });
  };

  const openAll = () => {
    // Open the best chests last so the biggest reveal is the finale.
    let s = state;
    const order = [...state.chests].sort((a, b) => RANK[a.kind] - RANK[b.kind]);
    for (const c of order) {
      const r = A.openChestById(s, c.id);
      if (!r) continue;
      s = r.state;
      reveal({ kind: 'chest', chest: c.kind, result: r.result });
    }
    apply(() => s);
  };

  // Progress toward the next chest of each kind.
  const quests = dailyQuests(A.today(state));
  const done = quests.filter((q) => q.done).length;
  const bronzeEarned = !!state.questChestDays[today];
  const left = quests.filter((q) => !q.done).map((q) => q.id === 'walk' ? 'steps' : q.id);
  const streak = A.streak(state);
  const intoWeek = streak % 7;
  const finds = walkFindsToday(state);
  const resetIn = useResetIn();
  const toNext = FIND_EVERY - (A.today(state).steps % FIND_EVERY);
  const rows: NextRow[] = [
    {
      key: 'bronze', kind: 'bronze', title: 'Bronze: today’s 3 habits',
      count: bronzeEarned ? 'Earned ✓' : `${done} of 3`, pct: bronzeEarned ? 1 : done / 3,
      hint: bronzeEarned ? `Next one in ${resetIn}` : left.length === 0 ? 'All done! Your chest is on its way' : left.length === 1 ? `Just your ${left[0]} left` : `Still to do: ${left.join(', ')}`,
    },
    {
      key: 'silver', kind: 'silver', title: 'Silver: 7-day streak',
      count: streak > 0 && intoWeek === 0 ? 'Earned ✓' : `Day ${intoWeek} of 7`, pct: streak > 0 && intoWeek === 0 ? 1 : intoWeek / 7,
      hint: streak > 0 && intoWeek === 0 ? `${streak}-day streak! Next one in 7 days` : `${7 - intoWeek} more day${7 - intoWeek === 1 ? '' : 's'} to go`,
    },
    team
      ? {
          key: 'gold', kind: 'gold', title: 'Gold: guild raid boss',
          count: team.claimed.includes('raid') ? 'Earned ✓' : `${Math.min(100, Math.round((team.raid.damage / team.raid.hp) * 100))}%`,
          pct: team.claimed.includes('raid') ? 1 : Math.min(1, team.raid.damage / team.raid.hp),
          hint: team.claimed.includes('raid') ? 'New boss on Monday' : `Ends Sunday · ${team.raid.hits_left} hit${team.raid.hits_left === 1 ? '' : 's'} left today`,
        }
      : { key: 'gold', kind: 'gold', title: 'Gold: guild raid boss', count: 'No guild', pct: 0, hint: 'Join a guild in the Social tab to fight the weekly boss' },
    {
      key: 'rainbow', kind: 'rainbow', title: 'Rainbow: 30-day streak',
      count: streak > 0 && streak % RAINBOW_STREAK === 0 ? 'Earned ✓' : `Day ${streak % RAINBOW_STREAK} of ${RAINBOW_STREAK}`,
      pct: streak > 0 && streak % RAINBOW_STREAK === 0 ? 1 : (streak % RAINBOW_STREAK) / RAINBOW_STREAK,
      hint: 'Super rare: always an Epic or Legendary egg. Also at the top of the Sky Tower.',
    },
    {
      key: 'walk', kind: 'walk', title: 'Walking finds',
      count: `${finds.found} of ${MAX_FINDS_PER_DAY} today`, pct: finds.found >= MAX_FINDS_PER_DAY ? 1 : 1 - toNext / FIND_EVERY,
      hint: finds.found >= MAX_FINDS_PER_DAY ? `All found today. More in ${resetIn}` : `Next lucky roll in ${toNext.toLocaleString()} steps`,
    },
  ];

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.vault}>
        <View style={styles.vaultHead}>
          <Text style={styles.vaultTitle}>Your chests</Text>
          <View style={[styles.countPill, !state.chests.length && { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
            <Text style={[styles.countText, !state.chests.length && { color: '#FFFFFF' }]}>{state.chests.length ? `${state.chests.length} to open` : 'All opened'}</Text>
          </View>
        </View>
        {state.chests.length === 0 ? (
          <View style={{ alignItems: 'center', gap: 6, paddingVertical: space.md }}>
            <View style={{ opacity: 0.45 }}><ChestArt kind="bronze" size={70} /></View>
            <Text style={styles.vaultEmpty}>No chests right now. See how close the next ones are below.</Text>
          </View>
        ) : (
          <View style={styles.chestGrid}>
            {state.chests.map((c) => (
              <Pressable key={c.id} onPress={() => openOne(c.id)} style={({ pressed }) => [styles.chestTile, pressed && { transform: [{ scale: 0.96 }] }]} accessibilityRole="button" accessibilityLabel={`Open ${CHESTS[c.kind].label}, ${c.reason}`}>
                <ChestArt kind={c.kind} size={60} />
                <Text style={styles.chestName}>{CHESTS[c.kind].label.replace(' chest', '')}</Text>
                <Text style={styles.chestWhy} numberOfLines={2}>{c.reason}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {state.chests.length > 1 ? (
          <Pressable onPress={openAll} style={({ pressed }) => [styles.openAll, pressed && { transform: [{ translateY: 2 }] }]} accessibilityRole="button">
            <Text style={styles.openAllText}>Open all {state.chests.length}</Text>
          </Pressable>
        ) : state.chests.length === 1 ? (
          <Text style={styles.tapHint}>Tap the chest to open it</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.nextHead}>
          <Text style={font.h2}>Next chests</Text>
          <Pressable onPress={() => overlay.open(<HowToEarnSheet onClose={overlay.close} />)} style={styles.howBtn} accessibilityRole="button" accessibilityLabel="How to earn chests">
            <Text style={styles.howBtnText}>ⓘ How to earn</Text>
          </Pressable>
        </View>
        {rows.map((r) => (
          <View key={r.key} style={styles.nextRow}>
            <View style={[styles.iconBox, { backgroundColor: r.kind === 'walk' ? colors.mintSoft : CHEST_SOFT[r.kind] }]}>
              {r.kind === 'walk' ? <Text style={{ fontSize: 22 }}>👟</Text> : <ChestArt kind={r.kind} size={34} />}
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={styles.nextTitle} numberOfLines={1}>{r.title}</Text>
                <Text style={styles.nextCount}>{r.count}</Text>
              </View>
              <ProgressBar value={r.pct} color={BAR[r.kind]} />
              <Text style={font.tiny}>{r.hint}</Text>
            </View>
          </View>
        ))}
      </View>
      <AdCard />
    </View>
  );
}

const styles = StyleSheet.create({
  vault: { backgroundColor: '#3A3470', borderRadius: 22, padding: space.md, gap: space.md },
  vaultHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vaultTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  countPill: { backgroundColor: colors.gold, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { fontSize: 12, fontWeight: '900', color: '#3B2A00' },
  vaultEmpty: { fontSize: 14, fontWeight: '800', color: '#DCD8F5', textAlign: 'center' },
  chestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chestTile: { width: '30%', flexGrow: 1, maxWidth: 160, alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 4 },
  chestName: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  chestWhy: { fontSize: 11, fontWeight: '800', color: '#DCD8F5', textAlign: 'center' },
  openAll: { backgroundColor: colors.gold, borderRadius: 16, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: '#C99212' },
  openAllText: { fontSize: 17, fontWeight: '900', color: '#3B2A00' },
  tapHint: { fontSize: 13, fontWeight: '800', color: '#DCD8F5', textAlign: 'center' },
  card: { backgroundColor: colors.card, borderRadius: 22, padding: space.md, gap: space.md, shadowColor: '#24323A', shadowOpacity: 0.08, shadowRadius: 0, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  nextHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  howBtn: { borderWidth: 2, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' },
  howBtnText: { fontSize: 13, fontWeight: '900', color: colors.mintDark },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  nextTitle: { flex: 1, fontSize: 15, fontWeight: '900', color: colors.ink },
  nextCount: { fontSize: 13, fontWeight: '900', color: colors.muted },
  howCard: { borderWidth: 2, borderColor: colors.line, borderRadius: 18, padding: space.sm, gap: 6 },
  howHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  way: { fontSize: 14, fontWeight: '800', color: colors.ink },
  odds: { backgroundColor: '#FAFBF9', borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: space.sm, gap: 3 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.6)', justifyContent: 'center', alignItems: 'center', padding: space.md, zIndex: 80 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: space.lg, width: '100%', maxWidth: 460, gap: space.sm },
});
