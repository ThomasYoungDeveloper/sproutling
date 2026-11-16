import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle, type StyleProp } from 'react-native';
import { colors, radius, space, font } from '../theme';
import type { Rarity } from '../game/types';
import { RARITY_INFO } from '../game/rarity';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHead({ title, meta }: { title: string; meta?: string }) {
  return (
    <View style={styles.head}>
      <Text style={font.h2}>{title}</Text>
      {meta ? <Text style={font.small}>{meta}</Text> : null}
    </View>
  );
}

export function Button({ label, onPress, primary, disabled, small, style }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean; small?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [styles.btn, primary && styles.btnPrimary, small && styles.btnSmall, disabled && styles.btnDisabled, pressed && !disabled && { opacity: 0.8 }, style]}
    >
      <Text style={[styles.btnText, primary && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({ value, color = colors.mint, height = 10 }: { value: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={[styles.track, { height }]}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 999 }} />
    </View>
  );
}

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  const r = RARITY_INFO[rarity];
  return (
    <View style={[styles.badge, { backgroundColor: r.soft }]}>
      <Text style={[styles.badgeText, { color: r.color }]}>{r.label}</Text>
    </View>
  );
}

export function Chip({ label, tone = 'mint' }: { label: string; tone?: 'mint' | 'muted' | 'gold' }) {
  const bg = tone === 'mint' ? colors.mintSoft : tone === 'gold' ? '#FFF1C9' : '#F0F3F2';
  const fg = tone === 'mint' ? colors.mintDark : tone === 'gold' ? '#9A6A00' : colors.muted;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space.lg, gap: space.sm },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.xs },
  btn: { borderWidth: 1, borderColor: colors.line, backgroundColor: '#F7FAF9', borderRadius: radius.sm, paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center' },
  btnPrimary: { backgroundColor: colors.mint, borderColor: colors.mint },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 10 },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontWeight: '800', fontSize: 14, color: colors.ink },
  track: { borderRadius: 999, backgroundColor: '#EEF4F1', borderWidth: 1, borderColor: '#CFE6DB', overflow: 'hidden' },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '800' },
});
