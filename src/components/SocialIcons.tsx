import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/** Line icons for the Social section tabs (same stroke style as the bottom tab bar). */
export type SocialIconName = 'friends' | 'chat' | 'team' | 'ranks' | 'battle' | 'show';

export function SocialIcon({ name, color, size = 24 }: { name: SocialIconName; color: string; size?: number }) {
  const p = { fill: 'none', stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'friends' && (
        <>
          <Circle cx={9} cy={8} r={3.2} {...p} />
          <Path d="M3.5 19c.6-3.4 2.8-5.2 5.5-5.2s4.9 1.8 5.5 5.2" {...p} />
          <Circle cx={16.5} cy={9} r={2.6} {...p} />
          <Path d="M15.5 13.9c2.6-.2 4.4 1.4 5 4.6" {...p} />
        </>
      )}
      {name === 'chat' && <Path d="M4 6.5C4 5.1 5.1 4 6.5 4h11C18.9 4 20 5.1 20 6.5v7c0 1.4-1.1 2.5-2.5 2.5H11l-4.5 3.5V16H6.5C5.1 16 4 14.9 4 13.5z" {...p} />}
      {name === 'team' && <Path d="M12 3.5l7 2.6v5.4c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6.1z" {...p} />}
      {name === 'battle' && (
        <>
          <Path d="M4 4l11 11M20 4L9 15" {...p} />
          <Path d="M12.6 17.4l4.8-4.8M6.6 12.6l4.8 4.8" {...p} />
          <Path d="M15 15l3.4 3.4M9 15l-3.4 3.4" {...p} />
          <Circle cx={19.4} cy={19.4} r={1.1} {...p} />
          <Circle cx={4.6} cy={19.4} r={1.1} {...p} />
        </>
      )}
      {name === 'ranks' && (
        <>
          <Path d="M4 20h16" {...p} />
          <Path d="M6 20v-6h4v6M10 20V9h4v11M14 20v-8h4v8" {...p} />
        </>
      )}
      {name === 'show' && <Path d="M12 4l2.3 4.8 5.2.7-3.8 3.6.9 5.2L12 15.9 7.4 18.3l.9-5.2L4.5 9.5l5.2-.7z" {...p} />}
    </Svg>
  );
}
