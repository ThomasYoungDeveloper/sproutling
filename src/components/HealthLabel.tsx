import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from './ScaledText';
import { useHealthLabel } from '../lib/guildTags';

const TEXT: Record<string, string> = {
  health: 'Apple Health',
  watch: 'Health + Watch',
  oura: 'Health + Oura',
  garmin: 'Health + Garmin',
  fitbit: 'Health + Fitbit',
  wearable: 'Health + Wearable',
};
const DEVICE: Record<string, string> = { watch: 'an Apple Watch', oura: 'an Oura ring', garmin: 'a Garmin', fitbit: 'a Fitbit', wearable: 'a wearable' };

/**
 * Where a player's steps and sleep come from: Apple Health (green), or Health plus the wearable it came from
 * (blue to purple). Typed-in players show nothing. Tap it for a one-line explanation.
 */
export default function HealthLabel({ userId, name }: { userId: string | null | undefined; name?: string }) {
  const label = useHealthLabel(userId);
  const [open, setOpen] = useState(false);
  if (!label || !TEXT[label]) return null;
  const plus = label !== 'health';
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={[styles.chip, plus ? styles.plus : styles.health]} accessibilityRole="button" accessibilityLabel={TEXT[label]} hitSlop={6}>
        <Svg width={12} height={12} viewBox="0 0 24 24">
          <Path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="#FFFFFF" opacity={0.9} />
          <Path d="M8.5 12l2.5 2.5 4.5-5" stroke={plus ? '#5A4FD8' : '#1F9A6E'} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={styles.text}>{TEXT[label]}</Text>
      </Pressable>
      {open ? (
        <Text style={styles.explain}>
          {name ? `${name}’s` : 'Their'} steps and sleep come from Apple Health{plus ? ` and ${DEVICE[label]}` : ''}.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'center' },
  health: { backgroundColor: '#2FB58A' },
  plus: { backgroundColor: '#5A6FE0' },
  text: { fontSize: 11, fontWeight: '900', color: '#FFFFFF' },
  explain: { fontSize: 12, fontWeight: '700', color: '#5A6A66', textAlign: 'center', maxWidth: 260 },
});
