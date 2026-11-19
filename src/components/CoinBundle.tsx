import React from 'react';
import { Image } from 'react-native';

const COINS = require('../../assets/items/coins.png');

/** Two stacks of coins for big coin rewards (from Neprosto's Treasure Chests pack). */
export default function CoinBundle({ size = 48 }: { size?: number }) {
  return <Image source={COINS} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />;
}
