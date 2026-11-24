import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { useGame } from '../state/GameContext';
import { useAuth } from '../state/AuthContext';
import { useOverlay } from './Overlay';
import { FitSheet, Button } from './ui';
import LevelBadge from './LevelBadge';
import GuildTag from './GuildTag';
import { accountProgress, XP_FOR } from '../game/account';
import { FEATURES } from '../game/unlocks';
import { colors, font } from '../theme';
import { markSeenNew, useIsNew } from '../lib/newDots';

const ROAD: { level: number; text: string }[] = [
  ...FEATURES.reduce<{ level: number; text: string }[]>((out, f) => {
    const hit = out.find((r) => r.level === f.level);
    if (hit) hit.text += ` and ${f.name}`;
    else out.push({ level: f.level, text: f.name });
    return out;
  }, []),
  { level: 10, text: 'Bronze level badge' },
  { level: 20, text: 'Silver level badge' },
  { level: 30, text: 'Gold level badge' },
].sort((a, b) => a.level - b.level);

const EARN: [string, string][] = [
  ['Hit your step goal', `+${XP_FOR.stepGoal}`],
  ['Every 1,000 steps', `+${XP_FOR.per1000Steps}`],
  ['Log water or sleep', `+${XP_FOR.water} each`],
  ['Play any day', `+${XP_FOR.dayPlayed}`],
  ['Hatch an egg', `+${XP_FOR.hatch}`],
  ['Win a battle', `+${XP_FOR.battleWin}`],
  ['Send a pet on a trip', `+${XP_FOR.trip}`],
  ['7 days in a row', `+${XP_FOR.streak7}`],
];

function Bar({ pct }: { pct: number }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%` }]} />
    </View>
  );
}

/** Social › Friends: your account level, name and guild. Tap for how to earn XP and what each level opens. */
export function AccountLevelCard() {
  const { state } = useGame();
  const { username, user } = useAuth();
  const overlay = useOverlay();
  const p = accountProgress(state);
  const isNew = useIsNew('level');
  return (
    <Pressable onPress={() => { markSeenNew('level'); overlay.open(<AccountLevelSheet onClose={overlay.close} />); }} style={styles.card} accessibilityRole="button" accessibilityLabel={`Level ${p.level}. Open your level`}>
      <View style={styles.row}>
        <LevelBadge level={p.level} size={56} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>{username ?? 'You'}</Text>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Text style={font.small}>Level {p.level}</Text>
            <GuildTag userId={user?.id} small />
          </View>
        </View>
        {isNew ? <View style={styles.newTag}><Text style={styles.newTagText}>NEW</Text></View> : <Text style={styles.chev}>›</Text>}
      </View>
      <Bar pct={p.into / p.need} />
      <View style={styles.between}>
        <Text style={styles.meta}>{p.into.toLocaleString()} / {p.need.toLocaleString()} XP</Text>
        <Text style={styles.meta}>Next: Level {p.level + 1}</Text>
      </View>
    </Pressable>
  );
}

export function AccountLevelSheet({ onClose }: { onClose: () => void }) {
  const { state } = useGame();
  const { username } = useAuth();
  const p = accountProgress(state);
  return (
    <View style={styles.backdrop}>
      <FitSheet onClose={onClose}>
        <View style={styles.sheet}>
          <View style={styles.row}>
            <LevelBadge level={p.level} size={52} />
            <Text style={[font.h2, { flex: 1 }]} accessibilityRole="header">{username ? `${username}’s Level (${p.level})` : `Your Level (${p.level})`}</Text>
          </View>
          <Bar pct={p.into / p.need} />
          <Text style={styles.meta}>{(p.need - p.into).toLocaleString()} XP to Level {p.level + 1}</Text>
          <Text style={styles.head}>Earn XP by playing</Text>
          {EARN.map(([t, xp]) => (
            <View key={t} style={styles.between}>
              <Text style={styles.line}>{t}</Text>
              <Text style={styles.xp}>{xp}</Text>
            </View>
          ))}
          <Text style={font.tiny}>Only you earn it. Trading pets never changes it, and it never goes down. Every level up pays 100 coins, plus a Silver chest every 5 levels.</Text>
          <Text style={styles.head}>Your level road</Text>
          {ROAD.map((r) => {
            const open = p.level >= r.level;
            return (
              <View key={r.level} style={[styles.road, !open && { opacity: 0.55 }]}>
                <LevelBadge level={r.level} size={30} />
                <Text style={[styles.line, { flex: 1 }]}>{r.text}</Text>
                <Text style={[styles.meta, open && { color: colors.mintDark }]}>{open ? 'Open' : ''}</Text>
              </View>
            );
          })}
          <Text style={font.tiny}>Joining a guild or group needs no level.</Text>
          <Button label="Close" onPress={onClose} />
        </View>
      </FitSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 16, gap: 8 , borderWidth: 1, borderColor: colors.line},
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 20, fontWeight: '800', color: colors.ink },
  newTag: { backgroundColor: '#FF8A5C', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  newTagText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  chev: { fontSize: 26, color: '#9AA7A2' },
  track: { height: 10, borderRadius: 10, backgroundColor: '#E4EEEA', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 10, backgroundColor: colors.mint },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  meta: { fontSize: 12, fontWeight: '600', color: colors.muted },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,30,35,0.5)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 9, width: '100%', maxWidth: 560, alignSelf: 'center' },
  head: { fontSize: 16, fontWeight: '700', color: colors.ink, marginTop: 6 },
  line: { fontSize: 14, fontWeight: '700', color: colors.ink },
  xp: { fontSize: 14, fontWeight: '700', color: colors.mintDark },
  road: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
