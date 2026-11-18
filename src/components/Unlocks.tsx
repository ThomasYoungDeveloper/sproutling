import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import { Button, Card } from './ui';
import { buzz, PopIn } from './fx';
import { colors, font, space } from '../theme';
import * as U from '../game/unlocks';

function LockIcon({ color = colors.muted, size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={5} y={10.5} width={14} height={10} rx={2.5} fill="none" stroke={color} strokeWidth={2.2} />
      <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

/** Shown where a feature will be once it opens: what it is, and how close you are. */
export function LockedCard({ feature, compact }: { feature: U.Feature; compact?: boolean }) {
  const { state } = useGame();
  const f = U.FEATURE_BY_ID[feature];
  const xp = U.xpToLevel(state, f.level);
  return (
    <Card style={[styles.locked, compact && { padding: space.md }]}>
      <View style={styles.row}>
        <View style={styles.lockBubble}><LockIcon /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.lockTitle}>{f.name} open at level {f.level}</Text>
          <Text style={font.small}>{f.text}</Text>
          <Text style={styles.lockMeta}>Your best pet is level {U.topLevel(state)} · {xp.toLocaleString()} XP to go</Text>
        </View>
      </View>
    </Card>
  );
}

/** A sheet for tapping something that's still locked (like the shop). */
export function LockedSheet({ feature, onClose }: { feature: U.Feature; onClose: () => void }) {
  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <LockedCard feature={feature} />
        <Button label="OK" primary onPress={onClose} />
      </View>
    </View>
  );
}

/** One card when something new opens: what it is and a button to go try it. */
export function UnlockCard({ onGo }: { onGo: (where: U.FeatureInfo['go']) => void }) {
  const { state, apply } = useGame();
  const f = U.newUnlock(state);
  if (!f) return null;
  const done = () => apply((s) => U.markSeen(s, f.id));
  return (
    <PopIn>
      <Card style={styles.newCard}>
        <Text style={styles.newTag}>NEW AT LEVEL {f.level}</Text>
        <Text style={styles.newTitle}>{f.title}</Text>
        <Text style={[font.small, { color: '#36505F' }]}>{f.text}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <Button small label="Later" onPress={done} />
          <Button
            small
            primary
            label="Try it now"
            onPress={() => {
              buzz('success');
              done();
              onGo(f.go);
            }}
          />
        </View>
      </Card>
    </PopIn>
  );
}

/** "Next: Trips at level 3" for the Today card. */
export function NextUnlockLine() {
  const { state } = useGame();
  const f = U.nextUnlock(state);
  if (!f) return null;
  return (
    <View style={styles.next}>
      <LockIcon size={14} color="#5C6F69" />
      <Text style={styles.nextText} numberOfLines={1}>
        Next unlock: {f.name} at level {f.level} ({U.xpToLevel(state, f.level).toLocaleString()} XP to go)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  locked: { backgroundColor: '#F3F6F4', borderWidth: 2, borderColor: '#DCE6E1', borderStyle: 'dashed' },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  lockBubble: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E4ECE8', alignItems: 'center', justifyContent: 'center' },
  lockTitle: { fontSize: 16, fontWeight: '900', color: colors.ink, marginBottom: 2 },
  lockMeta: { fontSize: 12, fontWeight: '800', color: colors.mintDark, marginTop: 4 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.5)', justifyContent: 'center', padding: space.lg, zIndex: 80 },
  sheet: { gap: space.md, width: '100%', maxWidth: 420, alignSelf: 'center' },
  newCard: { backgroundColor: '#FFF4D6', borderWidth: 2, borderColor: '#F2C27B', gap: 4 },
  newTag: { fontSize: 11, fontWeight: '900', color: '#B06A00', letterSpacing: 1 },
  newTitle: { fontSize: 19, fontWeight: '900', color: colors.ink },
  next: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nextText: { flex: 1, fontSize: 12, fontWeight: '800', color: '#5C6F69' },
});
