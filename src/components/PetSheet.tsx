import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../state/GameContext';
import PetSprite from './PetSprite';
import { Button, RarityBadge } from './ui';
import { buzz, PopIn } from './fx';
import { colors, font, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { levelFor, stageFor, ELEMENT_HABIT } from '../game/scoring';
import { SKIN_INFO } from '../game/skins';
import { ELEMENT_COLOR, ELEMENT_LABEL, NORMAL_COLOR } from '../game/battle';
import * as St from '../game/stats';
import * as A from '../game/actions';
import type { OwnedPet } from '../game/types';
import { sharePetCard } from '../lib/shareCapture';
import { ShareCardView } from './ShareCardView';
import PetZoom from './PetZoom';
import { useAuth } from '../state/AuthContext';
import { useFriends } from '../state/FriendsContext';

/** One pet up close: make it active, spend stat points and choose its battle moves. */
export default function PetSheet({ petId, onClose }: { petId: string; onClose: () => void }) {
  const { state, apply } = useGame();
  const pet = state.pets.find((p) => p.id === petId);
  const [confirmReset, setConfirmReset] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [cardW, setCardW] = useState(0);
  const cardRef = useRef<any>(null);
  const { username } = useAuth();
  const { myCode } = useFriends();
  if (!pet) return null;
  const sp = SPECIES_BY_ID[pet.speciesId];
  const lv = levelFor(pet.xp);
  const stats = St.statsFor(pet);
  const left = St.pointsLeft(pet);
  const pers = St.PERSONALITIES[St.personalityOf(pet)];
  const ivs = St.ivsOf(pet);
  const grade = St.gradeOf(pet);
  const gi = St.gradeInfo(grade);
  const equipped = St.equippedMoves(pet).map((m) => m.id);
  const isActive = state.activePetId === pet.id;
  const maxStat: Record<St.Stat, number> = { hp: 400, atk: 110, def: 100, spd: 100 };

  const update = (fn: (p: OwnedPet) => OwnedPet) => apply((s) => ({ ...s, pets: s.pets.map((p) => (p.id === pet.id ? fn(p) : p)) }));

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ gap: space.sm }}>
          <View style={styles.head}>
            <Pressable onPress={() => setZoom(true)} style={({ pressed }) => [styles.art, pressed && { transform: [{ scale: 0.95 }] }]} accessibilityRole="button" accessibilityLabel={`See ${pet.nickname} up close`}>
              <PetSprite species={sp} stage={stageFor(pet.xp)} size={110} shiny={pet.shiny} skin={pet.skin} hat={pet.look?.hat} aura={pet.look?.aura} />
              <View style={styles.zoomBadge}><Text style={styles.zoomText}>🔍</Text></View>
            </Pressable>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={font.title} numberOfLines={1}>{pet.nickname}</Text>
              <Text style={font.small}>Lv {lv} {sp.name}{pet.skin ? ` · ${SKIN_INFO[pet.skin].emoji} ${SKIN_INFO[pet.skin].label}` : ''}{pet.shiny ? ' · ✦ Shiny' : ''}</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                <RarityBadge rarity={sp.rarity} />
                <View style={[styles.chip, { backgroundColor: ELEMENT_COLOR[sp.element] }]}><Text style={styles.chipText}>{ELEMENT_LABEL[sp.element]}</Text></View>
                <View style={[styles.chip, { backgroundColor: '#F1EAFB' }]}><Text style={[styles.chipText, { color: '#6E56CF' }]}>{pers.emoji} {pers.label}: {pers.text}</Text></View>
              </View>
              <Text style={[font.tiny, { fontWeight: '800' }]}>{ELEMENT_HABIT[sp.element].emoji} While active: {ELEMENT_HABIT[sp.element].label}</Text>
              {isActive ? (
                <Text style={[font.small, { color: colors.mintDark, fontWeight: '900' }]}>★ Your active pet</Text>
              ) : (
                <Button small primary label="Make active" onPress={() => { buzz('success'); apply((s) => A.setActivePet(s, pet.id)); }} />
              )}
            </View>
          </View>

          <View style={styles.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.title}>🔎 Grade</Text>
              <Text style={[styles.gradeBig, { color: gi.color }]}>{grade >= 100 ? '💯 100%' : `${grade}%`}</Text>
            </View>
            <Text style={[font.small, { fontWeight: '800' }]}>
              {St.gradeStars(grade)} {gi.label}. {grade >= 100 ? 'A perfect pet: the best of the best!' : 'Every pet is born with hidden quality from 0 to 15 in each stat. A perfect 15 makes that stat up to 10% stronger.'}
            </Text>
            <View style={styles.ivGrid}>
              {St.STATS.map((k) => (
                <View key={k} style={styles.ivCell}>
                  <Text style={styles.ivLabel}>{St.STAT_INFO[k].emoji} {St.STAT_INFO[k].short}</Text>
                  <View style={styles.ivBar}>
                    <View style={{ width: `${(ivs[k] / St.IV_MAX) * 100}%`, height: '100%', borderRadius: 999, backgroundColor: ivs[k] === St.IV_MAX ? '#E3A81E' : St.STAT_INFO[k].color }} />
                  </View>
                  <Text style={styles.ivVal}>{ivs[k]}/{St.IV_MAX}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.title}>💪 Train</Text>
              {left > 0 ? (
                <PopIn key={left}>
                  <Text style={styles.points}>{left} point{left === 1 ? '' : 's'} to spend!</Text>
                </PopIn>
              ) : (
                <Text style={font.tiny}>You get 1 point every level</Text>
              )}
            </View>
            {St.STATS.map((k) => {
              const info = St.STAT_INFO[k];
              return (
                <View key={k} style={styles.statRow}>
                  <Text style={{ fontSize: 16, width: 22 }}>{info.emoji}</Text>
                  <Text style={styles.statLabel}>{info.short}</Text>
                  <View style={styles.bar}>
                    <View style={{ width: `${Math.min(100, (stats[k] / maxStat[k]) * 100)}%`, height: '100%', borderRadius: 999, backgroundColor: info.color }} />
                  </View>
                  <Text style={styles.statVal}>{stats[k]}</Text>
                  <Text style={styles.trained}>{pet.train?.[k] ? `+${pet.train[k]}` : ''}</Text>
                  <Pressable
                    onPress={() => {
                      if (left <= 0) return;
                      buzz('light', 'pop');
                      update((p) => St.train(p, k));
                    }}
                    style={[styles.plus, left <= 0 && { opacity: 0.3 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Train ${info.label}`}
                    accessibilityState={{ disabled: left <= 0 }}
                  >
                    <Text style={styles.plusText}>+</Text>
                  </Pressable>
                </View>
              );
            })}
            {St.pointsSpent(pet.train) > 0 ? (
              <Pressable
                onPress={() => {
                  if (!confirmReset) {
                    setConfirmReset(true);
                    setTimeout(() => setConfirmReset(false), 3000);
                    return;
                  }
                  if (state.coins < St.RESPEC_COST) return setMsg(`Resetting costs ${St.RESPEC_COST} coins.`);
                  buzz('medium');
                  apply((s) => ({ ...s, coins: s.coins - St.RESPEC_COST, pets: s.pets.map((p) => (p.id === pet.id ? { ...p, train: {} } : p)) }));
                  setConfirmReset(false);
                  setMsg('Points reset. Spend them again however you like!');
                }}
              >
                <Text style={styles.reset}>{confirmReset ? `Tap again to reset points (● ${St.RESPEC_COST})` : 'Reset points'}</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.title}>⚔️ Battle moves</Text>
              <Text style={font.tiny}>{equipped.length} of {St.MAX_MOVES} chosen</Text>
            </View>
            <Text style={font.tiny}>Tap moves to choose up to 4. Pets learn new moves as they level up.</Text>
            {St.learnset(pet.speciesId).map((m) => {
              const known = m.learn <= lv;
              const on = equipped.includes(m.id);
              const c = m.element === 'normal' ? NORMAL_COLOR : ELEMENT_COLOR[m.element];
              return (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    if (!known) return;
                    if (!on && equipped.length >= St.MAX_MOVES) return setMsg('Take a move out first (pets can bring 4).');
                    buzz('light');
                    setMsg(null);
                    update((p) => St.toggleMove(p, m.id));
                  }}
                  style={[styles.move, { borderColor: on ? c : colors.line }, on && { backgroundColor: '#FFFFFF' }, !known && { opacity: 0.45 }]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: !known }}
                  accessibilityLabel={m.name}
                >
                  <Text style={{ fontSize: 20 }}>{known ? m.emoji : '🔒'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.moveName}>{m.name} <Text style={styles.moveCost}>{m.cost ? `${m.cost}⚡` : 'Free'}{m.power ? ` · Power ${m.power}` : ''}</Text></Text>
                    <Text style={font.tiny}>{known ? m.desc : `Learns at level ${m.learn}`}</Text>
                  </View>
                  {on ? <Text style={[styles.check, { backgroundColor: c }]}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
          <Button label="📸 Share card" onPress={() => setPreview(true)} />
          <Button primary label="Done" onPress={onClose} />
        </ScrollView>
      </View>
      {zoom ? <PetZoom pet={{ ...pet, hat: pet.look?.hat, aura: pet.look?.aura }} scene={isActive ? state.scene : undefined} onClose={() => setZoom(false)} /> : null}
      {preview ? (
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { alignItems: 'center', gap: space.sm }]} onLayout={(e) => setCardW(Math.min(360, e.nativeEvent.layout.width - space.lg * 2))}>
            <Text style={font.h2}>Share {pet.nickname}</Text>
            {cardW > 0 ? <ShareCardView ref={cardRef} pet={pet} trainer={username ?? 'A Sproutling trainer'} friendCode={myCode} width={cardW} /> : null}
            {msg ? <Text style={styles.msg}>{msg}</Text> : null}
            <Button
              primary
              style={{ alignSelf: 'stretch' }}
              label={sharing ? 'Making your card…' : 'Share'}
              disabled={sharing}
              onPress={async () => {
                setSharing(true);
                setMsg(null);
                const r = await sharePetCard(cardRef.current, pet, username ?? 'A Sproutling trainer', myCode);
                setSharing(false);
                if (r === 'downloaded') setMsg('Card saved to your downloads! Post it anywhere.');
                else if (r === 'failed') setMsg('Couldn’t make the card. Try again.');
                else if (r === 'shared') setPreview(false);
              }}
            />
            <Button style={{ alignSelf: 'stretch' }} label="Back" onPress={() => { setPreview(false); setMsg(null); }} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gradeBig: { fontSize: 24, fontWeight: '900' },
  ivGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ivCell: { width: '47%', gap: 3 },
  ivLabel: { fontSize: 12, fontWeight: '900', color: colors.ink },
  ivBar: { height: 8, borderRadius: 999, backgroundColor: '#E8EEEC', overflow: 'hidden' },
  ivVal: { fontSize: 11, fontWeight: '800', color: colors.muted },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.6)', justifyContent: 'center', alignItems: 'center', padding: space.md, zIndex: 80 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: space.lg, width: '100%', maxWidth: 460, maxHeight: '96%' },
  head: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  topBar: { flexDirection: 'row', marginTop: -6, marginBottom: 4 },
  back: { minHeight: 40, paddingHorizontal: 10, marginLeft: -8, borderRadius: 999, justifyContent: 'center' },
  backText: { fontSize: 16, fontWeight: '900', color: colors.mintDark },
  zoomBadge: { position: 'absolute', right: 4, bottom: 4, backgroundColor: '#FFFFFF', borderRadius: 999, width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  zoomText: { fontSize: 13 },
  art: { width: 116, height: 116, borderRadius: 20, backgroundColor: colors.sky, alignItems: 'center', justifyContent: 'center' },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
  section: { backgroundColor: '#FAFCFB', borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: space.sm, gap: 6 },
  title: { fontWeight: '900', fontSize: 16, color: colors.ink },
  points: { fontWeight: '900', fontSize: 13, color: '#5A3E00', backgroundColor: colors.gold, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden' },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLabel: { width: 32, fontWeight: '900', fontSize: 12, color: colors.ink },
  bar: { flex: 1, height: 10, borderRadius: 999, backgroundColor: '#E7EEEA', overflow: 'hidden' },
  statVal: { width: 34, textAlign: 'right', fontWeight: '900', fontSize: 13, color: colors.ink },
  trained: { width: 24, fontWeight: '800', fontSize: 11, color: colors.mintDark },
  plus: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  plusText: { color: '#FFFFFF', fontWeight: '900', fontSize: 18, lineHeight: 20 },
  reset: { fontSize: 12, fontWeight: '800', color: colors.muted, textDecorationLine: 'underline', textAlign: 'right' },
  move: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 12, borderWidth: 2 },
  moveName: { fontWeight: '900', fontSize: 14, color: colors.ink },
  moveCost: { fontWeight: '800', fontSize: 11, color: colors.muted },
  check: { color: '#FFFFFF', fontWeight: '900', fontSize: 12, width: 22, height: 22, borderRadius: 11, textAlign: 'center', lineHeight: 22, overflow: 'hidden' },
  msg: { fontWeight: '800', fontSize: 13, color: '#C4562F', textAlign: 'center' },
});
