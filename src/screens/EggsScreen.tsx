import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import { Card, SectionHead, Button, ProgressBar, RarityBadge } from '../components/ui';
import EggSprite from '../components/EggSprite';
import { IncubatorArt, IncubatorSheet } from '../components/Incubator';
import { useReveal } from '../components/RevealOverlay';
import { useOverlay } from '../components/Overlay';
import { Wobble } from '../components/fx';
import { colors, font, space } from '../theme';
import { RARITY_INFO, STEPS_PER_KM, stepsToHatch } from '../game/rarity';
import { MAX_INCUBATORS, incubatorPrice } from '../game/incubators';
import * as A from '../game/actions';
import type { Egg } from '../game/types';

const NURSERY_SPOTS = ['#FF8FB1', '#FFD6E5', '#FF8FB1', '#B18CFF'];

export default function EggsScreen() {
  const { state, apply } = useGame();
  const reveal = useReveal();
  const overlay = useOverlay();
  const incubating = state.eggs.filter((e) => e.incubating);
  const waiting = state.eggs.filter((e) => !e.incubating);
  const free = state.incubatorSlots - incubating.length;
  // The big incubator shows the egg you picked, else the one closest to hatching.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const progressOf = (e: Egg) => e.stepsWalked / stepsToHatch(e.rarity);
  const shown = incubating.find((e) => e.id === pickedId) ?? [...incubating].sort((a, b) => progressOf(b) - progressOf(a))[0];

  const hatch = (e: Egg) => {
    const r = A.hatch(state, e.id);
    if (!r) return;
    apply(() => r.state);
    const petId = r.pet.id;
    reveal({ kind: 'egg', rarity: e.rarity, pet: r.pet, isNew: r.isNew, ...(e.bred ? { eggSpots: NURSERY_SPOTS, title: 'Your nursery egg is hatching!' } : {}), onMakeActive: r.state.activePetId === petId ? undefined : () => apply((s) => A.setActivePet(s, petId)) });
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
                  <EggSprite rarity={shown.rarity} size={78} cracked spots={shown.bred ? NURSERY_SPOTS : undefined} />
                </Wobble>
              ) : (
                <EggSprite rarity={shown.rarity} size={78} spots={shown.bred ? NURSERY_SPOTS : undefined} />
              )
            ) : null}
          </IncubatorArt>
          {shown ? (
            <>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <RarityBadge rarity={shown.rarity} />
                {shown.bred ? <Text style={styles.nursery}>💞 Nursery egg</Text> : null}
              </View>
              {A.isReady(shown) ? (
                <>
                  <Text style={styles.heroSub}>It's cracking! Ready to hatch.</Text>
                  <Button primary label="Hatch!" onPress={() => hatch(shown)} style={{ alignSelf: 'stretch', marginHorizontal: space.xl }} />
                </>
              ) : (
                <View style={{ alignSelf: 'stretch', gap: 4, paddingHorizontal: space.md }}>
                  <Text style={styles.heroSub}>
                    {(Math.min(shown.stepsWalked, stepsToHatch(shown.rarity)) / STEPS_PER_KM).toFixed(1)} of {RARITY_INFO[shown.rarity].eggKm} km walked
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
          <Text style={styles.label}>YOUR INCUBATORS</Text>
          <View style={styles.slots}>
            {Array.from({ length: MAX_INCUBATORS }, (_, i) => {
              const egg = incubating[i];
              if (i >= state.incubatorSlots) {
                return (
                  <Pressable key={i} onPress={openShop} style={[styles.slot, styles.slotLocked]} accessibilityRole="button" accessibilityLabel={`Locked incubator. Buy for ${incubatorPrice(i + 1)} coins`}>
                    <Svg width={20} height={20} viewBox="0 0 24 24"><Rect x={5} y={11} width={14} height={10} rx={2} fill="none" stroke={colors.muted} strokeWidth={2.6} /><Path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke={colors.muted} strokeWidth={2.6} strokeLinecap="round" /></Svg>
                    <Text style={styles.slotText}>● {incubatorPrice(i + 1)?.toLocaleString()}</Text>
                  </Pressable>
                );
              }
              if (!egg) {
                return (
                  <View key={i} style={[styles.slot, styles.slotEmpty]} accessibilityLabel="Empty incubator">
                    <Text style={{ fontSize: 22, color: colors.mint, fontWeight: '900' }}>+</Text>
                    <Text style={styles.slotText}>Empty</Text>
                  </View>
                );
              }
              const ready = A.isReady(egg);
              const on = shown?.id === egg.id;
              return (
                <Pressable key={egg.id} onPress={() => setPickedId(egg.id)} style={[styles.slot, on && styles.slotOn, ready && styles.slotReady]} accessibilityRole="button" accessibilityLabel={`${RARITY_INFO[egg.rarity].label} egg${ready ? ', ready' : ''}`} accessibilityState={{ selected: on }}>
                  <EggSprite rarity={egg.rarity} size={34} cracked={ready} spots={egg.bred ? NURSERY_SPOTS : undefined} />
                  <Text style={[styles.slotText, ready && { color: '#9A5B12' }]}>{ready ? 'Ready!' : `${Math.floor(progressOf(egg) * 100)}%`}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={font.tiny}>Every step warms every egg in an incubator.{state.incubatorSlots < MAX_INCUBATORS ? ' Tap a lock to buy another one.' : ''}</Text>
        </View>
      </View>

      <Card>
        <SectionHead title="Your eggs" meta={`${waiting.length} waiting`} />
        {waiting.length === 0 ? <Text style={font.small}>Open chests, go on expeditions and walk to find more eggs.</Text> : null}
        {waiting.map((e) => (
          <View key={e.id} style={styles.eggRow}>
            <EggSprite rarity={e.rarity} size={46} spots={e.bred ? NURSERY_SPOTS : undefined} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[font.body, { fontWeight: '900' }]}>{RARITY_INFO[e.rarity].label} egg{e.bred ? ' 💞' : ''}</Text>
              <Text style={font.tiny}>{RARITY_INFO[e.rarity].eggKm} km to hatch</Text>
            </View>
            {free > 0 ? (
              <Button small primary label="Incubate" onPress={() => apply((s) => A.incubate(s, e.id))} />
            ) : state.incubatorSlots < MAX_INCUBATORS ? (
              <Button small label="Get more room" onPress={openShop} />
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
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  hero: { backgroundColor: '#FFE9C7', padding: space.md, paddingBottom: space.lg, alignItems: 'center', gap: 6 },
  heroHead: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' },
  heroTitle: { fontSize: 20, fontWeight: '900', color: colors.ink },
  usePill: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  useText: { fontSize: 12, fontWeight: '900', color: '#9A5B12' },
  heroSub: { fontSize: 14, fontWeight: '800', color: '#8A5A1E', textAlign: 'center' },
  label: { fontSize: 12, fontWeight: '900', color: colors.muted, letterSpacing: 0.5 },
  slots: { flexDirection: 'row', gap: 8 },
  slot: { flex: 1, height: 76, borderRadius: 16, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: '#FFFFFF' },
  slotOn: { borderColor: '#F28C38', borderWidth: 3, backgroundColor: '#FFF6E6' },
  slotReady: { backgroundColor: '#FFF0C8' },
  slotEmpty: { borderStyle: 'dashed' },
  slotLocked: { backgroundColor: '#F4F7F6' },
  slotText: { fontSize: 11, fontWeight: '900', color: colors.muted },
  nursery: { fontWeight: '900', fontSize: 11, color: '#C2185B' },
  eggRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm },
});
