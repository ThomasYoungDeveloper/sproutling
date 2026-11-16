import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import { Card, SectionHead, Button, Chip } from '../components/ui';
import PetScene from '../components/PetScene';
import { useOverlay } from '../components/Overlay';
import { ShopSheet, WardrobeSheet } from '../components/ShopSheets';
import { buzz, PopIn } from '../components/fx';
import { colors, font, space } from '../theme';
import { scoreDay, dailyQuests } from '../game/scoring';
import * as A from '../game/actions';
import * as C from '../game/care';

export default function HomeScreen({ onNavigate }: { onNavigate?: (tab: 'eggs' | 'chests') => void }) {
  const { state, apply } = useGame();
  const d = A.today(state);
  const score = scoreDay(d);
  const pet = A.activePet(state);
  const mult = C.careMultiplier(d);
  const todo = C.reminders(state).slice(0, 4);
  const overlay = useOverlay();
  const openShop = () => overlay.open(<ShopSheet onClose={overlay.close} onWardrobe={openWardrobe} />);
  const openWardrobe = () => overlay.open(<WardrobeSheet onClose={overlay.close} onShop={openShop} />);

  const act = (r: C.Reminder) => {
    buzz('light');
    if (r.action === 'feed') apply(C.feed);
    else if (r.action === 'play') apply(C.play);
    else if (r.action === 'treat') apply(C.treat);
    else if (r.action === 'eggs' || r.action === 'chests') onNavigate?.(r.action);
  };

  return (
    <View style={{ gap: space.md }}>
      {pet ? <PetScene onShop={openShop} onDressUp={openWardrobe} /> : null}

      {todo.length > 0 && (
        <Card>
          <SectionHead title="Reminders" meta={pet ? `${pet.nickname}’s wishes` : undefined} />
          {todo.map((r) => {
            const tappable = ['feed', 'play', 'treat', 'eggs', 'chests'].includes(r.action ?? '');
            return (
              <Pressable key={r.id} onPress={tappable ? () => act(r) : undefined} style={({ pressed }) => [styles.reminder, pressed && tappable && { transform: [{ scale: 0.98 }] }]} accessibilityRole={tappable ? 'button' : undefined}>
                <Text style={{ fontSize: 20 }}>{r.icon}</Text>
                <Text style={[font.body, { flex: 1, fontWeight: '700' }]}>{r.text}</Text>
                {tappable ? <Text style={styles.go}>{r.action === 'eggs' || r.action === 'chests' ? 'Go ›' : 'Do it'}</Text> : null}
              </Pressable>
            );
          })}
        </Card>
      )}

      <Card>
        <SectionHead title="Daily quests" meta="+15 XP each" />
        {dailyQuests(d).map((q) => (
          <View key={q.id} style={styles.quest}>
            {q.done ? (
              <PopIn key="done">
                <View style={[styles.qbox, styles.qdone]}><Text style={styles.check}>✓</Text></View>
              </PopIn>
            ) : (
              <View style={styles.qbox} />
            )}
            <Text style={[font.body, { flex: 1, fontWeight: '700' }, q.done && { color: colors.muted, textDecorationLine: 'line-through' }]}>{q.label}</Text>
            <Text style={font.small}>{q.progress}</Text>
          </View>
        ))}
        <Text style={font.small}>Finish all three to earn a Bronze chest.</Text>
      </Card>

      <Card>
        <SectionHead title="Today" meta={mult > 1 ? `+${C.boostedTotal(d)} XP (×${mult.toFixed(1)})` : `+${score.total} XP`} />

        <Habit icon="👟" label={`${d.steps.toLocaleString()} steps`} sub="Also warms your eggs" xp={score.steps}>
          <Button small label="+500" onPress={() => { buzz(); apply((s) => A.addSteps(s, 500)); }} />
          <Button small label="+1,000" onPress={() => { buzz(); apply((s) => A.addSteps(s, 1000)); }} />
          <Button small label="+5,000" onPress={() => { buzz(); apply((s) => A.addSteps(s, 5000)); }} />
        </Habit>

        <Habit icon="🌙" label={`${d.sleepHours} h sleep`} sub="Sweet spot 7–9 hours" xp={score.sleep}>
          <Button small label="− 30 min" onPress={() => { buzz(); apply((s) => A.setSleep(s, d.sleepHours - 0.5)); }} />
          <Button small label="+ 30 min" onPress={() => { buzz(); apply((s) => A.setSleep(s, d.sleepHours + 0.5)); }} />
        </Habit>

        <Habit icon="💧" label={`${d.water} of 8 glasses`} sub="Tap a glass to fill it" xp={score.water}>
          {Array.from({ length: 8 }, (_, i) => (
            <Glass key={i} on={i < d.water} index={i} onPress={() => { buzz(); apply((s) => A.setWater(s, d.water === i + 1 ? i : i + 1)); }} />
          ))}
        </Habit>
        <Text style={font.tiny}>Web preview: you enter habits by hand. The phone app will read verified data from Apple Health or Health Connect.</Text>
      </Card>
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
    <Pressable accessibilityLabel={`${index + 1} glasses`} onPress={onPress}>
      <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1.25, 1] }) }] }}>
        <Svg width={26} height={30} viewBox="0 0 28 32">
          <Path d="M5 4 H23 L20.5 28 Q20 30 18 30 H10 Q8 30 7.5 28 Z" fill={on ? '#8FC9F0' : '#fff'} stroke={on ? '#2E7FB8' : '#B9CDD6'} strokeWidth={2.2} strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

function Habit({ icon, label, sub, xp, children }: { icon: string; label: string; sub: string; xp: number; children: React.ReactNode }) {
  return (
    <View style={styles.habit}>
      <View style={styles.habitTop}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[font.body, { fontWeight: '800' }]}>{label}</Text>
          <Text style={font.small}>{sub}</Text>
        </View>
        <PopIn key={xp} from={0.6}>
          <Chip label={`+${xp} XP`} tone={xp ? 'mint' : 'muted'} />
        </PopIn>
      </View>
      <View style={styles.controls}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  reminder: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  go: { fontWeight: '900', fontSize: 13, color: colors.mintDark },
  petCard: { backgroundColor: colors.sky, borderRadius: 24, borderWidth: 1, borderColor: colors.line, padding: space.lg, overflow: 'hidden' },
  petHead: { flexDirection: 'row', gap: space.sm },
  petName: { fontSize: 24, fontWeight: '800', color: colors.ink, padding: 0 },
  stage: { fontSize: 12, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  petStage: { alignItems: 'center', justifyContent: 'center', height: 200 },
  bubble: { position: 'absolute', top: 0, right: 0, maxWidth: 150, backgroundColor: '#fff', borderRadius: 14, borderBottomRightRadius: 4, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, zIndex: 2 },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  quest: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line },
  qbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: '#BFD3CB', alignItems: 'center', justifyContent: 'center' },
  qdone: { backgroundColor: colors.mint, borderColor: colors.mint },
  check: { color: '#fff', fontWeight: '900', fontSize: 13 },
  habit: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm, gap: space.sm },
  habitTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  meal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FAFBF9', borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  mealForm: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#fff', fontSize: 15, color: colors.ink },
  vegToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
});
