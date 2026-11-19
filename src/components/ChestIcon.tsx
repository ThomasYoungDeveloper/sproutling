import React from 'react';
import { Image } from 'react-native';
import type { ChestKind } from '../game/types';

/** Chest art from Neprosto's Treasure Chests pack (same artist as the pets): wood, silver and gold. */
const CHEST_IMAGES: Record<ChestKind, number> = {
  bronze: require('../../assets/chests/bronze.png'),
  silver: require('../../assets/chests/silver.png'),
  gold: require('../../assets/chests/gold.png'),
};

export default function ChestIcon({ kind, size = 64 }: { kind: ChestKind; size?: number }) {
  return <Image source={CHEST_IMAGES[kind]} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />;
}
