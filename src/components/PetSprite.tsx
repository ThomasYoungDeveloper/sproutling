import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Species, Stage } from '../game/types';
import { RARITY_INFO } from '../game/rarity';
import { PET_IMAGES } from './petImages';
import { PET_ANCHORS } from './petAnchors';
import { Aura, HatArt, hatPlacement } from './Cosmetics';

interface Props {
  species: Species;
  stage: Stage;
  size?: number;
  shiny?: boolean;
  mood?: 'happy' | 'joy' | 'sleepy';
  silhouette?: boolean;
  /** Cosmetic ids the pet is wearing. */
  hat?: string;
  aura?: string;
}

/** How big the pet looks at each growth stage (the art itself has a single stage). */
const STAGE_SCALE: Record<Stage, number> = { baby: 0.62, teen: 0.8, adult: 1 };

export default function PetSprite({ species, stage, size = 180, shiny = false, mood = 'happy', silhouette = false, hat, aura }: Props) {
  const scale = STAGE_SCALE[stage];
  // Leave headroom so a hat fits inside the pet's box.
  const img = size * scale * (hat && !silhouette ? (stage === 'adult' ? 0.8 : 0.9) : 1);
  const rarity = RARITY_INFO[species.rarity];
  const glow = !silhouette && stage === 'adult' && (species.rarity === 'epic' || species.rarity === 'legendary');

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }} accessibilityLabel={silhouette ? 'Unknown pet' : `${species.name}, ${stage}`}>
      {glow && (
        <View
          style={[
            styles.glow,
            { width: img * 0.95, height: img * 0.95, borderRadius: img, backgroundColor: rarity.color, bottom: size * 0.04 },
          ]}
        />
      )}
      {shiny && !silhouette && (
        <View style={[styles.glow, { width: img, height: img, borderRadius: img, backgroundColor: '#FFE27A', opacity: 0.35, bottom: size * 0.02 }]} />
      )}
      <View style={[styles.shadow, { width: img * 0.6, bottom: 0 }]} />
      <Image
        source={PET_IMAGES[species.id]}
        style={{ width: img, height: img, opacity: silhouette ? 0.9 : 1 }}
        tintColor={silhouette ? '#C9D3D0' : undefined}
        resizeMode="contain"
      />
      {aura && !silhouette ? <Aura id={aura} size={size} /> : null}
      {hat && !silhouette
        ? (() => {
            const pos = hatPlacement(PET_ANCHORS[species.id] ?? [0.5, 0.05, 0.6], img, (size - img) / 2, size - img, hat);
            return (
              <View pointerEvents="none" style={{ position: 'absolute', left: pos.left, top: pos.top }}>
                <HatArt id={hat} width={pos.width} />
              </View>
            );
          })()
        : null}
      {shiny && !silhouette && <Text style={[styles.badge, { fontSize: Math.max(12, size * 0.12) }]}>✦</Text>}
      {mood === 'sleepy' && !silhouette && <Text style={[styles.zzz, { fontSize: Math.max(12, size * 0.1) }]}>z z</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', opacity: 0.22 },
  shadow: { position: 'absolute', height: 10, borderRadius: 999, backgroundColor: 'rgba(36,50,58,0.12)' },
  badge: { position: 'absolute', top: 4, right: 8, color: '#E3A81E', fontWeight: '900' },
  zzz: { position: 'absolute', top: 6, left: 10, color: '#6B7C80', fontWeight: '900' },
});
