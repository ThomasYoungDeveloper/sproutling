import React from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../components/ScaledText';
import { useGame } from '../state/GameContext';
import { useReveal } from '../components/RevealOverlay';
import EggSprite from '../components/EggSprite';
import { useIdleWobble, buzz } from '../components/fx';
import { colors, font, space } from '../theme';
import * as A from '../game/actions';

/** One spot per element: the starter egg can hatch any of them. */
const ELEMENTS = [
  { label: 'Flower', color: '#5DBB63' },
  { label: 'Moon', color: '#8E7CE0' },
  { label: 'Ember', color: '#FF8A4C' },
  { label: 'Tide', color: '#2E9BD6' },
];
const SPOTS = ELEMENTS.map((e) => e.color);

export default function StarterScreen() {
  const { state, apply } = useGame();
  const reveal = useReveal();
  const wobble = useIdleWobble();

  const hatch = () => {
    buzz('medium');
    const r = A.chooseStarter(state);
    apply(() => r.state);
    reveal({ kind: 'egg', rarity: 'common', pet: r.pet, isNew: true, title: 'Your first pet is hatching!', eggSpots: SPOTS });
  };

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.hero}>
        <Text style={styles.title}>Welcome to Sproutling!</Text>
        <Text style={styles.sub}>Here’s your very first egg. Nobody knows who’s inside. It could be any kind of pet!</Text>
      </View>
      <Pressable onPress={hatch} style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="button" accessibilityLabel="Hatch your first egg">
        <Animated.View style={wobble}>
          <EggSprite rarity="common" spots={SPOTS} size={170} />
        </Animated.View>
        <Text style={styles.label}>Mystery egg</Text>
        <View style={styles.els}>
          {ELEMENTS.map((e) => (
            <View key={e.label} style={[styles.el, { backgroundColor: e.color + '22' }]}>
              <View style={[styles.dot, { backgroundColor: e.color }]} />
              <Text style={[styles.elText, { color: e.color }]}>{e.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>Tap to hatch</Text>
        </View>
      </Pressable>
      <Text style={[font.small, { textAlign: 'center' }]}>Your pet grows as you walk, sleep well, drink water and eat your veggies.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 6, paddingVertical: space.md },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  sub: { fontSize: 15, color: colors.muted, textAlign: 'center', fontWeight: '600', maxWidth: 340 },
  card: { alignSelf: 'center', width: '100%', maxWidth: 360, backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 2, borderColor: colors.mint, padding: space.lg, alignItems: 'center', gap: space.sm },
  label: { fontSize: 20, fontWeight: '800', color: colors.ink },
  els: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  el: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  elText: { fontSize: 12, fontWeight: '600' },
  cta: { backgroundColor: colors.mint, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10, marginTop: space.xs },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
