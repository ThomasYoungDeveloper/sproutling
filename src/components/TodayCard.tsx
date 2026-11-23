import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, Platform } from 'react-native';
import { Text } from './ScaledText';
import Svg, { Circle, Path } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import { useOverlay } from './Overlay';
import { FitSheet, Button, Card } from './ui';
import { buzz, PopIn } from './fx';
import { colors, font, space } from '../theme';
import { dailyQuests, EXERCISE_MINUTES, MINDFUL_MINUTES, RING_XP, ringsClosed, scoreDay } from '../game/scoring';
import * as A from '../game/actions';
import * as C from '../game/care';
import { healthAvailable, healthProvider, isVerified, nativeHealth } from '../lib/health';
import * as I from '../game/intro';
import { tipFor, WHY } from '../game/tips';
import { stepsToHatch, eggSteps } from '../game/rarity';
import { glassesText, stepGoalOf, waterGoalOf } from '../game/scoring';
import { NextUnlockLine } from './Unlocks';
import * as W from '../game/wishes';
import { WheelBanner } from './LuckyWheel';
import { InfoDot, InfoPop } from './InfoTip';

type Habit = 'steps' | 'water' | 'sleep';

const INFO: Record<Habit, { icon: string; label: string; color: string; goal: number }> = {
  steps: { icon: '👟', label: 'steps', color: '#2FB58A', goal: 8000 },
  water: { icon: '💧', label: 'glasses', color: '#3D8FD6', goal: 6 },
  sleep: { icon: '🌙', label: 'sleep', color: '#7F77DD', goal: 7 },
};

/** Each habit tile is softly tinted in its ring color. */
const TINT: Record<string, string> = { steps: '#DDF4EA', water: '#DCEBFB', sleep: '#E8E1FA' };

/** Today's three habits as tiles with progress rings. Tap a tile to log it. */
export default function TodayCard() {
  const { state, apply } = useGame();
  const overlay = useOverlay();
  const d = A.today(state);
  const el = A.activeElement(state);
  const pet = A.activePet(state);
  const quests = dailyQuests(d);
  const allDone = quests.every((q) => q.done);
  const unit = state.goals?.unit ?? 'oz';
  const goalOf: Record<Habit, number> = { steps: stepGoalOf(d), water: waterGoalOf(d), sleep: 7 };
  const value: Record<Habit, number> = { steps: d.steps, water: d.water, sleep: d.sleepHours };
  const shown: Record<Habit, string> = { steps: d.steps.toLocaleString(), water: I.waterText(d.water, unit), sleep: `${d.sleepHours} h` };
  const label: Record<Habit, string> = { steps: `of ${goalOf.steps.toLocaleString()}`, water: `of ${I.waterText(goalOf.water, unit)}`, sleep: 'sleep' };
  const name = pet?.nickname ?? 'your pet';
  const fed = !!d.care?.fed;
  const egg = state.eggs.filter((e) => e.incubating && !A.isReady(e)).map((e) => eggSteps(e) - e.stepsWalked).sort((a, b) => a - b)[0];
  const next = !fed
    ? `Next: feed ${name}`
    : d.water < goalOf.water
      ? 'Next: log a glass of water'
      : d.steps < goalOf.steps
        ? `Next: a walk (${(goalOf.steps - d.steps).toLocaleString()} steps to go)`
        : d.sleepHours === 0
          ? 'Next: log last night’s sleep'
          : null;
  const tip = tipFor(A.todayKey(state));
  const changed = state.goals?.changed;
  const todayOverlay = useOverlay();
  const done: Record<Habit, boolean> = { steps: quests[0].done, water: quests[1].done, sleep: quests[2].done };

  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.title}>Today</Text>
            <InfoDot label="today's tip" onPress={() => todayOverlay.open(<InfoPop tip={{ title: 'Tip of the day', text: `${tip.text}\n\nSource: ${tip.source}. Not medical advice.` }} onClose={todayOverlay.close} />)} />
            {A.starterBoost(state) ? <View style={styles.starterChip}><Text style={styles.starterChipText}>2× coins to Lv {A.STARTER_BOOST_UNTIL}</Text></View> : null}
          </View>
          <Text style={styles.subtitle}>{allDone ? 'All 3 done! Bronze chest earned' : 'Finish all 3 for a Bronze chest'}</Text>
        </View>
        <PopIn key={C.boostedTotal(d, el)} from={0.7}>
          <View style={styles.xp}><Text style={styles.xpText}>+{C.boostedTotal(d, el)} XP</Text></View>
        </PopIn>
      </View>
      <View style={styles.tiles}>
        {(['steps', 'water', 'sleep'] as Habit[]).map((h) => {
          return (
            <Pressable
              key={h}
              onPress={() => {
                buzz('light');
                overlay.open(<LogSheet habit={h} onClose={overlay.close} />);
              }}
              style={({ pressed }) => [styles.tile, { backgroundColor: TINT[h] }, pressed && { transform: [{ scale: 0.96 }] }]}
              accessibilityRole="button"
              accessibilityLabel={`${INFO[h].label}: ${shown[h]}${done[h] ? ', done' : ''}. Tap to log`}
            >
              <Ring frac={Math.min(1, value[h] / goalOf[h])} color={INFO[h].color} done={done[h]} icon={INFO[h].icon} />
              <Text style={styles.value}>{shown[h]}</Text>
              <Text style={styles.label}>{label[h]}</Text>
            </Pressable>
          );
        })}
      </View>
      {d.rings || d.mindfulMin !== undefined ? <ActivityRow d={d} /> : null}
      <View style={styles.extras}>
        <Row done={fed} text={`Feed ${name}`} meta={fed ? 'Done' : '+10% XP'} />
        {egg !== undefined ? <Row done={false} text="Hatch your egg" meta={`${egg.toLocaleString()} steps to go`} /> : null}
      </View>
      {changed ? (
        <Pressable onPress={() => apply((s) => ({ ...s, goals: s.goals ? { ...s.goals, changed: undefined } : s.goals }))} style={styles.changed} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Text style={styles.changedText}>
            {changed === 'up' ? `Great week! Your step goal went up to ${goalOf.steps.toLocaleString()}.` : `Your step goal eased to ${goalOf.steps.toLocaleString()} for this week. You’ve got this.`}
          </Text>
          <Text style={styles.changedX}>OK</Text>
        </Pressable>
      ) : null}
      {next && !allDone && !next.startsWith('Next: feed') ? <Text style={styles.next}>{next}</Text> : null}
      <WheelBanner />
      <WishRow />
      <NextUnlockLine />
    </Card>
  );
}

const RING_COLORS = { move: '#FA114F', exercise: '#7ED321', stand: '#1EC8E6' };

/** Apple Health extras: activity rings and mindful minutes, each with what it earns. */
function ActivityRow({ d }: { d: ReturnType<typeof A.today> }) {
  const r = d.rings ?? { move: 0, exercise: 0, stand: 0 };
  const closed = ringsClosed(d);
  const mindful = d.mindfulMin ?? 0;
  return (
    <View style={styles.activity} accessibilityLabel={`Activity rings: ${closed} of 3 closed. Mindful minutes: ${mindful}.`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {(['move', 'exercise', 'stand'] as const).map((k) => (
          <MiniRing key={k} frac={r[k]} color={RING_COLORS[k]} size={28} />
        ))}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.actTitle}>{closed === 3 ? 'All rings closed!' : `${closed} of 3 rings closed`}</Text>
        <Text style={styles.actSub}>{closed === 3 ? 'Rings Closed buff: +5% all stats' : `+${RING_XP} XP per ring, bonus for all 3`}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(d.exerciseMin ?? 0) >= EXERCISE_MINUTES || r.exercise >= 1 ? (
            <View style={[styles.mindful, { backgroundColor: '#E3F6D8' }]}><Text style={[styles.mindfulText, { color: '#3E7A1E' }]}>Trained</Text></View>
          ) : null}
          <View style={[styles.mindful, mindful >= MINDFUL_MINUTES && styles.mindfulOn]}>
            <Text style={[styles.mindfulText, mindful >= MINDFUL_MINUTES && { color: '#5B3FA8' }]}>🧘 {mindful} mindful min{mindful >= MINDFUL_MINUTES ? ' · Calm' : ''}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function MiniRing({ frac, color, size = 24 }: { frac: number; color: string; size?: number }) {
  const r = 9;
  const len = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, frac));
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={r} fill="none" stroke={color} strokeOpacity={0.2} strokeWidth={4} />
      {f > 0 ? <Circle cx={12} cy={12} r={r} fill="none" stroke={color} strokeWidth={4} strokeDasharray={`${len * f} ${len}`} strokeLinecap="round" transform="rotate(-90 12 12)" /> : null}
    </Svg>
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
  const [whyOpen, setWhyOpen] = useState(false);
  const d = A.today(state);
  const el = A.activeElement(state);
  const score = scoreDay(d, el);
  const q = dailyQuests(d);
  const title = { steps: 'Steps', water: 'Water', sleep: 'Sleep' }[habit];
  const xp = { steps: score.steps, water: score.water, sleep: score.sleep }[habit];
  const questDone = { steps: q[0].done, water: q[1].done, sleep: q[2].done }[habit];
  const unit = state.goals?.unit ?? 'oz';
  const glass = state.goals?.glass ?? 8;
  const wg = waterGoalOf(d);
  const pet = A.activePet(state);
  const line = {
    steps: `${d.steps.toLocaleString()} steps today. Walking also warms your eggs.`,
    water: `${glassesText(d.water)} of ${wg} glasses · ${I.waterText(d.water, unit)} of ${I.waterText(wg, unit)}`,
    sleep: `${d.sleepHours} hours last night. The sweet spot is 7–9 hours.`,
  }[habit];
  const goal = { steps: `Quest done at ${stepGoalOf(d).toLocaleString()} steps.`, water: `Quest done at ${I.waterText(wg, unit)}.`, sleep: 'Quest done at 7 hours.' }[habit];
  const why = WHY[habit];
  const sizeText = (oz: number) => (unit === 'ml' ? `${Math.round((oz * I.ML_PER_OZ) / 5) * 5} mL` : `${oz} oz`);

  return (
    <View style={styles.backdrop}>
      <FitSheet onClose={onClose}>
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

        {habit === 'steps' && isVerified(healthProvider()) ? (
          <View style={styles.goal}>
            <Text style={styles.goalText}>Synced from Apple Health. Walk with your phone or watch and it fills in by itself.</Text>
          </View>
        ) : habit === 'sleep' && isVerified(healthProvider()) && d.sleepHours > 0 ? (
          <View style={styles.goal}>
            <Text style={styles.goalText}>Synced from Apple Health. With no watch, set a bedtime in the Health app (Sleep) and your iPhone fills this in.</Text>
          </View>
        ) : habit === 'steps' && Platform.OS !== 'web' && healthAvailable() ? (
          <View style={{ gap: space.sm }}>
            <Text style={styles.goalText}>Steps on the iPhone come from Apple Health, so everyone’s count is real.</Text>
            <Button
              primary
              label="Connect Apple Health"
              onPress={async () => {
                const h = nativeHealth();
                if (!h) return;
                buzz();
                await h.requestAccess();
                apply((s) => ({ ...s, onboard: { ...s.onboard, health: 'connected' } }));
              }}
            />
          </View>
        ) : habit === 'sleep' && isVerified(healthProvider()) ? (
          <View style={{ gap: space.sm }}>
            <View style={styles.controls}>
              <Button label="−" onPress={() => { buzz(); apply((s) => A.setSleep(s, (A.today(s).sleepHours || 7) - 0.5)); }} style={{ flex: 1 }} />
              <Button primary label={`Log ${d.sleepHours || 7} hours`} onPress={() => { buzz('success'); apply((s) => A.setSleep(s, A.today(s).sleepHours || 7)); }} style={{ flex: 2 }} />
              <Button label="+" onPress={() => { buzz(); apply((s) => A.setSleep(s, (A.today(s).sleepHours || 7) + 0.5)); }} style={{ flex: 1 }} />
            </View>
            <Text style={styles.small}>Tip: set a bedtime in the iPhone Health app (Sleep) and Sproutling fills this in for you.</Text>
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
          <View style={{ gap: space.sm }}>
            <View style={styles.glasses}>
              {Array.from({ length: Math.max(8, wg) }, (_, i) => (
                <Glass key={i} on={i < d.water} part={d.water - i} index={i} />
              ))}
            </View>
            <View style={styles.controls}>
              <Button label="−" onPress={() => { buzz(); apply((s) => A.setWater(s, Math.round((A.today(s).water - glass / I.OZ_PER_GLASS) * 100) / 100)); }} style={{ flex: 1 }} />
              <Button primary label={`+ 1 glass (${sizeText(glass)})`} onPress={() => { buzz(); apply((s) => A.setWater(s, Math.round((A.today(s).water + glass / I.OZ_PER_GLASS) * 100) / 100)); }} style={{ flex: 3 }} />
            </View>
            <Text style={styles.small}>YOUR GLASS SIZE</Text>
            <View style={styles.controls}>
              {[8, 12, 16, 24].map((oz) => (
                <Button key={oz} small primary={glass === oz} label={sizeText(oz)} onPress={() => apply((s) => ({ ...s, goals: { steps: I.stepGoal(s), water: I.waterGoal(s), ...s.goals, glass: oz } }))} style={{ flex: 1 }} />
              ))}
            </View>
          </View>
        )}
        <Pressable onPress={() => setWhyOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: whyOpen }} hitSlop={6}>
          <Text style={styles.whyLink}>{whyOpen ? 'Hide' : `Why ${({ steps: 'walking', water: 'water', sleep: 'sleep' } as const)[habit]}?`}</Text>
        </Pressable>
        {whyOpen ? (
          <View style={styles.why}>
            <Text style={styles.whyText}>{why.text} {why.pet.split('{pet}').join(pet?.nickname ?? 'Your pet')}</Text>
            <Text style={styles.tipSource}>Source: {why.source} · Not medical advice</Text>
          </View>
        ) : null}

        <View style={[styles.goal, questDone && { backgroundColor: colors.mintSoft }]}>
          <Text style={[styles.goalText, questDone && { color: colors.mintDark }]}>{questDone ? `✓ ${goal} Keep going for more XP.` : goal}</Text>
        </View>
        <Button primary label="Done" onPress={onClose} />
      </View>
      </FitSheet>
    </View>
  );
}

/** A row under the habit tiles: pet care and your next egg. */
function Row({ done, text, meta }: { done: boolean; text: string; meta: string }) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowDot, done && { backgroundColor: colors.mint }]}>{done ? <Text style={styles.rowCheck}>✓</Text> : null}</View>
      <Text style={[styles.rowText, done && { color: colors.muted }]}>{text}</Text>
      <Text style={[styles.rowMeta, done && { color: colors.mintDark }]}>{meta}</Text>
    </View>
  );
}

/** A water glass that fills with a little bounce (part-full for bigger or smaller glasses). */
function Glass({ on, index, part }: { on: boolean; index: number; part: number }) {
  const v = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: on ? 1 : 0, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [on]);
  return (
    <View accessibilityLabel={`Glass ${index + 1}${on ? ', full' : ''}`} style={[styles.glass, on && styles.glassOn]}>
      <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1.25, 1] }) }] }}>
        <Svg width={26} height={30} viewBox="0 0 28 32">
          <Path d="M5 4 H23 L20.5 28 Q20 30 18 30 H10 Q8 30 7.5 28 Z" fill={part >= 1 ? '#8FC9F0' : part > 0 ? '#CFE6F8' : '#fff'} stroke={on ? '#2E7FB8' : '#B9CDD6'} strokeWidth={2.2} strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** The pet's wish, when one is showing: progress, then a Grant button for +25 XP. */
function WishRow() {
  const { state, apply } = useGame();
  const [granted, setGranted] = useState(false);
  const w = W.activeWish(state);
  const pet = A.activePet(state);
  if (granted) return <PopIn><Text style={styles.wishDone}>Wish granted! {pet?.nickname ?? 'Your pet'} got +{W.WISH_XP} XP.</Text></PopIn>;
  if (!w || !pet) return null;
  const info = W.WISHES[w.kind];
  const pct = Math.round((w.have / w.need) * 100);
  return (
    <View style={styles.wish} accessibilityLabel={`${pet.nickname} made a wish: ${info.label}. ${w.have} of ${w.need} ${info.unit}.`}>
      <View style={styles.wishMark}><Text style={styles.wishMarkText}>!</Text></View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.wishText}>{pet.nickname} made a wish: {info.label}</Text>
        <View style={styles.wishTrack}><View style={[styles.wishFill, { width: `${pct}%` }]} /></View>
        <Text style={styles.wishMeta}>{w.have.toLocaleString()} of {w.need.toLocaleString()} {info.unit} · +{W.WISH_XP} XP</Text>
      </View>
      {w.done ? <Button small primary label="Grant" onPress={() => { buzz('success', 'levelup'); apply((s) => W.grantWish(s)); setGranted(true); }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wish: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF4D6', borderRadius: 14, padding: 10 },
  wishMark: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFE3A0', alignItems: 'center', justifyContent: 'center' },
  wishMarkText: { fontSize: 16, fontWeight: '900', color: '#B06A00' },
  wishText: { fontSize: 14, fontWeight: '900', color: colors.ink },
  wishTrack: { height: 6, borderRadius: 9, backgroundColor: '#F2E2B8', overflow: 'hidden' },
  wishFill: { height: '100%', borderRadius: 9, backgroundColor: '#2FB58A' },
  wishMeta: { fontSize: 12, fontWeight: '800', color: '#7A5900' },
  wishDone: { fontSize: 14, fontWeight: '900', color: colors.mintDark, textAlign: 'center' },
  extras: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F6FAF8', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10 },
  rowDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#B9C9C2', alignItems: 'center', justifyContent: 'center' },
  rowCheck: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  rowText: { flex: 1, fontSize: 14, fontWeight: '900', color: colors.ink },
  rowMeta: { fontSize: 12, fontWeight: '900', color: '#B07A00' },
  next: { fontSize: 13, fontWeight: '900', color: colors.mintDark },
  changed: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF4D6', borderRadius: 12, padding: 10 },
  changedText: { flex: 1, fontSize: 13, fontWeight: '800', color: '#6A4A00' },
  changedX: { fontSize: 13, fontWeight: '900', color: '#B06A00' },
  starterChip: { backgroundColor: '#FFF1C2', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  starterChipText: { fontSize: 12, fontWeight: '900', color: '#8A6100' },
  whyLink: { fontSize: 14, fontWeight: '900', color: '#3D6E9C', textDecorationLine: 'underline' },
  tipLine: { gap: 2, paddingVertical: 2 },
  starter: { fontSize: 12, fontWeight: '800', color: '#B06A00' },
  tipTag: { fontSize: 12, fontWeight: '900', color: '#3D6E9C' },
  tipText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  tipSource: { fontSize: 12, fontWeight: '700', color: colors.muted },
  why: { backgroundColor: '#F6FAF8', borderRadius: 12, padding: 10, gap: 3 },
  whyText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  small: { fontSize: 12, fontWeight: '900', color: colors.muted, letterSpacing: 0.8 },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF0F3', borderRadius: 14, padding: 10 },
  actTitle: { fontSize: 14, fontWeight: '900', color: colors.ink },
  actSub: { fontSize: 12, fontWeight: '800', color: colors.muted },
  mindful: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: '#EFEDF6' },
  mindfulOn: { backgroundColor: '#E4DCFA' },
  mindfulText: { fontSize: 12, fontWeight: '900', color: colors.muted },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 19, fontWeight: '900', color: colors.ink },
  subtitle: { fontSize: 12, fontWeight: '800', color: colors.muted },
  xp: { backgroundColor: colors.mintSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  xpText: { color: colors.mintDark, fontSize: 14, fontWeight: '900' },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, borderWidth: 0, borderColor: 'transparent', backgroundColor: '#F6FAF8', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', gap: 3 },
  value: { fontSize: 16, fontWeight: '900', color: colors.ink },
  label: { fontSize: 12, fontWeight: '800', color: colors.muted },
  mult: { position: 'absolute', top: -9, right: -5, backgroundColor: '#7F77DD', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, zIndex: 2 },
  multText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.5)', justifyContent: 'flex-end', alignItems: 'center', zIndex: 50 },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.lg, paddingTop: 10, gap: space.md, width: '100%', maxWidth: 520, alignSelf: 'center' },
  grab: { width: 44, height: 5, borderRadius: 999, backgroundColor: colors.line, alignSelf: 'center' },
  controls: { flexDirection: 'row', gap: space.sm },
  glasses: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  glass: { width: '21.5%', height: 60, borderRadius: 14, borderWidth: 2, borderColor: '#B9DAF3', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  glassOn: { backgroundColor: '#E2F1FC', borderColor: '#8FC3EE' },
  goal: { backgroundColor: '#EAF3FC', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  goalText: { fontSize: 14, fontWeight: '800', color: '#1F5C94' },
});
