import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import PetSprite from './PetSprite';
import { Backdrop, skyNow } from './PetScene';
import { RarityBadge } from './ui';
import { SPECIES_BY_ID } from '../game/species';
import { levelFor, stageFor } from '../game/scoring';
import { SKIN_INFO } from '../game/skins';
import { play } from '../lib/sound';
import { space } from '../theme';

interface ZoomPet {
  speciesId: string;
  nickname: string;
  xp: number;
  shiny: boolean;
  skin?: import('../game/types').Skin;
  hat?: string;
  aura?: string;
}

/** A big close-up of a pet in its scene, with its hat and aura. Tap anywhere to close. */
export default function PetZoom({ pet, scene, onClose }: { pet: ZoomPet; scene?: string; onClose: () => void }) {
  const sp = SPECIES_BY_ID[pet.speciesId];
  const { width } = useWindowDimensions();
  const size = Math.min(320, width - 80);
  const pop = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    play('pop');
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  if (!sp) return null;
  return (
    <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={`Close close-up of ${pet.nickname}`}>
      <Animated.View style={[styles.card, { width: size + 40, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }], opacity: pop }]}>
        <View style={[styles.stage, { height: size + 30 }]}>
          <Backdrop element={sp.element} sky={skyNow()} scene={scene} />
          <Animated.View style={{ transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }] }}>
            <PetSprite species={sp} stage={stageFor(pet.xp)} size={size} shiny={pet.shiny} skin={pet.skin} hat={pet.hat} aura={pet.aura} mood="joy" />
          </Animated.View>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{pet.nickname}</Text>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Text style={styles.sub}>Lv {levelFor(pet.xp)} {sp.name}</Text>
            <RarityBadge rarity={sp.rarity} />
            {pet.skin ? <Text style={[styles.sub, { color: SKIN_INFO[pet.skin].color }]}>{SKIN_INFO[pet.skin].emoji} {SKIN_INFO[pet.skin].label}</Text> : null}
            {pet.shiny ? <Text style={[styles.sub, { color: '#C99212' }]}>✦ Shiny</Text> : null}
          </View>
          <Text style={styles.hint}>Tap anywhere to close</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(16,20,36,0.85)', justifyContent: 'center', alignItems: 'center', padding: space.md, zIndex: 120 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 26, overflow: 'hidden' },
  stage: { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10, overflow: 'hidden' },
  info: { padding: space.md, alignItems: 'center', gap: 6 },
  name: { fontSize: 26, fontWeight: '900', color: '#24323A' },
  sub: { fontSize: 14, fontWeight: '800', color: '#5B6B70' },
  hint: { fontSize: 12, fontWeight: '800', color: '#8A979A' },
});
