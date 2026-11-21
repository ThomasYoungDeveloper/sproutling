import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';
import { COSMETIC_BY_ID } from '../game/cosmetics';
import type { Element } from '../game/types';

/* ====================== Hats ======================
 * Drawn in a 100×70 box. The hat's base line is at y≈62 and is placed on the top of the pet's head.
 */

const HAT_BASE = 62 / 70;

export function HatArt({ id, width }: { id: string; width: number }) {
  const h = width * 0.7;
  return (
    <Svg width={width} height={h} viewBox="0 0 100 70">
      {HATS[id] ?? null}
    </Svg>
  );
}

const HATS: Record<string, React.ReactNode> = {
  acorn: (
    <G>
      <Path d="M16 58 Q14 24 50 20 Q86 24 84 58 Q50 66 16 58 Z" fill="#9A6234" stroke="#2B2B3A" strokeWidth={2.5} strokeLinejoin="round" />
      <Path d="M24 34 L34 50 M38 26 L46 46 M54 25 L60 46 M68 30 L74 50 M30 26 L22 42 M48 22 L40 40 M62 24 L54 42 M76 34 L68 50" stroke="#7A4A22" strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M50 20 Q52 8 60 4" stroke="#5A3517" strokeWidth={5} strokeLinecap="round" fill="none" />
      <Path d="M60 6 Q74 0 78 12 Q66 14 60 6 Z" fill="#E08A2B" stroke="#2B2B3A" strokeWidth={2} strokeLinejoin="round" />
    </G>
  ),
  scarecrow: (
    <G>
      <Path d="M6 58 Q50 46 94 58 Q86 66 50 66 Q14 66 6 58 Z" fill="#D9A55A" stroke="#2B2B3A" strokeWidth={2.5} strokeLinejoin="round" />
      <Path d="M26 54 Q28 22 50 18 Q72 22 74 54 Z" fill="#E8BE6E" stroke="#2B2B3A" strokeWidth={2.5} strokeLinejoin="round" />
      <Path d="M27 46 Q50 40 73 46 L73 53 Q50 47 27 53 Z" fill="#C0462E" stroke="#2B2B3A" strokeWidth={2} strokeLinejoin="round" />
      <Path d="M12 60 L6 70 M20 63 L16 72 M80 63 L84 72 M88 60 L94 70" stroke="#B5832F" strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M58 28 L66 24 M60 34 L68 32" stroke="#B5832F" strokeWidth={2} strokeLinecap="round" />
      <Path d="M64 30 Q76 22 80 32 Q70 36 64 30 Z" fill="#E08A2B" stroke="#2B2B3A" strokeWidth={2} strokeLinejoin="round" />
    </G>
  ),
  santa: (
    <G>
      <Path d="M20 56 Q26 18 52 14 Q74 12 84 30 Q88 40 86 46 Q80 34 72 30 Q78 44 80 56 Z" fill="#E5394D" stroke="#2B2B3A" strokeWidth={2.5} strokeLinejoin="round" />
      <Path d="M36 30 Q46 24 58 24" stroke="#FF7A87" strokeWidth={4} strokeLinecap="round" fill="none" />
      <Rect x={14} y={52} width={72} height={14} rx={7} fill="#FFFFFF" stroke="#2B2B3A" strokeWidth={2.5} />
      <Circle cx={86} cy={48} r={8} fill="#FFFFFF" stroke="#2B2B3A" strokeWidth={2.5} />
    </G>
  ),
  party: (
    <G>
      <Path d="M32 64 L50 6 L68 64 Z" fill="#FF7AA8" stroke="#2B2B3A" strokeWidth={2.5} strokeLinejoin="round" />
      <Path d="M38 45 L62 45 M42 30 L58 30 M46 17 L54 17" stroke="#FFE27A" strokeWidth={5} strokeLinecap="round" />
      <Circle cx={50} cy={6} r={6} fill="#7BD3F7" stroke="#2B2B3A" strokeWidth={2.5} />
    </G>
  ),
  flower: (
    <G>
      <Path d="M14 60 Q50 44 86 60" stroke="#5DBB63" strokeWidth={6} fill="none" strokeLinecap="round" />
      {[
        [20, 56, '#FF8FB1'],
        [35, 49, '#FFD84D'],
        [50, 47, '#B18CFF'],
        [65, 49, '#FF8FB1'],
        [80, 56, '#7BD3F7'],
      ].map(([x, y, c], i) => (
        <G key={i}>
          {[0, 72, 144, 216, 288].map((a) => (
            <Circle key={a} cx={(x as number) + 6 * Math.cos((a * Math.PI) / 180)} cy={(y as number) + 6 * Math.sin((a * Math.PI) / 180)} r={4.5} fill={c as string} stroke="#2B2B3A" strokeWidth={1.2} />
          ))}
          <Circle cx={x as number} cy={y as number} r={3.5} fill="#FFF3B0" />
        </G>
      ))}
    </G>
  ),
  beanie: (
    <G>
      <Path d="M18 60 Q18 20 50 20 Q82 20 82 60 Z" fill="#5DBB63" stroke="#2B2B3A" strokeWidth={2.5} />
      <Path d="M34 26 L34 58 M50 21 L50 58 M66 26 L66 58" stroke="#4AA352" strokeWidth={3} />
      <Rect x={14} y={52} width={72} height={13} rx={6} fill="#3E8E47" stroke="#2B2B3A" strokeWidth={2.5} />
      <Circle cx={50} cy={16} r={8} fill="#FFFFFF" stroke="#2B2B3A" strokeWidth={2.5} />
    </G>
  ),
  bow: (
    <G>
      <Path d="M50 50 Q20 22 18 42 Q16 64 50 54 Z" fill="#FF6FA0" stroke="#2B2B3A" strokeWidth={2.5} strokeLinejoin="round" />
      <Path d="M50 50 Q80 22 82 42 Q84 64 50 54 Z" fill="#FF6FA0" stroke="#2B2B3A" strokeWidth={2.5} strokeLinejoin="round" />
      <Path d="M28 40 Q32 46 40 48 M72 40 Q68 46 60 48" stroke="#FFC1D6" strokeWidth={3} strokeLinecap="round" fill="none" />
      <Circle cx={50} cy={52} r={7} fill="#FF4F8B" stroke="#2B2B3A" strokeWidth={2.5} />
    </G>
  ),
  bunny: (
    <G>
      <Ellipse cx={34} cy={30} rx={10} ry={30} fill="#FFFFFF" stroke="#2B2B3A" strokeWidth={2.5} transform="rotate(-12 34 30)" />
      <Ellipse cx={34} cy={32} rx={5} ry={22} fill="#FFB3CB" transform="rotate(-12 34 32)" />
      <Ellipse cx={66} cy={30} rx={10} ry={30} fill="#FFFFFF" stroke="#2B2B3A" strokeWidth={2.5} transform="rotate(12 66 30)" />
      <Ellipse cx={66} cy={32} rx={5} ry={22} fill="#FFB3CB" transform="rotate(12 66 32)" />
      <Path d="M22 62 Q50 50 78 62" stroke="#FF8FB1" strokeWidth={5} fill="none" strokeLinecap="round" />
    </G>
  ),
  cat: (
    <G>
      <Path d="M18 62 L26 18 L46 52 Z" fill="#3B3B4F" stroke="#2B2B3A" strokeWidth={2.5} strokeLinejoin="round" />
      <Path d="M25 52 L28 30 L39 50 Z" fill="#FFB3CB" />
      <Path d="M82 62 L74 18 L54 52 Z" fill="#3B3B4F" stroke="#2B2B3A" strokeWidth={2.5} strokeLinejoin="round" />
      <Path d="M75 52 L72 30 L61 50 Z" fill="#FFB3CB" />
      <Path d="M16 63 Q50 50 84 63" stroke="#3B3B4F" strokeWidth={5} fill="none" strokeLinecap="round" />
    </G>
  ),
  chef: (
    <G>
      <Circle cx={32} cy={30} r={15} fill="#FFFFFF" stroke="#2B2B3A" strokeWidth={2.5} />
      <Circle cx={68} cy={30} r={15} fill="#FFFFFF" stroke="#2B2B3A" strokeWidth={2.5} />
      <Circle cx={50} cy={22} r={18} fill="#FFFFFF" stroke="#2B2B3A" strokeWidth={2.5} />
      <Rect x={26} y={34} width={48} height={20} fill="#FFFFFF" />
      <Rect x={24} y={46} width={52} height={18} rx={4} fill="#F2F4F7" stroke="#2B2B3A" strokeWidth={2.5} />
    </G>
  ),
  wizard: (
    <G>
      <Path d="M30 58 L56 2 L72 58 Z" fill="#6E56CF" stroke="#2B2B3A" strokeWidth={2.5} strokeLinejoin="round" />
      <Ellipse cx={50} cy={60} rx={40} ry={8} fill="#5A44B8" stroke="#2B2B3A" strokeWidth={2.5} />
      <Path d="M50 30 l2.5 5 5.5 .8 -4 3.9 .9 5.5 -4.9-2.6 -4.9 2.6 .9-5.5 -4-3.9 5.5-.8z" fill="#FFD84D" />
      <Circle cx={60} cy={45} r={2.5} fill="#FFD84D" />
      <Circle cx={57} cy={18} r={2} fill="#FFD84D" />
    </G>
  ),
  tophat: (
    <G>
      <Rect x={30} y={10} width={40} height={46} rx={4} fill="#2B2B3A" stroke="#11111A" strokeWidth={2.5} />
      <Rect x={30} y={40} width={40} height={9} fill="#E5484D" />
      <Ellipse cx={50} cy={58} rx={34} ry={7} fill="#2B2B3A" stroke="#11111A" strokeWidth={2.5} />
      <Rect x={35} y={14} width={5} height={22} rx={2} fill="#4A4A5E" />
    </G>
  ),
  crown: (
    <G>
      <Path d="M20 62 L16 24 L34 42 L50 14 L66 42 L84 24 L80 62 Z" fill="#FFC93C" stroke="#2B2B3A" strokeWidth={2.5} strokeLinejoin="round" />
      <Rect x={20} y={52} width={60} height={10} fill="#F2A900" />
      <Circle cx={50} cy={36} r={5} fill="#E5484D" stroke="#2B2B3A" strokeWidth={1.5} />
      <Circle cx={32} cy={50} r={3.5} fill="#3D8FD6" />
      <Circle cx={68} cy={50} r={3.5} fill="#5DBB63" />
    </G>
  ),
  goldcrown: (
    <G>
      <Path d="M14 62 L10 18 L32 40 L50 6 L68 40 L90 18 L86 62 Z" fill="#FFD84D" stroke="#2B2B3A" strokeWidth={2.5} strokeLinejoin="round" />
      <Rect x={14} y={50} width={72} height={12} fill="#F2A900" />
      <Circle cx={50} cy={30} r={6} fill="#9C5FD8" stroke="#2B2B3A" strokeWidth={1.5} />
      {[24, 38, 62, 76].map((x) => (
        <Circle key={x} cx={x} cy={56} r={3.5} fill="#FFFFFF" />
      ))}
      <Path d="M10 18 l3 -6 M90 18 l-3 -6 M50 6 l0 -5" stroke="#FFF3B0" strokeWidth={2.5} strokeLinecap="round" />
    </G>
  ),
  halo: (
    <G>
      <Ellipse cx={50} cy={22} rx={30} ry={9} fill="none" stroke="#FFE27A" strokeWidth={8} opacity={0.5} />
      <Ellipse cx={50} cy={22} rx={30} ry={9} fill="none" stroke="#FFD84D" strokeWidth={4.5} />
    </G>
  ),
  kabuto: (
    <G>
      <Path d="M16 60 Q16 22 50 22 Q84 22 84 60 Z" fill="#2E3A66" stroke="#11111A" strokeWidth={2.5} />
      <Path d="M8 62 Q50 50 92 62 L88 68 Q50 58 12 68 Z" fill="#1F2850" stroke="#11111A" strokeWidth={2} />
      <Path d="M50 32 Q30 30 22 6 Q36 20 50 22 Q64 20 78 6 Q70 30 50 32 Z" fill="#FFC93C" stroke="#2B2B3A" strokeWidth={2} strokeLinejoin="round" />
      <Circle cx={50} cy={38} r={5} fill="#E5484D" stroke="#11111A" strokeWidth={1.5} />
    </G>
  ),
  trophy: (
    <G>
      {[...Array(6)].map((_, i) => (
        <Ellipse key={'l' + i} cx={22 + i * 4} cy={58 - i * 7} rx={7} ry={3.5} fill="#5DBB63" stroke="#2B2B3A" strokeWidth={1.5} transform={`rotate(${-50 + i * 8} ${22 + i * 4} ${58 - i * 7})`} />
      ))}
      {[...Array(6)].map((_, i) => (
        <Ellipse key={'r' + i} cx={78 - i * 4} cy={58 - i * 7} rx={7} ry={3.5} fill="#5DBB63" stroke="#2B2B3A" strokeWidth={1.5} transform={`rotate(${50 - i * 8} ${78 - i * 4} ${58 - i * 7})`} />
      ))}
      <Circle cx={50} cy={20} r={7} fill="#FFD84D" stroke="#2B2B3A" strokeWidth={2} />
    </G>
  ),
};

/** Where to put a hat on a pet image of a given size, from the measured head anchor. */
export function hatPlacement(anchor: [number, number, number], img: number, left: number, top: number, id: string) {
  const [ax, ay, aw] = anchor;
  const ears = id === 'bunny' || id === 'cat';
  const w = Math.max(img * 0.44, Math.min(img * (ears ? 0.66 : 0.62), aw * img * (ears ? 1.0 : 0.92)));
  const h = w * 0.7;
  const hx = left + ax * img;
  const hy = top + ay * img;
  // The halo floats just above the head; everything else sits on it.
  if (id === 'halo') return { left: hx - w / 2, top: hy - h * 0.42, width: w };
  return { left: hx - w / 2, top: hy - h * HAT_BASE + img * 0.04, width: w };
}

/* ====================== Auras ====================== */

type Motion = 'rise' | 'fall' | 'orbit';
const AURAS: Record<string, { motion: Motion; draw: (i: number) => React.ReactNode; count: number }> = {
  leaves: {
    motion: 'fall',
    count: 7,
    draw: (i) => (
      <>
        <Path d="M12 2 C20 6 22 14 12 22 C2 14 4 6 12 2 Z" fill={['#E07B2B', '#D9A23B', '#C2452D'][i % 3]} stroke="#8A3E15" strokeWidth={1} />
        <Path d="M12 4 L12 21" stroke="#8A3E15" strokeWidth={1.2} />
      </>
    ),
  },
  lights: {
    motion: 'orbit',
    count: 8,
    draw: (i) => (
      <>
        <Circle cx={12} cy={13} r={9} fill={['rgba(255,80,90,0.3)', 'rgba(90,220,120,0.3)', 'rgba(255,215,77,0.3)', 'rgba(110,170,255,0.3)'][i % 4]} />
        <Path d="M12 6 C16 8 17 14 12 20 C7 14 8 8 12 6 Z" fill={['#FF505A', '#5ADC78', '#FFD74D', '#6EAAFF'][i % 4]} />
        <Rect x={10} y={3} width={4} height={4} rx={1} fill="#5B6B70" />
      </>
    ),
  },
  hearts: { motion: 'rise', count: 6, draw: (i) => <Path d="M12 21 C3 14 1 9 4 5 C7 1 11 3 12 6 C13 3 17 1 20 5 C23 9 21 14 12 21 Z" fill={i % 2 ? '#FF7AA8' : '#FF4F8B'} /> },
  bubbles: { motion: 'rise', count: 7, draw: () => <><Circle cx={12} cy={12} r={9} fill="rgba(143,211,255,0.25)" stroke="#7BD3F7" strokeWidth={2} /><Circle cx={9} cy={8} r={2.5} fill="#FFFFFF" /></> },
  snowfall: { motion: 'fall', count: 8, draw: () => <Path d="M12 2 V22 M3 7 L21 17 M3 17 L21 7" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" /> },
  sparkles: { motion: 'rise', count: 7, draw: (i) => <Path d="M12 1 L14 10 L23 12 L14 14 L12 23 L10 14 L1 12 L10 10 Z" fill={i % 2 ? '#FFE27A' : '#FFFFFF'} /> },
  petals: { motion: 'fall', count: 7, draw: () => <Path d="M12 3 C18 6 20 13 12 21 C4 13 6 6 12 3 Z" fill="#FFB7D0" stroke="#FF8FB1" strokeWidth={1.2} /> },
  fireflies: { motion: 'rise', count: 7, draw: () => <><Circle cx={12} cy={12} r={8} fill="rgba(255,236,120,0.35)" /><Circle cx={12} cy={12} r={3.5} fill="#FFF07A" /></> },
  stars: { motion: 'orbit', count: 5, draw: () => <Path d="M12 2 L14.9 8.6 L22 9.3 L16.6 14 L18.2 21 L12 17.3 L5.8 21 L7.4 14 L2 9.3 L9.1 8.6 Z" fill="#FFD84D" stroke="#F2A900" strokeWidth={1} /> },
  galaxy: { motion: 'orbit', count: 8, draw: (i) => <Circle cx={12} cy={12} r={i % 3 === 0 ? 5 : 3.5} fill={['#B18CFF', '#7BD3F7', '#FF8FB1'][i % 3]} /> },
};

function Particle({ i, n, size, motion, children }: { i: number; n: number; size: number; motion: Motion; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  const dur = (motion === 'orbit' ? 6000 : 2600) + ((i * 431) % 1400);
  useEffect(() => {
    v.setValue(motion === 'orbit' ? 0 : (i / n) % 1);
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver: true }), { iterations: -1, resetBeforeIteration: true });
    const t = setTimeout(() => loop.start(), motion === 'orbit' ? 0 : (i * dur) / n);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [motion]);
  const p = size * 0.13;
  const x0 = ((i * 37) % 100) / 100;
  let style: any;
  if (motion === 'orbit') {
    const r = size * 0.42;
    const phase = (i / n) * 2 * Math.PI;
    const steps = Array.from({ length: 9 }, (_, k) => k / 8);
    style = {
      left: size / 2 - p / 2,
      top: size * 0.55 - p / 2,
      transform: [
        { translateX: v.interpolate({ inputRange: steps, outputRange: steps.map((k) => r * Math.cos(phase + k * 2 * Math.PI)) }) },
        { translateY: v.interpolate({ inputRange: steps, outputRange: steps.map((k) => r * 0.45 * Math.sin(phase + k * 2 * Math.PI)) }) },
      ],
    };
  } else {
    const rise = motion === 'rise';
    style = {
      left: size * (0.12 + x0 * 0.76) - p / 2,
      top: rise ? size * 0.85 : size * 0.05,
      opacity: v.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }),
      transform: [
        { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, (rise ? -1 : 1) * size * 0.75] }) },
        { translateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, (i % 2 ? 1 : -1) * size * 0.06, 0] }) },
        { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${i % 2 ? 180 : -180}deg`] }) },
      ],
    };
  }
  return (
    <Animated.View style={[{ position: 'absolute', width: p, height: p }, style]}>
      <Svg width={p} height={p} viewBox="0 0 24 24">
        {children}
      </Svg>
    </Animated.View>
  );
}

export function Aura({ id, size }: { id: string; size: number }) {
  const a = AURAS[id];
  if (!a) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: a.count }, (_, i) => (
        <Particle key={id + i} i={i} n={a.count} size={size} motion={a.motion}>
          {a.draw(i)}
        </Particle>
      ))}
    </View>
  );
}

/* ====================== Scenes ====================== */

interface ScenePalette {
  sky: [string, string];
  hills: [string, string, string];
  extras: React.ReactNode;
  dark?: boolean;
}

const tree = (x: number, y: number, s: number, c: string) => (
  <G key={`t${x}`}>
    <Rect x={x - 2 * s} y={y - 6 * s} width={4 * s} height={14 * s} fill="#8B5E3C" />
    <Circle cx={x} cy={y - 12 * s} r={10 * s} fill={c} />
    <Circle cx={x - 8 * s} cy={y - 7 * s} r={7 * s} fill={c} />
    <Circle cx={x + 8 * s} cy={y - 7 * s} r={7 * s} fill={c} />
  </G>
);

export const SCENES: Record<string, ScenePalette> = {
  // Battle arenas: each type fights on its own ground (see ARENA below).
  arena_ember: {
    sky: ['#FF7A45', '#FFD39A'],
    hills: ['#C2502A', '#9E3B1E', '#E8763A'],
    extras: (
      <G>
        <Circle cx={80} cy={78} r={34} fill="#FFE08A" opacity={0.55} />
        <Circle cx={80} cy={78} r={22} fill="#FFD04D" />
        <Path d="M250 205 L300 120 L318 120 L370 205 Z" fill="#7A2E1A" />
        <Path d="M300 120 Q309 100 318 120 Z" fill="#FF5A1F" />
        <Path d="M305 112 Q300 80 318 60 Q312 85 322 100" stroke="#FFB067" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.8} />
        {[[40, 150], [140, 120], [200, 160], [360, 90]].map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={2.4} fill="#FFE27A" opacity={0.9} />)}
      </G>
    ),
  },
  arena_stone: {
    sky: ['#E9B98A', '#FBE7CF'],
    hills: ['#B88456', '#9B6B42', '#C99A6B'],
    extras: (
      <G>
        <Circle cx={330} cy={60} r={20} fill="#FFE9A8" />
        <Path d="M20 210 L20 140 L70 140 L80 210 Z" fill="#A86F45" />
        <Path d="M20 160 H72 M22 180 H76" stroke="#8A5534" strokeWidth={3} />
        <Path d="M300 210 L310 120 L370 115 L380 210 Z" fill="#B07A4C" />
        <Path d="M308 150 H372 M306 175 H376" stroke="#8A5534" strokeWidth={3} />
        <Ellipse cx={180} cy={262} rx={22} ry={12} fill="#8E8174" />
        <Ellipse cx={240} cy={270} rx={14} ry={8} fill="#A0948A" />
      </G>
    ),
  },
  arena_spark: {
    sky: ['#140F3A', '#3B2C86'],
    hills: ['#2A2160', '#1E184A', '#3A2E7E'],
    dark: true,
    extras: (
      <G>
        {[[10, 120, 40, 90], [55, 100, 34, 110], [95, 135, 46, 75], [270, 110, 40, 100], [315, 90, 36, 120], [355, 125, 44, 85]].map(([x, y, w, h], i) => (
          <G key={i}>
            <Rect x={x} y={y} width={w} height={h} fill="#231B58" />
            {[0, 1, 2, 3].map((r) => <Rect key={r} x={x + 6} y={y + 10 + r * 18} width={w - 12} height={5} fill={['#FFD23F', '#5CE1E6', '#FF5FA2'][(i + r) % 3]} opacity={0.85} />)}
          </G>
        ))}
        <Path d="M200 20 L186 62 L200 62 L188 100" stroke="#FFD23F" strokeWidth={5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      </G>
    ),
  },
  arena_wind: {
    sky: ['#7FD6C2', '#E3FAF0'],
    hills: ['#86D3A8', '#5FBF8C', '#A6E3BF'],
    extras: (
      <G>
        {[[30, 60, 120], [180, 40, 150], [90, 120, 110], [250, 100, 120]].map(([x, y, w], i) => (
          <Path key={i} d={`M${x} ${y} Q${x + w / 2} ${y - 14} ${x + w} ${y} q12 4 6 14`} stroke="#FFFFFF" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.85} />
        ))}
        <Path d="M330 210 L334 150" stroke="#8B6A4A" strokeWidth={4} />
        <Path d="M334 150 l-24 -8 M334 150 l20 -16 M334 150 l6 24" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" />
        <Circle cx={334} cy={150} r={4} fill="#8B6A4A" />
      </G>
    ),
  },
  arena_toxic: {
    sky: ['#2B1640', '#6B3C7E'],
    hills: ['#4F6B2A', '#3B5420', '#6A8A34'],
    dark: true,
    extras: (
      <G>
        <Circle cx={320} cy={60} r={18} fill="#D7F27A" opacity={0.85} />
        {[[60, 150], [110, 130], [250, 140], [350, 160], [180, 110]].map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={i % 2 ? 5 : 8} fill="#C77DDB" opacity={0.5} />)}
        <Ellipse cx={200} cy={270} rx={70} ry={12} fill="#9BE04A" opacity={0.75} />
        {[[175, 262], [215, 266], [240, 260]].map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={4} fill="#E3FF9A" />)}
        <Path d="M40 230 Q44 200 34 180 M50 232 Q60 205 56 186" stroke="#2E3F18" strokeWidth={4} fill="none" strokeLinecap="round" />
      </G>
    ),
  },
  autumn: {
    sky: ['#F7B267', '#FCE8C8'],
    hills: ['#D98C3A', '#C2702A', '#E8B04B'],
    extras: (
      <G>
        <Circle cx={320} cy={70} r={26} fill="#FFE0A3" opacity={0.9} />
        {tree(55, 214, 1.3, '#E0632B')}
        {tree(105, 206, 1.0, '#E8A23B')}
        {tree(300, 210, 1.1, '#C9442D')}
        {tree(355, 218, 1.4, '#E58A2E')}
        {[[150, 262], [250, 266]].map(([x, y]) => (
          <G key={x}>
            <Ellipse cx={x} cy={y} rx={14} ry={11} fill="#F28C28" stroke="#B85A12" strokeWidth={2} />
            <Path d={`M${x} ${y - 11} Q${x + 2} ${y - 18} ${x + 6} ${y - 19}`} stroke="#5A7A2B" strokeWidth={3} fill="none" strokeLinecap="round" />
          </G>
        ))}
      </G>
    ),
  },
  winterfest: {
    sky: ['#1E3566', '#4C6FA8'],
    hills: ['#E6F0FA', '#D6E6F5', '#FFFFFF'],
    dark: true,
    extras: (
      <G>
        <Circle cx={330} cy={60} r={20} fill="#FFF6D6" />
        {[[40, 40], [120, 70], [200, 30], [280, 90], [90, 120], [240, 130], [370, 120]].map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={2.2} fill="#FFFFFF" />
        ))}
        <Path d="M0 30 Q50 52 100 34 T200 34 T300 34 T400 30" stroke="#2B2B3A" strokeWidth={1.5} fill="none" />
        {[20, 60, 100, 140, 180, 220, 260, 300, 340, 380].map((x, i) => (
          <Circle key={x} cx={x} cy={34 + (i % 2 ? 6 : 2) + (x % 100 === 60 ? 6 : 0)} r={5} fill={['#FF505A', '#5ADC78', '#FFD74D', '#6EAAFF'][i % 4]} />
        ))}
        {[[70, 214, 1.2], [330, 212, 1.4]].map(([x, y, k]) => (
          <G key={x}>
            <Polygon points={`${x},${y - 44 * k} ${x - 18 * k},${y} ${x + 18 * k},${y}`} fill="#2F7D5B" />
            <Polygon points={`${x},${y - 56 * k} ${x - 13 * k},${y - 20 * k} ${x + 13 * k},${y - 20 * k}`} fill="#3A9A6E" />
            <Path d={`M${x} ${y - 64 * k} L${x + 3} ${y - 58 * k} L${x - 3} ${y - 58 * k} Z`} fill="#FFD74D" stroke="#FFD74D" strokeWidth={4} strokeLinejoin="round" />
            {[[-8, -14], [6, -26], [-4, -38], [10, -8]].map(([dx, dy], j) => (
              <Circle key={j} cx={x + dx * k} cy={y + dy * k} r={3} fill={['#FF505A', '#FFD74D', '#6EAAFF', '#FF8FB1'][j]} />
            ))}
          </G>
        ))}
        <G>
          <Circle cx={200} cy={258} r={14} fill="#FFFFFF" stroke="#C9D8E8" strokeWidth={2} />
          <Circle cx={200} cy={236} r={10} fill="#FFFFFF" stroke="#C9D8E8" strokeWidth={2} />
          <Path d="M200 236 L210 238 L200 240 Z" fill="#F28C28" />
          <Circle cx={197} cy={232} r={1.5} fill="#2B2B3A" />
          <Circle cx={203} cy={232} r={1.5} fill="#2B2B3A" />
          <Rect x={190} y={242} width={20} height={4} rx={2} fill="#E5394D" />
        </G>
      </G>
    ),
  },
  beach: {
    sky: ['#7FD0FF', '#E8F7FF'],
    hills: ['#5BC0E8', '#3FA7D6', '#F4D9A0'],
    extras: (
      <G>
        <Circle cx={330} cy={60} r={22} fill="#FFD84D" />
        <Path d="M0 215 Q25 208 50 215 T100 215 T150 215 T200 215 T250 215 T300 215 T350 215 T400 215" stroke="#FFFFFF" strokeWidth={3} fill="none" opacity={0.7} />
        <Path d="M60 270 Q62 230 70 205" stroke="#8B5E3C" strokeWidth={6} fill="none" />
        <Path d="M70 205 Q50 195 38 208 M70 205 Q90 192 102 206 M70 205 Q66 186 54 182 M70 205 Q80 186 94 186" stroke="#3E9E52" strokeWidth={7} fill="none" strokeLinecap="round" />
        <Circle cx={330} cy={270} r={6} fill="#FF8A4C" />
      </G>
    ),
  },
  snow: {
    sky: ['#B9D7F2', '#EEF5FC'],
    hills: ['#E6F0FA', '#D6E6F5', '#FFFFFF'],
    extras: (
      <G>
        {[[60, 214], [95, 205], [320, 210], [355, 218]].map(([x, y]) => (
          <G key={x}>
            <Polygon points={`${x},${y - 34} ${x - 14},${y} ${x + 14},${y}`} fill="#2F7D5B" />
            <Polygon points={`${x},${y - 42} ${x - 10},${y - 16} ${x + 10},${y - 16}`} fill="#3A9A6E" />
            <Path d={`M${x - 10} ${y - 18} L${x + 10} ${y - 18}`} stroke="#FFFFFF" strokeWidth={3} />
          </G>
        ))}
        {[[40, 40], [120, 70], [200, 30], [280, 80], [360, 50], [160, 120], [250, 140]].map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={2.5} fill="#FFFFFF" />
        ))}
      </G>
    ),
  },
  sakura: {
    sky: ['#FFD6E5', '#FFF6EC'],
    hills: ['#C9E7B5', '#A8D99A', '#F8C9D8'],
    extras: (
      <G>
        <G opacity={0.55}>
          <Rect x={292} y={150} width={6} height={50} fill="#D9473F" />
          <Rect x={332} y={150} width={6} height={50} fill="#D9473F" />
          <Path d="M282 150 Q315 140 348 150 L346 157 Q315 148 284 157 Z" fill="#D9473F" />
          <Rect x={288} y={163} width={54} height={5} fill="#D9473F" />
        </G>
        {tree(50, 222, 1.6, '#FFB7D0')}
        {tree(370, 228, 1.3, '#FF9EC1')}
        {[[120, 60], [180, 100], [260, 50], [90, 140], [230, 130]].map(([x, y], i) => (
          <Ellipse key={i} cx={x} cy={y} rx={4} ry={2.5} fill="#FFB7D0" transform={`rotate(${i * 40} ${x} ${y})`} />
        ))}
      </G>
    ),
  },
  candy: {
    sky: ['#FFC9E8', '#E9DCFF'],
    hills: ['#B8F0D8', '#FFD1E6', '#FFF1A8'],
    extras: (
      <G>
        <Ellipse cx={90} cy={60} rx={34} ry={14} fill="#FFFFFF" opacity={0.85} />
        <Ellipse cx={300} cy={45} rx={28} ry={12} fill="#FFFFFF" opacity={0.85} />
        {[[60, 250, '#FF6FA0'], [350, 245, '#7BD3F7']].map(([x, y, c]) => (
          <G key={x as number}>
            <Rect x={(x as number) - 2.5} y={(y as number) - 40} width={5} height={42} fill="#FFFFFF" stroke="#E5C3D6" strokeWidth={1} />
            <Circle cx={x as number} cy={(y as number) - 50} r={16} fill={c as string} />
            <Path d={`M${x} ${(y as number) - 50} m-10 0 a10 10 0 1 1 10 10 a6 6 0 1 1 -6 -6`} stroke="#FFFFFF" strokeWidth={3} fill="none" />
          </G>
        ))}
        {[[150, 268, '#FF8FB1'], [270, 272, '#B18CFF'], [210, 262, '#7BD3F7']].map(([x, y, c]) => (
          <Circle key={x as number} cx={x as number} cy={y as number} r={4} fill={c as string} />
        ))}
      </G>
    ),
  },
  space: {
    sky: ['#0E1233', '#3A2A6B'],
    hills: ['#5C4C8F', '#4A3C78', '#6E5FA6'],
    dark: true,
    extras: (
      <G>
        {[[30, 30], [80, 70], [140, 20], [190, 60], [250, 25], [300, 90], [360, 40], [60, 130], [220, 120], [340, 140], [110, 100], [280, 160]].map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={i % 4 === 0 ? 2 : 1.2} fill="#FFFFFF" />
        ))}
        <Circle cx={320} cy={70} r={24} fill="#FF9E6B" />
        <Ellipse cx={320} cy={70} rx={40} ry={9} fill="none" stroke="#FFD8A8" strokeWidth={4} transform="rotate(-18 320 70)" />
        <Circle cx={70} cy={60} r={10} fill="#7BD3F7" />
        <Ellipse cx={120} cy={262} rx={14} ry={4} fill="#4A3C78" />
        <Ellipse cx={300} cy={268} rx={18} ry={5} fill="#4A3C78" />
      </G>
    ),
  },
  aurora: {
    sky: ['#0B2A3A', '#2A5D6E'],
    hills: ['#DCEAF2', '#C6DCE8', '#F2F8FB'],
    dark: true,
    extras: (
      <G>
        <Path d="M0 90 Q60 40 120 80 T240 70 T400 60 L400 110 Q340 100 280 120 T150 115 T0 130 Z" fill="#5DF2B0" opacity={0.35} />
        <Path d="M0 60 Q80 20 160 55 T320 40 T400 30 L400 70 Q330 75 260 85 T120 80 T0 95 Z" fill="#B18CFF" opacity={0.3} />
        {[[40, 30], [200, 20], [350, 100], [100, 120]].map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={1.5} fill="#FFFFFF" />
        ))}
      </G>
    ),
  },
};

/** The scene each type battles on (the opponent's type picks the arena). */
export const ARENA: Record<Element, string> = { flower: 'sakura', tide: 'beach', ember: 'arena_ember', moon: 'space', stone: 'arena_stone', spark: 'arena_spark', frost: 'snow', wind: 'arena_wind', toxic: 'arena_toxic' };

/** A small swatch of a scene, for shop and wardrobe tiles. */
export function SceneSwatch({ id, size }: { id: string; size: number }) {
  const p = SCENES[id];
  const sky: [string, string] = p ? p.sky : ['#8FD3FF', '#E6F6FF'];
  const hills: [string, string, string] = p ? p.hills : ['#A6DE94', '#7CC97A', '#5DB563'];
  return (
    <Svg width={size} height={size} viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id={`sw-${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={sky[0]} />
          <Stop offset="1" stopColor={sky[1]} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={400} height={300} fill={`url(#sw-${id})`} />
      {p?.extras}
      <Path d="M0 210 Q80 160 170 195 T400 180 V300 H0 Z" fill={hills[0]} />
      <Path d="M0 235 Q120 195 220 228 T400 220 V300 H0 Z" fill={hills[1]} />
      <Path d="M0 262 Q200 238 400 262 V300 H0 Z" fill={hills[2]} />
    </Svg>
  );
}

/** The icon for any cosmetic, used in the shop, wardrobe and loot cards. */
export function ItemIcon({ id, size }: { id: string; size: number }) {
  const c = COSMETIC_BY_ID[id];
  if (!c) return null;
  if (c.slot === 'toy') return <Text style={{ fontSize: size * 0.55, lineHeight: size * 0.75 }}>{c.emoji}</Text>;
  if (c.slot === 'hat') return <HatArt id={id} width={size} />;
  if (c.slot === 'scene') return <View style={{ width: size, height: size * 0.75, borderRadius: 10, overflow: 'hidden' }}><SceneSwatch id={id} size={size} /></View>;
  const a = AURAS[id];
  return (
    <Svg width={size} height={size * 0.75} viewBox="0 0 48 36">
      {[[4, 18], [18, 4], [28, 14], [14, 20], [30, 0]].map(([x, y], i) => (
        <G key={i} transform={`translate(${x} ${y}) scale(0.7)`}>
          {a?.draw(i)}
        </G>
      ))}
    </Svg>
  );
}
