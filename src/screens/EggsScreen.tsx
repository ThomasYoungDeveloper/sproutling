import { CoinText } from '../components/Coin';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../components/ScaledText';
import Svg, { Path, Rect } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import { Card, SectionHead, Button, ProgressBar, RarityBadge } from '../components/ui';
import EggSprite from '../components/EggSprite';
import { IncubatorArt, IncubatorMini, IncubatorSheet } from '../components/Incubator';
import PremiumSheet from '../components/PremiumSheet';
import { useReveal } from '../components/RevealOverlay';
import { useOverlay } from '../components/Overlay';
import { Wobble } from '../components/fx';
import { colors, font, space } from '../theme';
import { RARITY_INFO, STEPS_PER_KM, stepsToHatch, eggSteps } from '../game/rarity';
import { MAX_INCUBATORS, incubatorPrice } from '../game/incubators';
import * as A from '../game/actions';
import type { Egg } from '../game/types';
import { shortNumber } from '../lib/shortNumber';
import EggChooser from '../components/EggChooser';

/** Harvest Eggs: warm orange with autumn spots, so they stand out in the basket. */
const HARVEST_EGG = '#F6A13A';
const HARVEST_SPOTS = ['#B5462E', '#7A3F1D'];
const NURSERY_SPOTS = ['#FF8FB1', '#FFD6E5', '#FF8FB1', '#B18CFF'];

export default function EggsScreen() {
  const { state, apply } = useGame();
  const reveal = useReveal();
  const overlay = useOverlay();
  const incubating = state.eggs.filter((e) => e.incubating);
  const waiting = A.basketEggs(state);
  const overflow = A.overflowEggs(state);
  const full = waiting.length >= A.EGG_BASKET;
  const free = state.incubatorSlots - incubating.length;
  // The big incubator shows the egg you picked, else the one closest to hatching.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const progressOf = (e: Egg) => e.stepsWalked / eggSteps(e);
  const shown = incubating.find((e) => e.id === pickedId) ?? [...incubating].sort((a, b) => progressOf(b) - progressOf(a))[0];

  const hatch = (e: Egg) => {
    const r = A.hatch(state, e.id);
    if (!r) return;
    apply(() => r.state);
    const petId = r.pet.id;
    reveal({ kind: 'egg', rarity: e.rarity, pet: r.pet, isNew: r.isNew, ...(e.bred ? { eggSpots: NURSERY_SPOTS, title: e.bred.lucky ? 'Your Lucky egg is hatching! ✨' : 'Your nursery egg is hatching!', lucky: e.bred.lucky } : {}), onMakeActive: r.state.activePetId === petId ? undefined : () => apply((s) => A.setActivePet(s, petId)) });
  };

  const openShop = () => overlay.open(<IncubatorSheet onClose={overlay.close} />);

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.card}>
        <View style={styles.hero}>
          <View style={styles.heroHead}>
            <Text style={styles.heroTitle}>Incubators</Text>
            <View style={styles.usePill}><Text style={styles.useText}>{incubating.length} of {state.incubatorSlots} in use</Text></View>
          </View>
          <IncubatorArt size={190} warm={!!shown}>
            {shown ? (
              A.isReady(shown) ? (
                <Wobble>
                  <EggSprite rarity={shown.rarity} size={78} cracked spots={shown.skin === 'harvest' ? HARVEST_SPOTS : shown.bred ? NURSERY_SPOTS : undefined} color={shown.skin === 'harvest' ? HARVEST_EGG : undefined} />
                </Wobble>
              ) : (
                <EggSprite rarity={shown.rarity} size={78} spots={shown.skin === 'harvest' ? HARVEST_SPOTS : shown.bred ? NURSERY_SPOTS : undefined} color={shown.skin === 'harvest' ? HARVEST_EGG : undefined} />
              )
            ) : null}
          </IncubatorArt>
          {shown ? (
            <>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <RarityBadge rarity={shown.rarity} />
                {shown.bred ? <Text style={styles.nursery}>{shown.bred.lucky ? 'Lucky nursery egg' : 'Nursery egg'}</Text> : null}
              </View>
              {A.isReady(shown) ? (
                <>
                  <Text style={styles.heroSub}>It's cracking! Ready to hatch.</Text>
                  <Button primary label="Hatch!" onPress={() => hatch(shown)} style={{ alignSelf: 'stretch', marginHorizontal: space.xl }} />
                </>
              ) : (
                <View style={{ alignSelf: 'stretch', gap: 4, paddingHorizontal: space.md }}>
                  <Text style={styles.heroSub}>
                    {(Math.min(shown.stepsWalked, eggSteps(shown)) / STEPS_PER_KM).toFixed(1)} of {+(eggSteps(shown) / STEPS_PER_KM).toFixed(1)} km walked
                  </Text>
                  <ProgressBar value={progressOf(shown)} color={RARITY_INFO[shown.rarity].color} />
                </View>
              )}
            </>
          ) : (
            <Text style={styles.heroSub}>{waiting.length ? 'Put an egg in below to start warming it.' : 'Open chests and walk to find eggs.'}</Text>
          )}
        </View>
        <View style={{ padding: space.md, gap: 8 }}>
          <Text style={styles.label}>YOUR INCUBATORS · {state.incubatorSlots} OF {MAX_INCUBATORS + 1}</Text>
          <View style={styles.slots}>
            {Array.from({ length: MAX_INCUBATORS + 1 }, (_, i) => {
              if (i === MAX_INCUBATORS) {
                return (
                  <Pressable key="premium" onPress={() => overlay.open(<PremiumSheet onClose={overlay.close} />)} style={[styles.slot, styles.slotPremium]} accessibilityRole="button" accessibilityLabel="Premium incubator: comes with Premium">
                    <Text style={{ fontSize: 18 }}>⭐</Text>
                    <Text style={[styles.slotText, { color: '#6A51C2' }]}>Premium</Text>
                  </Pressable>
                );
              }
              const egg = incubating[i];
              if (i >= state.incubatorSlots) {
                return (
                  <Pressable key={i} onPress={openShop} style={[styles.slot, styles.slotLocked]} accessibilityRole="button" accessibilityLabel={`Locked incubator. Buy for ${incubatorPrice(i + 1)} coins`}>
                    <Svg width={20} height={20} viewBox="0 0 24 24"><Rect x={5} y={11} width={14} height={10} rx={2} fill="none" stroke={colors.muted} strokeWidth={2.6} /><Path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke={colors.muted} strokeWidth={2.6} strokeLinecap="round" /></Svg>
                    <CoinText style={styles.slotText} size={13}>{shortNumber(incubatorPrice(i + 1) ?? 0)}</CoinText>
                  </Pressable>
                );
              }
              if (!egg) {
                return (
                  <View key={i} style={[styles.slot, styles.slotEmpty]} accessibilityLabel="Empty incubator">
                    <IncubatorMini size={40} inUse={false} />
                    <Text style={styles.slotText}>Empty</Text>
                  </View>
                );
              }
              const ready = A.isReady(egg);
              const on = shown?.id === egg.id;
              return (
                <Pressable key={egg.id} onPress={() => setPickedId(egg.id)} style={[styles.slot, on && styles.slotOn, ready && styles.slotReady]} accessibilityRole="button" accessibilityLabel={`${RARITY_INFO[egg.rarity].label} egg${ready ? ', ready' : ''}`} accessibilityState={{ selected: on }}>
                  <IncubatorMini size={40} inUse />
                  <Text style={[styles.slotText, ready && { color: '#9A5B12' }]}>{ready ? 'Ready!' : `${Math.floor(progressOf(egg) * 100)}%`}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {overflow.length ? (
        <Pressable onPress={() => overlay.open(<EggChooser onClose={overlay.close} />)} style={styles.waitCard} accessibilityRole="button" accessibilityLabel={`${overflow.length === 1 ? 'An egg is' : `${overflow.length} eggs are`} waiting. Your basket is full. Open to make room`}>
          <EggSprite rarity={overflow[0].rarity} size={50} />
          <View style={{ flex: 1 }}>
            <Text style={styles.waitTitle}>{overflow.length === 1 ? 'An egg is waiting!' : `${overflow.length} eggs are waiting!`}</Text>
            <Text style={styles.waitSub}>Your basket is full. Pick one egg to leave behind.</Text>
          </View>
          <View style={styles.waitBtn}><Text style={styles.waitBtnText}>Open</Text></View>
        </Pressable>
      ) : null}

      <Card>
        <SectionHead title="Egg basket" meta={`${waiting.length} / ${A.EGG_BASKET}${full ? ' · Full' : ''}`} />
        <View style={styles.meter}><View style={[styles.meterFill, { width: `${Math.min(100, Math.round((waiting.length / A.EGG_BASKET) * 100))}%`, backgroundColor: full ? '#F2A23C' : '#2FB58A' }]} /></View>
        <Text style={font.small}>{waiting.length === 0 ? 'Open chests, go on trips and walk to find eggs.' : `Your basket holds ${A.EGG_BASKET} eggs. Eggs in incubators don’t count.`}</Text>
        {waiting.map((e) => (
          <View key={e.id} style={styles.eggRow}>
            <EggSprite rarity={e.rarity} size={46} spots={e.skin === 'harvest' ? HARVEST_SPOTS : e.bred ? NURSERY_SPOTS : undefined} color={e.skin === 'harvest' ? HARVEST_EGG : undefined} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[font.body, { fontWeight: '900' }]}>{RARITY_INFO[e.rarity].label} egg{e.bred ? (e.bred.lucky ? ' ✨ Lucky' : ' 💞') : ''}</Text>
              <Text style={font.tiny}>{+(eggSteps(e) / STEPS_PER_KM).toFixed(1)} km to hatch{e.bred ? ' (nursery eggs: half the walk)' : ''}</Text>
            </View>
            {free > 0 ? (
              <Button small primary label="Incubate" onPress={() => apply((s) => A.incubate(s, e.id))} />
            ) : state.incubatorSlots < MAX_INCUBATORS ? (
              <Button small label="Get an incubator" onPress={openShop} />
            ) : (
              <Text style={[font.tiny, { fontWeight: '900' }]}>All full</Text>
            )}
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  waitCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F4ECFF', borderWidth: 3, borderColor: '#9C5FD8', borderRadius: 22, padding: 14 },
  waitTitle: { fontSize: 17, fontWeight: '900', color: colors.ink },
  waitSub: { fontSize: 13, fontWeight: '800', color: '#6A5A8A' },
  waitBtn: { backgroundColor: '#9C5FD8', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  waitBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  meter: { height: 10, borderRadius: 5, backgroundColor: '#F0E9DD', overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 5 },
  card: { backgroundColor: colors.card, borderRadius: 22, overflow: 'hidden' },
  hero: { backgroundColor: '#FFE9C7', padding: space.md, paddingBottom: space.lg, alignItems: 'center', gap: 6 },
  heroHead: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' },
  heroTitle: { fontSize: 20, fontWeight: '900', color: colors.ink },
  usePill: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  useText: { fontSize: 12, fontWeight: '900', color: '#9A5B12' },
  heroSub: { fontSize: 14, fontWeight: '800', color: '#8A5A1E', textAlign: 'center' },
  label: { fontSize: 12, fontWeight: '900', color: colors.muted, letterSpacing: 0.5 },
  slots: { flexDirection: 'row', gap: 6 },
  slot: { flex: 1, height: 76, borderRadius: 16, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: '#FFFFFF' },
  slotOn: { borderColor: '#F28C38', borderWidth: 3, backgroundColor: '#FFF6E6' },
  slotReady: { backgroundColor: '#FFF0C8' },
  slotEmpty: { borderStyle: 'dashed' },
  slotLocked: { backgroundColor: '#EEF1F0', opacity: 0.8 },
  slotPremium: { backgroundColor: '#EFE9FC', borderColor: '#CDBEF2' },
  slotText: { fontSize: 12, fontWeight: '900', color: colors.muted },
  nursery: { fontWeight: '900', fontSize: 12, color: '#C2185B' },
  eggRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm },
});
