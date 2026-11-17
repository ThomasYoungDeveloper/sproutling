import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import type { Species, Stage } from '../game/types';
import { RARITY_INFO } from '../game/rarity';
import { PET_IMAGES } from './petImages';
import { SKIN_IMAGES } from './skinImages';
import type { Skin } from '../game/types';
import { PET_ANCHORS } from './petAnchors';
import { Aura, HatArt, hatPlacement } from './Cosmetics';

interface Props {
  /** Skip the built-in ground shadow (when the parent draws its own). */
  noShadow?: boolean;
  species: Species;
  stage: Stage;
  size?: number;
  shiny?: boolean;
  mood?: 'happy' | 'joy' | 'sleepy';
  silhouette?: boolean;
  /** Cosmetic ids the pet is wearing. */
  hat?: string;
  aura?: string;
  /** Rare color variant. */
  skin?: Skin;
}

/** How big the pet looks at each growth stage (the art itself has a single stage). */
const STAGE_SCALE: Record<Stage, number> = { baby: 0.62, teen: 0.8, adult: 1 };

export default function PetSprite({ species, stage, size = 180, shiny = false, mood = 'happy', silhouette = false, hat, aura, skin, noShadow = false }: Props) {
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
      {!noShadow && <View style={[styles.shadow, { width: img * 0.6, bottom: 0 }]} />}
      <Image
        source={(skin && !silhouette && SKIN_IMAGES[skin]?.[species.id]) || PET_IMAGES[species.id]}
        style={{ width: img, height: img, opacity: silhouette ? 0.9 : 1 }}
        tintColor={silhouette ? '#C9D3D0' : undefined}
        resizeMode="contain"
      />
      {skin && skin !== 'mono' && !silhouette && size >= 56 ? <SkinSparkles skin={skin} size={size} /> : null}
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

/** Twinkles on Silver, Gold and Rainbow skins so they look precious. */
const SPARKLE_SPOTS = [
  [0.22, 0.3],
  [0.78, 0.38],
  [0.62, 0.78],
  [0.3, 0.7],
];
const SPARKLE_COLOR: Record<Skin, string[]> = {
  mono: ['#FFFFFF'],
  silver: ['#FFFFFF', '#DCE8FF'],
  gold: ['#FFF3B0', '#FFFFFF'],
  rainbow: ['#FF8FB1', '#7BD3F7', '#FFE27A', '#B18CFF'],
};
function SkinSparkles({ skin, size }: { skin: Skin; size: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  const s = Math.max(10, size * 0.09);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {SPARKLE_SPOTS.map(([x, y], i) => {
        const off = i / SPARKLE_SPOTS.length;
        const steps = [0, off, Math.min(0.999, off + 0.12), Math.min(1, off + 0.25), 1];
        return (
          <Animated.Text
            key={i}
            style={{
              position: 'absolute',
              left: size * x - s / 2,
              top: size * y - s / 2,
              fontSize: s,
              color: SPARKLE_COLOR[skin][i % SPARKLE_COLOR[skin].length],
              textShadowColor: 'rgba(0,0,0,0.25)',
              textShadowRadius: 2,
              opacity: v.interpolate({ inputRange: steps, outputRange: [0, 0, 1, 0, 0], extrapolate: 'clamp' }),
              transform: [{ scale: v.interpolate({ inputRange: steps, outputRange: [0.3, 0.3, 1.2, 0.3, 0.3], extrapolate: 'clamp' }) }],
            }}
          >
            ✦
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', opacity: 0.22 },
  shadow: { position: 'absolute', height: 10, borderRadius: 999, backgroundColor: 'rgba(36,50,58,0.12)' },
  badge: { position: 'absolute', top: 4, right: 8, color: '#E3A81E', fontWeight: '900' },
  zzz: { position: 'absolute', top: 6, left: 10, color: '#6B7C80', fontWeight: '900' },
});
