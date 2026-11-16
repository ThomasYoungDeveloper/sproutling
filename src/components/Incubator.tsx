import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import { Button } from './ui';
import { buzz, PopIn } from './fx';
import { play } from '../lib/sound';
import { colors, font, space } from '../theme';
import { MAX_INCUBATORS, buyIncubator, incubatorPrice, nextIncubatorPrice } from '../game/incubators';

/** The incubator machine: a glass dome on a warm orange base. Whatever is passed as children sits inside the dome. */
export function IncubatorArt({ size = 190, warm = true, children }: { size?: number; warm?: boolean; children?: React.ReactNode }) {
  const k = size / 190;
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!warm) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [warm]);
  return (
    <View style={{ width: size, height: size }}>
      {warm ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }]}>
          <Svg width={size} height={size} viewBox="0 0 190 190">
            <Defs>
              <RadialGradient id="incWarm" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#FFD36B" stopOpacity={0.9} />
                <Stop offset="1" stopColor="#FFD36B" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={95} cy={92} r={80} fill="url(#incWarm)" />
          </Svg>
        </Animated.View>
      ) : null}
      <View style={{ position: 'absolute', left: 50 * k, top: 52 * k, width: 90 * k, height: 82 * k, alignItems: 'center', justifyContent: 'flex-end' }}>{children}</View>
      <Svg width={size} height={size} viewBox="0 0 190 190" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="incDome" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#CFEFFF" stopOpacity={0.25} />
          </LinearGradient>
        </Defs>
        <Path d="M45 132V88a50 50 0 0 1 100 0v44" fill="url(#incDome)" stroke="#5A3A1A" strokeWidth={5} />
        <Path d="M60 90a35 35 0 0 1 22-30" fill="none" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" />
        <Rect x={30} y={130} width={130} height={30} rx={12} fill="#F28C38" stroke="#5A3A1A" strokeWidth={5} />
        <Rect x={40} y={160} width={110} height={14} rx={6} fill="#C8662A" stroke="#5A3A1A" strokeWidth={5} />
        <Circle cx={70} cy={145} r={5} fill={warm ? '#FFE27A' : '#C9B79A'} stroke="#5A3A1A" strokeWidth={3} />
        <Rect x={84} y={140} width={56} height={10} rx={5} fill="#5A3A1A" />
        {warm ? <Rect x={86} y={142} width={44} height={6} rx={3} fill="#FFC94D" /> : null}
      </Svg>
    </View>
  );
}

/** Buying extra incubators (used in the shop and from a locked slot on the Eggs tab). */
export function IncubatorOffer() {
  const { state, apply } = useGame();
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const price = nextIncubatorPrice(state);
  return (
    <View style={styles.offer}>
      <View style={styles.offerTop}>
        <IncubatorArt size={92} warm={false} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.offerTitle}>Extra incubator</Text>
          <Text style={styles.offerBody}>Warm one more egg at a time. Yours to keep forever.</Text>
          <Text style={styles.offerHave}>You have {state.incubatorSlots} of {MAX_INCUBATORS}</Text>
        </View>
      </View>
      {Array.from({ length: MAX_INCUBATORS - 1 }, (_, i) => i + 2).map((slot) => {
        const owned = state.incubatorSlots >= slot;
        const isNext = slot === state.incubatorSlots + 1;
        const p = incubatorPrice(slot)!;
        return (
          <View key={slot} style={[styles.slotRow, owned && styles.slotOwned, isNext && styles.slotNext]}>
            <Text style={[styles.slotName, !isNext && !owned && { color: colors.muted }]}>{['', '', '2nd', '3rd', '4th'][slot]} incubator</Text>
            {owned ? (
              <Text style={[styles.slotNote, { color: colors.mintDark }]}>Owned ✓</Text>
            ) : isNext ? (
              <Button
                primary
                small
                label={`Buy · ● ${p.toLocaleString()}`}
                disabled={state.coins < p}
                onPress={() => {
                  const r = buyIncubator(state);
                  if (!r.ok) {
                    setMsg({ text: r.reason });
                    buzz('light');
                    return;
                  }
                  apply(() => r.state);
                  buzz('success');
                  play('chime');
                  setMsg({ text: 'New incubator ready! Put another egg in to warm it.', ok: true });
                }}
              />
            ) : (
              <Text style={styles.slotNote}>● {p.toLocaleString()} after the {['', '', '2nd', '3rd'][slot - 1]}</Text>
            )}
          </View>
        );
      })}
      {price !== null && state.coins < price ? <Text style={font.tiny}>You have ● {state.coins.toLocaleString()}. Earn coins from habits, quests, chests and battles.</Text> : null}
      {msg ? (
        <PopIn key={msg.text}>
          <Text style={[styles.msg, msg.ok && { color: colors.mintDark }]}>{msg.text}</Text>
        </PopIn>
      ) : null}
    </View>
  );
}

export function IncubatorSheet({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <Text style={font.title}>🥚 Incubators</Text>
        <IncubatorOffer />
        <Button primary label="Done" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  offer: { gap: 8 },
  offerTop: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: '#FFF0D6', borderRadius: 18, padding: space.sm },
  offerTitle: { fontSize: 17, fontWeight: '900', color: colors.ink },
  offerBody: { fontSize: 13, fontWeight: '700', color: '#6B5130' },
  offerHave: { fontSize: 12, fontWeight: '900', color: '#9A5B12' },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 2, borderColor: colors.line, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, minHeight: 52 },
  slotOwned: { backgroundColor: '#F6FAF8' },
  slotNext: { borderColor: '#F28C38', borderWidth: 3 },
  slotName: { flex: 1, fontSize: 15, fontWeight: '900', color: colors.ink },
  slotNote: { fontSize: 13, fontWeight: '900', color: colors.muted },
  msg: { fontSize: 13, fontWeight: '800', color: '#B4532A', textAlign: 'center' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.6)', justifyContent: 'center', alignItems: 'center', padding: space.md, zIndex: 80 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: space.lg, width: '100%', maxWidth: 460, gap: space.md },
});
