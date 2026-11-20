import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../state/GameContext';
import { useFriends } from '../state/FriendsContext';
import PetSprite from './PetSprite';
import { buzz, PopIn } from './fx';
import { colors, font, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { levelFor, stageFor } from '../game/scoring';
import { SKIN_INFO } from '../game/skins';
import * as St from '../game/stats';
import * as Pw from '../game/powerups';
import type { OwnedPet } from '../game/types';
import CrystalIcon from './CrystalIcon';

/** Raise a pet's grade after hatching: spend Training Crystals, or combine a spare copy of the same pet. */
export default function PowerUps({ pet }: { pet: OwnedPet }) {
  const { state, apply } = useGame();
  const { busyPetIds } = useFriends();
  const [mode, setMode] = useState<'none' | 'crystal' | 'combine'>('none');
  const [spareId, setSpareId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const crystals = Pw.crystalsOf(state);
  const ivs = St.ivsOf(pet);
  const spares = Pw.sparesFor(state, pet);
  const busy = busyPetIds ? [...busyPetIds] : [];
  const maxed = St.STATS.every((k) => ivs[k] >= St.IV_MAX);
  if (maxed) return null;

  const spare = spareId ? spares.find((p) => p.id === spareId) ?? null : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={() => { setMode(mode === 'crystal' ? 'none' : 'crystal'); setNote(null); }}
          style={[styles.tab, mode === 'crystal' && styles.tabOn]}
          accessibilityRole="button"
          accessibilityLabel={`Training Crystals: ${crystals}`}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><CrystalIcon size={18} /><Text style={[styles.tabText, mode === 'crystal' && styles.tabTextOn]}>Crystals · {crystals}</Text></View>
        </Pressable>
        <Pressable
          onPress={() => { setMode(mode === 'combine' ? 'none' : 'combine'); setSpareId(null); setNote(null); }}
          style={[styles.tab, mode === 'combine' && styles.tabOn]}
          accessibilityRole="button"
          accessibilityLabel={`Combine a spare: ${spares.length} spares`}
        >
          <Text style={[styles.tabText, mode === 'combine' && styles.tabTextOn]}>Combine · {spares.length}</Text>
        </Pressable>
      </View>

      {mode === 'crystal' ? (
        <PopIn>
          <View style={styles.panel}>
            {crystals > 0 ? (
              <>
                <Text style={font.small}>Tap a stat to spend one crystal on it: +1 each (up to {St.IV_MAX}), about +2% grade.</Text>
                <View style={styles.statGrid}>
                  {St.STATS.map((k) => {
                    const full = ivs[k] >= St.IV_MAX;
                    return (
                      <Pressable
                        key={k}
                        disabled={full}
                        onPress={() => {
                          buzz('success', 'chime');
                          apply((s) => Pw.useCrystal(s, pet.id, k));
                        }}
                        style={({ pressed }) => [styles.statBtn, full && { opacity: 0.45 }, pressed && { transform: [{ scale: 0.96 }] }]}
                        accessibilityRole="button"
                        accessibilityLabel={full ? `${St.STAT_INFO[k].label} is maxed` : `Raise ${St.STAT_INFO[k].label} from ${ivs[k]} to ${ivs[k] + 1}`}
                      >
                        <Text style={styles.statName}>{St.STAT_INFO[k].emoji} {St.STAT_INFO[k].short}</Text>
                        <Text style={styles.statVal}>{full ? 'Max' : `${ivs[k]} → ${ivs[k] + 1}`}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <Text style={font.small}>No crystals yet. Gold chests always have 1–2, Silver chests sometimes have one, every 7-day streak gives one, and the shop sells one a day.</Text>
            )}
          </View>
        </PopIn>
      ) : null}

      {mode === 'combine' ? (
        <PopIn>
          <View style={styles.panel}>
            {spares.length === 0 ? (
              <Text style={font.small}>Hatch another {SPECIES_BY_ID[pet.speciesId].name} and you can combine it into {pet.nickname}: it keeps the higher of each stat, plus +1 on one.</Text>
            ) : !spare ? (
              <>
                <Text style={font.small}>Pick a spare {SPECIES_BY_ID[pet.speciesId].name}. {pet.nickname} keeps the higher of each stat plus a +1 bonus. The spare goes home for good.</Text>
                <View style={styles.spareRow}>
                  {spares.map((p) => {
                    const why = Pw.canCombine(state, pet.id, p.id, busy);
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => (why.ok ? setSpareId(p.id) : setNote(why.reason))}
                        style={({ pressed }) => [styles.spare, !why.ok && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.96 }] }]}
                        accessibilityRole="button"
                        accessibilityLabel={`${p.nickname}, level ${levelFor(p.xp)}, grade ${St.gradeOf(p)}%`}
                      >
                        <PetSprite species={SPECIES_BY_ID[p.speciesId]} stage={stageFor(p.xp)} size={56} shiny={p.shiny} skin={p.skin} />
                        <Text style={styles.spareName} numberOfLines={1}>{p.nickname}</Text>
                        <Text style={styles.spareSub}>Lv {levelFor(p.xp)} · {St.gradeOf(p)}%</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <CombinePreview
                keep={pet}
                spare={spare}
                onCancel={() => setSpareId(null)}
                onConfirm={() => {
                  buzz('success', 'levelup');
                  apply((s) => Pw.combinePets(s, pet.id, spare.id, busy));
                  setSpareId(null);
                  setMode('none');
                  setNote(`Combined! ${pet.nickname} got stronger.`);
                }}
              />
            )}
          </View>
        </PopIn>
      ) : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

function CombinePreview({ keep, spare, onCancel, onConfirm }: { keep: OwnedPet; spare: OwnedPet; onCancel: () => void; onConfirm: () => void }) {
  const p = Pw.combinePreview(keep, spare);
  const s = St.ivsOf(spare);
  const total = (o: Record<string, number>) => Object.values(o).reduce((x, y) => x + y, 0);
  const before = St.gradeOf(keep);
  const after = Math.round((total(p.after) / (St.IV_MAX * 4)) * 100);
  const losing: string[] = [];
  if (spare.skin) losing.push(`a ${SKIN_INFO[spare.skin].label} skin`);
  if (spare.shiny) losing.push('a shiny glow');
  if (levelFor(spare.xp) > levelFor(keep.xp)) losing.push(`a higher level (Lv ${levelFor(spare.xp)})`);
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.table}>
        <Text style={[styles.cell, styles.head]} />
        <Text style={[styles.cell, styles.head]}>{keep.nickname}</Text>
        <Text style={[styles.cell, styles.head]}>Spare</Text>
        <Text style={[styles.cell, styles.head]}>After</Text>
        {St.STATS.map((k) => (
          <React.Fragment key={k}>
            <Text style={[styles.cell, { fontWeight: '900' }]}>{St.STAT_INFO[k].short}</Text>
            <Text style={styles.cell}>{p.before[k]}</Text>
            <Text style={styles.cell}>{s[k]}</Text>
            <Text style={[styles.cell, { fontWeight: '900', color: p.after[k] > p.before[k] ? colors.mintDark : colors.ink }]}>
              {p.after[k]}{p.bonus === k ? ' ✨' : p.after[k] > p.before[k] ? ' ▲' : ''}
            </Text>
          </React.Fragment>
        ))}
      </View>
      <Text style={styles.gradeLine}>{before}% → {after}%</Text>
      {losing.length ? <Text style={styles.warn}>Heads up: {spare.nickname} has {losing.join(' and ')}. That goes home with it.</Text> : null}
      <Text style={font.tiny}>✨ = the bonus +1. Level, XP, look and moves stay on {keep.nickname}.</Text>
      <View style={styles.row}>
        <Pressable onPress={onCancel} style={[styles.btn, { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: colors.line }]} accessibilityRole="button">
          <Text style={[styles.btnText, { color: colors.ink }]}>Back</Text>
        </Pressable>
        <Pressable onPress={onConfirm} style={[styles.btn, { flex: 1, backgroundColor: '#E5484D' }]} accessibilityRole="button" accessibilityLabel={`Combine ${spare.nickname} into ${keep.nickname}`}>
          <Text style={styles.btnText}>Combine</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginTop: 4 },
  row: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, height: 40, borderRadius: 12, borderWidth: 2, borderColor: colors.line, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  tabOn: { borderColor: '#4A8FE0', backgroundColor: '#E9F4FF' },
  tabText: { fontSize: 13, fontWeight: '900', color: colors.ink },
  tabTextOn: { color: '#1F5E99' },
  panel: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: space.sm, gap: 8, borderWidth: 1, borderColor: colors.line },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBtn: { width: '47%', borderRadius: 12, backgroundColor: '#E9F4FF', paddingVertical: 8, paddingHorizontal: 10, gap: 2 },
  statName: { fontSize: 12, fontWeight: '900', color: colors.ink },
  statVal: { fontSize: 15, fontWeight: '900', color: '#1F5E99' },
  spareRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  spare: { width: 92, alignItems: 'center', borderRadius: 12, backgroundColor: '#F6FAF8', padding: 6 },
  spareName: { fontSize: 12, fontWeight: '900', color: colors.ink },
  spareSub: { fontSize: 12, fontWeight: '800', color: colors.muted },
  table: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#F6FAF8', borderRadius: 12, padding: 8 },
  cell: { width: '25%', fontSize: 13, fontWeight: '700', color: colors.ink, paddingVertical: 2 },
  head: { fontSize: 12, fontWeight: '900', color: colors.muted },
  gradeLine: { fontSize: 20, fontWeight: '900', color: '#E5484D', textAlign: 'center' },
  warn: { fontSize: 12, fontWeight: '800', color: '#C4562F' },
  note: { fontSize: 13, fontWeight: '800', color: colors.mintDark },
  btn: { height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
});
