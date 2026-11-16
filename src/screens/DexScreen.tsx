import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../state/GameContext';
import { Card, SectionHead, RarityBadge, Chip } from '../components/ui';
import PetSprite from '../components/PetSprite';
import { colors, font, space } from '../theme';
import { SPECIES, SPECIES_BY_ID } from '../game/species';
import { RARITIES, RARITY_INFO } from '../game/rarity';
import { levelFor, stageFor } from '../game/scoring';
import * as Ach from '../game/achievements';
import { SKINS, SKIN_INFO, skinDexCount, skinKey } from '../game/skins';
import { useOverlay } from '../components/Overlay';
import AchievementsSheet from '../components/AchievementsSheet';
import NurseryCard from '../components/NurseryCard';
import * as A from '../game/actions';

function BadgeBanner() {
  const { state } = useGame();
  const overlay = useOverlay();
  const ready = Ach.claimable(state).length;
  const earned = Ach.badgeCount(state);
  return (
    <Pressable onPress={() => overlay.open(<AchievementsSheet onClose={overlay.close} />)} style={({ pressed }) => [badgeStyles.banner, ready > 0 && badgeStyles.ready, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button" accessibilityLabel="Badges">
      <Text style={{ fontSize: 28 }}>🏅</Text>
      <View style={{ flex: 1 }}>
        <Text style={badgeStyles.title}>Badges</Text>
        <Text style={badgeStyles.sub}>{earned} of {Ach.ACHIEVEMENTS.length} earned</Text>
      </View>
      {ready > 0 ? (
        <View style={badgeStyles.pill}><Text style={badgeStyles.pillText}>{ready} to claim!</Text></View>
      ) : (
        <Text style={badgeStyles.go}>See all ›</Text>
      )}
    </Pressable>
  );
}

const badgeStyles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: colors.line, paddingVertical: space.sm, paddingHorizontal: space.md },
  ready: { backgroundColor: '#FFF6DD', borderColor: colors.gold },
  title: { fontWeight: '900', fontSize: 16, color: colors.ink },
  sub: { fontWeight: '700', fontSize: 12, color: colors.muted },
  pill: { backgroundColor: colors.gold, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontWeight: '900', fontSize: 12, color: '#5A3E00' },
  go: { fontWeight: '900', fontSize: 13, color: colors.mintDark },
});

export default function DexScreen() {
  const { state, apply } = useGame();
  const found = Object.keys(state.dex).length;

  return (
    <View style={{ gap: space.md }}>
      <BadgeBanner />
      <NurseryCard />
      <Card>
        <SectionHead title="Your team" meta={`${state.pets.length} pets`} />
        <View style={styles.grid}>
          {state.pets.map((p) => {
            const sp = SPECIES_BY_ID[p.speciesId];
            const active = p.id === state.activePetId;
            return (
              <Pressable key={p.id} onPress={() => apply((s) => A.setActivePet(s, p.id))} style={[styles.tile, active && styles.active]} accessibilityLabel={`Make ${p.nickname} active`}>
                <PetSprite species={sp} stage={stageFor(p.xp)} size={86} shiny={p.shiny} skin={p.skin} hat={p.look?.hat} />
                <View style={styles.lv}><Text style={styles.lvText}>Lv {levelFor(p.xp)}</Text></View>
                {p.skin ? <Text style={[styles.skinBadge, { color: SKIN_INFO[p.skin].color }]}>{SKIN_INFO[p.skin].emoji}</Text> : null}
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
        <View style={styles.skinRow}>
          {SKINS.map((k) => (
            <View key={k} style={styles.skinLegend}>
              <View style={[styles.skinDot, { backgroundColor: SKIN_INFO[k].color }]} />
              <Text style={font.tiny}>{SKIN_INFO[k].label}</Text>
            </View>
          ))}
          <Text style={[font.tiny, { fontWeight: '900' }]}>Skins: {skinDexCount(state)} / {SPECIES.length * SKINS.length}</Text>
        </View>
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
                    {seen ? (
                      <View style={{ flexDirection: 'row', gap: 4 }} accessibilityLabel={`${SKINS.filter((k) => state.skinDex?.[skinKey(s.id, k)]).length} of 4 skins`}>
                        {SKINS.map((k) => (
                          <View key={k} style={[styles.skinDot, state.skinDex?.[skinKey(s.id, k)] ? { backgroundColor: SKIN_INFO[k].color } : styles.skinEmpty]} />
                        ))}
                      </View>
                    ) : null}
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
  skinBadge: { position: 'absolute', top: 4, right: 8, fontSize: 16 },
  lvText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  skinRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  skinLegend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  skinDot: { width: 9, height: 9, borderRadius: 5 },
  skinEmpty: { borderWidth: 1.5, borderColor: '#C9D3D0' },
  tier: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.sm },
});
