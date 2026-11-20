import Coin from './Coin';
import BagSheet from './BagSheet';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, PanResponder, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import PetSprite from './PetSprite';
import { ProgressBar, RarityBadge } from './ui';
import { buzz, PopIn, RollingNumber } from './fx';
import { RARITY_INFO } from '../game/rarity';
import { SKIN_INFO } from '../game/skins';
import * as W from '../game/wishes';
import { gradeOf } from '../game/stats';
import { colors, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { levelProgress, stageFor } from '../game/scoring';
import * as A from '../game/actions';
import * as C from '../game/care';
import type { Element } from '../game/types';
import { SCENES } from './Cosmetics';
import PowerGlow from './PowerGlow';
import FeedSheet, { NeedsMini, NeedsSheet } from './FeedSheet';
import { useOverlay } from './Overlay';
import * as F from '../game/food';
import { habitBuffs } from '../game/battle';
import { COSMETIC_BY_ID, ownedToys, type Cosmetic } from '../game/cosmetics';

const COIN_PILE = require('../../assets/items/coin_pile.png');

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

/**
 * The scene behind a pet. It measures the space it sits in and draws at that exact size:
 * a percent-sized drawing on iPhone keeps its first size and leaves bare strips when the box grows.
 */
export function Backdrop(props: { element: Element; sky: Sky; scene?: string }) {
  const [box, setBox] = React.useState({ w: 0, h: 0 });
  const theme = props.scene ? SCENES[props.scene] : undefined;
  const base = theme ? theme.sky[1] : SKY[props.sky][1];
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: base }]}
      onLayout={(e) => {
        const w = Math.ceil(e.nativeEvent.layout.width), h = Math.ceil(e.nativeEvent.layout.height);
        if (w !== box.w || h !== box.h) setBox({ w, h });
      }}
    >
      {box.w > 0 ? <BackdropArt {...props} w={box.w} h={box.h} /> : null}
    </View>
  );
}

function BackdropArt({ element, sky, scene, w, h }: { element: Element; sky: Sky; scene?: string; w: number; h: number }) {
  const theme = scene ? SCENES[scene] : undefined;
  const [top, bottom] = theme ? theme.sky : SKY[sky];
  const [h1, h2, h3] = theme ? theme.hills : HILLS[element];
  const night = theme ? !!theme.dark : sky === 'night';
  const dim = theme ? 1 : night ? 0.75 : 1;
  return (
    <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={w} height={h} viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice">
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

const TOY_SIZE = 46;
const AUTO_LINES = ['I love my {toy}!', 'Watch this!', 'Hehe, so fun!', 'Play with me!', 'Again, again!', 'Best day ever!'];
/** Top of a toy resting on the ground, measured from the top of the scene. */
const GROUND_TOP = 318;

/** A toy sitting in the scene. Drag it around, drag it back to the tray, or tap it to make your pet play. */
function PlacedToy({ toy, x, fromY, bounce, onMove, onTap }: { toy: Cosmetic; x: number; fromY: number; bounce: number; onMove: (dx: number, upToTray: boolean) => void; onTap: () => void }) {
  const drop = useRef(new Animated.Value(fromY - GROUND_TOP)).current;
  const jump = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.ValueXY()).current;
  const moved = useRef(false);
  const cb = useRef({ onMove, onTap });
  cb.current = { onMove, onTap };
  useEffect(() => {
    Animated.spring(drop, { toValue: 0, friction: 4, tension: 90, useNativeDriver: false }).start();
  }, []);
  // The pet played with it: it bounces, rolls or wobbles.
  useEffect(() => {
    if (!bounce) return;
    jump.setValue(0);
    Animated.sequence([
      Animated.timing(jump, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.spring(jump, { toValue: 0, friction: 3, tension: 120, useNativeDriver: false }),
    ]).start();
  }, [bounce]);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        moved.current = false;
      },
      onPanResponderMove: (e, g) => {
        if (Math.abs(g.dx) + Math.abs(g.dy) > 6) moved.current = true;
        drag.setValue({ x: g.dx, y: g.dy });
      },
      onPanResponderRelease: (e, g) => {
        if (!moved.current) {
          drag.setValue({ x: 0, y: 0 });
          cb.current.onTap();
          return;
        }
        // Let go: it lands where you dropped it (or goes home if dropped on the tray).
        drop.setValue(g.dy);
        drag.setValue({ x: 0, y: 0 });
        cb.current.onMove(g.dx, GROUND_TOP + g.dy > GROUND_TOP + 40);
        Animated.spring(drop, { toValue: 0, friction: 4, tension: 90, useNativeDriver: false }).start();
      },
    }),
  ).current;
  const isFood = toy.reaction === 'munch';
  return (
    <Animated.View
      {...pan.panHandlers}
      accessibilityLabel={`${toy.name} in the scene: tap to play, drag to move`}
      style={[
        styles.placed,
        Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as any) : null,
        {
          left: x - TOY_SIZE / 2,
          top: GROUND_TOP,
          transform: [
            { translateX: drag.x },
            { translateY: Animated.add(Animated.add(drop, drag.y), jump.interpolate({ inputRange: [0, 1], outputRange: [0, isFood ? -4 : -46] })) },
            { rotate: jump.interpolate({ inputRange: [0, 1], outputRange: ['0deg', toy.reaction === 'spin' ? '200deg' : '25deg'] }) },
          ],
        },
      ]}
    >
      <View style={styles.placedShadow} />
      <Text style={styles.placedEmoji} selectable={false}>{toy.emoji}</Text>
    </Animated.View>
  );
}

/** The yard: the pet's feet can be anywhere between these two lines (further up = further back). */
const SCENE_H = 500;
const FLOOR_TOP = 262;
const FLOOR_BOTTOM = 372;
const HOME_FEET = 340;
const PET_SIZE = 170;

/** The color at the very top of the home yard's sky (for the strip behind the phone's status bar), or whether it's a dark sky. */
export function yardSkyTop(s: { scene?: string }, wantDark?: false): string;
export function yardSkyTop(s: { scene?: string }, wantDark: true): boolean;
export function yardSkyTop(s: { scene?: string }, wantDark = false): string | boolean {
  const theme = s.scene ? SCENES[s.scene] : undefined;
  const sky = skyNow();
  if (wantDark) return theme ? !!theme.dark : sky === 'night';
  return theme ? theme.sky[0] : SKY[sky][0];
}

/** The home yard, drawn from a tilted top-down view: sky and fence at the back, a lawn floor the pet walks on. */
export function YardBackdrop({ element, sky, scene }: { element: Element; sky: Sky; scene?: string }) {
  const [box, setBox] = React.useState({ w: 0, h: 0 });
  const theme = scene ? SCENES[scene] : undefined;
  const [top, bottom] = theme ? theme.sky : SKY[sky];
  const [h1, h2, h3] = theme ? theme.hills : HILLS[element];
  const night = theme ? !!theme.dark : sky === 'night';
  const { w, h } = box;
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: h1 }]}
      onLayout={(e) => {
        const nw = Math.ceil(e.nativeEvent.layout.width), nh = Math.ceil(e.nativeEvent.layout.height);
        if (nw !== box.w || nh !== box.h) setBox({ w: nw, h: nh });
      }}
    >
      {w > 0 ? (
        <Svg width={w} height={h} style={{ position: 'absolute', top: 0, left: 0 }}>
          <Defs>
            <LinearGradient id={`ysky-${scene ?? sky}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={top} />
              <Stop offset="1" stopColor={bottom} />
            </LinearGradient>
            <LinearGradient id={`ylawn-${scene ?? element}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={h1} />
              <Stop offset="1" stopColor={h2} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={w} height={210} fill={`url(#ysky-${scene ?? sky})`} />
          {night ? (
            <>
              <Circle cx={w * 0.8} cy={70} r={22} fill="#FFF6D6" />
              {[0.1, 0.25, 0.4, 0.55, 0.92].map((x, i) => <Circle key={i} cx={w * x} cy={30 + (i % 3) * 28} r={2} fill="#FFFFFF" opacity={0.8} />)}
            </>
          ) : (
            <Circle cx={w * 0.82} cy={96} r={34} fill="#FFF3B8" opacity={0.85} />
          )}
          <Path d={`M0 150 Q${w * 0.15} 118 ${w * 0.32} 140 T${w * 0.64} 134 T${w} 140 V210 H0z`} fill={h3} opacity={0.9} />
          <Rect x={0} y={170} width={w} height={38} fill={night ? '#8C7A9E' : '#E8C79A'} />
          {Array.from({ length: Math.ceil(w / 32) + 1 }, (_, i) => (
            <Rect key={i} x={i * 32 + 8} y={170} width={3} height={38} fill={night ? '#6E5E82' : '#B98B55'} />
          ))}
          <Rect x={0} y={180} width={w} height={3} fill={night ? '#6E5E82' : '#B98B55'} />
          <Rect x={0} y={197} width={w} height={3} fill={night ? '#6E5E82' : '#B98B55'} />
          <Rect x={0} y={206} width={w} height={h - 206} fill={`url(#ylawn-${scene ?? element})`} />
          {[250, 300, 360, 430].map((y) => <Rect key={y} x={0} y={y} width={w} height={2} fill="#FFFFFF" opacity={0.16} />)}
          {[-0.35, -0.12, 0.12, 0.35].map((k) => (
            <Path key={k} d={`M${w / 2 + k * w * 0.55} 206 L${w / 2 + k * w * 1.9} ${h}`} stroke="#FFFFFF" strokeOpacity={0.14} strokeWidth={2} />
          ))}
          <Ellipse cx={w / 2} cy={330} rx={Math.min(130, w * 0.32)} ry={34} fill="#FFFFFF" opacity={0.28} />
          <Ellipse cx={w / 2} cy={330} rx={Math.min(112, w * 0.28)} ry={26} fill="none" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={3} strokeDasharray="6 6" />
          {[
            [0.08, 236], [0.11, 240], [0.9, 250], [0.78, 452], [0.2, 470],
          ].map(([x, y], i) => (
            <Path key={i} d={`M${w * x} ${y}c4-12 9-12 12 0`} stroke={h3} strokeWidth={3} fill="none" strokeLinecap="round" />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

function Bed() {
  return (
    <Svg width={96} height={62} viewBox="0 0 96 62">
      <Ellipse cx={48} cy={54} rx={44} ry={7} fill="#000" opacity={0.15} />
      <Ellipse cx={48} cy={38} rx={44} ry={18} fill="#C46A8E" stroke="#5A2A3A" strokeWidth={3} />
      <Ellipse cx={48} cy={34} rx={34} ry={11} fill="#F7B6CC" />
      <Ellipse cx={32} cy={30} rx={12} ry={7} fill="#FFFFFF" stroke="#5A2A3A" strokeWidth={2} />
    </Svg>
  );
}
function Bowl({ full }: { full: boolean }) {
  return (
    <Svg width={64} height={44} viewBox="0 0 64 44">
      <Ellipse cx={32} cy={38} rx={28} ry={5} fill="#000" opacity={0.15} />
      <Path d="M6 18h52l-6 18H12z" fill="#4A8FE0" stroke="#1F3F6A" strokeWidth={3} strokeLinejoin="round" />
      <Ellipse cx={32} cy={18} rx={26} ry={7} fill={full ? '#F2B04A' : '#D6E4F2'} stroke="#1F3F6A" strokeWidth={3} />
      {full ? (
        <>
          <Circle cx={24} cy={15} r={3} fill="#C9772A" />
          <Circle cx={36} cy={14} r={3} fill="#C9772A" />
        </>
      ) : null}
    </Svg>
  );
}
function Ball() {
  return (
    <Svg width={44} height={44} viewBox="0 0 44 44">
      <Ellipse cx={22} cy={40} rx={14} ry={3} fill="#000" opacity={0.15} />
      <Circle cx={22} cy={22} r={16} fill="#FF6B5B" stroke="#5A1A1A" strokeWidth={3} />
      <Path d="M8 18c8 4 20 4 28 0" fill="none" stroke="#FFFFFF" strokeWidth={4} />
    </Svg>
  );
}
function Plant() {
  return (
    <Svg width={46} height={60} viewBox="0 0 46 60">
      <Ellipse cx={23} cy={56} rx={16} ry={3} fill="#000" opacity={0.15} />
      <Path d="M9 34h28l-4 22H13z" fill="#D9774A" stroke="#5A2A1A" strokeWidth={3} strokeLinejoin="round" />
      <Path d="M23 34c-10-6-16-18-10-26 4 8 8 12 10 26zM23 34c8-8 18-14 18-24-8 4-14 10-18 24z" fill="#5CC27A" stroke="#2E6B3E" strokeWidth={2.5} strokeLinejoin="round" />
    </Svg>
  );
}

export default function PetScene({ onTrinketsEmpty, onDressUp, onShop, onAccount, account }: { onTrinketsEmpty?: () => void; onDressUp?: () => void; onShop?: (store?: 'food' | 'general') => void; onAccount?: () => void; account?: { initial: string; label: string; warn?: boolean } }) {
  const { state, apply } = useGame();
  const pet = A.activePet(state)!;
  const sp = SPECIES_BY_ID[pet.speciesId];
  const d = A.today(state);
  const stage = stageFor(pet.xp);
  const lp = levelProgress(pet.xp);
  const mood = C.moodFor(d);
  const wish = W.activeWish(state);
  const mi = C.MOOD_INFO[mood];
  const tasks = C.careTasks(d);
  const needs = F.needsFor(d);
  const overlay = useOverlay();
  const trinkets = C.trinketCount(state);
  const [sky, setSky] = useState(skyNow);
  useEffect(() => {
    const t = setInterval(() => setSky(skyNow()), 60000);
    return () => clearInterval(t);
  }, []);
  const [width, setWidth] = useState(0);
  const [showToys, setShowToys] = useState(false);
  const streak = A.streak(state);

  // Idle: gentle bob and breathing. Tapping makes the pet hop.
  const bob = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const step = useRef(new Animated.Value(0)).current;
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

  const hopOnce = (high = 1) => {
    hop.setValue(0);
    Animated.sequence([
      Animated.timing(hop, { toValue: high, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(hop, { toValue: 0, friction: 3.5, tension: 140, useNativeDriver: true }),
    ]).start();
  };
  const doPlay = () => {
    buzz('light', 'pop');
    setBurst((b) => b + 1);
    hopOnce();
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
  const allToys = ownedToys(state);
  const buffs = habitBuffs(state);
  const [placed, setPlaced] = useState<{ key: number; id: string; x: number; fromY: number; bounce: number }[]>([]);
  const toys = allToys.filter((t) => !placed.some((p) => p.id === t.id));
  const sceneBox = useRef<any>(null);
  const sceneRect = useRef<{ x: number; y: number } | null>(null);
  const measureAll = () => {
    measurePet();
    sceneBox.current?.measureInWindow?.((x: number, y: number) => {
      sceneRect.current = { x, y };
    });
  };
  const say = (text: string) => {
    setToyLine({ id: Date.now(), text });
    setTimeout(() => setToyLine((l) => (l && Date.now() - l.id >= 2200 ? null : l)), 2300);
  };

  // Walking around the yard. petX is the offset from the middle, petY is where the feet are.
  const petX = useRef(new Animated.Value(0)).current;
  const petY = useRef(new Animated.Value(HOME_FEET)).current;
  const face = useRef(new Animated.Value(1)).current;
  const pos = useRef({ x: 0, y: HOME_FEET });
  const busy = useRef(false);
  const lastAct = useRef(Date.now());
  const walkTo = (targetX: number, targetY: number | null, then?: () => void) => {
    const limit = Math.max(0, width / 2 - 70);
    const to = Math.max(-limit, Math.min(limit, targetX));
    const ty = Math.max(FLOOR_TOP, Math.min(FLOOR_BOTTOM, targetY ?? pos.current.y));
    const dist = Math.hypot(to - pos.current.x, (ty - pos.current.y) * 1.6);
    if (Math.abs(to - pos.current.x) > 6) face.setValue(to < pos.current.x ? -1 : 1);
    pos.current = { x: to, y: ty };
    if (dist < 6) return then?.();
    const duration = Math.min(2200, 300 + dist * 6);
    busy.current = true;
    const steps = Animated.loop(
      Animated.sequence([
        Animated.timing(step, { toValue: 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(step, { toValue: 0, duration: 150, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    steps.start();
    Animated.parallel([
      Animated.timing(petX, { toValue: to, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(petY, { toValue: ty, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]).start(() => {
      steps.stop();
      step.setValue(0);
      busy.current = false;
      then?.();
    });
  };
  /** Walk next to a toy at scene x, then play with it. */
  const playWith = (key: number, earn: boolean) => {
    const p = placedRef.current.find((q) => q.key === key);
    if (!p) return;
    const toy = COSMETIC_BY_ID[p.id];
    const center = width / 2;
    const side = p.x < center + pos.current.x ? 1 : -1;
    lastAct.current = Date.now();
    walkTo(p.x - center + side * 58, GROUND_TOP + TOY_SIZE, () => {
      react(toy, earn);
      if (toy.reaction === 'munch') {
        setTimeout(() => setPlaced((list) => list.filter((q) => q.key !== key)), 800);
      } else {
        setPlaced((list) => list.map((q) => (q.key === key ? { ...q, bounce: q.bounce + 1 } : q)));
      }
    });
  };
  const placedRef = useRef(placed);
  placedRef.current = placed;
  // The pet wanders the yard on its own, and plays with any toy that's out.
  useEffect(() => {
    if (!width) return;
    const t = setInterval(() => {
      if (busy.current || Date.now() - lastAct.current < 3500) return;
      const fun = placedRef.current.filter((p) => COSMETIC_BY_ID[p.id]?.reaction !== 'munch');
      if (fun.length && Math.random() < 0.5) return playWith(fun[Math.floor(Math.random() * fun.length)].key, false);
      if (Math.random() < (mood === 'sleepy' ? 0.7 : 0.3)) return;
      const limit = Math.max(0, width / 2 - 80);
      walkTo((Math.random() * 2 - 1) * limit, FLOOR_TOP + Math.random() * (FLOOR_BOTTOM - FLOOR_TOP));
    }, 4200);
    return () => clearInterval(t);
  }, [width, mood]);

  const react = (toy: Cosmetic, earn = true) => {
    const sounds = { munch: 'munch', bubbles: 'bubbles', notes: 'notes', rocket: 'whoosh', spin: 'whoosh', hop: toy.id === 'duck' ? 'squeak' : 'pop' } as const;
    buzz(earn ? 'success' : 'light', sounds[toy.reaction ?? 'hop']);
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
    say(earn ? toy.line ?? 'Yay!' : AUTO_LINES[Math.floor(Math.random() * AUTO_LINES.length)].replace('{toy}', toy.name.toLowerCase()));
    if (toy.reaction === 'munch') munch();
    else if (toy.reaction === 'spin') {
      spin.setValue(0);
      Animated.timing(spin, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start();
    } else hopOnce(toy.reaction === 'rocket' ? 3 : 0.6);
    if (earn) apply(C.playToy);
  };
  const munch = () => {
    squash.setValue(0);
    Animated.sequence([0, 1, 2].flatMap(() => [
      Animated.timing(squash, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(squash, { toValue: 0, duration: 140, useNativeDriver: true }),
    ])).start();
  };

  // Things in the yard. Tapping one sends the pet over.
  const bed = { x: 20, y: 214 };
  const bowl = { x: Math.max(0, width - 76), y: 300 };
  const ball = { x: 14, y: 300 };
  const goBed = () => {
    lastAct.current = Date.now() + 4000;
    walkTo(bed.x + 48 - width / 2, FLOOR_TOP, () => {
      buzz('light', 'pop');
      say(mood === 'sleepy' || night ? 'Zzz… so cozy.' : 'My comfy bed!');
    });
  };
  /** Walk to the bowl and eat the chosen food. */
  const eat = (foodId: string) => {
    lastAct.current = Date.now() + 4000;
    walkTo(bowl.x - 20 - width / 2, bowl.y + 40, () => {
      const f = F.FOOD_BY_ID[foodId];
      buzz('success', 'munch');
      munch();
      const mult = f ? F.tasteMult(pet, f.id) : 1;
      const first = f && !pet.tasted?.includes(f.id);
      setBurstSet(mult > 1 ? ['💖', '💖', '✨'] : f ? [f.emoji, '✨', '💪'] : ['😋', '✨', '💛']);
      setBurst((b) => b + 1);
      const gain = f ? F.boostFor(pet, f, A.today(state)) : 0;
      const boost = gain > 0 ? ` ${F.pct(gain)} ${F.statLabel(f!.stat)}!` : '';
      say(!f ? 'Crunchy pellets, thanks!' : mult > 1 ? `${first ? 'My favorite!' : 'My favorite, again!'}${boost}` : mult < 1 ? `Hmm, not my favorite.${boost}` : gain > 0 ? `Yum!${boost}` : `Yum, ${f.name}!`);
      apply((s) => C.feed(s, foodId));
    });
  };
  /** Feed opens the food picker. */
  const goBowl = (_fromButton = false) => {
    overlay.open(
      <FeedSheet
        onClose={overlay.close}
        onShop={onShop ? () => { overlay.close(); onShop('food'); } : undefined}
        onFeed={(id) => {
          overlay.close();
          eat(id);
        }}
      />,
    );
  };
  const openNeeds = () =>
    overlay.open(
      <NeedsSheet
        name={pet.nickname}
        needs={needs}
        onClose={overlay.close}
        onFeed={() => {
          overlay.close();
          goBowl(true);
        }}
        onPlay={() => {
          overlay.close();
          goBall();
        }}
      />,
    );
  const goBall = () => {
    lastAct.current = Date.now() + 4000;
    walkTo(ball.x + 60 - width / 2, ball.y + 40, () => {
      say('Again! Again!');
      doPlay();
    });
  };

  // Drop test: is the finger over the pet?
  const dropToy = (toy: Cosmetic) => (x: number, y: number) => {
    const sr = sceneRect.current;
    if (!sr) return false;
    const sx = x - sr.x;
    const sy = y - sr.y;
    if (sx < 0 || sx > width || sy < 206 || sy > FLOOR_BOTTOM + 30) return false; // dropped off the floor: back it goes
    const r = petRect.current;
    const onPet = !!r && x >= r.x - 30 && x <= r.x + r.w + 30 && y >= r.y - 30 && y <= r.y + r.h + 30;
    const center = width / 2 + pos.current.x;
    const tx = onPet ? center + (sx < center ? -58 : 58) : Math.max(TOY_SIZE, Math.min(width - TOY_SIZE, sx));
    const key = Date.now();
    setPlaced((list) => [...list, { key, id: toy.id, x: tx, fromY: Math.min(GROUND_TOP, sy - TOY_SIZE / 2), bounce: 0 }]);
    setShowToys(false);
    setTimeout(() => playWith(key, true), onPet ? 350 : 500);
    return true;
  };
  const moveToy = (key: number) => (dx: number, toTray: boolean) => {
    if (toTray) return setPlaced((list) => list.filter((q) => q.key !== key));
    setPlaced((list) => list.map((q) => (q.key === key ? { ...q, x: Math.max(TOY_SIZE, Math.min(width - TOY_SIZE, q.x + dx)) } : q)));
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

  const depth = petY.interpolate({ inputRange: [FLOOR_TOP, FLOOR_BOTTOM], outputRange: [0.82, 1.08], extrapolate: 'clamp' });
  const placeTransform = [
    { translateX: petX },
    { translateY: Animated.add(petY, -HOME_FEET) },
  ];
  const petTransform = [
    { translateY: Animated.add(Animated.add(bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }), hop.interpolate({ inputRange: [0, 1], outputRange: [0, -38] })), step.interpolate({ inputRange: [0, 1], outputRange: [0, -9] })) },
    { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
    { scaleY: Animated.add(bob.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }), squash.interpolate({ inputRange: [0, 1], outputRange: [0, -0.14] })) },
    { scaleX: Animated.add(bob.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }), squash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.1] })) },
  ];
  const night = state.scene && SCENES[state.scene] ? !!SCENES[state.scene].dark : sky === 'night';

  return (
    <View style={styles.scene} ref={sceneBox} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <YardBackdrop element={sp.element} sky={sky} scene={state.scene} />
      <Cloud width={width} top={22} duration={38000} delay={0} scale={1} />
      <Cloud width={width} top={70} duration={52000} delay={9000} scale={0.7} />

      <Pressable onPress={goBed} style={[styles.decor, { left: bed.x, top: bed.y }]} accessibilityRole="button" accessibilityLabel={`${pet.nickname}'s bed`}>
        <Bed />
      </Pressable>
      <View pointerEvents="none" style={[styles.decor, { left: Math.max(0, width * 0.6), top: 196 }]}>
        <Plant />
      </View>

      <Animated.View pointerEvents="box-none" style={[styles.petSpot, { left: width / 2 - PET_SIZE / 2, top: HOME_FEET - PET_SIZE - 6, transform: placeTransform }]}>
        <Animated.View pointerEvents="box-none" style={{ transform: [{ scale: depth }] }}>
          <View style={styles.petShadow} />
          <Pressable onPress={() => { lastAct.current = Date.now(); doPlay(); }} accessibilityRole="button" accessibilityLabel={`Play with ${pet.nickname}`}>
            <Animated.View ref={petBox as any} style={{ transform: [{ scaleX: face }] }}>
              <Animated.View style={{ transform: petTransform }}>
                <PowerGlow count={buffs.length} size={PET_SIZE} />
                <PetSprite noShadow species={sp} stage={stage} size={PET_SIZE} shiny={pet.shiny} skin={pet.skin} mood={mood === 'sleepy' ? 'sleepy' : mood === 'joy' ? 'joy' : 'happy'} hat={pet.look?.hat} aura={pet.look?.aura} />
              </Animated.View>
            </Animated.View>
          </Pressable>
          <Hearts burst={burst} set={burstSet} />
        </Animated.View>
      </Animated.View>

      <Pressable onPress={goBall} style={[styles.decor, { left: ball.x, top: ball.y }]} accessibilityRole="button" accessibilityLabel="Ball">
        <Ball />
      </Pressable>
      <Pressable onPress={() => goBowl()} style={[styles.decor, { left: bowl.x, top: bowl.y }]} accessibilityRole="button" accessibilityLabel={tasks[0].done ? 'Food bowl (fed today)' : 'Food bowl'}>
        <Bowl full={!tasks[0].done} />
      </Pressable>

      {placed.map((p) => {
        const toy = COSMETIC_BY_ID[p.id];
        return toy ? <PlacedToy key={p.key} toy={toy} x={p.x} fromY={p.fromY} bounce={p.bounce} onMove={moveToy(p.key)} onTap={() => playWith(p.key, true)} /> : null;
      })}
      {floats.map((f) => (
        <XpFloat key={f.id} id={f.id} amount={f.amount} />
      ))}

      <View style={styles.hud}>
        <View style={styles.namePill}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={styles.level}><Text style={styles.levelText}>Lv {lp.level}</Text></View>
            <TextInput
              style={styles.name}
              defaultValue={pet.nickname}
              key={pet.id + pet.nickname}
              onEndEditing={(e) => apply((s) => A.renamePet(s, pet.id, e.nativeEvent.text))}
              onBlur={(e: any) => e?.nativeEvent?.text !== undefined && apply((s) => A.renamePet(s, pet.id, e.nativeEvent.text))}
              accessibilityLabel="Pet name"
              maxLength={14}
            />
          </View>
          <View style={styles.xpTrack} accessibilityLabel={lp.max ? 'Max level' : `${lp.into} of ${lp.need} XP to level ${lp.level + 1}`}>
            <View style={[styles.xpFill, { width: `${Math.round((lp.max ? 1 : lp.into / lp.need) * 100)}%` }]} />
          </View>
          <Text style={styles.sub} numberOfLines={1}>
            {RARITY_INFO[sp.rarity].label}{pet.shiny ? ' ✦' : ''} · {gradeOf(pet)}% · <Text style={{ color: mi.color }}>{mi.emoji} {mi.label}</Text>
          </Text>
          <Pressable onPress={openNeeds} hitSlop={6} accessibilityRole="button" accessibilityLabel={`How ${pet.nickname} feels: food ${needs.food}%, fun ${needs.fun}%, water ${needs.water}%, energy ${needs.energy}%`}>
            <NeedsMini needs={needs} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={styles.stat} accessibilityLabel={`${streak}-day streak${state.shields ? `, ${state.shields} shields` : ''}`}>
            <Text style={styles.statText}>🔥 {streak}{state.shields ? ` 🛡️${state.shields}` : ''}</Text>
          </View>
          <Pressable style={styles.stat} hitSlop={8} onPress={() => onShop?.()} accessibilityRole="button" accessibilityLabel={`${state.coins} coins, open shop`}>
            <Image source={COIN_PILE} style={{ width: 24, height: 24 }} resizeMode="contain" />
            <RollingNumber value={state.coins} prefix="" short style={styles.statText} />
            <View style={styles.plus}><Text style={styles.plusText}>+</Text></View>
          </Pressable>
          <Pressable style={[styles.avatar, account?.warn && { backgroundColor: '#E8590C' }]} hitSlop={8} onPress={onAccount} accessibilityRole="button" accessibilityLabel={account?.label ?? 'Account'}>
            <Text style={styles.avatarText}>{account?.warn ? '!' : account?.initial ?? '?'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.bubbleWrap} pointerEvents="none">
        <PopIn key={toyLine ? toyLine.id : toyHint ? 'hint' : mood}>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{toyLine ? toyLine.text : toyHint ? 'Drag a toy onto the grass!' : wish && !wish.done ? W.WISHES[wish.kind].ask : wish?.done ? 'You did it! Grant my wish?' : C.moodLine(mood, pet.nickname)}</Text>
          </View>
        </PopIn>
      </View>
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

      <Pressable onPress={() => onDressUp?.()} style={styles.side} accessibilityRole="button" accessibilityLabel="Style">
        <View style={styles.sideBtn}><Text style={{ fontSize: 22 }}>🎨</Text></View>
        <Text style={styles.sideLabel}>Style</Text>
      </Pressable>
      <Pressable onPress={() => overlay.open(<BagSheet onClose={overlay.close} />)} style={[styles.side, { top: 182 }]} accessibilityRole="button" accessibilityLabel="Bag: your food, potions and items">
        <View style={[styles.sideBtn, { borderColor: '#C98A3E' }]}>
          <Svg width={24} height={24} viewBox="0 0 24 24">
            <Path d="M5 9h14l-1.2 10.5a1.5 1.5 0 0 1-1.5 1.5H7.7a1.5 1.5 0 0 1-1.5-1.5z" fill="#F3D3A6" stroke="#9A6427" strokeWidth={2} strokeLinejoin="round" />
            <Path d="M9 9V7a3 3 0 0 1 6 0v2" fill="none" stroke="#9A6427" strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </View>
        <Text style={styles.sideLabel}>Bag</Text>
      </Pressable>

      {showToys ? (
        <View style={styles.toyShelf}>
          {toys.length ? (
            toys.slice(0, 8).map((t) => (
              <DraggableToy
                key={t.id}
                toy={t}
                small={toys.length > 6}
                onDrop={dropToy(t)}
                onGrab={measureAll}
                onTap={() => {
                  setToyHint(true);
                  setTimeout(() => setToyHint(false), 1800);
                }}
              />
            ))
          ) : (
            <Text style={styles.shelfEmpty}>All your toys are out. Drag them back here to put them away.</Text>
          )}
        </View>
      ) : null}
      <View style={styles.care}>
        <CareButton icon="🍙" label="Feed" color="#F28C38" done={tasks[0].done} onPress={() => goBowl(true)} />
        <CareButton
          icon="🧸"
          label={tasks[1].done ? 'Play' : `Play ${tasks[1].progress}`}
          color="#4A8FE0"
          done={tasks[1].done}
          on={showToys}
          onPress={() => {
            if (!allToys.length) return doPlay();
            buzz('light');
            setShowToys((v) => !v);
          }}
        />
        <CareButton
          icon="🍪"
          label="Snack"
          color="#C9772A"
          badge={tasks[2].done ? undefined : trinkets}
          done={tasks[2].done}
          dim={!tasks[2].done && trinkets === 0}
          onPress={() => {
            if (!trinkets) return onTrinketsEmpty?.();
            buzz('success', 'munch');
            munch();
            setBurst((b) => b + 1);
            say('A snack! You’re the best!');
            apply(C.treat);
          }}
        />
      </View>
    </View>
  );
}

/** A big round care button at the bottom of the yard: Feed, Play and Snack. */
function CareButton({ icon, label, color, done, dim, badge, on, onPress }: { icon: string; label: string; color: string; done?: boolean; dim?: boolean; badge?: number; on?: boolean; onPress: () => void }) {
  const press = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(press, { toValue: 0.9, useNativeDriver: true, friction: 6 }).start()}
      onPressOut={() => Animated.spring(press, { toValue: 1, useNativeDriver: true, friction: 4 }).start()}
      style={{ alignItems: 'center', gap: 3, width: 70 }}
      accessibilityRole="button"
      accessibilityState={{ checked: done, selected: on }}
      accessibilityLabel={badge !== undefined ? `${label}, ${badge} left` : done ? `${label}, done today` : label}
    >
      <Animated.View style={[styles.careBtn, { backgroundColor: color }, on && { borderColor: '#FFE27A' }, dim && { opacity: 0.55 }, { transform: [{ scale: press }] }]}>
        <Text style={{ fontSize: 26 }}>{icon}</Text>
        {done ? (
          <View style={styles.careCheck}><Text style={styles.careCheckText}>✓</Text></View>
        ) : badge ? (
          <View style={styles.trayBadge}><Text style={styles.trayBadgeText}>{badge}</Text></View>
        ) : null}
      </Animated.View>
      <Text style={styles.careLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scene: { height: SCENE_H, overflow: 'hidden' },
  decor: { position: 'absolute', zIndex: 4 },
  petSpot: { position: 'absolute', width: PET_SIZE, height: PET_SIZE + 6, alignItems: 'center', justifyContent: 'flex-end', zIndex: 6 },
  petShadow: { position: 'absolute', bottom: -PET_SIZE * 0.22, alignSelf: 'center', width: PET_SIZE * 0.5, height: PET_SIZE * 0.5, borderRadius: PET_SIZE, backgroundColor: 'rgba(0,0,0,0.14)', transform: [{ scaleY: 0.16 }] },
  hud: { position: 'absolute', top: 10, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, zIndex: 20 },
  namePill: { flex: 1, maxWidth: 230, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 18, paddingVertical: 7, paddingHorizontal: 10, gap: 4 },
  plus: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  plusText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', marginTop: -1 },
  side: { position: 'absolute', right: 10, top: 112, alignItems: 'center', gap: 2, zIndex: 20 },
  sideBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#9B5BD6', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  sideLabel: { fontSize: 12, fontWeight: '900', color: colors.ink, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 999, paddingHorizontal: 6, overflow: 'hidden' },
  care: { position: 'absolute', left: 0, right: 0, bottom: 34, flexDirection: 'row', justifyContent: 'center', gap: 10, zIndex: 20 },
  careBtn: { width: 60, height: 60, borderRadius: 30, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 4, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  careCheck: { position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.mint, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  careCheckText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  tray: { position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 20, padding: 6, zIndex: 10 },
  trayDivider: { width: 1, height: 36, backgroundColor: colors.line },
  trayDone: { borderColor: colors.mint, backgroundColor: colors.mintSoft },
  trayOn: { borderColor: '#3D8FD6', backgroundColor: '#EAF3FC' },
  trayBadge: { position: 'absolute', top: -6, right: -4, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 999, backgroundColor: '#9C5FD8', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  trayBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  toyShelf: { position: 'absolute', left: 10, right: 10, bottom: 126, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 18, padding: 6, zIndex: 11 },
  shelfEmpty: { fontSize: 12, fontWeight: '800', color: colors.muted, padding: 6, textAlign: 'center' },
  stat: { height: 30, paddingHorizontal: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  statText: { fontSize: 12, fontWeight: '900', color: colors.ink },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.mint, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  xpTrack: { height: 6, borderRadius: 999, backgroundColor: '#E3EBE8', overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 999, backgroundColor: colors.mint },
  trayBtn: { height: 54, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', gap: 1 },
  trayIcon: { fontSize: 22 },
  trayLabel: { fontSize: 12, fontWeight: '900', color: colors.ink },
  toys: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  toy: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.line },
  toyEmoji: { fontSize: 24 },
  placed: { position: 'absolute', width: TOY_SIZE, height: TOY_SIZE, alignItems: 'center', justifyContent: 'center', zIndex: 8 },
  placedEmoji: { fontSize: 34 },
  placedShadow: { position: 'absolute', bottom: -4, width: 30, height: 7, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.15)' },
  head: { gap: 4, paddingTop: 12, paddingRight: 12, paddingLeft: 16 },
  level: { backgroundColor: colors.gold, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  levelText: { color: '#5A3E00', fontWeight: '900', fontSize: 12 },
  name: { fontSize: 17, fontWeight: '900', padding: 0, flexShrink: 1, minWidth: 60, color: colors.ink },
  sub: { fontSize: 12, fontWeight: '800', color: '#4F5F63' },
  mood: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 9, paddingVertical: 3 },
  moodText: { fontSize: 12, fontWeight: '900' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 86, paddingTop: 30 },
  bubbleWrap: { position: 'absolute', top: 104, left: 60, right: 60, alignItems: 'center', zIndex: 15 },
  bubble: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 7, paddingHorizontal: 12, maxWidth: 230, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  bubbleText: { fontSize: 13, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  xpFloat: { position: 'absolute', top: 160, alignSelf: 'center', backgroundColor: colors.gold, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, zIndex: 5 },
  xpFloatText: { fontWeight: '900', color: '#5A3E00', fontSize: 15 },
  levelUpWrap: { position: 'absolute', top: 150, left: 0, right: 0, alignItems: 'center', zIndex: 25 },
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
  careDone: { borderColor: colors.mint, backgroundColor: colors.mintSoft },
  careLabel: { fontWeight: '900', fontSize: 12, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  hint: { fontSize: 12, fontWeight: '700', color: colors.muted },
});
