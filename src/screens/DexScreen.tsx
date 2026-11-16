import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../state/GameContext';
import { Card, SectionHead, RarityBadge, Chip } from '../components/ui';
import PetSprite from '../components/PetSprite';
import { colors, font, space } from '../theme';
import { SPECIES, SPECIES_BY_ID } from '../game/species';
import { RARITIES, RARITY_INFO } from '../game/rarity';
import { levelFor, stageFor } from '../game/scoring';
import * as A from '../game/actions';

export default function DexScreen() {
  const { state, apply } = useGame();
  const found = Object.keys(state.dex).length;

  return (
    <View style={{ gap: space.md }}>
      <Card>
        <SectionHead title="Your team" meta={`${state.pets.length} pets`} />
        <View style={styles.grid}>
          {state.pets.map((p) => {
            const sp = SPECIES_BY_ID[p.speciesId];
            const active = p.id === state.activePetId;
            return (
              <Pressable key={p.id} onPress={() => apply((s) => A.setActivePet(s, p.id))} style={[styles.tile, active && styles.active]} accessibilityLabel={`Make ${p.nickname} active`}>
                <PetSprite species={sp} stage={stageFor(p.xp)} size={86} shiny={p.shiny} hat={p.look?.hat} />
                <View style={styles.lv}><Text style={styles.lvText}>Lv {levelFor(p.xp)}</Text></View>
                <Text style={styles.name} numberOfLines={1}>{p.nickname}</Text>
                {active ? <Chip label="Active" /> : <RarityBadge rarity={sp.rarity} />}
              </Pressable>
            );
          })}
        </View>
        <Text style={font.tiny}>Tap a pet to make it your active pet. Your active pet earns today’s XP and levels up.</Text>
      </Card>

      <Card>
        <SectionHead title="Pet-dex" meta={`${found} of ${SPECIES.length} found`} />
        {RARITIES.map((r) => (
          <View key={r} style={{ gap: 6 }}>
            <Text style={[styles.tier, { color: RARITY_INFO[r].color }]}>{RARITY_INFO[r].label}</Text>
            <View style={styles.grid}>
              {SPECIES.filter((s) => s.rarity === r).map((s) => {
                const seen = !!state.dex[s.id];
                return (
                  <View key={s.id} style={styles.tile}>
                    <PetSprite species={s} stage="adult" size={76} silhouette={!seen} />
                    <Text style={styles.name} numberOfLines={1}>{seen ? s.name : '???'}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { width: '30%', minWidth: 96, flexGrow: 1, maxWidth: 140, alignItems: 'center', gap: 4, padding: space.sm, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FAFCFB' },
  active: { borderColor: colors.mint, backgroundColor: colors.mintSoft },
  name: { fontWeight: '800', fontSize: 13, color: colors.ink },
  lv: { position: 'absolute', top: 6, left: 6, backgroundColor: colors.ink, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  lvText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  tier: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.sm },
});
