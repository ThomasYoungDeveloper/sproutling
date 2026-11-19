import React from 'react';
import { Image } from 'react-native';

const CRYSTAL = require('../../assets/items/crystal.png');

/** Training Crystal art (from Neprosto's Treasure Chests pack, same artist as the pets). */
export default function CrystalIcon({ size = 32 }: { size?: number }) {
  return <Image source={CRYSTAL} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />;
}
