import { AdCard } from '../components/Ads';
import * as U from '../game/unlocks';
import { LockedCard } from '../components/Unlocks';
import { Glow } from '../components/Spotlight';
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
import PetZoom from '../components/PetZoom';
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
const DYE_SKINS: Skin[] = ['pastel', 'retro', 'sakura', 'ocean', 'ember', 'moonlit', 'crystal', 'shadow', 'galaxy', 'ancient', 'slime', 'harvest'];
const FILTERS: DexFilter[] = ['all', 'mono', 'silver', 'gold', 'rainbow', ...DYE_SKINS, 'shiny'];
const FILTER_LABEL = { all: 'All', mono: 'Ink', silver: 'Silver', gold: 'Gold', rainbow: 'Rainbow', shiny: 'Shiny', ...Object.fromEntries(DYE_SKINS.map((k) => [k, SKIN_INFO[k].label])) } as Record<DexFilter, string>;
const FILTER_DOT = { all: '#FFFFFF', mono: SKIN_INFO.mono.color, silver: SKIN_INFO.silver.color, gold: SKIN_INFO.gold.color, rainbow: SKIN_INFO.rainbow.color, shiny: '#F2C230', ...Object.fromEntries(DYE_SKINS.map((k) => [k, SKIN_INFO[k].color])) } as Record<DexFilter, string>;
/** Darker tag colors so white text stays readable. */
const FILTER_TAG = { all: colors.mintDark, mono: '#3B3B4F', silver: '#5F7385', gold: '#9A6F00', rainbow: '#8A3DB8', shiny: '#9A6F00', ...Object.fromEntries(DYE_SKINS.map((k) => [k, SKIN_INFO[k].color])) } as Record<DexFilter, string>;
const FILTER_HINT = {
  ...Object.fromEntries(DYE_SKINS.map((k) => [k, k === 'harvest' ? 'Only from the Harvest Festival: the Festival Dye and Harvest Eggs.' : `From a ${SKIN_INFO[k].label} Dye (shop, Lucky Wheel) or, rarely, a lucky hatch.`])),
  all: '',
  mono: 'Ink hatches from about 1 in 20 eggs.',
  silver: 'Silver hatches from about 1 in 33 eggs. Nursery eggs make it more likely.',
  gold: 'Gold hatches from about 1 in 67 eggs. Breed two skinned pets for better odds.',
  rainbow: 'The rarest style: about 1 in 200 eggs.',
  shiny: 'Shiny pets sparkle. Keep hatching!',
} as Record<DexFilter, string>;

const ELEMENT_TINT: Record<string, string> = { flower: '#DDF2D2', moon: '#E8E1FA', ember: '#FFE4CC', tide: '#D6EDF8', stone: '#EFE4D6', spark: '#FFF2C2', frost: '#DDF5F8', wind: '#DDF4E8', toxic: '#F1DDF5' };
const RARITY_TINT: Record<string, string> = { common: '#E8F6FF', uncommon: '#E2F6E6', rare: '#F1E8FF', epic: '#FFE8F2', legendary: '#FFF2D6' };

export default function DexScreen() {
  const { state, apply } = useGame();
  const found = Object.keys(state.dex).length;
  const overlay = useOverlay();
  const [filter, setFilter] = useState<DexFilter>('all');
  const [allStyles, setAllStyles] = useState(false);
  const [section, setSection] = useState<'team' | 'dex' | 'nursery'>('team');
  const shinyIds = [...new Set(state.pets.filter((p) => p.shiny).map((p) => p.speciesId))];
  const filtered = filter === 'all' ? [] : filter === 'shiny' ? SPECIES.filter((sp) => shinyIds.includes(sp.id)) : SPECIES.filter((sp) => state.skinDex?.[skinKey(sp.id, filter)]);

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {(['team', 'dex', 'nursery'] as const).map((t) => (
          <Pressable key={t} onPress={() => setSection(t)} style={[styles.tab, section === t && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: section === t }}>
            <Text style={[styles.tabText, section === t && { color: colors.ink }]}>{t === 'team' ? 'Team' : t === 'dex' ? 'Pet-dex' : 'Nursery'}</Text>
          </Pressable>
        ))}
      </View>
      {section === 'nursery' ? (U.unlocked(state, 'breeding') ? <Glow id="breeding"><NurseryCard /></Glow> : <LockedCard feature="breeding" compact />) : null}
      {section === 'team' ? <BadgeBanner /> : null}
      {section === 'team' ? (
      <Card>
        <SectionHead title="Your team" meta={`${state.pets.length} pets`} />
        <View style={styles.grid}>
          {state.pets.map((p) => {
            const sp = SPECIES_BY_ID[p.speciesId];
            const active = p.id === state.activePetId;
            return (
              <Pressable key={p.id} onPress={() => overlay.open(<PetSheet petId={p.id} onClose={overlay.close} />)} style={[styles.tile, { backgroundColor: ELEMENT_TINT[sp.element], borderColor: 'transparent' }, active && styles.active]} accessibilityLabel={`Open ${p.nickname}`}>
                <PetSprite species={sp} stage={stageFor(p.xp)} size={86} shiny={p.shiny} skin={p.skin} hat={p.look?.hat} aura={p.look?.aura} />
                <View style={styles.lv}><Text style={styles.lvText}>Lv {levelFor(p.xp)}</Text></View>
                {p.skin ? <Text style={[styles.skinBadge, { color: SKIN_INFO[p.skin].color }]}>{SKIN_INFO[p.skin].label}</Text> : null}
                {pointsLeft(p) > 0 ? <View style={styles.pts}><Text style={styles.ptsText}>+{pointsLeft(p)}</Text></View> : null}
                <Text style={styles.name} numberOfLines={1}>{p.nickname}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, alignItems: 'center' }}>
                  <GradeChip grade={gradeOf(p)} />
                  {active ? <Chip label="Active" /> : <RarityBadge rarity={sp.rarity} />}
                </View>
              </Pressable>
            );
          })}
        </View>
 </Card>
      ) : null}

      {section === 'dex' ? (
      <Card>
        <SectionHead title="Pet-dex" meta={filter === 'all' ? `${found} of ${SPECIES.length} found` : `${filtered.length} of ${SPECIES.length} ${FILTER_LABEL[filter]}`} />
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Show style">
          {(() => {
            const countOf = (f: DexFilter) => (f === 'all' ? found : f === 'shiny' ? shinyIds.length : SPECIES.filter((sp) => state.skinDex?.[skinKey(sp.id, f)]).length);
            // Only styles you've found show as chips; the rest stay a surprise behind "See all styles".
            const shown = FILTERS.filter((f) => f === 'all' || f === filter || countOf(f) > 0 || allStyles);
            const hidden = FILTERS.length - shown.length;
            return [
              ...shown.map((f) => {
            const on = filter === f;
            const n = countOf(f);
            return (
              <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${FILTER_LABEL[f]}, ${n}`}>
                <View style={[styles.chipDot, { backgroundColor: FILTER_DOT[f] }, f === 'all' && { borderWidth: 1.5, borderColor: on ? '#fff' : colors.muted }]} />
                <Text style={[styles.chipText, on && { color: '#fff' }]}>{FILTER_LABEL[f]} <Text style={{ opacity: 0.7 }}>{n}</Text></Text>
              </Pressable>
            );
              }),
              hidden > 0 || allStyles ? (
                <Pressable key="more" onPress={() => setAllStyles((v) => !v)} style={[styles.chip, { borderStyle: 'dashed' }]} accessibilityRole="button" accessibilityLabel={allStyles ? 'Hide styles you have not found' : `See all styles, ${hidden} not found yet`}>
                  <Text style={[styles.chipText, { color: colors.muted }]}>{allStyles ? 'Show fewer' : `+${hidden} styles to find`}</Text>
                </Pressable>
              ) : null,
            ];
          })()}
        </View>
        {filter === 'all' ? (
          <>
            <ProgressBar value={found / SPECIES.length} color={colors.mint} />
            {skinDexCount(state) > 0 ? <Text style={[font.tiny, { fontWeight: '900' }]}>Skins collected: {skinDexCount(state)}</Text> : null}
            {RARITIES.map((r) => (
              <View key={r} style={{ gap: 6 }}>
                <Text style={[styles.tier, { color: RARITY_INFO[r].color }]}>{RARITY_INFO[r].label}</Text>
                <View style={styles.dexGrid}>
                  {SPECIES.filter((s) => s.rarity === r).map((s) => {
                    const seen = !!state.dex[s.id];
                    return (
                      <Pressable key={s.id} disabled={!seen} onPress={() => overlay.open(<PetZoom dex pet={{ speciesId: s.id, nickname: s.name, xp: 99999, shiny: false }} onClose={overlay.close} />)} style={({ pressed }) => [styles.dexTile, { backgroundColor: seen ? RARITY_TINT[s.rarity] : '#E6ECEA' }, pressed && { transform: [{ scale: 0.96 }] }]} accessibilityRole={seen ? 'button' : undefined} accessibilityLabel={seen ? `See ${s.name} up close` : 'Not found yet'}>
                        <PetSprite species={s} stage="adult" size={54} silhouette={!seen} />
                        {seen ? <Text style={styles.dexName} numberOfLines={1}>{s.name}</Text> : null}
                        {(() => {
                          // One colored dot per skin you've collected for this pet (none until you have one).
                          const got = SKINS.filter((k) => state.skinDex?.[skinKey(s.id, k)]);
                          if (!seen || !got.length) return null;
                          return (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, maxWidth: 90 }} accessibilityLabel={`${got.length} skin${got.length === 1 ? '' : 's'} collected`}>
                              {got.map((k) => <View key={k} style={[styles.skinDot, { backgroundColor: SKIN_INFO[k].color }]} />)}
                            </View>
                          );
                        })()}
                      </Pressable>
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
                  <Pressable key={s.id} onPress={() => overlay.open(<PetZoom dex pet={{ speciesId: s.id, nickname: s.name, xp: 99999, shiny: filter === 'shiny', skin: filter === 'shiny' ? undefined : filter }} onClose={overlay.close} />)} style={({ pressed }) => [styles.tile, { borderColor: 'transparent', backgroundColor: RARITY_TINT[s.rarity] }, pressed && { transform: [{ scale: 0.96 }] }]} accessibilityRole="button" accessibilityLabel={`See ${s.name} up close`}>
                    <PetSprite species={s} stage="adult" size={76} skin={filter === 'shiny' ? undefined : filter} shiny={filter === 'shiny'} />
                    <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                    <View style={[styles.styleTag, { backgroundColor: FILTER_TAG[filter] }]}><Text style={styles.styleTagText}>{FILTER_LABEL[filter]}</Text></View>
                  </Pressable>
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
      ) : null}
      <AdCard />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tabs: { flexDirection: 'row', backgroundColor: '#E2F0EA', borderRadius: 14, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 11 },
  tabOn: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 15, fontWeight: '900', color: '#6F8A82' },
  dexGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dexTile: { width: '23%', flexGrow: 0, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 8, borderRadius: 14, minHeight: 76 },
  dexName: { fontWeight: '800', fontSize: 12, color: colors.ink },
  tile: { width: '30%', minWidth: 96, flexGrow: 1, maxWidth: 140, alignItems: 'center', gap: 4, padding: space.sm, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FAFCFB' },
  active: { borderColor: colors.mint, backgroundColor: colors.mintSoft },
  name: { fontWeight: '800', fontSize: 13, color: colors.ink },
  lv: { position: 'absolute', top: 6, left: 6, backgroundColor: colors.ink, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  pts: { position: 'absolute', bottom: 58, right: 8, backgroundColor: colors.gold, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  ptsText: { fontWeight: '900', fontSize: 12, color: '#5A3E00' },
  skinBadge: { position: 'absolute', top: 4, right: 6, fontSize: 9, fontWeight: '900', backgroundColor: '#FFFFFFDD', borderRadius: 6, paddingHorizontal: 4, overflow: 'hidden' },
  lvText: { color: '#fff', fontWeight: '900', fontSize: 12 },
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
  styleTagText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  empty: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.line, borderRadius: 16, padding: space.lg, alignItems: 'center', gap: 4 },
  tier: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.sm },
});
