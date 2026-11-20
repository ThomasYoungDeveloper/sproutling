import * as U from '../game/unlocks';
import { PersonalitySheet } from './BuffInfo';
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
import * as FD from '../game/food';
import { ELEMENT_COLOR, ELEMENT_LABEL, NORMAL_COLOR } from '../game/battle';
import * as St from '../game/stats';
import * as A from '../game/actions';
import type { OwnedPet } from '../game/types';
import { sharePetCard } from '../lib/shareCapture';
import { ShareCardView } from './ShareCardView';
import PetZoom from './PetZoom';
import PowerUps from './PowerUps';
import HpCard from './HpCard';
import { InfoDot, InfoPop, type Tip } from './InfoTip';
import { useAuth } from '../state/AuthContext';
import { useFriends } from '../state/FriendsContext';

const TIPS = {
  hp: { title: 'HP', text: 'Fights on trips and with wild pets lower HP. Friend, live and ranked battles never do. HP heals by itself (10% an hour), and potions heal right away. A knocked-out pet rests a while before it starts healing.' },
  stats: (nature: string, fav: string | null): Tip => ({ title: 'Battle stats', text: `Every stat grows a little each level on its own. You also get 1 point every level to put where you like.${fav ? ` ${nature} pets grow ${fav} faster.` : ''} Points can't be moved once you lock them in, so choose carefully.` }),
  moves: { title: 'Moves', text: 'Pets bring 4 moves into battle. Tap a move to take it out or put it in. Pets learn new moves as they level up. Moves cost energy; free moves build it up.' },
  grade: { title: 'Grade', text: 'Every pet is born with hidden quality from 0 to 15 in each stat. A perfect 15 makes that stat up to 10% stronger. Raise it with Training Crystals, or by combining a spare of the same pet.' },
};

/** One pet up close: make it active, spend stat points and choose its battle moves. */
export default function PetSheet({ petId, onClose }: { petId: string; onClose: () => void }) {
  const { state, apply } = useGame();
  const pet = state.pets.find((p) => p.id === petId);
  // Training is permanent, so points are placed first and only saved when you tap Lock in.
  const [pending, setPending] = useState<St.Training>({});
  const [info, setInfo] = useState<'personality' | null>(null);
  const [tab, setTab] = useState<'stats' | 'moves' | 'about'>('stats');
  const [tip, setTip] = useState<Tip | null>(null);
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
  const placed = St.pointsSpent(pending);
  const trainPreview = { ...pet, train: Object.fromEntries(St.STATS.map((k) => [k, (pet.train?.[k] ?? 0) + (pending[k] ?? 0)])) as St.Training };
  const stats = St.statsFor(trainPreview);
  const left = St.pointsLeft(pet) - placed;
  const pers = St.PERSONALITIES[St.personalityOf(pet)];
  const nb = St.natureBonus(trainPreview);
  const ivs = St.ivsOf(pet);
  const grade = St.gradeOf(pet);
  const gi = St.gradeInfo(grade);
  const equipped = St.equippedMoves(pet).map((m) => m.id);
  const isActive = state.activePetId === pet.id;
  const known = St.learnset(pet.speciesId).filter((m) => m.learn <= lv);
  const locked = St.learnset(pet.speciesId).filter((m) => m.learn > lv).sort((x, y) => x.learn - y.learn);
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
          <Pressable onPress={() => setPreview(true)} style={styles.back} accessibilityRole="button" accessibilityLabel={`Share ${pet.nickname}'s card`}>
            <Text style={styles.backText}>Share</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ gap: space.sm }}>
          <View style={styles.head}>
            <Pressable onPress={() => setZoom(true)} style={({ pressed }) => [styles.art, pressed && { transform: [{ scale: 0.95 }] }]} accessibilityRole="button" accessibilityLabel={`See ${pet.nickname} up close`}>
              <PetSprite species={sp} stage={stageFor(pet.xp)} size={110} shiny={pet.shiny} skin={pet.skin} hat={pet.look?.hat} aura={pet.look?.aura} />
            </Pressable>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={font.title} numberOfLines={1}>{pet.nickname}</Text>
              <Text style={styles.sub}>Level {lv}{pet.nickname !== sp.name ? ` ${sp.name}` : ''}{pet.skin ? ` · ${SKIN_INFO[pet.skin].label}` : ''}{pet.shiny ? ' · Shiny' : ''}</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                <RarityBadge rarity={sp.rarity} />
                <View style={[styles.chip, { backgroundColor: ELEMENT_COLOR[sp.element] }]}><Text style={styles.chipText}>{ELEMENT_LABEL[sp.element]}</Text></View>
                <Pressable onPress={() => setInfo('personality')} style={[styles.chip, styles.natureChip]} accessibilityRole="button" accessibilityLabel={`Nature: ${pers.label}. Tap for more`}>
                  <Text style={[styles.chipText, { color: '#6E56CF' }]}>{pers.label}{nb ? ` +${nb.amount} ${St.STAT_INFO[nb.stat].short}` : ''}</Text>
                  <InfoDot onPress={() => setInfo('personality')} label="nature" color="#6E56CF" />
                </Pressable>
              </View>
              {isActive ? (
                <Text style={styles.active}>Active pet · {ELEMENT_HABIT[sp.element].label}</Text>
              ) : (
                <Button small primary label="Make active" onPress={() => { buzz('success'); apply((s) => A.setActivePet(s, pet.id)); }} />
              )}
            </View>
          </View>

          <View style={styles.tabs} accessibilityRole="tablist">
            {(['stats', 'moves', 'about'] as const).map((t) => (
              <Pressable key={t} onPress={() => { buzz('light'); setTab(t); }} style={[styles.tab, tab === t && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
                <Text style={[styles.tabText, tab === t && { color: colors.ink }]}>{t === 'stats' ? 'Stats' : t === 'moves' ? 'Moves' : 'About'}</Text>
                {t === 'stats' && left > 0 ? <View style={styles.tabDot} /> : null}
              </Pressable>
            ))}
          </View>

          {tab === 'stats' ? (
            <>
              <HpCard pet={pet} onInfo={() => setTip(TIPS.hp)} />
              <View style={styles.section}>
                <View style={styles.titleRow}>
                  <View style={styles.titleL}>
                    <Text style={styles.title}>Battle stats</Text>
                    <InfoDot onPress={() => setTip(TIPS.stats(pers.label, nb ? St.STAT_INFO[nb.stat].label : null))} label="battle stats" />
                  </View>
                  {left > 0 ? (
                    <PopIn key={left}>
                      <Text style={styles.points}>{left} point{left === 1 ? '' : 's'} to spend</Text>
                    </PopIn>
                  ) : null}
                </View>
                {St.STATS.map((k) => {
                  const info = St.STAT_INFO[k];
                  return (
                    <View key={k} style={styles.statRow}>
                      <Text style={[styles.statLabel, nb?.stat === k && { color: '#6E56CF' }]}>{info.short}</Text>
                      <View style={styles.bar}>
                        <View style={{ width: `${Math.min(100, (stats[k] / maxStat[k]) * 100)}%`, height: '100%', borderRadius: 999, backgroundColor: info.color }} />
                      </View>
                      <Text style={styles.statVal}>{stats[k]}</Text>
                      {pending[k] ? <Text style={styles.pendingTag}>+{pending[k]}</Text> : null}
                      {left > 0 || placed > 0 ? (
                        <Pressable
                          onPress={() => {
                            if (left <= 0) return;
                            buzz('light', 'pop');
                            setPending((p) => ({ ...p, [k]: (p[k] ?? 0) + 1 }));
                          }}
                          style={[styles.plus, left <= 0 && { opacity: 0.3 }]}
                          accessibilityRole="button"
                          accessibilityLabel={`Train ${info.label}`}
                          accessibilityState={{ disabled: left <= 0 }}
                        >
                          <Text style={styles.plusText}>+</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
                {placed > 0 ? (
                  <View style={{ gap: 6, marginTop: 4 }}>
                    <Text style={[font.small, { fontWeight: '800', color: '#C4562F' }]}>Points can’t be moved once locked in.</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Button small label="Undo" onPress={() => setPending({})} />
                      <Button
                        small
                        primary
                        label={`Lock in ${placed} point${placed === 1 ? '' : 's'}`}
                        onPress={() => {
                          buzz('medium');
                          update((p) => {
                            let q = p;
                            for (const k of St.STATS) for (let i = 0; i < (pending[k] ?? 0); i++) q = St.train(q, k);
                            return q;
                          });
                          setPending({});
                          setMsg('Training locked in!');
                        }}
                      />
                    </View>
                  </View>
                ) : null}
                <Pressable onPress={() => setTab('about')} style={styles.gradeRow} accessibilityRole="button" accessibilityLabel={`Grade ${grade}%, ${gi.label}. See details`}>
                  <Text style={styles.gradeText}>Grade <Text style={{ color: gi.color }}>{grade}%</Text> · {gi.label}</Text>
                  <Text style={styles.link}>Details ›</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          {tab === 'moves' ? (
            <View style={styles.section}>
              <View style={styles.titleRow}>
                <View style={styles.titleL}>
                  <Text style={styles.title}>Your moves</Text>
                  <InfoDot onPress={() => setTip(TIPS.moves)} label="moves" />
                </View>
                <Text style={styles.hint}>{equipped.length} of {St.MAX_MOVES} · tap to swap</Text>
              </View>
              {known.map((m) => {
                const on = equipped.includes(m.id);
                const c = m.element === 'normal' ? NORMAL_COLOR : ELEMENT_COLOR[m.element];
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => {
                      if (!on && equipped.length >= St.MAX_MOVES) return setMsg('Take a move out first (pets can bring 4).');
                      buzz('light');
                      setMsg(null);
                      update((p) => St.toggleMove(p, m.id));
                    }}
                    style={[styles.move, { borderColor: on ? c : colors.line }, on && { backgroundColor: '#FFFFFF' }]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${m.name}. ${m.desc}`}
                  >
                    <View style={[styles.moveDot, { backgroundColor: c }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.moveName}>{m.name}</Text>
                      <Text style={styles.moveCost}>{[m.power ? `Power ${m.power}` : m.desc.replace(/\s*⚡/g, ' energy').replace(/\.$/, ''), m.cost ? `${m.cost} energy` : 'Free'].join(' · ')}</Text>
                    </View>
                    {on ? <Text style={[styles.check, { backgroundColor: c }]}>✓</Text> : null}
                  </Pressable>
                );
              })}
              {locked.length ? <Text style={styles.lockedLine}>{locked.length} more move{locked.length === 1 ? '' : 's'} to learn · next at Lv {locked[0].learn}</Text> : null}
            </View>
          ) : null}

          {tab === 'about' ? (
            <>
              <View style={styles.section}>
                <Text style={styles.title}>Nature: {pers.label}</Text>
                <Text style={styles.body}>{nb ? `${St.STAT_INFO[nb.stat].label} grows faster every level (+${nb.amount} now).` : `${pers.text}.`} Born with it.</Text>
              </View>
              <View style={styles.section}>
                <Text style={styles.title}>Favorite food</Text>
                <Text style={styles.body}>{(() => { const t = FD.tasteOf(pet); const fav = pet.tasted?.includes(t.fav) ? FD.FOOD_BY_ID[t.fav]?.name : null; const no = pet.tasted?.includes(t.dislike) ? FD.FOOD_BY_ID[t.dislike]?.name : null; return fav || no ? [fav ? `Loves ${fav}` : null, no ? `not a fan of ${no}` : null].filter(Boolean).join(', ') + '.' : 'Not found yet. Try feeding it new foods.'; })()}</Text>
              </View>
              <View style={styles.section}>
                <Text style={styles.title}>While active</Text>
                <Text style={styles.body}>{ELEMENT_HABIT[sp.element].label}</Text>
              </View>
              <View style={styles.section}>
                <View style={styles.titleRow}>
                  <View style={styles.titleL}>
                    <Text style={styles.title}>Grade {grade}% · {gi.label}</Text>
                    <InfoDot onPress={() => setTip(TIPS.grade)} label="grade" />
                  </View>
                </View>
                <View style={styles.ivGrid}>
                  {St.STATS.map((k) => (
                    <View key={k} style={styles.ivCell}>
                      <Text style={styles.ivLabel}>{St.STAT_INFO[k].short} <Text style={styles.ivVal}>{ivs[k]}/{St.IV_MAX}</Text></Text>
                      <View style={styles.ivBar}>
                        <View style={{ width: `${(ivs[k] / St.IV_MAX) * 100}%`, height: '100%', borderRadius: 999, backgroundColor: ivs[k] === St.IV_MAX ? '#E3A81E' : St.STAT_INFO[k].color }} />
                      </View>
                    </View>
                  ))}
                </View>
                {U.unlocked(state, 'breeding') ? <PowerUps pet={pet} /> : <Text style={styles.hint}>{U.lockedText('breeding')} to power up.</Text>}
              </View>
            </>
          ) : null}

          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
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
      <InfoPop tip={tip} onClose={() => setTip(null)} />
      {info === 'personality' ? <PersonalitySheet personality={St.personalityOf(pet)} name={pet.nickname} onClose={() => setInfo(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gradeBig: { fontSize: 24, fontWeight: '900' },
  ivGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ivCell: { width: '47%', gap: 3 },
  ivLabel: { fontSize: 13, fontWeight: '900', color: colors.ink },
  ivBar: { height: 8, borderRadius: 999, backgroundColor: '#E8EEEC', overflow: 'hidden' },
  ivVal: { fontSize: 13, fontWeight: '800', color: colors.muted },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.6)', justifyContent: 'center', alignItems: 'center', padding: space.md, zIndex: 80 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: space.lg, width: '100%', maxWidth: 460, maxHeight: '96%' },
  head: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -6, marginBottom: 4 },
  sub: { fontSize: 14, fontWeight: '800', color: colors.muted },
  natureChip: { backgroundColor: '#F1EAFB', flexDirection: 'row', alignItems: 'center', gap: 5 },
  active: { fontSize: 13, fontWeight: '900', color: colors.mintDark },
  tabs: { flexDirection: 'row', backgroundColor: '#EEF4F1', borderRadius: 14, padding: 4 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 11, flexDirection: 'row', gap: 5 },
  tabOn: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 15, fontWeight: '900', color: '#7E918B' },
  tabDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E8590C' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 28 },
  titleL: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hint: { fontSize: 13, fontWeight: '800', color: colors.muted },
  body: { fontSize: 14, fontWeight: '700', color: '#4D5E59' },
  pendingTag: { fontSize: 13, fontWeight: '900', color: '#E8590C' },
  gradeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 4 },
  gradeText: { fontSize: 15, fontWeight: '900', color: colors.ink },
  link: { fontSize: 14, fontWeight: '900', color: colors.mintDark },
  moveDot: { width: 12, height: 12, borderRadius: 6 },
  lockedLine: { textAlign: 'center', fontSize: 14, fontWeight: '900', color: colors.muted, backgroundColor: '#F1F5F3', borderRadius: 12, paddingVertical: 10, overflow: 'hidden' },
  back: { minHeight: 40, paddingHorizontal: 10, marginLeft: -8, borderRadius: 999, justifyContent: 'center' },
  backText: { fontSize: 16, fontWeight: '900', color: colors.mintDark },
  zoomBadge: { position: 'absolute', right: 4, bottom: 4, backgroundColor: '#FFFFFF', borderRadius: 999, width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  zoomText: { fontSize: 13 },
  art: { width: 116, height: 116, borderRadius: 20, backgroundColor: colors.sky, alignItems: 'center', justifyContent: 'center' },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  section: { backgroundColor: '#FAFCFB', borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: space.md, gap: 8 },
  title: { fontWeight: '900', fontSize: 17, color: colors.ink },
  points: { fontWeight: '900', fontSize: 13, color: '#5A3E00', backgroundColor: colors.gold, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden' },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34 },
  statLabel: { width: 36, fontWeight: '900', fontSize: 14, color: colors.ink },
  bar: { flex: 1, height: 10, borderRadius: 999, backgroundColor: '#E7EEEA', overflow: 'hidden' },
  statVal: { width: 40, textAlign: 'right', fontWeight: '900', fontSize: 15, color: colors.ink },
  trained: { width: 24, fontWeight: '800', fontSize: 12, color: colors.mintDark },
  plus: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  plusText: { color: '#FFFFFF', fontWeight: '900', fontSize: 18, lineHeight: 20 },
  reset: { fontSize: 12, fontWeight: '800', color: colors.muted, textDecorationLine: 'underline', textAlign: 'right' },
  move: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 12, borderWidth: 2 },
  moveName: { fontWeight: '900', fontSize: 15, color: colors.ink },
  moveCost: { fontWeight: '800', fontSize: 13, color: colors.muted },
  check: { color: '#FFFFFF', fontWeight: '900', fontSize: 12, width: 22, height: 22, borderRadius: 11, textAlign: 'center', lineHeight: 22, overflow: 'hidden' },
  msg: { fontWeight: '800', fontSize: 13, color: '#C4562F', textAlign: 'center' },
});
