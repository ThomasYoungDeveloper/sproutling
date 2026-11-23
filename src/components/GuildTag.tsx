import React from 'react';
import { StyleSheet } from 'react-native';
import { Text } from './ScaledText';
import { useGuildTag, usePlayerLevel } from '../lib/guildTags';
import LevelBadge from './LevelBadge';

/** A quiet grey [Guild Name] after a player's name. Nothing for players without a guild. */
export default function GuildTag({ userId, small }: { userId: string | null | undefined; small?: boolean }) {
  const name = useGuildTag(userId);
  if (!name) return null;
  return (
    <Text style={[styles.tag, small && { fontSize: 11 }]} numberOfLines={1} accessibilityLabel={`Guild: ${name}`}>
      [{name}]
    </Text>
  );
}

const styles = StyleSheet.create({ tag: { fontSize: 12, fontWeight: '800', color: '#6A7A75', flexShrink: 1 } });

/** The small account level badge next to another player's name. */
export function PlayerLevel({ userId, size = 20 }: { userId: string | null | undefined; size?: number }) {
  const lv = usePlayerLevel(userId);
  return lv ? <LevelBadge level={lv} size={size} /> : null;
}
