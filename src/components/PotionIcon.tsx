import React from 'react';
import { View } from 'react-native';
import type { PotionKind } from '../game/hp';

export const POTION_COLOR: Record<PotionKind, string> = { small: '#E5487A', full: '#8A4FD8' };

/** A little potion bottle drawn with shapes: pink for Small, purple for Full. */
export default function PotionIcon({ kind, size = 40 }: { kind: PotionKind; size?: number }) {
  const c = POTION_COLOR[kind];
  const body = size * 0.78;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={{ width: size * 0.26, height: size * 0.1, borderRadius: 3, backgroundColor: '#B07A4A' }} />
      <View style={{ width: size * 0.2, height: size * 0.14, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 2, borderColor: '#24323A33' }} />
      <View style={{ width: body, height: body * 0.86, borderRadius: body / 2, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 2, borderColor: '#24323A33', overflow: 'hidden', justifyContent: 'flex-end' }}>
        <View style={{ height: kind === 'full' ? '82%' : '55%', backgroundColor: c }}>
          <View style={{ position: 'absolute', left: body * 0.18, top: body * 0.08, width: body * 0.14, height: body * 0.14, borderRadius: body, backgroundColor: 'rgba(255,255,255,0.6)' }} />
        </View>
      </View>
    </View>
  );
}
