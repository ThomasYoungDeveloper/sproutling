import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { useGame } from '../state/GameContext';
import { FitSheet, Button } from './ui';
import { colors, font, space } from '../theme';
import * as B from '../game/battle';
import * as St from '../game/stats';

/** Tap a habit buff: what it does, what you did today, and how to earn it. */
export function BuffSheet({ id, onClose }: { id: B.BuffInfo['id']; onClose: () => void }) {
  const { state } = useGame();
  const b = B.buffInfo(state).find((x) => x.id === id);
  if (!b) return null;
  return (
    <Sheet onClose={onClose}>
      <Text style={[styles.tag, { color: b.have ? colors.mintDark : colors.muted }]}>{b.have ? 'ON TODAY' : 'NOT YET TODAY'}</Text>
      <Text style={styles.title}>{b.label}</Text>
      <Text style={styles.effect}>{b.effect} in battles</Text>
      <View style={styles.box}>
        <Text style={styles.label}>Today</Text>
        <Text style={font.body}>{b.today}</Text>
      </View>
      <View style={styles.box}>
        <Text style={styles.label}>How to earn it</Text>
        <Text style={font.body}>{b.how}{b.healthOnly ? ' Needs Apple Health.' : ''}</Text>
      </View>
      <Text style={font.tiny}>Habit buffs reset each day, so they always show how you took care of yourself today.</Text>
    </Sheet>
  );
}

/** Tap a pet's nature (stored as its personality): born with it, not earned. */
export function PersonalitySheet({ personality, name, onClose }: { personality: St.Personality; name: string; onClose: () => void }) {
  const p = St.PERSONALITIES[personality];
  return (
    <Sheet onClose={onClose}>
      <Text style={[styles.tag, { color: '#6E56CF' }]}>NATURE · BORN WITH IT</Text>
      <Text style={styles.title}>{p.label}</Text>
      <Text style={styles.effect}>{p.text}</Text>
      <View style={styles.box}>
        <Text style={font.body}>
          This is {name}’s nature. Every pet is born with one of six natures, and it never changes.{St.NATURE_STAT[personality] ? ` Its favored stat grows faster every time it levels up, on its own (training points are extra), and gets 10% more on top.` : ''} It’s one reason two pets of the same kind can play differently. Buffs from your habits (like Rested or Hydrated) are separate and reset each day.
        </Text>
      </View>
      <Text style={font.tiny}>All six: {Object.values(St.PERSONALITIES).map((x) => `${x.label} (${x.text})`).join(', ')}.</Text>
    </Sheet>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <View style={styles.backdrop}>
      <FitSheet onClose={onClose}>
      <View style={styles.sheet}>
        {children}
        <Button label="Got it" primary onPress={onClose} />
      </View>
      </FitSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.55)', justifyContent: 'center', padding: space.lg, zIndex: 95 },
  sheet: { backgroundColor: colors.card, borderRadius: 24, padding: space.lg, gap: 8, width: '100%', maxWidth: 420, alignSelf: 'center' },
  tag: { fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  effect: { fontSize: 15, fontWeight: '700', color: colors.mintDark },
  box: { backgroundColor: '#F2F6F4', borderRadius: 14, padding: 12, gap: 2 },
  label: { fontSize: 12, fontWeight: '600', color: colors.muted },
});
