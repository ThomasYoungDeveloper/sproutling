import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PetSprite from './PetSprite';
import { RarityBadge } from './ui';
import { colors, font, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { levelFor, stageFor } from '../game/scoring';
import * as St from '../game/stats';
import { ELEMENT_COLOR, ELEMENT_LABEL, NORMAL_COLOR } from '../game/battle';
import type { Skin } from '../game/types';

/** A friend's pet (from their card) or a pet in a trade. */
export interface ViewPet {
  id?: string;
  speciesId: string;
  nickname: string;
  xp: number;
  shiny: boolean;
  skin?: Skin;
  hat?: string;
  aura?: string;
  personality?: St.Personality;
  ivs?: St.Ivs;
  train?: St.Training;
  foodBoost?: St.Training;
  moves?: string[];
  away?: boolean;
}

const moveColor = (m: St.MoveDef) => (m.element === 'normal' ? NORMAL_COLOR : ELEMENT_COLOR[m.element]);
const moveElement = (m: St.MoveDef) => (m.element === 'normal' ? 'Normal' : ELEMENT_LABEL[m.element]);
const movePower = (m: St.MoveDef) =>
  m.power ? `Power ${m.power}` : m.kind === 'heal' && m.heal ? `Heal ${Math.round(m.heal * 100)}%` : m.kind === 'energy' ? `+${m.energy ?? 0} energy` : 'Boost';
const moveCost = (m: St.MoveDef) => (m.cost ? `${m.cost} energy` : 'Free');

function MoveRow({ m, locked }: { m: St.MoveDef; locked?: number }) {
  const c = moveColor(m);
  return (
    <View style={[styles.move, locked ? { opacity: 0.5 } : null]} accessible accessibilityLabel={`${m.name}, ${moveElement(m)}, ${movePower(m)}, ${moveCost(m)}. ${m.desc}${locked ? ` Learns at level ${locked}.` : ''}`}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.moveName}>{m.name}</Text>
          <View style={[styles.el, { backgroundColor: c }]}><Text style={styles.elText}>{moveElement(m)}</Text></View>
        </View>
        <Text style={styles.moveDesc} numberOfLines={2}>{m.desc}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {locked ? <View style={styles.lock}><Text style={styles.lockText}>Lv {locked}</Text></View> : <Text style={styles.movePower}>{movePower(m)}</Text>}
        <Text style={styles.moveCost}>{locked ? `${movePower(m)} · ${moveCost(m)}` : moveCost(m)}</Text>
      </View>
    </View>
  );
}

/**
 * A close look at someone else's pet: level, stats and moves, with an optional action pinned at the bottom
 * (Make a trade offer). Stats include training and food boosts, which stay with the pet in a trade.
 */
export default function FriendPetSheet({ pet, owner, action, onClose }: { pet: ViewPet; owner: string; action?: { label: string; onPress: () => void; disabled?: string }; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [all, setAll] = useState(false);
  const sp = SPECIES_BY_ID[pet.speciesId];
  if (!sp) return null;
  const lv = levelFor(pet.xp);
  const stats = St.statsFor(pet);
  const equipped = St.equippedMoves(pet);
  const known = St.learned(pet.speciesId, pet.xp);
  const also = known.filter((m) => !equipped.some((e) => e.id === m.id));
  const later = St.learnset(pet.speciesId).filter((m) => m.learn > lv);
  const trained = St.pointsSpent(pet.train);
  const points = St.pointsEarned(pet.xp);
  const personality = St.PERSONALITIES[pet.personality ?? St.personalityOf({ ...pet, id: pet.id ?? pet.nickname })];

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <View style={styles.top}>
          <Pressable onPress={all ? () => setAll(false) : onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={all ? `Back to ${pet.nickname}` : 'Close'}>
            <Text style={styles.back}>{all ? `‹ ${pet.nickname}` : 'Close'}</Text>
          </Pressable>
          <Text style={styles.topTitle} numberOfLines={1}>{all ? 'All moves' : `${owner}${/s$/i.test(owner) ? '’' : '’s'} pet`}</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.body}>
          {all ? (
            <>
              <Head title="In use" meta={`${equipped.length} of ${St.MAX_MOVES}`} />
              {equipped.map((m) => <MoveRow key={m.id} m={m} />)}
              {also.length ? <Head title="Also knows" meta="Swap in anytime after the trade" /> : null}
              {also.map((m) => <MoveRow key={m.id} m={m} />)}
              {later.length ? <Head title="Learns later" /> : null}
              {later.map((m) => <MoveRow key={m.id} m={m} locked={m.learn} />)}
            </>
          ) : (
            <>
              <View style={[styles.art, { backgroundColor: ELEMENT_COLOR[sp.element] + '26' }]}>
                <PetSprite species={sp} stage={stageFor(pet.xp)} size={130} shiny={pet.shiny} skin={pet.skin} hat={pet.hat} aura={pet.aura} />
              </View>
              <Text style={styles.name} numberOfLines={1}>{pet.nickname}</Text>
              <View style={styles.chips}>
                <View style={[styles.chip, { backgroundColor: colors.ink }]}><Text style={styles.chipText}>Lv {lv}</Text></View>
                <RarityBadge rarity={sp.rarity} />
                <View style={[styles.chip, { backgroundColor: ELEMENT_COLOR[sp.element] }]}><Text style={styles.chipText}>{ELEMENT_LABEL[sp.element]}</Text></View>
                {pet.shiny ? <Text style={[font.tiny, { color: '#C99212', fontWeight: '800' }]}>✦ Shiny</Text> : null}
              </View>
              {sp.name !== pet.nickname ? <Text style={styles.sub}>{sp.name}</Text> : null}
              <View style={styles.stats}>
                {St.STATS.map((k) => (
                  <View key={k} style={styles.stat}>
                    <Text style={styles.statValue}>{stats[k]}</Text>
                    <Text style={styles.statLabel}>{St.STAT_INFO[k].label}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.note}>
                Nature: {personality.label} ({personality.text}) · {St.gradeOf(pet)}% grade{points > 0 ? ` · ${trained} of ${points} training point${points === 1 ? '' : 's'} used` : ''}
              </Text>
              <Head title="Moves" meta={`${equipped.length} in use`} />
              {equipped.map((m) => <MoveRow key={m.id} m={m} />)}
              {also.length || later.length ? (
                <Pressable onPress={() => setAll(true)} style={styles.allBtn} accessibilityRole="button">
                  <Text style={styles.allText}>
                    See all moves ({known.length} known{later.length ? `, ${later.length} to learn` : ''}) ›
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}
        </ScrollView>
        {action ? (
          <View style={styles.footer}>
            {action.disabled ? <Text style={styles.why}>{action.disabled}</Text> : null}
            <Pressable onPress={action.disabled ? undefined : action.onPress} style={[styles.cta, !!action.disabled && { opacity: 0.45 }]} accessibilityRole="button" accessibilityState={{ disabled: !!action.disabled }}>
              <Text style={styles.ctaText}>{action.label}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Head({ title, meta }: { title: string; meta?: string }) {
  return (
    <View style={styles.head}>
      <Text style={styles.headTitle}>{title}</Text>
      {meta ? <Text style={styles.headMeta}>{meta}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.55)', justifyContent: 'flex-end', zIndex: 90 },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%', width: '100%', maxWidth: 560, alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  back: { width: 90, fontSize: 15, fontWeight: '700', color: colors.mintDark },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.ink },
  body: { padding: space.lg, paddingTop: space.md, gap: 6, alignItems: 'stretch' },
  art: { alignSelf: 'center', borderRadius: 24, paddingHorizontal: 28, paddingVertical: 6 },
  name: { fontSize: 24, fontWeight: '800', color: colors.ink, textAlign: 'center', marginTop: 4 },
  sub: { fontSize: 13, fontWeight: '600', color: colors.muted, textAlign: 'center' },
  chips: { flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 6, marginTop: 6 },
  stat: { flex: 1, backgroundColor: '#F2F6F4', borderRadius: 14, paddingVertical: 7, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.ink },
  statLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  note: { fontSize: 12, fontWeight: '600', color: colors.muted, textAlign: 'center' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 },
  headTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  headMeta: { fontSize: 12, fontWeight: '600', color: colors.muted },
  move: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#F7FAF8' },
  moveName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  moveDesc: { fontSize: 12, fontWeight: '600', color: colors.muted },
  movePower: { fontSize: 13, fontWeight: '600', color: colors.ink },
  moveCost: { fontSize: 12, fontWeight: '600', color: '#B07A00' },
  el: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  elText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  lock: { backgroundColor: colors.muted, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  lockText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  allBtn: { marginTop: 4, borderRadius: 12, backgroundColor: '#E4F2EC', paddingVertical: 10, alignItems: 'center' },
  allText: { fontSize: 13, fontWeight: '600', color: colors.mintDark },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: 6, borderTopWidth: 1, borderTopColor: colors.line },
  why: { fontSize: 13, fontWeight: '600', color: '#C4562F', textAlign: 'center' },
  cta: { height: 54, borderRadius: 18, backgroundColor: '#4A8FE0', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: '#2F6DB8' },
  ctaText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
});
