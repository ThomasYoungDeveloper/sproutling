import React from 'react';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import type { Rarity } from '../game/types';
import { RARITY_INFO } from '../game/rarity';

export default function EggSprite({ rarity, size = 80, cracked = false }: { rarity: Rarity; size?: number; cracked?: boolean }) {
  const c = RARITY_INFO[rarity].color;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Ellipse cx={50} cy={92} rx={24} ry={4} fill="rgba(36,50,58,0.12)" />
      <Ellipse cx={50} cy={56} rx={28} ry={36} fill="#FFF8EC" stroke="#24323A" strokeWidth={2.5} />
      <Circle cx={40} cy={44} r={6} fill={c} opacity={0.75} />
      <Circle cx={60} cy={60} r={8} fill={c} opacity={0.75} />
      <Circle cx={44} cy={74} r={4} fill={c} opacity={0.75} />
      {rarity === 'legendary' && <Path d="M50 26 l3 6 6.5 .8 -4.8 4.5 1.2 6.4 -5.9 -3.2 -5.9 3.2 1.2 -6.4 -4.8 -4.5 6.5 -.8z" fill="#FFD84D" />}
      {cracked && <Path d="M26 54 l8 -6 6 7 7 -8 7 8 6 -7 8 6" stroke="#24323A" strokeWidth={2.5} fill="none" strokeLinejoin="round" />}
    </Svg>
  );
}
