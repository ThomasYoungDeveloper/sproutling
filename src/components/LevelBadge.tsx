import React from 'react';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { badgeTier } from '../game/account';

const TIERS = {
  green: { fill: '#2FB58A', inner: '#5FD3A8', edge: '#1F7A58' },
  bronze: { fill: '#B8743A', inner: '#E0A46A', edge: '#7A4A20' },
  silver: { fill: '#9AA6B4', inner: '#D6DEE6', edge: '#5E6A78' },
  gold: { fill: '#E2A91E', inner: '#F7D56A', edge: '#9A6A00' },
};

/** The account level badge: a hexagon with the number. Green, then bronze at 10, silver at 20, gold at 30. */
export default function LevelBadge({ level, size = 28 }: { level: number; size?: number }) {
  const t = TIERS[badgeTier(level)];
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel={`Level ${level}`}>
      <Path d="M24 2l19 11v22L24 46 5 35V13z" fill={t.fill} stroke={t.edge} strokeWidth={2.5} />
      <Path d="M24 7l15 8.7v16.6L24 41 9 32.3V15.7z" fill={t.inner} opacity={0.5} />
      <SvgText x={24} y={30.5} textAnchor="middle" fontSize={level >= 100 ? 13 : 17} fontWeight="900" fill="#FFFFFF">
        {String(level)}
      </SvgText>
    </Svg>
  );
}
