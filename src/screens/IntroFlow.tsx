import React, { useMemo, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import { useAuth } from '../state/AuthContext';
import { useReveal } from '../components/RevealOverlay';
import EggSprite from '../components/EggSprite';
import PetSprite from '../components/PetSprite';
import { RarityBadge } from '../components/ui';
import { buzz, useIdleWobble } from '../components/fx';
import { colors, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { ELEMENT_COLOR, ELEMENT_LABEL } from '../game/battle';
import * as I from '../game/intro';
import * as A from '../game/actions';
import { healthAvailable, nativeHealth } from '../lib/health';

type Step = 'eggs' | 'name' | 'age' | 'under' | 'goals' | 'health' | 'skip' | 'ready';

/** Three eggs in the meadow, each with its own look (no hints about what's inside). */
const EGG_LOOKS = [
  { color: '#F6E7C8', spots: ['#E9B872', '#F2CF8E', '#E0A85E'] },
  { color: '#DDEFF5', spots: ['#9CC9DC', '#B8DAE7', '#86BBD2'] },
  { color: '#F4DDE8', spots: ['#E2A6C2', '#EDBFD3', '#D893B3'] },
];

const FOCUS: { id: I.Focus; label: string; sub: string }[] = [
  { id: 'move', label: 'Move more', sub: 'Steps and walks' },
  { id: 'water', label: 'Drink more water', sub: 'Glasses through the day' },
  { id: 'sleep', label: 'Sleep better', sub: 'Hours of sleep a night' },
];
const ACTIVITY: { id: I.Activity; label: string }[] = [
  { id: 'low', label: 'Mostly sitting' },
  { id: 'some', label: 'On my feet some' },
  { id: 'high', label: 'Very active' },
];

/**
 * The new player intro (and, for players who started before it, a quick two-question setup):
 * pick an egg, meet your pet, birth year (13+), what you want help with, Apple Health and your goal, first day.
 */
export default function IntroFlow() {
  const { state, apply } = useGame();
  const { deleteAccount } = useAuth();
  const reveal = useReveal();
  const insets = useSafeAreaInsets();
  const quick = !!state.onboard?.legacy;
  const pet = A.activePet(state);
  const thisYear = new Date().getFullYear();

  const [step, setStep] = useState<Step>(quick || state.onboard?.hatched || pet ? 'age' : 'eggs');
  const eggs = useMemo(() => [I.rollStarterEgg(), I.rollStarterEgg(), I.rollStarterEgg()], []);
  const [picked, setPicked] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [year, setYear] = useState<number | null>(state.onboard?.birthYear ?? null);
  const [focus, setFocus] = useState<I.Focus[]>(state.onboard?.focus ?? []);
  const [activity, setActivity] = useState<I.Activity>(state.onboard?.activity ?? 'some');
  const [avg, setAvg] = useState<number | null>(null);
  const [goal, setGoal] = useState<number>(state.goals?.steps ?? I.ACTIVITY_GOAL.some);
  const [health, setHealth] = useState<'connected' | 'skipped' | null>(state.onboard?.health ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scroll = useRef<any>(null);
  // The year list opens around 2000 so nobody has to scroll far (and no year is suggested).
  const years = useRef<any>(null);

  const go = (s: Step) => {
    setErr(null);
    setStep(s);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const takeEgg = () => {
    if (picked === null) return;
    buzz('medium');
    const r = I.hatchStarter(state, eggs[picked]);
    apply(() => r.state);
    reveal({ kind: 'egg', rarity: eggs[picked].rarity, pet: r.pet, isNew: true, title: 'Your egg is hatching!', eggColor: EGG_LOOKS[picked].color, eggSpots: EGG_LOOKS[picked].spots });
    go('name');
  };

  const connect = async () => {
    const h = nativeHealth();
    if (!h) return;
    setBusy(true);
    const ok = await h.requestAccess();
    const a = ok && h.averageSteps ? await h.averageSteps(28) : null;
    setBusy(false);
    setHealth('connected');
    setAvg(a);
    setGoal(a ? I.suggestGoal(a) : I.ACTIVITY_GOAL[activity]);
  };

  const finish = (h: 'connected' | 'skipped' | null) => {
    buzz('success');
    apply((s) => ({
      ...s,
      onboard: { ...s.onboard, done: true, birthYear: year ?? undefined, ...(quick ? {} : { focus, activity }), ...(h ? { health: h } : {}) },
      goals: { unit: 'oz', glass: 8, ...s.goals, steps: I.clampGoal(goal), water: s.goals?.water ?? I.DEFAULT_WATER_GOAL, auto: true },
      // Today's quest uses the new goal right away.
      days: s.days[A.todayKey(s)] ? { ...s.days, [A.todayKey(s)]: { ...s.days[A.todayKey(s)], stepGoal: I.clampGoal(goal), waterGoal: s.goals?.water ?? I.DEFAULT_WATER_GOAL } } : s.days,
    }));
  };

  const sp = pet ? SPECIES_BY_ID[pet.speciesId] : null;
  const petName = pet?.nickname ?? 'your pet';
  const page = (() => {
    switch (step) {
      case 'eggs':
        return (
          <>
            <Head kicker="Welcome to Sproutling" title="Three eggs in the meadow" sub="Each one hides a different pet. One of them is meant for you." />
            <Meadow>
              {eggs.map((_, i) => (
                <EggPick key={i} look={EGG_LOOKS[i]} on={picked === i} onPress={() => { buzz('light'); setPicked(i); }} index={i} />
              ))}
            </Meadow>
            {picked !== null ? (
              <View style={styles.card}>
                <Text style={styles.kicker}>A MYSTERY EGG</Text>
                <Text style={styles.body}>{I.EGG_LINES[picked]}</Text>
                <Text style={styles.small}>Every egg holds a different pet. Usually common, with a small chance of something rarer.</Text>
              </View>
            ) : (
              <Text style={[styles.small, { textAlign: 'center' }]}>Tap an egg to take a closer look.</Text>
            )}
            <Cta label="Take this egg" disabled={picked === null} onPress={takeEgg} />
          </>
        );
      case 'name':
        return pet && sp ? (
          <>
            <Head kicker="Meet your new pet!" title={`A ${sp.name} hatched`} sub="What will you call it? You can keep its real name, or give it a nickname." />
            <View style={[styles.card, { alignItems: 'center' }]}>
              <PetSprite species={sp} stage="baby" size={150} shiny={pet.shiny} skin={pet.skin} />
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <RarityBadge rarity={sp.rarity} />
                <View style={[styles.chip, { backgroundColor: ELEMENT_COLOR[sp.element] }]}><Text style={styles.chipText}>{ELEMENT_LABEL[sp.element]}</Text></View>
              </View>
              <TextInput
                value={name}
                onChangeText={(t) => setName(t.slice(0, 14))}
                placeholder={sp.name}
                placeholderTextColor="#9AA9A4"
                style={styles.input}
                maxLength={14}
                autoCorrect={false}
                returnKeyType="done"
                accessibilityLabel="Nickname (optional)"
              />
              <Text style={styles.small}>{name.trim() ? `Friends will see “${name.trim()} (${sp.name})”.` : 'Leave it blank to use its real name. You can change this later.'}</Text>
            </View>
            <Cta
              label={name.trim() ? 'That’s the one' : `Keep “${sp.name}”`}
              onPress={() => {
                if (name.trim()) apply((s) => A.renamePet(s, pet.id, name));
                go('age');
              }}
            />
          </>
        ) : null;
      case 'age':
        return (
          <>
            <Head kicker={quick ? 'Two quick questions' : 'About you'} title="When were you born?" sub="This helps us set up chat and safety settings for you. Only the year is saved." />
            <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
              <ScrollView ref={years} style={{ maxHeight: 250 }} nestedScrollEnabled onLayout={() => years.current?.scrollTo({ y: (year ? thisYear - 5 - year : thisYear - 5 - 2000) * 45 - 100, animated: false })}>
                {Array.from({ length: 96 }, (_, i) => thisYear - 5 - i).map((y) => (
                  <Pressable key={y} onPress={() => { buzz('light'); setYear(y); }} style={[styles.year, year === y && styles.yearOn]} accessibilityRole="radio" accessibilityState={{ selected: year === y }}>
                    <Text style={[styles.yearText, year === y && { color: '#FFFFFF' }]}>{y}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <Text style={[styles.small, { textAlign: 'center' }]}>Sproutling is for ages 13 and up. Chat and battles are only ever with friends you add.</Text>
            <Cta label="Next" disabled={!year} onPress={() => (year && I.tooYoung(year) ? go('under') : go(quick ? 'health' : 'goals'))} />
          </>
        );
      case 'under':
        return (
          <>
            <Head kicker="Not yet" title="Come back when you’re 13!" sub={`Sproutling is made for ages 13 and up. ${pet ? `${petName} will` : 'Your egg will'} be waiting for you. We’ll remove this account now, so nothing about you is kept.`} />
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <Cta
              label={busy ? 'One moment…' : 'OK'}
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                const r = await deleteAccount();
                setBusy(false);
                if (r.error) setErr(r.error);
              }}
            />
            <Pressable onPress={() => go('age')} style={{ alignSelf: 'center', padding: 8 }} accessibilityRole="button">
              <Text style={styles.link}>I picked the wrong year</Text>
            </Pressable>
          </>
        );
      case 'goals':
        return (
          <>
            <Head kicker="Your goals" title="What do you want help with?" sub={`Pick one or more. ${petName}’s daily quests start with these.`} />
            <View style={{ gap: 8 }}>
              {FOCUS.map((f) => {
                const on = focus.includes(f.id);
                return (
                  <Pressable key={f.id} onPress={() => { buzz('light'); setFocus((x) => (on ? x.filter((y) => y !== f.id) : [...x, f.id])); }} style={[styles.option, on && styles.optionOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                    <View style={[styles.check, on && styles.checkOn]}>{on ? <Text style={styles.checkMark}>✓</Text> : null}</View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionTitle}>{f.label}</Text>
                      <Text style={styles.small}>{f.sub}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.kicker, { marginTop: space.md }]}>HOW ACTIVE ARE YOU MOST DAYS?</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {ACTIVITY.map((a) => (
                <Pressable key={a.id} onPress={() => { buzz('light'); setActivity(a.id); setGoal(I.ACTIVITY_GOAL[a.id]); }} style={[styles.seg, activity === a.id && styles.segOn]} accessibilityRole="radio" accessibilityState={{ selected: activity === a.id }}>
                  <Text style={[styles.segText, activity === a.id && { color: '#FFFFFF' }]}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
            <Cta label="Next" onPress={() => go('health')} />
          </>
        );
      case 'health': {
        const canHealth = healthAvailable();
        const goalBox = (
          <View style={[styles.card, { alignItems: 'center' }]}>
            <Text style={styles.kicker}>YOUR DAILY STEP GOAL</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
              <Round label="−" onPress={() => setGoal((g) => I.clampGoal(g - 500))} a11y="Lower goal" />
              <Text style={styles.goal}>{goal.toLocaleString()}</Text>
              <Round label="+" onPress={() => setGoal((g) => I.clampGoal(g + 500))} a11y="Raise goal" />
            </View>
            <Text style={styles.small}>{avg ? 'A little above your normal. It rises as you do.' : 'It moves with you each week: up after good weeks, down after slow ones.'}</Text>
          </View>
        );
        if (!canHealth || health === 'connected') {
          return (
            <>
              <Head kicker="Your goal" title={health === 'connected' ? 'Let your steps grow your pet' : 'Set your step goal'} sub={health === 'connected' ? 'We read steps and sleep from Apple Health. Nothing else, and it never leaves your account.' : `Your steps grow ${petName}. Start with a goal that feels doable.`} />
              {avg ? (
                <View style={styles.card}>
                  <Text style={styles.kicker}>YOUR LAST 4 WEEKS</Text>
                  <Text style={styles.big}>About {avg.toLocaleString()} steps a day</Text>
                </View>
              ) : null}
              {goalBox}
              <Cta label={quick ? 'Done' : 'Next'} onPress={() => (quick ? finish(health) : go('ready'))} />
            </>
          );
        }
        return (
          <>
            <Head kicker="Apple Health" title="Let your steps grow your pet" sub="We read steps and sleep from Apple Health. Nothing else, and it never leaves your account." />
            <View style={styles.card}>
              <Text style={styles.body}>With Apple Health, we look at your last 4 weeks and suggest a goal a little above your normal.</Text>
            </View>
            <Cta label={busy ? 'Connecting…' : 'Connect Apple Health'} disabled={busy} onPress={connect} />
            <Pressable onPress={() => go('skip')} style={{ alignSelf: 'center', padding: 8 }} accessibilityRole="button">
              <Text style={styles.link}>Skip for now (start at {I.ACTIVITY_GOAL[activity].toLocaleString()})</Text>
            </Pressable>
          </>
        );
      }
      case 'skip':
        return (
          <>
            <Head kicker="Before you skip" title="Play without Apple Health?" sub="You can still play. Here’s what Apple Health adds:" />
            <View style={{ gap: 8 }}>
              <Perk title="Steps and sleep fill in on their own" text="Without it, you type them in yourself each day." />
              <Perk title="Eggs on your walks" text="Walks can turn up eggs only with steps from Apple Health." />
              <Perk title="Extra battle buffs" text="Trained, Calm and Rings Closed come from exercise minutes, mindful minutes and activity rings." />
            </View>
            <Text style={[styles.small, { textAlign: 'center' }]}>You can connect any time from your account page.</Text>
            <Cta label={busy ? 'Connecting…' : 'Connect Apple Health'} disabled={busy} onPress={async () => { await connect(); go('health'); }} />
            <Pressable
              onPress={() => {
                setHealth('skipped');
                setGoal(I.ACTIVITY_GOAL[activity]);
                if (quick) finish('skipped');
                else go('ready');
              }}
              style={{ alignSelf: 'center', padding: 8 }}
              accessibilityRole="button"
            >
              <Text style={styles.link}>Skip anyway (goal starts at {I.ACTIVITY_GOAL[activity].toLocaleString()})</Text>
            </Pressable>
          </>
        );
      case 'ready':
        return (
          <>
            <Head kicker="All set" title={`You and ${petName} are bonded`} sub="Here’s your first day together." />
            {pet && sp ? (
              <View style={{ alignItems: 'center' }}>
                <PetSprite species={sp} stage="baby" size={130} shiny={pet.shiny} skin={pet.skin} />
              </View>
            ) : null}
            <View style={{ gap: 8 }}>
              <Quest text={`Walk ${goal.toLocaleString()} steps`} reward="+XP" />
              <Quest text={`Drink ${I.DEFAULT_WATER_GOAL} glasses of water (${I.DEFAULT_WATER_GOAL * I.OZ_PER_GLASS} oz)`} reward="+XP" />
              <Quest text={`Feed ${petName} once`} reward="+XP" />
            </View>
            <Text style={[styles.small, { textAlign: 'center' }]}>Finish your quests for a Bronze chest. More of the game opens as {petName} levels up.</Text>
            <Cta label="Let’s go" onPress={() => finish(health)} />
          </>
        );
    }
  })();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <ScrollView ref={scroll} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
        {page}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Head({ kicker, title, sub }: { kicker: string; title: string; sub: string }) {
  return (
    <View style={{ gap: 4, marginBottom: space.sm }}>
      <Text style={styles.kicker}>{kicker.toUpperCase()}</Text>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <Text style={styles.sub}>{sub}</Text>
    </View>
  );
}

function Cta({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} style={({ pressed }) => [styles.cta, disabled && { opacity: 0.4 }, pressed && !disabled && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}>
      <Text style={styles.ctaText}>{label}</Text>
    </Pressable>
  );
}

function Round({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
  return (
    <Pressable onPress={() => { buzz('light'); onPress(); }} style={styles.round} accessibilityRole="button" accessibilityLabel={a11y}>
      <Text style={styles.roundText}>{label}</Text>
    </Pressable>
  );
}

function Perk({ title, text }: { title: string; text: string }) {
  return (
    <View style={[styles.card, { gap: 2 }]}>
      <Text style={styles.optionTitle}>{title}</Text>
      <Text style={styles.small}>{text}</Text>
    </View>
  );
}

function Quest({ text, reward }: { text: string; reward: string }) {
  return (
    <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }]}>
      <View style={styles.dot} />
      <Text style={[styles.optionTitle, { flex: 1 }]}>{text}</Text>
      <Text style={styles.reward}>{reward}</Text>
    </View>
  );
}

function Meadow({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.meadow}>
      <Svg width="100%" height="100%" viewBox="0 0 360 240" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#BFE6FF" />
            <Stop offset="1" stopColor="#E9F7F0" />
          </LinearGradient>
        </Defs>
        <Rect width="360" height="240" fill="url(#sky)" />
        <Path d="M0 150 Q90 110 180 140 T360 128 V240 H0z" fill="#B7E2B9" />
        <Path d="M0 180 Q120 150 220 175 T360 168 V240 H0z" fill="#9AD39F" />
      </Svg>
      <View style={styles.eggRow}>{children}</View>
    </View>
  );
}

function EggPick({ look, on, onPress, index }: { look: (typeof EGG_LOOKS)[number]; on: boolean; onPress: () => void; index: number }) {
  const wobble = useIdleWobble();
  return (
    <Pressable onPress={onPress} style={[styles.egg, on && styles.eggOn]} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`Egg ${index + 1}`}>
      <Animated.View style={on ? wobble : undefined}>
        <EggSprite rarity="common" color={look.color} spots={look.spots} size={on ? 96 : 82} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space.lg, gap: space.md, maxWidth: 520, width: '100%', alignSelf: 'center' },
  kicker: { fontSize: 12, fontWeight: '900', color: colors.mintDark, letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '900', color: colors.ink },
  sub: { fontSize: 15, fontWeight: '700', color: '#4E615B' },
  body: { fontSize: 16, fontWeight: '700', color: colors.ink },
  small: { fontSize: 13, fontWeight: '700', color: colors.muted },
  big: { fontSize: 20, fontWeight: '900', color: colors.ink },
  err: { fontSize: 14, fontWeight: '800', color: '#C4562F', textAlign: 'center' },
  link: { fontSize: 14, fontWeight: '900', color: colors.mintDark, textDecorationLine: 'underline' },
  card: { backgroundColor: colors.card, borderRadius: 22, padding: space.lg, gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  input: { alignSelf: 'stretch', marginTop: 6, height: 52, borderRadius: 16, borderWidth: 2, borderColor: colors.line, backgroundColor: '#FFFFFF', paddingHorizontal: 14, fontSize: 20, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  cta: { height: 56, borderRadius: 18, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: colors.mintDark, marginTop: space.sm },
  ctaText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  year: { height: 45, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line },
  yearOn: { backgroundColor: colors.mint },
  yearText: { fontSize: 18, fontWeight: '900', color: colors.ink },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 18, padding: 14, borderWidth: 2, borderColor: 'transparent' },
  optionOn: { borderColor: colors.mint },
  optionTitle: { fontSize: 16, fontWeight: '900', color: colors.ink },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#B9C9C2', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.mint, borderColor: colors.mint },
  checkMark: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  seg: { flex: 1, borderRadius: 14, backgroundColor: colors.card, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center' },
  segOn: { backgroundColor: colors.ink },
  segText: { fontSize: 13, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  goal: { fontSize: 34, fontWeight: '900', color: colors.ink, minWidth: 120, textAlign: 'center' },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E4F2EC', alignItems: 'center', justifyContent: 'center' },
  roundText: { fontSize: 26, fontWeight: '900', color: colors.mintDark },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.mint },
  reward: { fontSize: 13, fontWeight: '900', color: '#B07A00' },
  meadow: { height: 240, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end' },
  eggRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingBottom: 22, paddingHorizontal: 8 },
  egg: { alignItems: 'center', justifyContent: 'flex-end', borderRadius: 20, padding: 6, borderWidth: 3, borderColor: 'transparent' },
  eggOn: { borderColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.35)' },
});
