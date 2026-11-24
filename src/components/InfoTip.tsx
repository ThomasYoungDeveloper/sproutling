import { FitSheet } from './ui';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { colors } from '../theme';
import { buzz } from './fx';

/**
 * Small (i) button and the pop-up it opens. Used instead of explanation paragraphs, so screens stay
 * short and the details are one tap away.
 */
export function InfoDot({ onPress, label, color = colors.muted }: { onPress: () => void; label: string; color?: string }) {
  return (
    <Pressable
      onPress={() => { buzz('light'); onPress(); }}
      hitSlop={10}
      style={[styles.dot, { borderColor: color }]}
      accessibilityRole="button"
      accessibilityLabel={`About ${label}`}
    >
      <Text style={[styles.dotText, { color }]}>i</Text>
    </Pressable>
  );
}

export type Tip = { title: string; text: string };

export function InfoPop({ tip, onClose }: { tip: Tip | null; onClose: () => void }) {
  if (!tip) return null;
  return (
    <View style={styles.backdrop}>
      <FitSheet onClose={onClose} center>
      <View style={styles.card} accessibilityViewIsModal>
        <Text style={styles.title} accessibilityRole="header">{tip.title}</Text>
        <Text style={styles.text}>{tip.text}</Text>
        <Pressable onPress={onClose} style={styles.ok} accessibilityRole="button">
          <Text style={styles.okText}>Got it</Text>
        </Pressable>
      </View>
      </FitSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotText: { fontSize: 11, fontWeight: '600', lineHeight: 13 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24, zIndex: 200 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 20, width: '100%', maxWidth: 380, gap: 10, alignSelf: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  text: { fontSize: 15, fontWeight: '700', color: '#4D5E59', lineHeight: 21 },
  ok: { marginTop: 6, backgroundColor: colors.mint, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  okText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
