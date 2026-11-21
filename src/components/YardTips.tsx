import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '../state/GameContext';
import * as A from '../game/actions';
import * as C from '../game/care';
import { Button } from './ui';
import { colors } from '../theme';
import { play } from '../lib/sound';
import { remindersSupported, setRemindersOn } from '../lib/remindersState';

/** Which yard button is glowing for the first-day tips ('feed', 'play' or 'snack'), shared with PetScene. */
export type YardTip = 'feed' | 'play' | 'snack' | null;
let current: YardTip = null;
const listeners = new Set<() => void>();
function setTip(t: YardTip) {
  current = t;
  listeners.forEach((l) => l());
}
export function useYardTip(): YardTip {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return current;
}

/**
 * First-day tips on the real yard, one at a time: Feed, then Play, then Snack. The matching button glows,
 * and each tip moves on when you do it (or tap Next). Ends by offering reminders.
 */
export default function YardTips() {
  const { state, apply } = useGame();
  const insets = useSafeAreaInsets();
  const name = A.activePet(state)?.nickname ?? 'your pet';
  const tasks = C.careTasks(A.today(state));
  const [i, setI] = useState(0);
  const tips: { id: Exclude<YardTip, null>; title: string; text: string; chips: string[] }[] = [
    { id: 'feed', title: `Feeding keeps ${name} happy`, text: 'Tap Feed (or the bowl) once a day.', chips: ['+10% XP today', 'Free every day', 'Keeps the mood up'] },
    { id: 'play', title: `Play with ${name}`, text: 'Tap Play and pick a toy. Play 3 times a day.', chips: ['+10% XP today', 'Drag a toy into the yard'] },
    { id: 'snack', title: 'Snacks are a treat', text: 'Give one snack a day from your bag.', chips: ['+10% XP today', 'Snacks live in your bag'] },
  ];
  const last = i >= tips.length;
  const tip = tips[Math.min(i, tips.length - 1)];
  const doneNow = !last && tasks[i]?.done;

  useEffect(() => {
    setTip(last ? null : tip.id);
    return () => setTip(null);
  }, [i, last]);
  // Doing the thing moves the tip on.
  useEffect(() => {
    if (doneNow) {
      play('chime');
      const t = setTimeout(() => setI((n) => n + 1), 900);
      return () => clearTimeout(t);
    }
  }, [doneNow]);

  const finish = () => {
    setTip(null);
    apply((s) => ({ ...s, tutorialDone: true }));
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: 96 + insets.bottom }]}>
        <View style={styles.card}>
          {last ? (
            <>
              <Text style={styles.title}>You’re all set!</Text>
              <Text style={styles.text}>{remindersSupported ? `Want a nudge? We’ll remind you about your streak, ready eggs and when ${name} is home from a trip. Never more than one habit reminder a day.` : `Walk, drink water and sleep well, and ${name} grows. More of the game opens as you level up.`}</Text>
              {remindersSupported ? (
                <View style={{ gap: 8 }}>
                  <Button primary label="Turn on reminders" onPress={async () => { await setRemindersOn(true); finish(); }} />
                  <Button label="Maybe later" onPress={finish} />
                </View>
              ) : (
                <Button primary label="Let’s go!" onPress={finish} />
              )}
            </>
          ) : (
            <>
              <View style={styles.head}>
                <Text style={styles.count}>Tip {i + 1} of {tips.length}</Text>
                <Pressable onPress={finish} hitSlop={10} accessibilityRole="button" accessibilityLabel="Skip tips">
                  <Text style={styles.skip}>Skip</Text>
                </Pressable>
              </View>
              <Text style={styles.title}>{doneNow ? 'Nice!' : tip.title}</Text>
              <Text style={styles.text}>{tip.text}</Text>
              <View style={styles.chips}>
                {tip.chips.map((c) => (
                  <View key={c} style={styles.chip}><Text style={styles.chipText}>{c}</Text></View>
                ))}
              </View>
              <Pressable onPress={() => setI(i + 1)} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'flex-end' }}>
                <Text style={styles.next}>Next</Text>
              </Pressable>
            </>
          )}
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 80 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, gap: 8, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { fontSize: 13, fontWeight: '900', color: colors.mintDark, letterSpacing: 0.5 },
  skip: { fontSize: 14, fontWeight: '900', color: colors.muted },
  title: { fontSize: 19, fontWeight: '900', color: colors.ink },
  text: { fontSize: 15, fontWeight: '700', color: '#4E615B' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: '#FFF1DC', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 13, fontWeight: '900', color: '#9A5B12' },
  next: { fontSize: 15, fontWeight: '900', color: colors.mintDark, paddingVertical: 2 },
});
