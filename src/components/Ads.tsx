import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import { buzz } from './fx';
import { colors } from '../theme';
import * as Ad from '../lib/ads';
import * as B from '../game/adBonus';
import type { GameState } from '../game/types';

/** Starts AdMob once the player's age is known (adults see the iPhone tracking prompt then). */
export function useStartAds() {
  const { state } = useGame();
  const by = state.onboard?.birthYear;
  const ready = !!state.onboard?.done || !!state.onboard?.legacy;
  useEffect(() => {
    if (ready && Ad.adsAvailable()) void Ad.startAds(by);
  }, [ready, by]);
}

/** One small ad at the very bottom of a screen, set apart under "Sponsored". Never mixed into game items. */
export function AdCard() {
  const [ok, setOk] = useState(true);
  const m = Ad.ads();
  if (!m || !ok) return null;
  const { BannerAd, BannerAdSize } = m;
  return (
    <View style={styles.wrap}>
      <View style={styles.rule} />
      <Text style={styles.label}>SPONSORED</Text>
      <View style={styles.banner}>
        <BannerAd unitId={Ad.unit('banner')} size={BannerAdSize.BANNER} requestOptions={Ad.requestOptions()} onAdFailedToLoad={() => setOk(false)} />
      </View>
    </View>
  );
}

function PlayIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Rect x={2} y={4} width={20} height={16} rx={4} fill="none" stroke="#FFFFFF" strokeWidth={2.2} />
      <Path d="M10 9l5 3-5 3z" fill="#FFFFFF" />
    </Svg>
  );
}

/**
 * "Watch a short ad" bonus button. Hidden when ads aren't in this build or today's 3 are used.
 * The reward is applied only after the ad is watched to the end.
 */
export function AdBonusButton({ title, onReward, onDone, style }: { title: string; onReward: (s: GameState) => GameState; onDone?: () => void; style?: object }) {
  const { state, apply } = useGame();
  const [busy, setBusy] = useState(false);
  const [used, setUsed] = useState(false);
  const left = B.adBonusesLeft(state);
  if (!Ad.adsAvailable() || used || (left < 1 && !busy)) return null;
  const go = async () => {
    if (busy) return;
    setBusy(true);
    buzz('light');
    const ok = await Ad.showRewarded();
    setBusy(false);
    if (ok) {
      buzz('success', 'coin');
      apply((s) => B.useAdBonus(s, onReward));
      setUsed(true);
      onDone?.();
    }
  };
  return (
    <Pressable onPress={go} style={({ pressed }) => [styles.bonus, pressed && { transform: [{ scale: 0.98 }] }, style]} accessibilityRole="button" accessibilityLabel={`${title}. Watch a short ad. ${left} left today`}>
      <PlayIcon />
      <View style={{ flex: 1 }}>
        <Text style={styles.bonusTitle}>{busy ? 'Loading ad…' : title}</Text>
        <Text style={styles.bonusSub}>Watch a short ad · {left} left today</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18, gap: 6, alignItems: 'center' },
  rule: { alignSelf: 'stretch', borderTopWidth: 2, borderStyle: 'dashed', borderColor: '#B9D6CA' },
  label: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '900', color: '#8A9A95', letterSpacing: 1 },
  banner: { alignItems: 'center', borderRadius: 12, overflow: 'hidden' },
  bonus: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 56, borderRadius: 16, paddingHorizontal: 14, backgroundColor: '#FF8A4C', alignSelf: 'stretch' },
  bonusTitle: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  bonusSub: { fontSize: 12, fontWeight: '800', color: '#FFF3E0' },
});
