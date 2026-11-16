import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../state/GameContext';
import { useReveal } from '../components/RevealOverlay';
import EggSprite from '../components/EggSprite';
import { useIdleWobble, buzz } from '../components/fx';
import { colors, font, space } from '../theme';
import * as A from '../game/actions';
import type { Element } from '../game/types';

const EGGS: { el: Element; label: string; color: string; blurb: string }[] = [
  { el: 'flower', label: 'Flower egg', color: '#5DBB63', blurb: 'Food friends and nature spirits' },
  { el: 'moon', label: 'Moon egg', color: '#8E7CE0', blurb: 'Ghosts, gadgets and night owls' },
  { el: 'ember', label: 'Ember egg', color: '#FF8A4C', blurb: 'Fighters, fire and big energy' },
  { el: 'tide', label: 'Tide egg', color: '#2E9BD6', blurb: 'Water spirits and sea snacks' },
];

function EggChoice({ egg, onPick }: { egg: (typeof EGGS)[number]; onPick: () => void }) {
  const wobble = useIdleWobble();
  return (
    <Pressable onPress={onPick} style={({ pressed }) => [styles.card, { borderColor: egg.color }, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="button" accessibilityLabel={`Choose the ${egg.label}`}>
      <Animated.View style={wobble}>
        <EggSprite rarity="common" color={egg.color} size={92} />
      </Animated.View>
      <Text style={[styles.label, { color: egg.color }]}>{egg.label}</Text>
      <Text style={styles.blurb}>{egg.blurb}</Text>
    </Pressable>
  );
}

export default function StarterScreen() {
  const { state, apply } = useGame();
  const reveal = useReveal();

  const pick = (el: Element) => {
    const color = EGGS.find((e) => e.el === el)!.color;
    buzz('medium');
    const r = A.chooseStarter(state, el);
    apply(() => r.state);
    reveal({ kind: 'egg', rarity: 'common', pet: r.pet, isNew: true, title: 'Your first pet is hatching!', eggColor: color });
  };

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.hero}>
        <Text style={styles.title}>Welcome to Sproutling!</Text>
        <Text style={styles.sub}>Pick an egg. Every egg hides a different surprise pet, so even the same egg can hatch someone new.</Text>
      </View>
      <View style={styles.grid}>
        {EGGS.map((e) => (
          <EggChoice key={e.el} egg={e} onPick={() => pick(e.el)} />
        ))}
      </View>
      <Text style={[font.small, { textAlign: 'center' }]}>Your pet grows as you walk, sleep well, drink water and eat your veggies.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 6, paddingVertical: space.md },
  title: { fontSize: 26, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  sub: { fontSize: 15, color: colors.muted, textAlign: 'center', fontWeight: '600', maxWidth: 340 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'center' },
  card: { width: '46%', minWidth: 150, flexGrow: 1, maxWidth: 220, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 2, padding: space.md, alignItems: 'center', gap: 4 },
  label: { fontSize: 17, fontWeight: '900' },
  blurb: { fontSize: 12, color: colors.muted, fontWeight: '700', textAlign: 'center' },
});
