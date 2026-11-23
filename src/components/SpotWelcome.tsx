import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './ScaledText';
import { Button } from './ui';
import PetSprite from './PetSprite';
import { SPECIES_BY_ID } from '../game/species';
import { colors, font } from '../theme';
import type { SpotInfo } from '../lib/spot';

const FALLBACK = ['p15', 'p82', 'p29', 'p04'];

/** One sprite hopping and swaying, a little after the one before it. */
function Dancer({ speciesId, i, size }: { speciesId: string; i: number; size: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }));
    const start = setTimeout(() => loop.start(), i * 180);
    return () => {
      clearTimeout(start);
      loop.stop();
    };
  }, []);
  const sp = SPECIES_BY_ID[speciesId];
  if (!sp) return null;
  const translateY = t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -10, 0, -6, 0] });
  const rotate = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-6deg', '6deg', '-6deg'] });
  return (
    <Animated.View style={{ transform: [{ translateY }, { rotate }] }}>
      <PetSprite species={sp} stage="adult" size={size} mood="joy" />
    </Animated.View>
  );
}

/**
 * What a player sees after scanning a spot's QR code: the place as a postcard, its members' sprites dancing,
 * and a button to start (new players) or join the place's group (players who already play).
 */
export default function SpotWelcome({ spot, action, onAction, onLater, note }: { spot: SpotInfo; action: string; onAction: () => void; onLater?: () => void; note?: string | null }) {
  const insets = useSafeAreaInsets();
  const sprites = (spot.sprites.length ? spot.sprites : FALLBACK).slice(0, 4);
  return (
    <View style={styles.full}>
      {spot.photo ? <Image source={{ uri: spot.photo }} style={StyleSheet.absoluteFill} blurRadius={24} resizeMode="cover" /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: '#CFE9F2' }]} />}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,40,34,0.18)' }]} />
      <View style={{ alignItems: 'center', paddingTop: insets.top + 24, gap: 16 }}>
        <View style={styles.banner}>
          <Text style={styles.bannerText}>You found a Sproutling Spot!</Text>
        </View>
        <View style={styles.postcard}>
          <View style={styles.tape} />
          {spot.photo ? (
            <Image source={{ uri: spot.photo }} style={styles.photo} resizeMode="cover" accessibilityLabel={`Photo of ${spot.name}`} />
          ) : (
            <View style={[styles.photo, { backgroundColor: '#DDF1E7', alignItems: 'center', justifyContent: 'center' }]}>
              {SPECIES_BY_ID[sprites[0]] ? <PetSprite species={SPECIES_BY_ID[sprites[0]]} stage="adult" size={130} mood="joy" /> : null}
            </View>
          )}
          <Text style={styles.place} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {spot.name}
          </Text>
        </View>
      </View>
      <View style={[styles.card, { paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.dancers}>
          {sprites.map((s, i) => (
            <Dancer key={`${s}${i}`} speciesId={s} i={i} size={i === 1 || i === 2 ? 56 : 46} />
          ))}
        </View>
        <Text style={styles.line}>
          {spot.members > 1 ? `${spot.members} players chat and walk in the ` : 'Be one of the first in the '}
          <Text style={{ fontWeight: '900' }}>{spot.name}</Text> group.
        </Text>
        {note ? <Text style={[font.small, { textAlign: 'center', color: '#C4562F' }]}>{note}</Text> : null}
        <Button primary label={action} onPress={onAction} style={{ alignSelf: 'stretch' }} />
        {onLater ? <Button label="Not now" onPress={onLater} style={{ alignSelf: 'stretch' }} /> : null}
        <Text style={[font.tiny, { textAlign: 'center' }]}>Groups don’t change your guild. You can leave any time.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300, justifyContent: 'space-between', backgroundColor: '#CFE9F2' },
  banner: { backgroundColor: colors.mint, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  bannerText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  postcard: { backgroundColor: '#FFFFFF', padding: 12, paddingBottom: 14, borderRadius: 6, transform: [{ rotate: '-3deg' }], shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6, width: 250 },
  tape: { position: 'absolute', top: -12, alignSelf: 'center', width: 76, height: 24, backgroundColor: 'rgba(255,214,140,0.85)', transform: [{ rotate: '4deg' }], zIndex: 2 },
  photo: { width: 226, height: 190, borderRadius: 3 },
  place: { marginTop: 10, textAlign: 'center', fontSize: 21, fontWeight: '900', color: '#2F4A40' },
  card: { marginHorizontal: 12, backgroundColor: '#FFFCF5', borderRadius: 24, padding: 16, gap: 10, alignItems: 'center', width: undefined, maxWidth: 560, alignSelf: 'stretch' },
  dancers: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4, height: 64 },
  line: { fontSize: 15, fontWeight: '700', color: '#3D4A46', textAlign: 'center' },
});
