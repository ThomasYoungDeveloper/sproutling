import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useGame } from '../state/GameContext';
import { Card, SectionHead, Button, ProgressBar, RarityBadge } from '../components/ui';
import EggSprite from '../components/EggSprite';
import { useReveal } from '../components/RevealOverlay';
import { colors, font, space } from '../theme';
import { RARITY_INFO, STEPS_PER_KM, stepsToHatch } from '../game/rarity';
import * as A from '../game/actions';

export default function EggsScreen() {
  const { state, apply } = useGame();
  const reveal = useReveal();
  const incubating = state.eggs.filter((e) => e.incubating);
  const waiting = state.eggs.filter((e) => !e.incubating);
  const free = state.incubatorSlots - incubating.length;

  return (
    <View style={{ gap: space.md }}>

      <Card>
        <SectionHead title="Incubators" meta={`${incubating.length} of ${state.incubatorSlots} in use`} />
        <Text style={font.small}>Eggs hatch as you walk. Every step you take warms every egg in an incubator.</Text>
        {incubating.length === 0 ? <Text style={font.body}>No eggs warming. Put one in below.</Text> : null}
        {incubating.map((e) => {
          const need = stepsToHatch(e.rarity);
          const ready = A.isReady(e);
          return (
            <View key={e.id} style={styles.eggRow}>
              <EggSprite rarity={e.rarity} size={70} cracked={ready} spots={e.bred ? ['#FF8FB1', '#FFD6E5', '#FF8FB1', '#B18CFF'] : undefined} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <RarityBadge rarity={e.rarity} />
                  {e.bred ? <Text style={styles.nursery}>💞 Nursery egg</Text> : null}
                </View>
                <Text style={font.small}>
                  {ready ? 'Ready to hatch!' : `${(Math.min(e.stepsWalked, need) / STEPS_PER_KM).toFixed(1)} of ${RARITY_INFO[e.rarity].eggKm} km walked`}
                </Text>
                <ProgressBar value={e.stepsWalked / need} color={RARITY_INFO[e.rarity].color} />
              </View>
              {ready ? (
                <Button
                  primary
                  label="Hatch"
                  onPress={() => {
                    const r = A.hatch(state, e.id);
                    if (!r) return;
                    apply(() => r.state);
                    const petId = r.pet.id;
                    reveal({ kind: 'egg', rarity: e.rarity, pet: r.pet, isNew: r.isNew, ...(e.bred ? { eggSpots: ['#FF8FB1', '#FFD6E5', '#FF8FB1', '#B18CFF'], title: 'Your nursery egg is hatching!' } : {}), onMakeActive: r.state.activePetId === petId ? undefined : () => apply((s) => A.setActivePet(s, petId)) });
                  }}
                />
              ) : null}
            </View>
          );
        })}
        <Text style={font.tiny}>Premium adds a second incubator. You still walk every step.</Text>
      </Card>

      <Card>
        <SectionHead title="Your eggs" meta={`${waiting.length} waiting`} />
        {waiting.length === 0 ? <Text style={font.small}>Open chests to find more eggs.</Text> : null}
        <View style={styles.grid}>
          {waiting.map((e) => (
            <View key={e.id} style={styles.eggCard}>
              <EggSprite rarity={e.rarity} size={64} spots={e.bred ? ['#FF8FB1', '#FFD6E5', '#FF8FB1', '#B18CFF'] : undefined} />
              <RarityBadge rarity={e.rarity} />
              {e.bred ? <Text style={styles.nursery}>💞 Nursery</Text> : null}
              <Text style={font.tiny}>{RARITY_INFO[e.rarity].eggKm} km to hatch</Text>
              <Button small label="Incubate" primary={free > 0} disabled={free <= 0} onPress={() => apply((s) => A.incubate(s, e.id))} />
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  nursery: { fontWeight: '900', fontSize: 11, color: '#C2185B' },
  eggRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  eggCard: { width: '31%', minWidth: 100, flexGrow: 1, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: space.sm, backgroundColor: '#FAFCFB' },
});
