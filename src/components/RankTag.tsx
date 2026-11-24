import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { useRankTitle } from '../lib/ranks';

/** Gold, silver and bronze for last week's top 3; green for places 4 to 10. Shown next to a player's name. */
const TONE: Record<number, { bg: string; fg: string }> = {
  1: { bg: '#F7C948', fg: '#5A3A00' },
  2: { bg: '#D6DEE6', fg: '#34414E' },
  3: { bg: '#E8A87C', fg: '#5A2A08' },
};

export default function RankTag({ userId, small }: { userId: string | null | undefined; small?: boolean }) {
  const t = useRankTitle(userId);
  if (!t) return null;
  const tone = TONE[t.place] ?? { bg: '#E3F5EC', fg: '#1F7A58' };
  return (
    <View style={[styles.tag, { backgroundColor: tone.bg }, small && styles.small]} accessibilityLabel={`Last week: ${t.label}`}>
      <Text style={[styles.text, { color: tone.fg }, small && { fontSize: 10 }]} numberOfLines={1}>
        {t.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start', flexShrink: 1 },
  small: { paddingHorizontal: 5, paddingVertical: 1 },
  text: { fontSize: 11, fontWeight: '600' },
});
