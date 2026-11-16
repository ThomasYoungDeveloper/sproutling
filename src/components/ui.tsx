import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type ViewStyle, type StyleProp } from 'react-native';
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
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number, friction: number) => Animated.spring(scale, { toValue: v, friction, tension: 220, useNativeDriver: true }).start();
  // Layout styles (flex, alignSelf, margins) size the tap area; the rest styles the button itself.
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, any>;
  const outer: Record<string, any> = {};
  const inner: Record<string, any> = {};
  Object.entries(flat).forEach(([k, val]) => ((/^(flex|alignSelf|margin|width|minWidth|maxWidth)/.test(k) ? outer : inner)[k] = val));
  if (outer.alignSelf === 'stretch' || outer.flex) inner.alignSelf = 'stretch';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={disabled ? undefined : onPress}
      onPressIn={() => !disabled && to(0.94, 6)}
      onPressOut={() => to(1, 3.5)}
      style={outer}
    >
      <Animated.View style={[styles.btn, primary && styles.btnPrimary, small && styles.btnSmall, disabled && styles.btnDisabled, inner, { transform: [{ scale }] }]}>
        <Text style={[styles.btnText, primary && { color: '#fff' }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** A bar that slides smoothly to its new value. */
export function ProgressBar({ value, color = colors.mint, height = 10 }: { value: number; color?: string; height?: number }) {
  const target = Math.max(0, Math.min(1, value));
  const v = useRef(new Animated.Value(target)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: target, friction: 7, tension: 50, useNativeDriver: false }).start();
  }, [target]);
  return (
    <View style={[styles.track, { height }]}>
      <Animated.View style={{ width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), height: '100%', backgroundColor: color, borderRadius: 999 }} />
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
