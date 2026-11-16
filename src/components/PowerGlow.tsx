import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

/**
 * A pulsing glow behind a pet that's powered up by today's real-life habits.
 * More habit buffs = a bigger, brighter glow (and sparkles at 3+).
 */
export default function PowerGlow({ count, size }: { count: number; size: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const spark = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!count) return;
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const b = Animated.loop(Animated.timing(spark, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [count]);
  if (!count) return null;
  const level = Math.min(5, count);
  const color = level >= 4 ? '#FFD84D' : level >= 2 ? '#7CF0C8' : '#9FE3FF';
  const d = size * (1.1 + level * 0.08);
  const id = `glow-${level}`;
  return (
    <View pointerEvents="none" style={[styles.wrap, { width: d, height: d, marginLeft: -d / 2, marginTop: -d / 2 }]}>
      <Animated.View
        style={{
          width: d,
          height: d,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6 + level * 0.06, 0.85 + level * 0.03] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.06] }) }],
        }}
      >
        <Svg width={d} height={d} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id={id} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
              <Stop offset="0.25" stopColor={color} stopOpacity={1} />
              <Stop offset="0.6" stopColor={color} stopOpacity={0.55} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={50} cy={50} r={50} fill={`url(#${id})`} />
        </Svg>
      </Animated.View>
      {level >= 3
        ? [0, 1, 2, 3].map((i) => (
            <Animated.Text
              key={i}
              style={[
                styles.spark,
                {
                  left: d * (0.18 + 0.2 * i),
                  color,
                  fontSize: 12 + (i % 2) * 6,
                  opacity: spark.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 0.9, 0] }),
                  transform: [{ translateY: spark.interpolate({ inputRange: [0, 1], outputRange: [d * (0.8 - (i % 2) * 0.15), d * (0.1 + (i % 2) * 0.12)] }) }],
                },
              ]}
            >
              ✦
            </Animated.Text>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: '50%', top: '50%' },
  spark: { position: 'absolute', top: 0, fontWeight: '900' },
});
