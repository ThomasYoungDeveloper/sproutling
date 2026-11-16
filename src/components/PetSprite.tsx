import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { Species, Stage, Topper } from '../game/types';

/**
 * Placeholder pet art, drawn from each species' traits so every species looks distinct.
 * Swap this component for purchased sprite images later; the rest of the app won't change.
 */
const INK = '#24323A';

interface Props {
  species: Species;
  stage: Stage;
  size?: number;
  shiny?: boolean;
  mood?: 'happy' | 'joy' | 'sleepy';
  silhouette?: boolean;
}

function shinyColor(hex: string): string {
  // Rotate the colour for rare "shiny" variants: swap R and B channels.
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return '#' + ((b << 16) | (g << 8) | r).toString(16).padStart(6, '0');
}

function topperPath(t: Topper, x: number, y: number, s: number, accent: string): React.ReactNode {
  switch (t) {
    case 'sprout':
      return (
        <G>
          <Path d={`M${x} ${y + 10 * s} Q${x - 2} ${y} ${x} ${y - 6 * s}`} stroke="#3D9A6E" strokeWidth={3.5} fill="none" strokeLinecap="round" />
          <Ellipse cx={x + 9 * s} cy={y - 8 * s} rx={10 * s} ry={5 * s} fill={accent} stroke={INK} strokeWidth={2.5} transform={`rotate(-20 ${x + 9 * s} ${y - 8 * s})`} />
        </G>
      );
    case 'flower':
      return (
        <G>
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i * 72 * Math.PI) / 180;
            return <Circle key={i} cx={x + Math.cos(a) * 7 * s} cy={y + Math.sin(a) * 7 * s} r={6 * s} fill={accent} stroke={INK} strokeWidth={2} />;
          })}
          <Circle cx={x} cy={y} r={4.5 * s} fill="#FFE27A" stroke={INK} strokeWidth={2} />
        </G>
      );
    case 'moon': {
      const R = 11 * s;
      return <Path d={`M${x} ${y - R} A${R} ${R} 0 1 0 ${x} ${y + R} A${R * 0.68} ${R} 0 1 1 ${x} ${y - R} Z`} fill={accent} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />;
    }
    case 'star': {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 === 0 ? 12 * s : 5 * s;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        return `${x + Math.cos(a) * r},${y + Math.sin(a) * r}`;
      }).join(' ');
      return <Path d={`M${pts.replace(/ /g, ' L')} Z`} fill={accent} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />;
    }
    case 'flame':
    case 'drop': {
      const h = 24 * s, w = 11 * s;
      const d = `M${x} ${y - h / 2} C${x + w} ${y - h * 0.05}, ${x + w * 0.8} ${y + h / 2}, ${x} ${y + h / 2} C${x - w * 0.8} ${y + h / 2}, ${x - w} ${y - h * 0.05}, ${x} ${y - h / 2} Z`;
      return (
        <G>
          <Path d={d} fill={accent} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
          <Ellipse cx={x - w * 0.25} cy={y + h * 0.1} rx={2.5 * s} ry={4 * s} fill="#FFFFFF" opacity={0.6} />
        </G>
      );
    }
    case 'crystal':
      return <Path d={`M${x} ${y - 14 * s} L${x + 8 * s} ${y} L${x} ${y + 10 * s} L${x - 8 * s} ${y} Z`} fill={accent} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />;
    case 'mushroom':
      return (
        <G>
          <Rect x={x - 4 * s} y={y} width={8 * s} height={10 * s} rx={3} fill="#FFF6E8" stroke={INK} strokeWidth={2} />
          <Path d={`M${x - 16 * s} ${y + 2 * s} Q${x} ${y - 20 * s} ${x + 16 * s} ${y + 2 * s} Z`} fill={accent} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
          <Circle cx={x - 6 * s} cy={y - 4 * s} r={2.5 * s} fill="#FFFFFF" />
          <Circle cx={x + 5 * s} cy={y - 6 * s} r={2 * s} fill="#FFFFFF" />
        </G>
      );
    default:
      return null;
  }
}

export default function PetSprite({ species, stage, size = 180, shiny = false, mood = 'happy', silhouette = false }: Props) {
  const sc = stage === 'baby' ? 0.72 : stage === 'teen' ? 0.86 : 1;
  const base = species.colors;
  const body = silhouette ? '#C9D3D0' : shiny ? shinyColor(base.body) : base.body;
  const belly = silhouette ? '#C9D3D0' : shiny ? shinyColor(base.belly) : base.belly;
  const accent = silhouette ? '#B7C2BF' : shiny ? shinyColor(base.accent) : base.accent;
  const stroke = silhouette ? '#AEB9B6' : INK;

  // Body dimensions by shape.
  const dims = { round: [56, 52], tall: [46, 62], blob: [60, 48], wide: [68, 46] }[species.body];
  const rx = dims[0] * sc, ry = dims[1] * sc;
  const cx = 100, cy = 178 - ry;
  const top = cy - ry;

  const ears = (() => {
    const e = species.ears;
    const lx = cx - rx * 0.55, rxp = cx + rx * 0.55, ey = top + ry * 0.25;
    const pair = (l: React.ReactNode, r: React.ReactNode) => <G>{l}{r}</G>;
    switch (e) {
      case 'cat':
      case 'fox': {
        const h = e === 'fox' ? 30 : 22;
        const tri = (x: number, dir: number) => <Path d={`M${x - 14 * dir} ${ey + 6} L${x - 2 * dir} ${ey - h * sc} L${x + 12 * dir} ${ey + 2} Z`} fill={body} stroke={stroke} strokeWidth={3} strokeLinejoin="round" />;
        return pair(tri(lx, 1), tri(rxp, -1));
      }
      case 'bunny':
        return pair(
          <Ellipse cx={lx + 4} cy={ey - 30 * sc} rx={9 * sc} ry={28 * sc} fill={body} stroke={stroke} strokeWidth={3} />,
          <Ellipse cx={rxp - 4} cy={ey - 30 * sc} rx={9 * sc} ry={28 * sc} fill={body} stroke={stroke} strokeWidth={3} />,
        );
      case 'bear':
        return pair(
          <Circle cx={lx} cy={ey - 2} r={12 * sc} fill={body} stroke={stroke} strokeWidth={3} />,
          <Circle cx={rxp} cy={ey - 2} r={12 * sc} fill={body} stroke={stroke} strokeWidth={3} />,
        );
      case 'antenna':
        return pair(
          <G><Path d={`M${lx + 8} ${ey + 4} Q${lx - 4} ${ey - 20} ${lx - 6} ${ey - 30 * sc}`} stroke={stroke} strokeWidth={3} fill="none" /><Circle cx={lx - 6} cy={ey - 30 * sc} r={5} fill={accent} stroke={stroke} strokeWidth={2} /></G>,
          <G><Path d={`M${rxp - 8} ${ey + 4} Q${rxp + 4} ${ey - 20} ${rxp + 6} ${ey - 30 * sc}`} stroke={stroke} strokeWidth={3} fill="none" /><Circle cx={rxp + 6} cy={ey - 30 * sc} r={5} fill={accent} stroke={stroke} strokeWidth={2} /></G>,
        );
      case 'horns':
        return pair(
          <Path d={`M${lx} ${ey + 4} Q${lx - 14} ${ey - 16} ${lx - 6} ${ey - 30 * sc} Q${lx + 2} ${ey - 14} ${lx + 10} ${ey + 2} Z`} fill={accent} stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" />,
          <Path d={`M${rxp} ${ey + 4} Q${rxp + 14} ${ey - 16} ${rxp + 6} ${ey - 30 * sc} Q${rxp - 2} ${ey - 14} ${rxp - 10} ${ey + 2} Z`} fill={accent} stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" />,
        );
      case 'fins':
        return pair(
          <Path d={`M${cx - rx + 4} ${cy} Q${cx - rx - 22} ${cy - 18} ${cx - rx - 14} ${cy + 10} Z`} fill={accent} stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" />,
          <Path d={`M${cx + rx - 4} ${cy} Q${cx + rx + 22} ${cy - 18} ${cx + rx + 14} ${cy + 10} Z`} fill={accent} stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" />,
        );
      case 'tufts':
        return pair(
          <Path d={`M${lx - 6} ${ey + 6} L${lx - 10} ${ey - 18 * sc} L${lx + 8} ${ey} Z`} fill={accent} stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" />,
          <Path d={`M${rxp + 6} ${ey + 6} L${rxp + 10} ${ey - 18 * sc} L${rxp - 8} ${ey} Z`} fill={accent} stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" />,
        );
      default:
        return null;
    }
  })();

  const ey = cy - ry * 0.1, ex = rx * 0.36;
  const eyes = silhouette ? null : mood === 'sleepy' ? (
    <Path d={`M${cx - ex - 6} ${ey} q6 4 12 0 M${cx + ex - 6} ${ey} q6 4 12 0`} stroke={INK} strokeWidth={3.2} fill="none" strokeLinecap="round" />
  ) : mood === 'joy' ? (
    <Path d={`M${cx - ex - 6} ${ey + 2} q6 -8 12 0 M${cx + ex - 6} ${ey + 2} q6 -8 12 0`} stroke={INK} strokeWidth={3.2} fill="none" strokeLinecap="round" />
  ) : (
    <G>
      <Circle cx={cx - ex} cy={ey} r={6} fill={INK} />
      <Circle cx={cx + ex} cy={ey} r={6} fill={INK} />
      <Circle cx={cx - ex + 2} cy={ey - 2.4} r={2} fill="#FFFFFF" />
      <Circle cx={cx + ex + 2} cy={ey - 2.4} r={2} fill="#FFFFFF" />
    </G>
  );

  const showTopper = stage !== 'baby' && species.topper !== 'none';
  const topperScale = stage === 'teen' ? 0.75 : 1;
  const legendaryGlow = species.rarity === 'legendary' && stage === 'adult' && !silhouette;

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      {legendaryGlow && <Circle cx={cx} cy={cy} r={ry + 26} fill={accent} opacity={0.18} />}
      <Ellipse cx={cx} cy={182} rx={rx * 0.85} ry={7} fill="rgba(36,50,58,0.12)" />
      {species.ears === 'fins' ? ears : null}
      {species.ears !== 'fins' ? ears : null}
      {stage !== 'baby' && (
        <G>
          <Ellipse cx={cx - rx * 0.45} cy={176} rx={11 * sc} ry={6.5} fill={body} stroke={stroke} strokeWidth={3} />
          <Ellipse cx={cx + rx * 0.45} cy={176} rx={11 * sc} ry={6.5} fill={body} stroke={stroke} strokeWidth={3} />
        </G>
      )}
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={body} stroke={stroke} strokeWidth={3} />
      <Ellipse cx={cx} cy={cy + ry * 0.32} rx={rx * 0.6} ry={ry * 0.48} fill={belly} />
      {eyes}
      {!silhouette && (
        <G>
          <Ellipse cx={cx - ex - 9} cy={ey + 11} rx={6.5} ry={4} fill="#FFB2A0" opacity={0.8} />
          <Ellipse cx={cx + ex + 9} cy={ey + 11} rx={6.5} ry={4} fill="#FFB2A0" opacity={0.8} />
          <Path d={`M${cx - 7} ${ey + 11} q7 ${mood === 'joy' ? 9 : 6} 14 0`} stroke={INK} strokeWidth={2.8} fill={mood === 'joy' ? '#FF8F8F' : 'none'} strokeLinecap="round" strokeLinejoin="round" />
        </G>
      )}
      {showTopper && topperPath(species.topper, cx, top - 12 * topperScale, topperScale, accent)}
    </Svg>
  );
}
