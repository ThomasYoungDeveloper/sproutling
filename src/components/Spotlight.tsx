import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { colors } from '../theme';

/**
 * "Try it now" spotlight: after an unlock, the new feature's card glows for a few seconds
 * with a one-line pointer for the first step. Fades on the first tap.
 */
type Spot = { id: string; hint: string; until: number } | null;
let current: Spot = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const SPOT_MS = 6000;
export function spotlight(id: string, hint: string) {
  current = { id, hint, until: Date.now() + SPOT_MS };
  emit();
  setTimeout(() => {
    if (current && current.until <= Date.now()) {
      current = null;
      emit();
    }
  }, SPOT_MS + 50);
}
export function clearSpotlight() {
  if (!current) return;
  current = null;
  emit();
}

export function useSpotlight(id?: string): Spot {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  if (!current || current.until < Date.now()) return null;
  return id === undefined || current.id === id ? current : null;
}

/** Wraps a card: while its feature is in the spotlight it gets a pulsing gold ring and a pointer. */
export function Glow({ id, children }: { id: string; children: React.ReactNode }) {
  const spot = useSpotlight(id);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!spot) return;
    const l = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.35, duration: 600, useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, [!!spot]);
  if (!spot) return <>{children}</>;
  return (
    <View onTouchStart={clearSpotlight}>
      <View>
        <Animated.View pointerEvents="none" style={[styles.ring, { opacity: v }]} />
        {children}
      </View>
      <View style={styles.tipWrap} pointerEvents="none">
        <View style={styles.arrow} />
        <View style={styles.tip}><Text style={styles.tipText}>{spot.hint}</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', top: -7, left: -7, right: -7, bottom: -7, borderRadius: 30, borderWidth: 4, borderColor: '#FFC94D', shadowColor: '#FFC94D', shadowOpacity: 0.9, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  tipWrap: { alignItems: 'center', marginTop: 10 },
  arrow: { width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderBottomWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: colors.ink },
  tip: { backgroundColor: colors.ink, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9 },
  tipText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', textAlign: 'center' },
});
