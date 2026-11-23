import React from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

const RING = [
  { a: '#D9E2DE', b: '#EEF3F1', c: '#B5C2BD' }, // not yet
  { a: '#A67A45', b: '#DDB887', c: '#7E5A35' }, // Wooden
  { a: '#B5602A', b: '#F0A060', c: '#8A3E14' }, // Bronze
  { a: '#9AA6B4', b: '#E4EAF0', c: '#5E6A78' }, // Silver
  { a: '#E2A91E', b: '#FFE07A', c: '#9A6A00' }, // Gold
];
const W = '#FFFFFF';

function Icon({ id }: { id: string }) {
  const st = { stroke: W, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (id) {
    case 'walk':
      return (
        <G>
          <Circle cx={27} cy={14} r={3.5} fill={W} />
          <Path d="M21 38l5-10 5 3 2 9M26 28l2-8 6 4 4-1" strokeWidth={3.2} {...st} />
        </G>
      );
    case 'egg':
      return <Path d="M25 13c6 0 10 9 10 16a10 10 0 0 1-20 0c0-7 4-16 10-16z" fill={W} />;
    case 'book':
      return <Path d="M14 16h10a3 3 0 0 1 3 3v17a3 3 0 0 0-3-3H14zM36 16H27v20a3 3 0 0 1 3-3h6z" fill={W} />;
    case 'flame':
      return <Path d="M25 12c5 6 9 10 9 16a9 9 0 0 1-18 0c0-4 2-7 4-9 1 3 2 5 4 5-1-4 0-8 1-12z" fill={W} />;
    case 'drop':
      return <Path d="M25 12c5 7 9 12 9 17a9 9 0 0 1-18 0c0-5 4-10 9-17z" fill={W} />;
    case 'moon':
      return <Path d="M29 13a12 12 0 1 0 8 19 10 10 0 0 1-8-19z" fill={W} />;
    case 'sword':
      return <Path d="M25 13v20M20 28h10M25 33v5" strokeWidth={3.5} {...st} />;
    case 'map':
      return <Path d="M13 17l8-3 8 3 8-3v19l-8 3-8-3-8 3zM21 14v19M29 17v19" strokeWidth={2.8} {...st} />;
    case 'gift':
      return <Path d="M14 21h22v5H14zM16 26h18v11H16zM25 21v16M25 21c-3-6-9-5-7-1 1 2 7 1 7 1zM25 21c3-6 9-5 7-1-1 2-7 1-7 1z" strokeWidth={2.5} {...st} />;
    case 'swap':
      return <Path d="M15 20h18l-4-4M35 30H17l4 4" strokeWidth={3.2} {...st} />;
    case 'cheer':
      return <Path d="M25 37s-11-6-11-14a5.5 5.5 0 0 1 11-2 5.5 5.5 0 0 1 11 2c0 8-11 14-11 14z" fill={W} />;
    case 'shield':
      return <Path d="M25 12l11 4v8c0 7-5 12-11 14-6-2-11-7-11-14v-8z" fill={W} />;
    case 'nest':
      return (
        <G>
          <Path d="M13 28c3 7 21 7 24 0M15 28h20" strokeWidth={3} {...st} />
          <Path d="M21 27c0-5 2-8 4-8s4 3 4 8" fill={W} />
        </G>
      );
    case 'hat':
      return <Path d="M13 32h24M17 32c0-8 3-14 8-14s8 6 8 14" strokeWidth={3} {...st} />;
    case 'chest':
      return <Path d="M14 21h22v15H14zM14 21c0-4 4-7 11-7s11 3 11 7M14 27h22M23 25h4v4h-4z" strokeWidth={2.6} {...st} />;
    default:
      return <Path d="M25 13l3.5 7.5 8 1-6 5.5 1.6 8-7.1-4-7.1 4 1.6-8-6-5.5 8-1z" fill={W} />;
  }
}

/** A badge medal: tier 0 (not yet, faded), 1 Wooden, 2 Bronze, 3 Silver, 4 Gold, 5 Rainbow. */
export default function BadgeMedal({ icon, tier, size = 60, id = 'm' }: { icon: string; tier: number; size?: number; id?: string }) {
  const g = `bg-${id}-${tier}`;
  const shiny = tier >= 2;
  return (
    <Svg width={size} height={size} viewBox="0 0 50 50" opacity={tier === 0 ? 0.4 : 1}>
      <Defs>
        <LinearGradient id={`${g}r`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF6B9A" />
          <Stop offset="0.25" stopColor="#FFC53D" />
          <Stop offset="0.5" stopColor="#4CD7A0" />
          <Stop offset="0.75" stopColor="#4FA3FF" />
          <Stop offset="1" stopColor="#A06BFF" />
        </LinearGradient>
        <LinearGradient id={`${g}t`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={RING[Math.min(tier, 4)].b} />
          <Stop offset="1" stopColor={RING[Math.min(tier, 4)].a} />
        </LinearGradient>
      </Defs>
      <Circle cx={25} cy={25} r={23} fill={`url(#${g}${tier === 5 ? 'r' : 't'})`} stroke={tier === 5 ? 'none' : RING[tier].c} strokeWidth={1.5} />
      {tier === 1 ? <Path d="M8 20c8-3 26-3 34 0M7 30c9 3 27 3 36 0" stroke="#6A4320" strokeWidth={1} fill="none" opacity={0.5} /> : null}
      <Circle cx={25} cy={25} r={17.5} fill={tier === 5 ? '#5B3FC8' : RING[tier].c} />
      <Icon id={icon} />
      {shiny ? <Path d="M12 15a16 16 0 0 1 14-7" stroke={W} strokeWidth={2.5} fill="none" opacity={0.55} strokeLinecap="round" /> : null}
    </Svg>
  );
}
