import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { play, type SoundName } from '../lib/sound';
import { shortNumber } from '../lib/shortNumber';

/** A short buzz. Works on phones, and on the web wherever the browser supports vibration. */
const DEFAULT_SOUND = { light: 'tap', medium: 'pop', heavy: 'thud', success: 'chime' } as const;

/** A little vibration plus a matching sound. Pass a sound name to use a special one, or 'none'. */
export function buzz(kind: 'light' | 'medium' | 'heavy' | 'success' = 'light', sound?: SoundName | 'none') {
  if (sound !== 'none') play(sound ?? DEFAULT_SOUND[kind]);
  try {
    const p =
      kind === 'success'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.impactAsync(kind === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    p?.catch?.(() => {});
  } catch {}
}

const CONFETTI_COLORS = ['#FF9E7A', '#FFD25E', '#2FB58A', '#8FC9F0', '#B9AAF2', '#FF7EB6'];

/** A burst of falling confetti. `amount` scales with rarity. */
export function Confetti({ amount = 40, colors = CONFETTI_COLORS, width = 360, height = 640 }: { amount?: number; colors?: string[]; width?: number; height?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: amount }, (_, i) => ({
        x: Math.random() * width,
        drift: (Math.random() - 0.5) * 160,
        delay: Math.random() * 300,
        dur: 1400 + Math.random() * 1200,
        size: 6 + Math.random() * 7,
        color: colors[i % colors.length],
        spin: Math.random() > 0.5 ? 1 : -1,
        round: Math.random() > 0.6,
        v: new Animated.Value(0),
      })),
    [amount, width],
  );
  useEffect(() => {
    Animated.parallel(
      pieces.map((p) => Animated.timing(p.v, { toValue: 1, duration: p.dur, delay: p.delay, easing: Easing.out(Easing.quad), useNativeDriver: true })),
    ).start();
  }, [pieces]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: -20,
            width: p.size,
            height: p.round ? p.size : p.size * 0.5,
            borderRadius: p.round ? p.size : 2,
            backgroundColor: p.color,
            opacity: p.v.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) },
              { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin * 540}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

/** Slowly spinning light rays behind a reveal, tinted by rarity. */
export function Rays({ color, size = 340, count = 12 }: { color: string; size?: number; count?: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(grow, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.55,
        transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }, { scale: grow }],
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: size * 0.09,
            height: size,
            backgroundColor: color,
            opacity: i % 2 ? 0.35 : 0.6,
            borderRadius: size,
            transform: [{ rotate: `${(360 / count) * i}deg` }],
          }}
        />
      ))}
      <View style={{ width: size * 0.55, height: size * 0.55, borderRadius: size, backgroundColor: color, opacity: 0.5 }} />
    </Animated.View>
  );
}

/** Pops children in with an overshoot, after an optional delay. */
export function PopIn({ children, delay = 0, from = 0.2 }: { children: React.ReactNode; delay?: number; from?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, delay, friction: 5, tension: 120, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [from, 1] }) }] }}>
      {children}
    </Animated.View>
  );
}

/** Full-screen white flash used at the moment something cracks open. */
export function Flash({ onDone }: { onDone?: () => void }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 0, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => onDone?.());
  }, []);
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF', opacity: v }]} />;
}

/** Counts a number up from 0 for a satisfying coin tally. */
export function useCountUp(target: number, duration = 900, start = true): number {
  const [n, setN] = React.useState(0);
  useEffect(() => {
    if (!start) return;
    let raf: any;
    const t0 = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = setTimeout(tick, 16);
    };
    tick();
    return () => clearTimeout(raf);
  }, [target, start]);
  return n;
}

/** A shake animation driven by a key that changes on every tap. */
export function useShake(trigger: number, strength = 10) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!trigger) return;
    v.setValue(0);
    Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(v, { toValue: -1, duration: 70, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 70, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [trigger]);
  return {
    transform: [
      { translateX: v.interpolate({ inputRange: [-1, 1], outputRange: [-strength, strength] }) },
      { rotate: v.interpolate({ inputRange: [-1, 1], outputRange: ['-6deg', '6deg'] }) },
    ],
  };
}

/** Gentle idle wobble so eggs and chests look alive before you tap them. */
export function useIdleWobble() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(v, { toValue: -1, duration: 160, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.delay(1200),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return { transform: [{ rotate: v.interpolate({ inputRange: [-1, 1], outputRange: ['-5deg', '5deg'] }) }] };
}

/** Wraps children in the idle wobble (for eggs that are ready to hatch). */
export function Wobble({ children }: { children: React.ReactNode }) {
  const style = useIdleWobble();
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** A pill number that rolls from its old value to its new one and bumps when it goes up. */
export function RollingNumber({ value, style, prefix = '', short = false }: { value: number; style?: any; prefix?: string; /** 10K / 1.2M / 3B instead of the full number. */ short?: boolean }) {
  const [shown, setShown] = React.useState(value);
  const from = useRef(value);
  const bump = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    if (value > start) {
      play('coin');
      bump.setValue(0);
      Animated.sequence([
        Animated.timing(bump, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.spring(bump, { toValue: 0, friction: 3, useNativeDriver: true }),
      ]).start();
    }
    const t0 = Date.now();
    let raf: any;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / 600);
      setShown(Math.round(start + (value - start) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = setTimeout(tick, 16);
      else from.current = value;
    };
    tick();
    return () => {
      clearTimeout(raf);
      from.current = value;
    };
  }, [value]);
  return (
    <Animated.Text style={[style, { transform: [{ scale: bump.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }] }]}>
      {prefix}
      {short ? shortNumber(shown) : shown.toLocaleString()}
    </Animated.Text>
  );
}

/** Fades and slides its children in whenever `id` changes (used for switching tabs). */
export function FadeSwitch({ id, children }: { id: string; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [id]);
  return <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>{children}</Animated.View>;
}
