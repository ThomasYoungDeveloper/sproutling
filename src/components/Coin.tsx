import React from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import { Text } from './ScaledText';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { shortNumber } from '../lib/shortNumber';

/** A shiny gold coin (the coin emoji looks silver on iPhone). */
export default function Coin({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Defs>
        <LinearGradient id="coinFace" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFE27A" />
          <Stop offset="0.55" stopColor="#F7C12E" />
          <Stop offset="1" stopColor="#E09A12" />
        </LinearGradient>
      </Defs>
      <Circle cx={12} cy={12} r={11} fill="#C98309" />
      <Circle cx={12} cy={11.4} r={10.2} fill="url(#coinFace)" />
      <Circle cx={12} cy={11.4} r={7.4} fill="none" stroke="#D99312" strokeWidth={1.3} />
      {/* A little leaf, for Sproutling */}
      <Path d="M12 15.6c0-3.4 1.4-6 4.2-7.2-.3 3.6-1.8 5.9-4.2 7.2zM12 15.6c-.1-2.6-1.2-4.4-3.5-5.2.1 2.7 1.4 4.4 3.5 5.2z" fill="#B97508" />
      <Path d="M5.6 8.2a7.4 7.4 0 0 1 4-3.6" fill="none" stroke="#FFF6CF" strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

/** Prices show short from 1,000 up: 1.5K, 4K, 1.2M. */
const short = (c: React.ReactNode) => (typeof c === 'number' ? shortNumber(c) : typeof c === 'string' && /^\d{1,3}(,\d{3})+$|^\d+$/.test(c) ? shortNumber(Number(c.replace(/,/g, ''))) : c);

/** A coin and an amount side by side, e.g. a price tag. */
export function CoinText({ children, style, size = 15 }: { children: React.ReactNode; style?: StyleProp<TextStyle>; size?: number }) {
  return (
    <View style={styles.row}>
      <Coin size={size} />
      <Text style={style}>{short(children)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 4 } });
