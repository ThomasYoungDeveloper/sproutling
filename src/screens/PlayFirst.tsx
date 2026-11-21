import React, { useMemo, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { Text } from '../components/ScaledText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import EggSprite from '../components/EggSprite';
import PetSprite from '../components/PetSprite';
import { Confetti, PopIn, Rays, buzz, useIdleWobble } from '../components/fx';
import { colors } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { RARITY_INFO } from '../game/rarity';
import { SKIN_INFO } from '../game/skins';
import * as I from '../game/intro';
import { savePendingStarter, type PendingStarter } from '../lib/pendingStarter';
import { play } from '../lib/sound';

/** Three eggs in the meadow, each with its own look (no hints about what's inside). */
export const EGG_LOOKS = [
  { color: '#F6E7C8', spots: ['#E9B872', '#F2CF8E', '#E0A85E'] },
  { color: '#DDEFF5', spots: ['#9CC9DC', '#B8DAE7', '#86BBD2'] },
  { color: '#F4DDE8', spots: ['#E2A6C2', '#EDBFD3', '#D893B3'] },
];

const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Play first: a new player picks an egg, taps it open and names their pet before making an account.
 * The pet is saved on this phone and moved into their game after sign-up.
 */
export default function PlayFirst({ onSave, onSignIn, existing }: { onSave: (p: PendingStarter) => void; onSignIn: () => void; existing?: PendingStarter | null }) {
  const [step, setStep] = useState<'meadow' | 'tap' | 'hatched'>(existing ? 'hatched' : 'meadow');
  const eggs = useMemo(() => [I.rollStarterEgg(), I.rollStarterEgg(), I.rollStarterEgg()], []);
  const [picked, setPicked] = useState<number | null>(existing?.look ?? null);
  const [pending, setPending] = useState<PendingStarter | null>(existing ?? null);

  if (step === 'meadow') return <MeadowStep picked={picked} onPick={setPicked} onTake={() => setStep('tap')} onSignIn={onSignIn} />;
  if (step === 'tap' && picked !== null)
    return (
      <TapStep
        look={EGG_LOOKS[picked]}
        onHatch={() => {
          const pet = I.rollStarterPet(eggs[picked], localDay());
          const p = { pet, look: picked };
          setPending(p);
          savePendingStarter(p);
          setStep('hatched');
        }}
      />
    );
  if (pending)
    return (
      <HatchedStep
        p={pending}
        onSave={(nick) => {
          const p = { ...pending, pet: { ...pending.pet, nickname: nick || pending.pet.nickname } };
          savePendingStarter(p);
          onSave(p);
        }}
      />
    );
  return null;
}

function Sky({ dark }: { dark?: boolean }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="pfsky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={dark ? '#3B2D6B' : '#8ED3FF'} />
          <Stop offset="1" stopColor={dark ? '#7B5BC9' : '#DFF5FF'} />
        </LinearGradient>
      </Defs>
      <Rect width="390" height="844" fill="url(#pfsky)" />
      {!dark ? (
        <>
          <Circle cx="330" cy="330" r="34" fill="#FFE68A" />
          <Path d="M40 300 q20 -22 44 -8 q14 -18 36 -4 q18 2 18 16 h-98z" fill="#FFFFFF" opacity="0.9" />
          <Path d="M200 380 q16 -18 36 -6 q12 -14 30 -2 q14 2 14 12 h-80z" fill="#FFFFFF" opacity="0.8" />
        </>
      ) : null}
      <Path d="M0 560 Q100 500 200 540 T390 520 V844 H0z" fill={dark ? '#5E46A8' : '#A8DFA9'} />
      <Path d="M0 620 Q120 580 230 612 T390 600 V844 H0z" fill={dark ? '#4C3891' : '#8CD392'} />
      <Path d="M0 690 Q140 660 260 690 T390 684 V844 H0z" fill={dark ? '#3E2E7A' : '#76C77E'} />
    </Svg>
  );
}

function MeadowStep({ picked, onPick, onTake, onSignIn }: { picked: number | null; onPick: (i: number) => void; onTake: () => void; onSignIn: () => void }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <View style={styles.full}>
      <Sky />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 14 }} bounces={false}>
        <View style={{ paddingHorizontal: 22, gap: 8 }}>
          <Text style={styles.brand}>Sprout<Text style={{ color: '#2F9E6B' }}>ling</Text></Text>
          <Text style={styles.blurb}>
            Somewhere in this meadow, a tiny pet is waiting for you. It grows when you take care of yourself: walk, drink water and sleep well, and it levels up, finds eggs and goes on adventures.
          </Text>
        </View>
        <View style={[styles.eggRow, { minHeight: Math.max(200, height * 0.3) }]}>
          {EGG_LOOKS.map((look, i) => (
            <MeadowEgg key={i} look={look} on={picked === i} index={i} onPress={() => { buzz('light'); onPick(i); }} />
          ))}
        </View>
        <View style={styles.bottomCard}>
          <Text style={styles.cardTitle}>{picked === null ? 'Pick your egg' : 'This one?'}</Text>
          <Text style={styles.cardSub}>{picked === null ? 'Tap one. Each hides a different pet.' : I.EGG_LINES[picked]}</Text>
          <Pressable onPress={picked === null ? undefined : onTake} style={[styles.cta, picked === null && { opacity: 0.45 }]} accessibilityRole="button" accessibilityState={{ disabled: picked === null }}>
            <Text style={styles.ctaText}>Take this egg</Text>
          </Pressable>
          <Pressable onPress={onSignIn} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>I already have an account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function MeadowEgg({ look, on, index, onPress }: { look: (typeof EGG_LOOKS)[number]; on: boolean; index: number; onPress: () => void }) {
  const wobble = useIdleWobble();
  return (
    <Pressable onPress={onPress} style={[styles.egg, on && styles.eggOn]} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`Egg ${index + 1}`}>
      <Animated.View style={on ? wobble : undefined}>
        <EggSprite rarity="common" color={look.color} spots={look.spots} size={on ? 104 : 84} />
      </Animated.View>
    </Pressable>
  );
}

function TapStep({ look, onHatch }: { look: (typeof EGG_LOOKS)[number]; onHatch: () => void }) {
  const insets = useSafeAreaInsets();
  const [taps, setTaps] = useState(0);
  const shake = useRef(new Animated.Value(0)).current;
  const tap = () => {
    if (taps >= 3) return;
    const n = taps + 1;
    setTaps(n);
    buzz(n === 3 ? 'heavy' : 'medium');
    play(n === 3 ? 'chime' : 'tap');
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 80, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(() => n === 3 && setTimeout(onHatch, 250));
  };
  return (
    <Pressable style={styles.full} onPress={tap} accessibilityRole="button" accessibilityLabel={`Tap the egg to hatch it. ${3 - taps} taps left`}>
      <Sky dark />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top, gap: 24 }}>
        <Text style={styles.tapTitle}>Tap tap tap!</Text>
        <Animated.View style={{ transform: [{ rotate: shake.interpolate({ inputRange: [-1, 1], outputRange: ['-12deg', '12deg'] }) }, { scale: 1 + taps * 0.06 }] }}>
          <EggSprite rarity="common" color={look.color} spots={look.spots} size={220} cracked={taps >= 2} />
        </Animated.View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[0, 1, 2].map((i) => <View key={i} style={[styles.tapDot, i < taps && styles.tapDotOn]} />)}
        </View>
        <Text style={styles.tapSub}>Something’s moving inside…</Text>
      </View>
    </Pressable>
  );
}

function HatchedStep({ p, onSave }: { p: PendingStarter; onSave: (nick: string) => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const sp = SPECIES_BY_ID[p.pet.speciesId];
  const [nick, setNick] = useState(p.pet.nickname !== sp.name ? p.pet.nickname : '');
  const info = RARITY_INFO[sp.rarity];
  const pct = I.starterPct(sp.rarity);
  const skin = p.pet.skin ? SKIN_INFO[p.pet.skin] : null;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.full}>
      <Sky dark />
      <Confetti amount={sp.rarity === 'common' && !skin ? 60 : 120} width={width} height={height} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 14 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={{ alignItems: 'center', gap: 10, flex: 1, justifyContent: 'center' }}>
          <PopIn from={0.4}><Text style={styles.hatched}>IT HATCHED!</Text></PopIn>
          <View style={{ alignItems: 'center', justifyContent: 'center', height: 230 }}>
            <Rays color={skin ? skin.color : info.color} size={Math.min(width, 380)} />
            <PopIn from={0.1} delay={150}><PetSprite species={sp} stage="baby" size={200} shiny={p.pet.shiny} skin={p.pet.skin} mood="joy" /></PopIn>
          </View>
          <PopIn delay={400}>
            <View style={[styles.banner, { backgroundColor: info.color }]}>
              <Text style={styles.bannerBig}>{info.label.toUpperCase()}</Text>
              <Text style={styles.bannerSmall}>{sp.name.toUpperCase()} · {pct ? `ONLY ${pct}% OF EGGS` : 'A RARE FIND'}</Text>
            </View>
          </PopIn>
          {skin ? (
            <PopIn delay={650}>
              <View style={[styles.banner, { backgroundColor: skin.color, transform: [{ rotate: '3deg' }] }]}>
                <Text style={styles.bannerSmall}>AND A {skin.label.toUpperCase()} SKIN!</Text>
              </View>
            </PopIn>
          ) : null}
        </View>
        <View style={styles.bottomCard}>
          <Text style={styles.cardTitle}>What will you call it?</Text>
          <TextInput
            value={nick}
            onChangeText={(t) => setNick(t.slice(0, 14))}
            placeholder={sp.name}
            placeholderTextColor="#9AA9A4"
            style={styles.input}
            maxLength={14}
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel="Nickname (optional)"
          />
          <Pressable onPress={() => onSave(nick.trim())} style={styles.cta} accessibilityRole="button">
            <Text style={styles.ctaText}>{nick.trim() ? `Hi, ${nick.trim()}!` : `Keep “${sp.name}”`}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: '#8ED3FF' },
  brand: { fontSize: 42, fontWeight: '900', color: colors.ink },
  blurb: { fontSize: 17, fontWeight: '800', color: '#1F3A33', lineHeight: 24 },
  eggRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingHorizontal: 10, paddingBottom: 18 },
  egg: { borderRadius: 24, padding: 6, borderWidth: 3, borderColor: 'transparent' },
  eggOn: { borderColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.35)' },
  bottomCard: { marginHorizontal: 14, backgroundColor: '#FFFFFF', borderRadius: 26, padding: 18, gap: 10 },
  cardTitle: { fontSize: 22, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  cardSub: { fontSize: 15, fontWeight: '700', color: colors.muted, textAlign: 'center' },
  cta: { minHeight: 56, borderRadius: 18, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: colors.mintDark, paddingHorizontal: 12 },
  ctaText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  link: { fontSize: 15, fontWeight: '900', color: colors.mintDark, textAlign: 'center', paddingVertical: 4 },
  tapTitle: { fontSize: 40, fontWeight: '900', color: '#FFFFFF' },
  tapSub: { fontSize: 17, fontWeight: '800', color: '#E9E1FF' },
  tapDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.35)' },
  tapDotOn: { backgroundColor: '#FFE27A' },
  hatched: { fontSize: 44, fontWeight: '900', color: '#FFE27A', textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 3 } },
  banner: { borderRadius: 16, paddingHorizontal: 20, paddingVertical: 8, alignItems: 'center', transform: [{ rotate: '-4deg' }] },
  bannerBig: { color: '#FFFFFF', fontSize: 30, fontWeight: '900', letterSpacing: 1 },
  bannerSmall: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  input: { height: 52, borderRadius: 16, borderWidth: 2, borderColor: colors.line, backgroundColor: '#FFFFFF', paddingHorizontal: 14, fontSize: 20, fontWeight: '900', color: colors.ink, textAlign: 'center' },
});
