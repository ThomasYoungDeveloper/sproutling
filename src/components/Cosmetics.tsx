import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';
import { COSMETIC_BY_ID } from '../game/cosmetics';

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
