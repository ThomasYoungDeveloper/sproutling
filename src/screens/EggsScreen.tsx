import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useGame } from '../state/GameContext';
import { Card, SectionHead, Button, ProgressBar, RarityBadge } from '../components/ui';
import EggSprite from '../components/EggSprite';
import PetSprite from '../components/PetSprite';
import { colors, font, space } from '../theme';
import { RARITY_INFO, STEPS_PER_KM, stepsToHatch } from '../game/rarity';
import { SPECIES_BY_ID } from '../game/species';
import * as A from '../game/actions';
import type { OwnedPet } from '../game/types';

export default function EggsScreen() {
  const { state, apply } = useGame();
  const [hatched, setHatched] = useState<{ pet: OwnedPet; isNew: boolean } | null>(null);
  const incubating = state.eggs.filter((e) => e.incubating);
  const waiting = state.eggs.filter((e) => !e.incubating);
  const free = state.incubatorSlots - incubating.length;

  return (
    <View style={{ gap: space.md }}>
      {hatched ? (
        <Card style={{ alignItems: 'center', backgroundColor: RARITY_INFO[SPECIES_BY_ID[hatched.pet.speciesId].rarity].soft }}>
          <Text style={font.h2}>It hatched!</Text>
          <PetSprite species={SPECIES_BY_ID[hatched.pet.speciesId]} stage="baby" size={170} shiny={hatched.pet.shiny} mood="joy" />
          <Text style={[font.title, { fontSize: 20 }]}>{SPECIES_BY_ID[hatched.pet.speciesId].name}{hatched.pet.shiny ? ' (Shiny!)' : ''}</Text>
          <RarityBadge rarity={SPECIES_BY_ID[hatched.pet.speciesId].rarity} />
          <Text style={font.small}>{hatched.isNew ? 'New to your Pet-dex!' : 'Another one for your team.'}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Make active" primary onPress={() => { apply((s) => A.setActivePet(s, hatched.pet.id)); setHatched(null); }} />
            <Button label="Nice!" onPress={() => setHatched(null)} />
          </View>
        </Card>
      ) : null}

      <Card>
        <SectionHead title="Incubators" meta={`${incubating.length} of ${state.incubatorSlots} in use`} />
        <Text style={font.small}>Eggs hatch as you walk. Every step you take warms every egg in an incubator.</Text>
        {incubating.length === 0 ? <Text style={font.body}>No eggs warming. Put one in below.</Text> : null}
        {incubating.map((e) => {
          const need = stepsToHatch(e.rarity);
          const ready = A.isReady(e);
          return (
            <View key={e.id} style={styles.eggRow}>
              <EggSprite rarity={e.rarity} size={70} cracked={ready} />
              <View style={{ flex: 1, gap: 4 }}>
                <RarityBadge rarity={e.rarity} />
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
                    setHatched({ pet: r.pet, isNew: r.isNew });
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
              <EggSprite rarity={e.rarity} size={64} />
              <RarityBadge rarity={e.rarity} />
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
  eggRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  eggCard: { width: '31%', minWidth: 100, flexGrow: 1, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: space.sm, backgroundColor: '#FAFCFB' },
});
