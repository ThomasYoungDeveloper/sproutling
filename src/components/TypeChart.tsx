import React, { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, G, Marker, Path, Text as SvgText } from 'react-native-svg';
import { Text } from './ScaledText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as B from '../game/battle';
import type { Element } from '../game/types';
import { colors } from '../theme';

/** A small white glyph for each type (24 grid). */
const GLYPH: Record<Element, string> = {
  flower: 'M12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M12 9.5c-1-3 1-5 0-6 -1 1 1 3 0 6M14.5 12c3-1 5 1 6 0 -1-1-3 1-6 0M12 14.5c1 3-1 5 0 6 1-1-1-3 0-6M9.5 12c-3 1-5-1-6 0 1 1 3-1 6 0',
  tide: 'M3 14c2.5-2 4.5-2 6 0s3.5 2 6 0 4.5-2 6 0M3 9c2.5-2 4.5-2 6 0s3.5 2 6 0 4.5-2 6 0M3 19c2.5-2 4.5-2 6 0s3.5 2 6 0 4.5-2 6 0',
  ember: 'M12 3c1 3.2 5 5.2 5 9.6A5 5 0 0 1 7 13c0-2 1-3.3 2.2-4.3.1 1.9.9 3 2.1 3.3-.3-3 .2-6 .7-9z',
  moon: 'M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z',
  stone: 'M5 18l2-8 5-4 6 3 2 9zM9 11l3 2 4-2',
  spark: 'M13 3L5 13.5h6L10 21l8-10.5h-6z',
  frost: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5',
  wind: 'M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h7',
  toxic: 'M12 4c-3 4-6 6.5-6 10a6 6 0 0 0 12 0c0-3.5-3-6-6-10zM10 14h.01M14 14h.01M10.5 17.5c1 .7 2 .7 3 0',
};

/** A type's colored dot with its glyph, for chips and lists. */
export function ElementBadge({ element, size = 20 }: { element: Element; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: B.ELEMENT_COLOR[element], alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <Path d={GLYPH[element]} />
      </Svg>
    </View>
  );
}

/** Eight types in a loop (each beats the next one clockwise), Stone in the middle. */
const RING: Element[] = ['flower', 'tide', 'ember', 'frost', 'spark', 'toxic', 'wind', 'moon'];
const ALL: Element[] = [...RING.slice(0, 4), 'stone', ...RING.slice(4)];
const CX = 180, CY = 180, R = 128;
const GOOD = '#2FB58A', BAD = '#E0567A', DIM = '#9AA8A3';
const label = (e: Element) => B.ELEMENT_LABEL[e];

function pos(e: Element): [number, number] {
  if (e === 'stone') return [CX, CY];
  const a = ((RING.indexOf(e) * 45 - 90) * Math.PI) / 180;
  return [CX + R * Math.cos(a), CY + R * Math.sin(a)];
}

function arrowPath(a: Element, b: Element, curve: number) {
  const [x1, y1] = pos(a);
  const [x2, y2] = pos(b);
  const dx = x2 - x1, dy = y2 - y1;
  const d = Math.hypot(dx, dy);
  const ux = dx / d, uy = dy / d;
  const sx = x1 + ux * 30, sy = y1 + uy * 30, ex = x2 - ux * 33, ey = y2 - uy * 33;
  let c = curve;
  if (a !== 'stone' && b !== 'stone' && Math.hypot((sx + ex) / 2 - CX, (sy + ey) / 2 - CY) < 45) c = 95;
  const mx = (sx + ex) / 2 - uy * c, my = (sy + ey) / 2 + ux * c;
  return `M${sx.toFixed(1)} ${sy.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
}

function Wheel({ sel, onPick, size }: { sel: Element | null; onPick: (e: Element) => void; size: number }) {
  const keep = sel ? new Set<Element>([sel, ...B.BEATS[sel], ...B.weakTo(sel)]) : null;
  const arrows: React.ReactNode[] = [];
  if (!sel) {
    (Object.keys(B.BEATS) as Element[]).forEach((a) =>
      B.BEATS[a].forEach((b) => {
        const ringPair = RING.includes(a) && RING.includes(b) && (RING.indexOf(b) - RING.indexOf(a) + 8) % 8 === 1;
        const strong = ringPair || a === 'stone' || b === 'stone';
        arrows.push(<Path key={a + b} d={arrowPath(a, b, ringPair ? 10 : 0)} stroke={DIM} strokeWidth={strong ? 2.2 : 1.2} opacity={strong ? 0.9 : 0.35} fill="none" strokeLinecap="round" markerEnd="url(#ahd)" />);
      }),
    );
  } else {
    B.BEATS[sel].forEach((b) => arrows.push(<Path key={'g' + b} d={arrowPath(sel, b, 8)} stroke={GOOD} strokeWidth={4} fill="none" strokeLinecap="round" markerEnd="url(#ahg)" />));
    B.weakTo(sel).forEach((a) => arrows.push(<Path key={'b' + a} d={arrowPath(a, sel, 8)} stroke={BAD} strokeWidth={4} fill="none" strokeLinecap="round" markerEnd="url(#ahb)" />));
  }
  return (
    <Svg width={size} height={size * (370 / 360)} viewBox="0 0 360 370">
      <Defs>
        {[['ahd', DIM], ['ahg', GOOD], ['ahb', BAD]].map(([id, c]) => (
          <Marker key={id} id={id} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <Path d="M1 1L8 5L1 9z" fill={c} />
          </Marker>
        ))}
      </Defs>
      {arrows}
      {ALL.map((e) => {
        const [x, y] = pos(e);
        const on = e === sel;
        const r = on ? 28 : 24;
        const s = r * 1.25;
        return (
          <G key={e} opacity={keep && !keep.has(e) ? 0.28 : 1} onPress={() => onPick(e)}>
            {on ? <Circle cx={x} cy={y} r={r + 5} stroke={B.ELEMENT_COLOR[e]} strokeWidth={3} opacity={0.35} fill="none" /> : null}
            <Circle cx={x} cy={y} r={r} fill={B.ELEMENT_COLOR[e]} />
            <G transform={`translate(${x - s / 2} ${y - s / 2}) scale(${s / 24})`}>
              <Path d={GLYPH[e]} fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </G>
            <SvgText x={x} y={y + r + 15} fontSize={12} fontWeight="700" fontFamily="System, -apple-system, Helvetica, Arial, sans-serif" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={4} strokeLinejoin="round" textAnchor="middle">
              {label(e)}
            </SvgText>
            <SvgText x={x} y={y + r + 15} fontSize={12} fontWeight="700" fontFamily="System, -apple-system, Helvetica, Arial, sans-serif" fill={colors.ink} textAnchor="middle">
              {label(e)}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

/** The type chart: a rock-paper-scissors wheel. Tap a type to see what it beats and what beats it. */
export default function TypeChart({ onClose, initial = null }: { onClose: () => void; initial?: Element | null }) {
  const [sel, setSel] = useState<Element | null>(initial);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const size = Math.min(340, width - 40);
  const pick = (e: Element) => setSel((s) => (s === e ? null : e));
  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.grab} />
        <View style={styles.top}>
          <Text style={styles.title}>Type chart</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.done} accessibilityRole="button">
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
        <View style={{ alignItems: 'center' }} accessibilityLabel="Type chart wheel">
          <Wheel sel={sel} onPick={pick} size={size} />
        </View>
        {sel ? (
          <View style={styles.cards}>
            <View style={[styles.card, { backgroundColor: '#E3F5EC' }]}>
              <Text style={[styles.cardKicker, { color: '#1E8A68' }]}>{label(sel).toUpperCase()} BEATS · 2× DAMAGE</Text>
              <Text style={styles.cardText}>{B.BEATS[sel].map(label).join(' · ')}</Text>
            </View>
            <View style={[styles.card, { backgroundColor: '#FDE7EC' }]}>
              <Text style={[styles.cardKicker, { color: '#C2365C' }]}>WATCH OUT FOR</Text>
              <Text style={styles.cardText}>{B.weakTo(sel).map(label).join(' · ')}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.hint}>Arrows point at who each type beats.{'\n'}Tap a type to see its matchups.</Text>
        )}
        <View style={styles.chips}>
          {ALL.map((e) => (
            <Pressable key={e} onPress={() => pick(e)} hitSlop={4} style={[styles.chip, sel && sel !== e && { opacity: 0.35 }, sel === e && { borderColor: B.ELEMENT_COLOR[e] }]} accessibilityRole="button" accessibilityState={{ selected: sel === e }} accessibilityLabel={`${label(e)}: beats ${B.BEATS[e].map(label).join(' and ')}, weak to ${B.weakTo(e).map(label).join(' and ')}`}>
              <ElementBadge element={e} size={28} />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,28,32,0.45)', justifyContent: 'flex-end', alignItems: 'center', zIndex: 60 },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 8, width: '100%', maxWidth: 560 },
  grab: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: '#CBD5D1', marginBottom: 6 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  done: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  doneText: { fontSize: 16, fontWeight: '700', color: colors.mintDark },
  hint: { textAlign: 'center', fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 4 },
  cards: { flexDirection: 'row', gap: 8, marginTop: 4 },
  card: { flex: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
  cardKicker: { fontSize: 11, fontWeight: '700' },
  cardText: { fontSize: 15, fontWeight: '700', color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 1, marginTop: 12 },
  chip: { padding: 2, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
});
