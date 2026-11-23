import React from 'react';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { TRIMS, type Crest } from '../game/crest';

const SHAPE: Record<Crest['shape'], string> = {
  shield: 'M32 4l24 8v18c0 16-11 26-24 30C19 56 8 46 8 30V12z',
  round: 'M32 5a27 27 0 1 0 0.01 0z',
  banner: 'M12 4h40v52l-20-10-20 10z',
  kite: 'M32 3l24 20-24 38L8 23z',
};
const INK = '#FFF6D8';

function Symbol({ id }: { id: string }) {
  switch (id) {
    case 'sword':
      return <Path d="M32 16v24M27 34h10M32 40v6" stroke={INK} strokeWidth={4} strokeLinecap="round" />;
    case 'sun':
      return (
        <G>
          <Circle cx={32} cy={31} r={7} fill={INK} />
          <Path d="M32 17v4M32 41v4M18 31h4M42 31h4M22 21l3 3M39 38l3 3M42 21l-3 3M25 38l-3 3" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        </G>
      );
    case 'moon':
      return <Path d="M38 18a12 12 0 1 0 4 20 10 10 0 0 1-4-20z" fill={INK} />;
    case 'heart':
      return <Path d="M32 42s-12-7-12-15a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 8-12 15-12 15z" fill={INK} />;
    case 'mountain':
      return <Path d="M16 42l11-16 6 8 4-5 11 13z" fill={INK} />;
    case 'star':
      return <Path d="M32 16l4 10h10l-8 6 3 10-9-6-9 6 3-10-8-6h10z" fill={INK} />;
    case 'wave':
      return <Path d="M16 30c4-4 8-4 12 0s8 4 12 0 6-3 8-1M16 38c4-4 8-4 12 0s8 4 12 0 6-3 8-1" stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" />;
    case 'paw':
      return (
        <G fill={INK}>
          <Circle cx={32} cy={36} r={6} />
          <Circle cx={24} cy={27} r={3} />
          <Circle cx={30} cy={22} r={3} />
          <Circle cx={36} cy={22} r={3} />
          <Circle cx={41} cy={28} r={3} />
        </G>
      );
    case 'crown':
      return <Path d="M18 40l-2-16 9 7 7-11 7 11 9-7-2 16z" fill={INK} />;
    case 'flame':
      return <Path d="M32 16c6 7 11 12 11 19a11 11 0 0 1-22 0c0-5 3-8 5-11 1 4 3 6 5 6-1-5 0-9 1-14z" fill={INK} />;
    case 'dragon':
      return <Path d="M18 40c4-10 10-16 18-18l-2-5 6 4 6-2-3 6c2 4 1 9-3 12l3 5-7-2c-5 2-12 2-18 0z" fill={INK} />;
    case 'leaf':
      return <Path d="M22 42c0-14 8-22 20-24-1 13-8 22-20 24zM22 42l12-12" stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" />;
    default:
      return null;
  }
}

/** A guild crest drawn from its parts. */
export default function CrestArt({ crest, size = 52, id = 'c' }: { crest: Crest; size?: number; id?: string }) {
  const d = SHAPE[crest.shape];
  const trim = TRIMS.find((t) => t.id === crest.trim)?.color ?? '#8A5A2B';
  const clip = `crest-${id}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <ClipPath id={clip}>
          <Path d={d} />
        </ClipPath>
      </Defs>
      <Path d={d} fill="#000" opacity={0.2} transform="translate(0 2)" />
      <Path d={d} fill={crest.c1} />
      <G clipPath={`url(#${clip})`}>
        {crest.pattern === 'split' ? <Rect x={32} y={0} width={32} height={64} fill={crest.c2} /> : null}
        {crest.pattern === 'chevron' ? <Path d="M0 24l32 18 32-18v12L32 54 0 36z" fill={crest.c2} /> : null}
        {crest.pattern === 'stripe' ? <Rect x={0} y={27} width={64} height={10} fill={crest.c2} /> : null}
      </G>
      <Path d={d} fill="none" stroke={trim} strokeWidth={crest.trim === 'wooden' ? 3.5 : 3} />
      {crest.trim === 'gold' || crest.trim === 'silver' ? <Path d={d} fill="none" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={1} transform="translate(32 32) scale(0.9) translate(-32 -32)" /> : null}
      <Symbol id={crest.symbol} />
    </Svg>
  );
}
