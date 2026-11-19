import React from 'react';
import { Image } from 'react-native';
import type { PotionKind } from '../game/hp';

export const POTION_COLOR: Record<PotionKind, string> = { small: '#3FB422', full: '#D8283A' };

const POTION_IMAGES: Record<PotionKind, number> = {
  small: require('../../assets/potions/small.png'),
  full: require('../../assets/potions/full.png'),
};

/** Potion bottle art from the Mad Scientist Laboratory pack: green for Small, red for Full. */
export default function PotionIcon({ kind, size = 40 }: { kind: PotionKind; size?: number }) {
  return <Image source={POTION_IMAGES[kind]} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />;
}
