import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { useGame } from '../state/GameContext';
import { Button, ProgressBar } from './ui';
import BadgeMedal from './BadgeMedal';
import { colors, font } from '../theme';
import { BADGE_BY_ID, TIERS, TIER_REWARD, badgeStatus, fmt, setShowcase, tiersEarned, type BadgeStatus } from '../game/badges';

const TIER_COLOR = ['#9AA7A2', '#8A6A3A', '#A0521E', '#5E6A78', '#9A6A00', '#6C4FD8'];
const rewardLabel = (i: number) => {
  const r = TIER_REWARD[i];
  return r.coins ? `${r.coins} coins` : `${r.chest![0].toUpperCase()}${r.chest!.slice(1)} chest${i === 4 ? ' and a rainbow frame' : ''}`;
};

/** Badges: every badge with its tier; tap one for its tier ladder; pick 3 to show on your profile. */
export default function AchievementsSheet({ onClose }: { onClose: () => void }) {
  const { state, apply } = useGame();
  const [open, setOpen] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const all = badgeStatus(state);
  const show = state.showcase ?? [];
  const x = open ? all.find((y) => y.b.id === open)! : null;
  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        {x ? (
          <Ladder x={x} onBack={() => setOpen(null)} />
        ) : (
          <>
            <Text style={font.title} accessibilityRole="header">Badges</Text>
            <Text style={font.small}>{tiersEarned(state)} tiers earned · {picking ? 'tap up to 3 to show on your profile' : 'tap a badge'}</Text>
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.grid}>
              {all.map((y) => {
                const on = show.includes(y.b.id);
                return (
                  <Pressable
                    key={y.b.id}
                    onPress={() => {
                      if (!picking) return setOpen(y.b.id);
                      if (!y.tier) return;
                      apply((s) => setShowcase(s, on ? show.filter((id) => id !== y.b.id) : [...show, y.b.id].slice(-3)));
                    }}
                    style={[styles.cell, picking && on && styles.cellOn]}
                    accessibilityRole="button"
                    accessibilityLabel={`${y.b.name}, ${y.tier ? TIERS[y.tier - 1].label : 'not earned yet'}`}
                  >
                    <BadgeMedal icon={y.b.icon} tier={y.tier} size={58} id={y.b.id} />
                    <Text style={styles.name} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{y.b.name}</Text>
                    <Text style={[styles.tier, { color: TIER_COLOR[y.tier] }]}>{y.tier ? TIERS[y.tier - 1].label : 'Not yet'}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label={picking ? 'Done' : 'Pick profile badges'} onPress={() => setPicking((p) => !p)} style={{ flex: 1 }} />
              <Button primary label="Close" onPress={onClose} style={{ flex: 1 }} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function Ladder({ x, onBack }: { x: BadgeStatus; onBack: () => void }) {
  const b = BADGE_BY_ID[x.b.id];
  const prev = x.tier ? b.steps[x.tier - 1] : 0;
  const pct = x.next ? (x.value - prev) / Math.max(1, x.next - prev) : 1;
  return (
    <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 10 }}>
      <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button"><Text style={styles.back}>‹ All badges</Text></Pressable>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <BadgeMedal icon={b.icon} tier={x.tier} size={110} id={`big-${b.id}`} />
        <Text style={font.h2}>{b.name}</Text>
        <Text style={font.small}>{x.tier ? TIERS[x.tier - 1].label : 'Not earned yet'} · {fmt(b, x.value)} {b.what.toLowerCase()}</Text>
      </View>
      {x.next ? (
        <View style={{ gap: 4 }}>
          <ProgressBar value={pct} height={10} color={colors.gold} />
          <Text style={[font.tiny, { textAlign: 'center' }]}>{fmt(b, x.next - x.value)} more to {TIERS[x.tier].label}</Text>
        </View>
      ) : (
        <Text style={[font.small, { textAlign: 'center', color: '#6C4FD8', fontWeight: '800' }]}>Every tier earned!</Text>
      )}
      {TIERS.map((t, i) => {
        const done = x.tier > i;
        const now = x.tier === i;
        return (
          <View key={t.id} style={[styles.row, !done && !now && { opacity: 0.6 }]}>
            <BadgeMedal icon={b.icon} tier={i + 1} size={40} id={`t-${b.id}-${i}`} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t.label} · {fmt(b, b.steps[i])}</Text>
              <Text style={font.tiny}>{rewardLabel(i)}</Text>
            </View>
            <Text style={[styles.rowState, { color: done ? colors.mintDark : '#A0521E' }]}>{done ? 'Earned' : now ? 'Next' : ''}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,30,35,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 10, maxHeight: '92%', width: '100%', maxWidth: 560, alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingVertical: 6 },
  cell: { width: 80, alignItems: 'center', gap: 2, padding: 4, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  cellOn: { borderColor: colors.gold, backgroundColor: '#FFF6DD' },
  name: { fontSize: 11, fontWeight: '600', color: colors.ink, textAlign: 'center' },
  tier: { fontSize: 10, fontWeight: '600' },
  back: { fontSize: 15, fontWeight: '700', color: colors.mintDark },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  rowState: { fontSize: 11, fontWeight: '600' },
});
