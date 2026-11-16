import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../state/GameContext';
import { Card, SectionHead, RarityBadge, Chip, GradeChip, ProgressBar } from '../components/ui';
import PetSprite from '../components/PetSprite';
import { colors, font, space } from '../theme';
import { SPECIES, SPECIES_BY_ID } from '../game/species';
import { RARITIES, RARITY_INFO } from '../game/rarity';
import { levelFor, stageFor } from '../game/scoring';
import { gradeOf } from '../game/stats';
import * as Ach from '../game/achievements';
import { SKINS, SKIN_INFO, skinDexCount, skinKey } from '../game/skins';
import { useOverlay } from '../components/Overlay';
import AchievementsSheet from '../components/AchievementsSheet';
import NurseryCard from '../components/NurseryCard';
import PetSheet from '../components/PetSheet';
import { pointsLeft } from '../game/stats';
import * as A from '../game/actions';
import type { Skin } from '../game/types';

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

type DexFilter = 'all' | Skin | 'shiny';
const FILTERS: DexFilter[] = ['all', 'mono', 'silver', 'gold', 'rainbow', 'shiny'];
const FILTER_LABEL: Record<DexFilter, string> = { all: 'All', mono: 'Black & White', silver: 'Silver', gold: 'Gold', rainbow: 'Rainbow', shiny: 'Shiny' };
const FILTER_DOT: Record<DexFilter, string> = { all: '#FFFFFF', mono: SKIN_INFO.mono.color, silver: SKIN_INFO.silver.color, gold: SKIN_INFO.gold.color, rainbow: SKIN_INFO.rainbow.color, shiny: '#F2C230' };
/** Darker tag colors so white text stays readable. */
const FILTER_TAG: Record<DexFilter, string> = { all: colors.mintDark, mono: '#3B3B4F', silver: '#5F7385', gold: '#9A6F00', rainbow: '#8A3DB8', shiny: '#9A6F00' };
const FILTER_HINT: Record<DexFilter, string> = {
  all: '',
  mono: 'Black & White hatches from about 1 in 20 eggs.',
  silver: 'Silver hatches from about 1 in 33 eggs. Nursery eggs make it more likely.',
  gold: 'Gold hatches from about 1 in 67 eggs. Breed two skinned pets for better odds.',
  rainbow: 'The rarest style: about 1 in 200 eggs.',
  shiny: 'Shiny pets sparkle. Keep hatching!',
};

export default function DexScreen() {
  const { state, apply } = useGame();
  const found = Object.keys(state.dex).length;
  const overlay = useOverlay();
  const [filter, setFilter] = useState<DexFilter>('all');
  const shinyIds = [...new Set(state.pets.filter((p) => p.shiny).map((p) => p.speciesId))];
  const filtered = filter === 'all' ? [] : filter === 'shiny' ? SPECIES.filter((sp) => shinyIds.includes(sp.id)) : SPECIES.filter((sp) => state.skinDex?.[skinKey(sp.id, filter)]);

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
              <Pressable key={p.id} onPress={() => overlay.open(<PetSheet petId={p.id} onClose={overlay.close} />)} style={[styles.tile, active && styles.active]} accessibilityLabel={`Open ${p.nickname}`}>
                <PetSprite species={sp} stage={stageFor(p.xp)} size={86} shiny={p.shiny} skin={p.skin} hat={p.look?.hat} />
                <View style={styles.lv}><Text style={styles.lvText}>Lv {levelFor(p.xp)}</Text></View>
                {p.skin ? <Text style={[styles.skinBadge, { color: SKIN_INFO[p.skin].color }]}>{SKIN_INFO[p.skin].emoji}</Text> : null}
                {pointsLeft(p) > 0 ? <View style={styles.pts}><Text style={styles.ptsText}>+{pointsLeft(p)}</Text></View> : null}
                <Text style={styles.name} numberOfLines={1}>{p.nickname}</Text>
                <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                  <GradeChip grade={gradeOf(p)} />
                  {active ? <Chip label="Active" /> : <RarityBadge rarity={sp.rarity} />}
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text style={font.tiny}>Tap a pet to train it, pick its battle moves or make it your active pet. Your active pet earns today’s XP.</Text>
      </Card>

      <Card>
        <SectionHead title="Pet-dex" meta={filter === 'all' ? `${found} of ${SPECIES.length} found` : `${filtered.length} of ${SPECIES.length} ${FILTER_LABEL[filter]}`} />
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Show style">
          {FILTERS.map((f) => {
            const on = filter === f;
            const n = f === 'all' ? found : f === 'shiny' ? shinyIds.length : SPECIES.filter((sp) => state.skinDex?.[skinKey(sp.id, f)]).length;
            return (
              <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${FILTER_LABEL[f]}, ${n}`}>
                <View style={[styles.chipDot, { backgroundColor: FILTER_DOT[f] }, f === 'all' && { borderWidth: 1.5, borderColor: on ? '#fff' : colors.muted }]} />
                <Text style={[styles.chipText, on && { color: '#fff' }]}>{FILTER_LABEL[f]} <Text style={{ opacity: 0.7 }}>{n}</Text></Text>
              </Pressable>
            );
          })}
        </View>
        {filter === 'all' ? (
          <>
            <Text style={[font.tiny, { fontWeight: '900' }]}>Skins collected: {skinDexCount(state)} / {SPECIES.length * SKINS.length}</Text>
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
          </>
        ) : (
          <>
            <View style={{ gap: 4 }}>
              <ProgressBar value={filtered.length / SPECIES.length} color={FILTER_DOT[filter]} />
              <Text style={font.tiny}>{filtered.length} of {SPECIES.length} {FILTER_LABEL[filter]} collected</Text>
            </View>
            {filtered.length ? (
              <View style={styles.grid}>
                {filtered.map((s) => (
                  <View key={s.id} style={styles.tile}>
                    <PetSprite species={s} stage="adult" size={76} skin={filter === 'shiny' ? undefined : filter} shiny={filter === 'shiny'} />
                    <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                    <View style={[styles.styleTag, { backgroundColor: FILTER_TAG[filter] }]}><Text style={styles.styleTagText}>{FILTER_LABEL[filter]}</Text></View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={[font.body, { fontWeight: '900' }]}>No {FILTER_LABEL[filter]} pets yet</Text>
                <Text style={[font.small, { textAlign: 'center' }]}>{FILTER_HINT[filter]}</Text>
              </View>
            )}
          </>
        )}
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
  pts: { position: 'absolute', bottom: 58, right: 8, backgroundColor: colors.gold, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  ptsText: { fontWeight: '900', fontSize: 11, color: '#5A3E00' },
  skinBadge: { position: 'absolute', top: 4, right: 8, fontSize: 16 },
  lvText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  skinRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  skinLegend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  skinDot: { width: 9, height: 9, borderRadius: 5 },
  skinEmpty: { borderWidth: 1.5, borderColor: '#C9D3D0' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 2, borderColor: colors.line, backgroundColor: '#FFFFFF' },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipDot: { width: 12, height: 12, borderRadius: 6 },
  chipText: { fontSize: 13, fontWeight: '900', color: colors.ink },
  styleTag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  styleTagText: { color: '#fff', fontWeight: '900', fontSize: 10 },
  empty: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.line, borderRadius: 16, padding: space.lg, alignItems: 'center', gap: 4 },
  tier: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.sm },
});
