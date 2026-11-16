import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import { useOverlay } from './Overlay';
import { Button, Card } from './ui';
import { buzz, PopIn } from './fx';
import { colors, font, space } from '../theme';
import { dailyQuests, ELEMENT_HABIT, scoreDay } from '../game/scoring';
import * as A from '../game/actions';
import * as C from '../game/care';
import { healthProvider, isVerified } from '../lib/health';

type Habit = 'steps' | 'water' | 'sleep';

const INFO: Record<Habit, { icon: string; label: string; color: string; goal: number }> = {
  steps: { icon: '👟', label: 'steps', color: '#2FB58A', goal: 8000 },
  water: { icon: '💧', label: 'glasses', color: '#3D8FD6', goal: 6 },
  sleep: { icon: '🌙', label: 'sleep', color: '#7F77DD', goal: 7 },
};

/** Today's three habits as tiles with progress rings. Tap a tile to log it. */
export default function TodayCard() {
  const { state } = useGame();
  const overlay = useOverlay();
  const d = A.today(state);
  const el = A.activeElement(state);
  const eb = el ? ELEMENT_HABIT[el] : null;
  const pet = A.activePet(state);
  const quests = dailyQuests(d);
  const allDone = quests.every((q) => q.done);
  const value: Record<Habit, number> = { steps: d.steps, water: d.water, sleep: d.sleepHours };
  const shown: Record<Habit, string> = { steps: d.steps.toLocaleString(), water: `${d.water} / 8`, sleep: `${d.sleepHours} h` };
  const done: Record<Habit, boolean> = { steps: quests[0].done, water: quests[1].done, sleep: quests[2].done };

  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Today</Text>
          <Text style={styles.subtitle}>{allDone ? 'All 3 done! Bronze chest earned' : 'Finish all 3 for a Bronze chest'}</Text>
        </View>
        {eb?.habit === 'quests' && pet ? (
          <View style={[styles.mult, { position: 'relative', top: 0, right: 0 }]}><Text style={styles.multText}>2× quest XP</Text></View>
        ) : null}
        <PopIn key={C.boostedTotal(d, el)} from={0.7}>
          <View style={styles.xp}><Text style={styles.xpText}>+{C.boostedTotal(d, el)} XP</Text></View>
        </PopIn>
      </View>
      <View style={styles.tiles}>
        {(['steps', 'water', 'sleep'] as Habit[]).map((h) => {
          const boosted = eb?.habit === h;
          return (
            <Pressable
              key={h}
              onPress={() => {
                buzz('light');
                overlay.open(<LogSheet habit={h} onClose={overlay.close} />);
              }}
              style={({ pressed }) => [styles.tile, boosted && { borderColor: INFO[h].color, borderWidth: 2, backgroundColor: '#F4F3FE' }, pressed && { transform: [{ scale: 0.96 }] }]}
              accessibilityRole="button"
              accessibilityLabel={`${INFO[h].label}: ${shown[h]}${done[h] ? ', done' : ''}${boosted ? `, ${pet?.nickname ?? 'your pet'} boosts this` : ''}. Tap to log`}
            >
              {boosted ? (
                <View style={[styles.mult, { backgroundColor: INFO[h].color }]}><Text style={styles.multText}>{eb!.mult === 2 ? '2×' : `${eb!.mult}×`} XP</Text></View>
              ) : null}
              <Ring frac={Math.min(1, value[h] / INFO[h].goal)} color={INFO[h].color} done={done[h]} icon={INFO[h].icon} />
              <Text style={styles.value}>{shown[h]}</Text>
              <Text style={styles.label}>{INFO[h].label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

function Ring({ frac, color, done, icon }: { frac: number; color: string; done: boolean; icon: string }) {
  const r = 22;
  const len = 2 * Math.PI * r;
  return (
    <View style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={52} height={52} viewBox="0 0 52 52" style={StyleSheet.absoluteFill as any}>
        <Circle cx={26} cy={26} r={r} fill="none" stroke="#DCE7E2" strokeWidth={5} />
        {frac > 0 ? <Circle cx={26} cy={26} r={r} fill="none" stroke={color} strokeWidth={5} strokeDasharray={`${len * frac} ${len}`} strokeLinecap="round" transform="rotate(-90 26 26)" /> : null}
        {done ? <Path d="M19 27l5 5 9-10" fill="none" stroke="#1E8A68" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" /> : null}
      </Svg>
      {done ? null : <Text style={{ fontSize: 18 }}>{icon}</Text>}
    </View>
  );
}

/** The sheet that opens from a habit tile: log steps, water or sleep. */
function LogSheet({ habit, onClose }: { habit: Habit; onClose: () => void }) {
  const { state, apply } = useGame();
  const d = A.today(state);
  const el = A.activeElement(state);
  const score = scoreDay(d, el);
  const q = dailyQuests(d);
  const title = { steps: 'Steps', water: 'Water', sleep: 'Sleep' }[habit];
  const xp = { steps: score.steps, water: score.water, sleep: score.sleep }[habit];
  const questDone = { steps: q[0].done, water: q[1].done, sleep: q[2].done }[habit];
  const line = {
    steps: `${d.steps.toLocaleString()} steps today. Walking also warms your eggs.`,
    water: `${d.water} of 8 glasses. Tap a glass to fill it.`,
    sleep: `${d.sleepHours} hours last night. The sweet spot is 7–9 hours.`,
  }[habit];
  const goal = { steps: 'Quest done at 8,000 steps.', water: 'Quest done at 6 glasses.', sleep: 'Quest done at 7 hours.' }[habit];

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.grab} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 26 }}>{INFO[habit].icon}</Text>
          <Text style={[font.title, { flex: 1 }]}>{title}</Text>
          <PopIn key={xp} from={0.7}>
            <View style={styles.xp}><Text style={styles.xpText}>+{xp} XP</Text></View>
          </PopIn>
        </View>
        <Text style={[font.body, { fontWeight: '800', color: colors.muted }]}>{line}</Text>

        {habit !== 'water' && isVerified(healthProvider()) ? (
          <View style={styles.goal}>
            <Text style={styles.goalText}>❤️ Synced from Apple Health. Walk and sleep with your phone or watch and it fills in by itself.</Text>
          </View>
        ) : habit === 'steps' ? (
          <View style={styles.controls}>
            {[500, 1000, 5000].map((n) => (
              <Button key={n} label={`+${n.toLocaleString()}`} onPress={() => { buzz(); apply((s) => A.addSteps(s, n)); }} style={{ flex: 1 }} />
            ))}
          </View>
        ) : habit === 'sleep' ? (
          <View style={styles.controls}>
            <Button label="− 30 min" onPress={() => { buzz(); apply((s) => A.setSleep(s, d.sleepHours - 0.5)); }} style={{ flex: 1 }} />
            <Button label="+ 30 min" onPress={() => { buzz(); apply((s) => A.setSleep(s, d.sleepHours + 0.5)); }} style={{ flex: 1 }} />
          </View>
        ) : (
          <View style={styles.glasses}>
            {Array.from({ length: 8 }, (_, i) => (
              <Glass key={i} on={i < d.water} index={i} onPress={() => { buzz(); apply((s) => A.setWater(s, d.water === i + 1 ? i : i + 1)); }} />
            ))}
          </View>
        )}

        <View style={[styles.goal, questDone && { backgroundColor: colors.mintSoft }]}>
          <Text style={[styles.goalText, questDone && { color: colors.mintDark }]}>{questDone ? `✓ ${goal} Keep going for more XP.` : goal}</Text>
        </View>
        {isVerified(healthProvider()) ? null : <Text style={font.tiny}>Preview build: you log habits by hand. The phone app fills in steps and sleep from Apple Health or Health Connect.</Text>}
        <Button primary label="Done" onPress={onClose} />
      </View>
    </View>
  );
}

/** A water glass that fills with a little bounce. */
function Glass({ on, index, onPress }: { on: boolean; index: number; onPress: () => void }) {
  const v = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: on ? 1 : 0, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [on]);
  return (
    <Pressable accessibilityLabel={`${index + 1} glasses`} onPress={onPress} style={[styles.glass, on && styles.glassOn]}>
      <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1.25, 1] }) }] }}>
        <Svg width={26} height={30} viewBox="0 0 28 32">
          <Path d="M5 4 H23 L20.5 28 Q20 30 18 30 H10 Q8 30 7.5 28 Z" fill={on ? '#8FC9F0' : '#fff'} stroke={on ? '#2E7FB8' : '#B9CDD6'} strokeWidth={2.2} strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 19, fontWeight: '900', color: colors.ink },
  subtitle: { fontSize: 12, fontWeight: '800', color: colors.muted },
  xp: { backgroundColor: colors.mintSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  xpText: { color: colors.mintDark, fontSize: 14, fontWeight: '900' },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, borderWidth: 1, borderColor: colors.line, backgroundColor: '#F6FAF8', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', gap: 3 },
  value: { fontSize: 16, fontWeight: '900', color: colors.ink },
  label: { fontSize: 12, fontWeight: '800', color: colors.muted },
  mult: { position: 'absolute', top: -9, right: -5, backgroundColor: '#7F77DD', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, zIndex: 2 },
  multText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.5)', justifyContent: 'flex-end', alignItems: 'center', zIndex: 50 },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.lg, paddingTop: 10, gap: space.md, width: '100%', maxWidth: 520 },
  grab: { width: 44, height: 5, borderRadius: 999, backgroundColor: colors.line, alignSelf: 'center' },
  controls: { flexDirection: 'row', gap: space.sm },
  glasses: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  glass: { width: '21.5%', height: 60, borderRadius: 14, borderWidth: 2, borderColor: '#B9DAF3', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  glassOn: { backgroundColor: '#E2F1FC', borderColor: '#8FC3EE' },
  goal: { backgroundColor: '#EAF3FC', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  goalText: { fontSize: 14, fontWeight: '800', color: '#1F5C94' },
});
