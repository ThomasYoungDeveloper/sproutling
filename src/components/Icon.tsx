import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

/**
 * One small drawn icon set for the whole app (24 grid, 2px rounded strokes).
 * Use these instead of emoji next to text. `filled` paints closed shapes in the same color.
 */
export type IconName =
  | 'flame' | 'shield' | 'gift' | 'volume' | 'volumeOff' | 'star' | 'swords' | 'steps' | 'drop' | 'moon'
  | 'bowl' | 'ball' | 'cookie' | 'blocks' | 'palette' | 'compass' | 'lock' | 'crown' | 'egg' | 'heart'
  | 'mail' | 'key' | 'bell' | 'bellOff' | 'trophy' | 'bag' | 'sparkle' | 'check' | 'chevron' | 'people'
  | 'ban' | 'sprout' | 'dumbbell' | 'calm' | 'bolt' | 'user' | 'help' | 'logout' | 'doc' | 'plus' | 'close' | 'clock';

const P: Record<IconName, (c: string, f: boolean) => React.ReactNode> = {
  flame: (c, f) => <Path d="M12 3c.8 3.2 4.5 5.2 4.5 9.6A4.5 4.5 0 0 1 7.5 13c0-1.9.9-3.2 2-4.2.1 1.8.8 2.9 2 3.2-.3-3 .2-5.9.5-9z" fill={f ? c : 'none'} />,
  shield: (c, f) => <Path d="M12 3l7 3v5.5c0 4.2-2.9 7.6-7 9.5-4.1-1.9-7-5.3-7-9.5V6z" fill={f ? c : 'none'} />,
  gift: () => <><Rect x={3.5} y={8} width={17} height={4} rx={1} /><Path d="M5.5 12v7.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V12M12 8v12.5M12 8C10.5 4 6.5 3.8 6.5 6.2 6.5 8 10 8 12 8zm0 0c1.5-4 5.5-4.2 5.5-1.8C17.5 8 14 8 12 8z" /></>,
  volume: (c, f) => <><Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill={f ? c : 'none'} /><Path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" /></>,
  volumeOff: (c, f) => <><Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill={f ? c : 'none'} /><Path d="M16 9.5l5 5M21 9.5l-5 5" /></>,
  star: (c, f) => <Path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" fill={f ? c : 'none'} />,
  swords: () => <Path d="M14.5 4H20v5.5L9 20.5 6.5 18 17.5 7M9.5 4H4v5.5l4 4M14.5 17.5l3.5 3 2.5-2.5-3-3.5M4 18l2 2" />,
  steps: () => <Path d="M3.5 15.5V13c0-.6.4-1 1-1 1.6 0 2.8-1.3 2.8-2.9V7.5c0-.6.4-1 1-1h1.2c.4 0 .8.3.9.6l.8 1.8c.3.8 1.1 1.3 1.9 1.4l4 .6c1.7.3 3 1.7 3 3.4v1.2zM3.5 15.5v1.5c0 .6.4 1 1 1h15c.6 0 1-.4 1-1v-1.5M10 10.5l1.2-1.2M12.5 11l1.2-1.2" />,
  drop: (c, f) => <Path d="M12 3.5c3 4 6 7.2 6 10.8a6 6 0 0 1-12 0c0-3.6 3-6.8 6-10.8z" fill={f ? c : 'none'} />,
  moon: (c, f) => <Path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z" fill={f ? c : 'none'} />,
  bowl: (c, f) => <><Path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z" fill={f ? c : 'none'} /><Path d="M9 8c0-1.5 1.5-2 1.5-4M14 8c0-1.5 1.5-2 1.5-4" /></>,
  ball: () => <><Circle cx={12} cy={12} r={8.5} /><Path d="M6.2 6c3 3.3 3 8.7 0 12M17.8 6c-3 3.3-3 8.7 0 12" /></>,
  cookie: (c) => <><Circle cx={12} cy={12} r={8.5} /><Circle cx={9} cy={9.5} r={1.2} fill={c} /><Circle cx={14.5} cy={11} r={1.2} fill={c} /><Circle cx={10.5} cy={15} r={1.2} fill={c} /></>,
  blocks: () => <><Rect x={4} y={12} width={7} height={7} rx={1.5} /><Rect x={13} y={12} width={7} height={7} rx={1.5} /><Rect x={8.5} y={4} width={7} height={7} rx={1.5} /></>,
  palette: (c) => <><Path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.9 2-1.9 0-1.2-1-1.5-1-2.6 0-1 .9-1.5 1.9-1.5h1.8a3.8 3.8 0 0 0 3.8-3.8c0-4.1-3.8-7.2-8.5-7.2z" /><Circle cx={8} cy={11} r={1.2} fill={c} /><Circle cx={11} cy={7.5} r={1.2} fill={c} /><Circle cx={15.5} cy={8.5} r={1.2} fill={c} /></>,
  compass: (c, f) => <><Circle cx={12} cy={12} r={8.5} /><Path d="M15.5 8.5l-2 5-5 2 2-5z" fill={f ? c : 'none'} /></>,
  lock: (c, f) => <><Rect x={5} y={10.5} width={14} height={10} rx={2.5} fill={f ? c : 'none'} /><Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  crown: (c, f) => <Path d="M4 8l4 4 4-6 4 6 4-4-1.5 10.5h-13z" fill={f ? c : 'none'} />,
  egg: (c, f) => <Path d="M12 3.5c3.6 0 6.5 6 6.5 10.5a6.5 6.5 0 0 1-13 0C5.5 9.5 8.4 3.5 12 3.5z" fill={f ? c : 'none'} />,
  heart: (c, f) => <Path d="M12 20s-8-4.8-8-10.6A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.4C20 15.2 12 20 12 20z" fill={f ? c : 'none'} />,
  mail: () => <><Rect x={3.5} y={5.5} width={17} height={13} rx={2} /><Path d="M4 7l8 6 8-6" /></>,
  key: () => <><Circle cx={8} cy={15} r={4} /><Path d="M11 12l8.5-8.5M16 7l3 3M14 9l2 2" /></>,
  bell: (c, f) => <><Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" fill={f ? c : 'none'} /><Path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  bellOff: () => <Path d="M6 16.5V11a6 6 0 0 1 9.5-4.9M18 11v5.5l1.5 1.5H8M10 20.5a2 2 0 0 0 4 0M4 4l16 16" />,
  trophy: () => <Path d="M8 4h8v6a4 4 0 0 1-8 0zM8 6H4.5v1A3.5 3.5 0 0 0 8 10.5M16 6h3.5v1a3.5 3.5 0 0 1-3.5 3.5M12 14v4M8.5 20.5h7" />,
  bag: () => <Path d="M6 10a6 6 0 0 1 12 0v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM9.5 6V4h5v2M9 14.5h6" />,
  sparkle: (c, f) => <Path d="M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6-5.6-1.9 5.6-1.9z" fill={f ? c : 'none'} />,
  check: () => <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevron: () => <Path d="M9.5 6l6 6-6 6" />,
  people: () => <><Circle cx={9} cy={8.5} r={3.5} /><Path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c1.8.6 3 2.4 3 5.2" /></>,
  ban: () => <><Circle cx={12} cy={12} r={8.5} /><Path d="M6 6l12 12" /></>,
  sprout: () => <Path d="M12 21v-9M12 12c0-4.2-3-6.5-7.5-6.5 0 4.2 3 6.5 7.5 6.5zM12 14c0-4.2 3-6.5 7.5-6.5 0 4.2-3 6.5-7.5 6.5z" />,
  dumbbell: () => <Path d="M6.5 7.5v9M17.5 7.5v9M3.5 10v4M20.5 10v4M6.5 12h11" />,
  calm: () => <Path d="M12 18.5c-4.5 0-8-2.2-9-6 3.5 0 6.5 1.8 9 6zm0 0c4.5 0 8-2.2 9-6-3.5 0-6.5 1.8-9 6zm0 0c-2.2-3.2-2.2-7.8 0-12 2.2 4.2 2.2 8.8 0 12z" />,
  bolt: (c, f) => <Path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" fill={f ? c : 'none'} />,
  user: () => <><Circle cx={12} cy={8.5} r={4} /><Path d="M4.5 20.5c0-3.8 3.4-6 7.5-6s7.5 2.2 7.5 6" /></>,
  help: (c) => <><Circle cx={12} cy={12} r={8.5} /><Path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8v.5" /><Circle cx={12} cy={16.8} r={1.1} fill={c} stroke="none" /></>,
  logout: () => <Path d="M14 4.5h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-4M10 16.5L5.5 12 10 7.5M5.5 12H15" />,
  doc: () => <Path d="M7 3.5h7l4.5 4.5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15.5a1 1 0 0 1 1-1zM14 3.5V8h4.5M9 13h6M9 16.5h6" />,
  plus: () => <Path d="M12 5v14M5 12h14" />,
  close: () => <Path d="M6 6l12 12M18 6L6 18" />,
  clock: () => <><Circle cx={12} cy={12} r={8.5} /><Path d="M12 7.5V12l3 2" /></>,
};

export function Icon({ name, size = 20, color = colors.ink, filled = false, strokeWidth = 2 }: { name: IconName; size?: number; color?: string; filled?: boolean; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
      {P[name](color, filled)}
    </Svg>
  );
}

/** An icon on a soft round tile, for list rows and empty states. */
export function IconTile({ name, size = 40, tint = colors.mintSoft, color = colors.mintDark, filled }: { name: IconName; size?: number; tint?: string; color?: string; filled?: boolean }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={Math.round(size * 0.52)} color={color} filled={filled} />
    </View>
  );
}
