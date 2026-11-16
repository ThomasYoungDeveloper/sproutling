import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import PetSprite from './PetSprite';
import { ProgressBar, RarityBadge } from './ui';
import { buzz, PopIn } from './fx';
import { colors, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { levelProgress, stageFor } from '../game/scoring';
import * as A from '../game/actions';
import * as C from '../game/care';
import type { Element } from '../game/types';
import { SCENES } from './Cosmetics';
import { COSMETIC_BY_ID, ownedToys, type Cosmetic } from '../game/cosmetics';

const STAGE_LABEL = { baby: 'Baby', teen: 'Teen', adult: 'Adult' } as const;

export type Sky = 'dawn' | 'day' | 'dusk' | 'night';
export function skyNow(): Sky {
  const h = new Date().getHours();
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}
const SKY: Record<Sky, [string, string]> = {
  dawn: ['#FFD3B0', '#D6ECFF'],
  day: ['#8FD3FF', '#E6F6FF'],
  dusk: ['#FF9F80', '#FFE0C2'],
  night: ['#25325E', '#5D6BAE'],
};
const HILLS: Record<Element, [string, string, string]> = {
  flower: ['#A6DE94', '#7CC97A', '#5DB563'],
  moon: ['#CBC2F2', '#AA9DE6', '#8E7CE0'],
  ember: ['#FFD39A', '#FFB36E', '#F7954A'],
  tide: ['#A7E1F0', '#73C8E3', '#3FAED6'],
};

function Cloud({ width, top, duration, delay, scale }: { width: number; top: number; duration: number; delay: number; scale: number }) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!width) return;
    x.setValue(0);
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration, delay, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [width]);
  return (
    <Animated.View style={{ position: 'absolute', top, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-90 * scale, width + 20] }) }, { scale }] }} pointerEvents="none">
      <Svg width={90} height={40} viewBox="0 0 90 40">
        <Path d="M15 34 Q2 34 4 24 Q6 14 18 17 Q22 4 37 7 Q47 0 57 9 Q72 6 74 19 Q88 19 86 28 Q85 34 74 34 Z" fill="#FFFFFF" opacity={0.85} />
      </Svg>
    </Animated.View>
  );
}

export function Backdrop({ element, sky, scene }: { element: Element; sky: Sky; scene?: string }) {
  const theme = scene ? SCENES[scene] : undefined;
  const [top, bottom] = theme ? theme.sky : SKY[sky];
  const [h1, h2, h3] = theme ? theme.hills : HILLS[element];
  const night = theme ? !!theme.dark : sky === 'night';
  const dim = theme ? 1 : night ? 0.75 : 1;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice">
      <Defs>
        <LinearGradient id={`sky-${scene ?? sky}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset="1" stopColor={bottom} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={400} height={300} fill={`url(#sky-${scene ?? sky})`} />
      {theme ? (
        theme.extras
      ) : night ? (
        <>
          {[[40, 30], [90, 60], [150, 22], [230, 48], [300, 26], [350, 70], [200, 80], [60, 95]].map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.8 : 1.2} fill="#FFFFFF" opacity={0.85} />
          ))}
          <Circle cx={330} cy={52} r={20} fill="#FFF4C7" />
          <Circle cx={340} cy={46} r={18} fill={top} />
        </>
      ) : (
        <>
          <Circle cx={sky === 'dusk' ? 70 : 335} cy={sky === 'day' ? 50 : 82} r={30} fill={sky === 'day' ? '#FFE27A' : '#FFC46B'} opacity={0.35} />
          <Circle cx={sky === 'dusk' ? 70 : 335} cy={sky === 'day' ? 50 : 82} r={20} fill={sky === 'day' ? '#FFD84D' : '#FFB347'} />
        </>
      )}
      <Path d="M0 210 Q80 160 170 195 T400 180 V300 H0 Z" fill={h1} opacity={dim} />
      <Path d="M0 235 Q120 195 220 228 T400 220 V300 H0 Z" fill={h2} opacity={dim} />
      <Path d="M0 262 Q200 238 400 262 V300 H0 Z" fill={h3} opacity={dim} />
      {!theme &&
        [[40, 266], [120, 258], [300, 262], [365, 270], [210, 255]].map(([x, y], i) => (
          <Path key={i} d={`M${x} ${y} l-3 -9 M${x} ${y} l0 -11 M${x} ${y} l3 -9`} stroke={h3} strokeWidth={2.5} strokeLinecap="round" opacity={0.9} />
        ))}
      {!theme &&
        [[70, 250, '#FFFFFF'], [330, 248, '#FFE27A'], [260, 270, '#FF9EB5']].map(([x, y, c], i) => (
          <Circle key={'f' + i} cx={x as number} cy={y as number} r={3.2} fill={c as string} />
        ))}
      <Ellipse cx={200} cy={268} rx={70} ry={9} fill="rgba(20,40,40,0.12)" />
    </Svg>
  );
}

/** Hearts that float up when you tap your pet. */
function Hearts({ burst, set = ['💖', '💛', '✨', '💚', '💜'] }: { burst: number; set?: string[] }) {
  const [hearts, setHearts] = useState<{ id: number; x: number; v: Animated.Value; emoji: string }[]>([]);
  useEffect(() => {
    if (!burst) return;
    const made = Array.from({ length: 5 }, (_, i) => ({ id: burst * 10 + i, x: (Math.random() - 0.5) * 120, v: new Animated.Value(0), emoji: set[i % set.length] }));
    setHearts((h) => [...h, ...made]);
    made.forEach((h, i) => Animated.timing(h.v, { toValue: 1, duration: 900 + i * 90, easing: Easing.out(Easing.quad), useNativeDriver: true }).start());
    const t = setTimeout(() => setHearts((list) => list.filter((h) => !made.includes(h))), 1400);
    return () => clearTimeout(t);
  }, [burst]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {hearts.map((h) => (
        <Animated.Text
          key={h.id}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 90,
            fontSize: 22,
            opacity: h.v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
            transform: [{ translateX: h.v.interpolate({ inputRange: [0, 1], outputRange: [-10, h.x - 10] }) }, { translateY: h.v.interpolate({ inputRange: [0, 1], outputRange: [0, -130] }) }, { scale: h.v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, 1.2, 0.9] }) }],
          }}
        >
          {h.emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

/** "+12 XP" that floats up from the pet whenever today's XP goes up. */
function XpFloat({ amount, id }: { amount: number; id: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 1300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      key={id}
      style={[styles.xpFloat, { opacity: v.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, -70] }) }, { scale: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.6, 1.15, 1] }) }] }]}
    >
      <Text style={styles.xpFloatText}>+{amount} XP</Text>
    </Animated.View>
  );
}

/** A toy you drag from the tray and drop on your pet (like Toca Boca). */
function DraggableToy({ toy, onDrop, onTap, onGrab, small }: { toy: Cosmetic; onDrop: (x: number, y: number) => boolean; onTap: () => void; onGrab: () => void; small?: boolean }) {
  const pos = useRef(new Animated.ValueXY()).current;
  const lift = useRef(new Animated.Value(0)).current;
  const moved = useRef(false);
  const cb = useRef({ onDrop, onTap, onGrab });
  cb.current = { onDrop, onTap, onGrab };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        moved.current = false;
        cb.current.onGrab();
        Animated.spring(lift, { toValue: 1, friction: 5, useNativeDriver: false }).start();
      },
      onPanResponderMove: (e, g) => {
        if (Math.abs(g.dx) + Math.abs(g.dy) > 6) moved.current = true;
        pos.setValue({ x: g.dx, y: g.dy });
      },
      onPanResponderRelease: (e, g) => {
        Animated.spring(lift, { toValue: 0, friction: 5, useNativeDriver: false }).start();
        if (!moved.current) {
          pos.setValue({ x: 0, y: 0 });
          cb.current.onTap();
          return;
        }
        if (cb.current.onDrop(g.moveX, g.moveY)) {
          // Eaten or played with: vanish, then pop back into the tray.
          lift.setValue(0);
          pos.setValue({ x: 0, y: 0 });
          return;
        }
        Animated.spring(pos, { toValue: { x: 0, y: 0 }, friction: 6, tension: 80, useNativeDriver: false }).start();
      },
    }),
  ).current;
  return (
    <Animated.View
      {...pan.panHandlers}
      accessibilityLabel={`${toy.name}: drag onto your pet`}
      style={[
        styles.toy,
        small && { width: 34, height: 34, borderRadius: 11 },
        Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as any) : null,
        { zIndex: 20, transform: [{ translateX: pos.x }, { translateY: pos.y }, { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }] },
      ]}
    >
      <Text style={[styles.toyEmoji, small && { fontSize: 19 }]} selectable={false}>{toy.emoji}</Text>
    </Animated.View>
  );
}

export default function PetScene({ onTrinketsEmpty, onDressUp, onShop }: { onTrinketsEmpty?: () => void; onDressUp?: () => void; onShop?: () => void }) {
  const { state, apply } = useGame();
  const pet = A.activePet(state)!;
  const sp = SPECIES_BY_ID[pet.speciesId];
  const d = A.today(state);
  const stage = stageFor(pet.xp);
  const lp = levelProgress(pet.xp);
  const mood = C.moodFor(d);
  const mi = C.MOOD_INFO[mood];
  const tasks = C.careTasks(d);
  const mult = C.careMultiplier(d);
  const trinkets = C.trinketCount(state);
  const [sky] = useState(skyNow);
  const [width, setWidth] = useState(0);

  // Idle: gentle bob and breathing. Tapping makes the pet hop.
  const bob = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: mood === 'sleepy' ? 1800 : 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: mood === 'sleepy' ? 1800 : 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [mood]);
  const [burst, setBurst] = useState(0);

  const doPlay = () => {
    buzz('light', 'pop');
    setBurst((b) => b + 1);
    hop.setValue(0);
    Animated.sequence([
      Animated.timing(hop, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(hop, { toValue: 0, friction: 3.5, tension: 140, useNativeDriver: true }),
    ]).start();
    apply(C.play);
  };

  // Toy reactions.
  const spin = useRef(new Animated.Value(0)).current;
  const squash = useRef(new Animated.Value(0)).current;
  const [toyLine, setToyLine] = useState<{ id: number; text: string } | null>(null);
  const [burstSet, setBurstSet] = useState<string[] | undefined>(undefined);
  const [toyHint, setToyHint] = useState(false);
  const petBox = useRef<any>(null);
  const petRect = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const measurePet = () =>
    petBox.current?.measureInWindow?.((x: number, y: number, w: number, h: number) => {
      petRect.current = { x, y, w, h };
    });
  const toys = ownedToys(state);

  const react = (toy: Cosmetic) => {
    const sounds = { munch: 'munch', bubbles: 'bubbles', notes: 'notes', rocket: 'whoosh', spin: 'whoosh', hop: toy.id === 'duck' ? 'squeak' : 'pop' } as const;
    buzz('success', sounds[toy.reaction ?? 'hop']);
    const sets: Record<string, string[]> = {
      munch: ['😋', '✨', '💛'],
      bubbles: ['🫧', '🫧', '✨', '🫧'],
      notes: ['🎵', '🎶', '🎵', '🎶'],
      rocket: ['⭐', '🌟', '✨', '⭐'],
      spin: ['💫', '✨', '💖'],
      hop: ['💖', '💛', '✨', '💚', '💜'],
    };
    setBurstSet(sets[toy.reaction ?? 'hop']);
    setBurst((b) => b + 1);
    setToyLine({ id: Date.now(), text: toy.line ?? 'Yay!' });
    setTimeout(() => setToyLine((l) => (l && Date.now() - l.id >= 2200 ? null : l)), 2300);
    if (toy.reaction === 'munch') {
      squash.setValue(0);
      Animated.sequence([0, 1, 2].flatMap(() => [
        Animated.timing(squash, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(squash, { toValue: 0, duration: 140, useNativeDriver: true }),
      ])).start();
    } else if (toy.reaction === 'spin') {
      spin.setValue(0);
      Animated.timing(spin, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start();
    } else {
      const high = toy.reaction === 'rocket' ? 1 : 0.6;
      hop.setValue(0);
      Animated.sequence([
        Animated.timing(hop, { toValue: high * (toy.reaction === 'rocket' ? 3 : 1), duration: toy.reaction === 'rocket' ? 420 : 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(hop, { toValue: 0, friction: 3.5, tension: 120, useNativeDriver: true }),
      ]).start();
    }
    apply(C.playToy);
  };

  // Drop test: is the finger over the pet?
  const dropOnPet = (toy: Cosmetic) => (x: number, y: number) => {
    const r = petRect.current;
    const hit = !!r && x >= r.x - 30 && x <= r.x + r.w + 30 && y >= r.y - 30 && y <= r.y + r.h + 30;
    if (hit) react(toy);
    return hit;
  };

  // Floating XP and level-up banners.
  const total = C.boostedTotal(d);
  const lastTotal = useRef(total);
  const lastLevel = useRef(lp.level);
  const [floats, setFloats] = useState<{ id: number; amount: number }[]>([]);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  useEffect(() => {
    const gained = total - lastTotal.current;
    lastTotal.current = total;
    if (gained > 0) {
      const id = Date.now();
      setFloats((f) => [...f.slice(-3), { id, amount: gained }]);
      setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1400);
    }
  }, [total]);
  useEffect(() => {
    if (lp.level > lastLevel.current) {
      buzz('success', 'levelup');
      setLevelUp(lp.level);
      setTimeout(() => setLevelUp(null), 2600);
    }
    lastLevel.current = lp.level;
  }, [lp.level]);
  useEffect(() => {
    lastTotal.current = total;
    lastLevel.current = lp.level;
  }, [pet.id]);

  const petTransform = [
    { translateY: Animated.add(bob.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }), hop.interpolate({ inputRange: [0, 1], outputRange: [0, -38] })) },
    { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
    { scaleY: Animated.add(bob.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }), squash.interpolate({ inputRange: [0, 1], outputRange: [0, -0.14] })) },
    { scaleX: Animated.add(bob.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }), squash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.1] })) },
  ];
  const night = state.scene && SCENES[state.scene] ? !!SCENES[state.scene].dark : sky === 'night';
  const ink = night ? '#FFFFFF' : colors.ink;

  return (
    <View style={styles.card}>
      <View style={styles.scene} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <Backdrop element={sp.element} sky={sky} scene={state.scene} />
        <Cloud width={width} top={18} duration={38000} delay={0} scale={1} />
        <Cloud width={width} top={58} duration={52000} delay={9000} scale={0.7} />

        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.level}><Text style={styles.levelText}>Lv {lp.level}</Text></View>
              <TextInput
                style={[styles.name, { color: ink }]}
                defaultValue={pet.nickname}
                key={pet.id + pet.nickname}
                onEndEditing={(e) => apply((s) => A.renamePet(s, pet.id, e.nativeEvent.text))}
                onBlur={(e: any) => e?.nativeEvent?.text !== undefined && apply((s) => A.renamePet(s, pet.id, e.nativeEvent.text))}
                accessibilityLabel="Pet name"
                maxLength={14}
              />
            </View>
            <Text style={[styles.sub, { color: night ? '#DDE3FF' : '#4E5F66' }]}>
              {sp.name} · {STAGE_LABEL[stage]}{pet.shiny ? ' · ✦ Shiny' : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <RarityBadge rarity={sp.rarity} />
            <View style={[styles.mood, { borderColor: mi.color }]}>
              <Text style={[styles.moodText, { color: mi.color }]}>{mi.emoji} {mi.label}</Text>
            </View>
          </View>
        </View>

        <View style={styles.stage}>
          <View style={styles.bubbleWrap} pointerEvents="none">
            <PopIn key={toyLine ? toyLine.id : toyHint ? 'hint' : mood}>
              <View style={styles.bubble}>
                <Text style={styles.bubbleText}>{toyLine ? toyLine.text : toyHint ? 'Drag a toy onto me!' : C.moodLine(mood, pet.nickname)}</Text>
              </View>
            </PopIn>
          </View>
          <Hearts burst={burst} set={burstSet} />
          {floats.map((f) => (
            <XpFloat key={f.id} id={f.id} amount={f.amount} />
          ))}
          <Pressable onPress={doPlay} accessibilityRole="button" accessibilityLabel={`Play with ${pet.nickname}`}>
            <Animated.View ref={petBox as any} style={{ transform: petTransform }}>
              <PetSprite species={sp} stage={stage} size={200} shiny={pet.shiny} skin={pet.skin} mood={mood === 'sleepy' ? 'sleepy' : mood === 'joy' ? 'joy' : 'happy'} hat={pet.look?.hat} aura={pet.look?.aura} />
            </Animated.View>
          </Pressable>
          {levelUp ? (
            <View style={styles.levelUpWrap} pointerEvents="none">
              <PopIn key={levelUp}>
                <View style={styles.levelUp}>
                  <Text style={styles.levelUpText}>LEVEL UP! Lv {levelUp}</Text>
                  <Text style={styles.levelUpSub}>+1 stat point to train</Text>
                </View>
              </PopIn>
            </View>
          ) : null}
        </View>

        <View style={styles.tray}>
          <Pressable onPress={onDressUp} style={styles.trayBtn} accessibilityRole="button" accessibilityLabel="Dress up">
            <Text style={styles.trayIcon}>👗</Text>
            <Text style={styles.trayLabel}>Dress</Text>
          </Pressable>
          <View style={styles.toys}>
            {toys.slice(0, 7).map((t) => (
              <DraggableToy
                key={t.id}
                toy={t}
                small={toys.length > 5}
                onDrop={dropOnPet(t)}
                onGrab={measurePet}
                onTap={() => {
                  setToyHint(true);
                  setTimeout(() => setToyHint(false), 1800);
                }}
              />
            ))}
          </View>
          <Pressable onPress={onShop} style={styles.trayBtn} accessibilityRole="button" accessibilityLabel="Shop">
            <Text style={styles.trayIcon}>🛍️</Text>
            <Text style={styles.trayLabel}>Shop</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.xpRow}>
          <Text style={styles.xpLabel}>{lp.max ? `Lv ${lp.level} · Max level` : `Lv ${lp.level} → ${lp.level + 1}`}</Text>
          <Text style={styles.xpNum}>{lp.max ? `${pet.xp.toLocaleString()} XP` : `${lp.into.toLocaleString()} / ${lp.need.toLocaleString()} XP`}</Text>
        </View>
        <ProgressBar value={lp.into / lp.need} height={12} />

        <View style={styles.careHead}>
          <Text style={styles.careTitle}>Care for {pet.nickname}</Text>
          <View style={[styles.boost, mult > 1 && styles.boostOn]}>
            <Text style={[styles.boostText, mult > 1 && { color: '#9A6A00' }]}>XP boost ×{mult.toFixed(1)}</Text>
          </View>
        </View>
        <View style={styles.careRow}>
          <CareButton icon="🍙" label="Feed" done={tasks[0].done} onPress={() => { buzz('success'); apply(C.feed); }} />
          <CareButton icon="🎾" label={tasks[1].done ? 'Play' : `Play ${tasks[1].progress}`} done={tasks[1].done} onPress={doPlay} />
          <CareButton
            icon="✨"
            label={trinkets ? `Treat (${trinkets})` : 'Treat'}
            done={tasks[2].done}
            disabled={!tasks[2].done && trinkets === 0}
            onPress={() => {
              if (!trinkets) return onTrinketsEmpty?.();
              buzz('success');
              setBurst((b) => b + 1);
              apply(C.treat);
            }}
          />
        </View>
        <Text style={styles.hint}>
          {mult >= 1.3 - 1e-9 ? `${pet.nickname} is very well cared for today. Every habit earns 30% more XP!` : trinkets === 0 && !tasks[2].done ? 'Each care task adds +10% XP today. Trinkets for treats come from chests.' : 'Each care task adds +10% XP today. Your pet never loses anything if you skip a day.'}
        </Text>
      </View>
    </View>
  );
}

function CareButton({ icon, label, done, disabled, onPress }: { icon: string; label: string; done: boolean; disabled?: boolean; onPress: () => void }) {
  const press = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={done || disabled ? undefined : onPress}
      onPressIn={() => Animated.spring(press, { toValue: 0.92, useNativeDriver: true, friction: 6 }).start()}
      onPressOut={() => Animated.spring(press, { toValue: 1, useNativeDriver: true, friction: 4 }).start()}
      style={{ flex: 1 }}
      accessibilityRole="button"
      accessibilityState={{ disabled: done || disabled, checked: done }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.careBtn, done && styles.careDone, disabled && { opacity: 0.45 }, { transform: [{ scale: press }] }]}>
        <Text style={{ fontSize: 22 }}>{done ? '✅' : icon}</Text>
        <Text style={[styles.careLabel, done && { color: colors.mintDark }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 26, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, shadowColor: '#2B4A40', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  scene: { height: 410 },
  tray: { position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 20, padding: 6, zIndex: 10 },
  trayBtn: { alignItems: 'center', width: 52, paddingVertical: 2 },
  trayIcon: { fontSize: 22 },
  trayLabel: { fontSize: 10, fontWeight: '900', color: colors.ink },
  toys: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  toy: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.line },
  toyEmoji: { fontSize: 24 },
  head: { flexDirection: 'row', gap: space.sm, padding: space.lg, paddingBottom: 0 },
  level: { backgroundColor: colors.gold, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 2, borderColor: '#FFFFFF' },
  levelText: { color: '#5A3E00', fontWeight: '900', fontSize: 13 },
  name: { fontSize: 24, fontWeight: '900', padding: 0, flexShrink: 1, minWidth: 60 },
  sub: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  mood: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 9, paddingVertical: 3 },
  moodText: { fontSize: 12, fontWeight: '900' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 72, paddingTop: 44 },
  bubbleWrap: { position: 'absolute', top: 6, left: 0, right: 0, alignItems: 'center', zIndex: 3 },
  bubble: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 7, paddingHorizontal: 12, maxWidth: 230, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  bubbleText: { fontSize: 13, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  xpFloat: { position: 'absolute', bottom: 150, alignSelf: 'center', backgroundColor: colors.gold, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, zIndex: 5 },
  xpFloatText: { fontWeight: '900', color: '#5A3E00', fontSize: 15 },
  levelUpWrap: { position: 'absolute', top: 10, left: 0, right: 0, alignItems: 'center' },
  levelUp: { backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8, borderWidth: 3, borderColor: colors.gold },
  levelUpSub: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, textAlign: 'center' },
  levelUpText: { color: colors.gold, fontWeight: '900', fontSize: 18, letterSpacing: 1 },
  footer: { padding: space.lg, paddingTop: space.md, gap: 6 },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between' },
  xpLabel: { fontWeight: '900', fontSize: 13, color: colors.ink },
  xpNum: { fontWeight: '800', fontSize: 13, color: colors.muted },
  careHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm },
  careTitle: { fontWeight: '900', fontSize: 15, color: colors.ink },
  boost: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: '#F0F3F2' },
  boostOn: { backgroundColor: '#FFF1C9' },
  boostText: { fontWeight: '900', fontSize: 12, color: colors.muted },
  careRow: { flexDirection: 'row', gap: space.sm },
  careBtn: { alignItems: 'center', gap: 2, paddingVertical: 10, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, backgroundColor: '#FAFCFB' },
  careDone: { borderColor: colors.mint, backgroundColor: colors.mintSoft },
  careLabel: { fontWeight: '900', fontSize: 13, color: colors.ink },
  hint: { fontSize: 11, fontWeight: '700', color: colors.muted },
});
