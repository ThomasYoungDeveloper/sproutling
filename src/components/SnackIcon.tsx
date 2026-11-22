import React from 'react';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

/** Simple flat art for each snack, outlined like the pet art. */
export default function SnackIcon({ name, size = 32 }: { name: string; size?: number }) {
  const o = '#3A2A20';
  const art: Record<string, React.ReactNode> = {
    'Ember Cookie': (
      <>
        <Circle cx="16" cy="16" r="12" fill="#E8A55A" stroke={o} strokeWidth="2" />
        <Path d="M16 9c2 3-2 4 0 7 1-1 2-2 2-3 2 2 2 6-2 7-4 0-5-4-3-6 0 1 1 2 1 2-1-3 1-5 2-7z" fill="#FF6A2B" />
        <Circle cx="10" cy="13" r="1.4" fill="#6B3A1E" /><Circle cx="21" cy="20" r="1.4" fill="#6B3A1E" /><Circle cx="11" cy="21" r="1.2" fill="#6B3A1E" />
      </>
    ),
    'Moon Mochi': (
      <>
        <Ellipse cx="16" cy="19" rx="12" ry="9" fill="#F4E6FF" stroke={o} strokeWidth="2" />
        <Path d="M18 10a6 6 0 1 0 4 9 5 5 0 1 1-4-9z" fill="#B79EEB" />
        <Circle cx="11" cy="21" r="1" fill={o} /><Circle cx="17" cy="21" r="1" fill={o} />
      </>
    ),
    'Tide Taffy': (
      <>
        <Path d="M3 12l5 4-5 4zM29 12l-5 4 5 4z" fill="#9CC9F2" stroke={o} strokeWidth="1.6" strokeLinejoin="round" />
        <Rect x="8" y="10" width="16" height="12" rx="5" fill="#5BB3F0" stroke={o} strokeWidth="2" />
        <Path d="M11 16q2.5-3 5 0t5 0" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeLinecap="round" />
      </>
    ),
    'Star Candy': (
      <Path d="M16 3l3.6 8 8.4.8-6.4 5.6 1.9 8.3L16 21.5l-7.5 4.2 1.9-8.3L4 11.8l8.4-.8z" fill="#FFD23F" stroke={o} strokeWidth="2" strokeLinejoin="round" />
    ),
    'Acorn Biscuit': (
      <>
        <Path d="M7 13c0-4 4-7 9-7s9 3 9 7z" fill="#8A5530" stroke={o} strokeWidth="2" />
        <Path d="M8 13h16c0 7-3.5 12-8 13-4.5-1-8-6-8-13z" fill="#E0A96B" stroke={o} strokeWidth="2" />
        <Path d="M16 6V3" stroke={o} strokeWidth="2.2" strokeLinecap="round" />
      </>
    ),
    'Starlight Drop': (
      <>
        <Path d="M16 3c5 7 9 11 9 16a9 9 0 0 1-18 0c0-5 4-9 9-16z" fill="#C9B8FF" stroke={o} strokeWidth="2" />
        <Path d="M16 13l1.3 3 3.2.3-2.4 2.1.7 3.1-2.8-1.6-2.8 1.6.7-3.1-2.4-2.1 3.2-.3z" fill="#FFFFFF" />
      </>
    ),
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {art[name] ?? <Circle cx="16" cy="16" r="11" fill="#F2C27A" stroke={o} strokeWidth="2" />}
    </Svg>
  );
}
