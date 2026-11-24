import { gradeInfo } from '../game/stats';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View, type ViewStyle, type StyleProp, type LayoutChangeEvent } from 'react-native';
import { useWindowDimensions } from 'react-native';
import { Text } from './ScaledText';
import { colors, radius, space, font, cardStyle, TAP } from '../theme';
import type { Rarity } from '../game/types';
import { RARITY_INFO } from '../game/rarity';

export function Card({ children, style, onLayout }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onLayout?: (e: LayoutChangeEvent) => void }) {
  return <View style={[styles.card, style]} onLayout={onLayout}>{children}</View>;
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
      <Animated.View style={[styles.btn, primary && styles.btnPrimary, small && styles.btnSmall, small && primary && { backgroundColor: colors.mint, borderColor: colors.mint }, disabled && styles.btnDisabled, inner, { transform: [{ scale }] }]}>
        <Text style={[styles.btnText, small && styles.btnTextSmall, primary && { color: '#fff' }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** A bar that slides smoothly to its new value. */
export function ProgressBar({ value, color = colors.mint, height = 8 }: { value: number; color?: string; height?: number }) {
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
    <View style={[styles.badge, { backgroundColor: r.soft, maxWidth: '100%' }]}>
      <Text style={[styles.badgeText, { color: r.color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{r.label}</Text>
    </View>
  );
}

/** A pet's grade, e.g. "87%" in its grade color. */
export function GradeChip({ grade, small }: { grade: number; small?: boolean }) {
  const g = gradeInfo(grade);
  return (
    <View style={[styles.badge, { backgroundColor: g.color }, small && { paddingHorizontal: 5, paddingVertical: 1 }]} accessibilityLabel={`Grade ${grade}%, ${g.label}`}>
      <Text style={[styles.badgeText, { color: '#FFFFFF' }, small && { fontSize: 12 }]}>{grade >= 100 ? '💯' : `${grade}%`}</Text>
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
  card: { ...cardStyle, padding: space.lg, gap: space.sm },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.xs, marginBottom: space.xs, paddingHorizontal: space.xs },
  btn: { borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF', borderRadius: 14, minHeight: TAP, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: colors.mint, borderColor: colors.mint },
  btnSmall: { minHeight: 36, borderRadius: radius.sm, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: colors.tile, borderColor: colors.tile },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontWeight: '700', fontSize: 15, color: colors.ink, textAlign: 'center' },
  btnTextSmall: { fontSize: 13 },
  track: { borderRadius: 999, backgroundColor: '#E9F0ED', overflow: 'hidden' },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
});

/**
 * Wraps a pop-up card so it scrolls when it's taller than the screen (big accessibility text sizes).
 * Tapping the empty space above it closes it, like before.
 */
export function FitSheet({ onClose, center, children }: { onClose: () => void; center?: boolean; children: React.ReactNode }) {
  return (
    <ScrollView
      style={{ flex: 1, alignSelf: 'stretch' }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: center ? 'center' : 'flex-end', ...(center ? { alignItems: 'center' as const } : {}) }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <Pressable style={{ flexGrow: 1, minHeight: 24 }} onPress={onClose} accessibilityLabel="Close" />
      {children}
      {center ? <Pressable style={{ flexGrow: 1, minHeight: 24 }} onPress={onClose} accessible={false} /> : null}
    </ScrollView>
  );
}

/** Side padding that keeps a full-screen page to a readable column on wide screens (iPad, unfolded phones). */
export function useSidePad(max = 560, min = 16) {
  const { width } = useWindowDimensions();
  return Math.max(min, (width - max) / 2);
}
