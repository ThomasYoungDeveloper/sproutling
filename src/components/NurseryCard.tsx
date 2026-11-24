import React, { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { Rays } from './fx';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { Icon } from './Icon';
import { useGame } from '../state/GameContext';
import { useOverlay } from './Overlay';
import PetPicker from './PetPicker';
import PetSprite from './PetSprite';
import EggSprite from './EggSprite';
import { Button, Card, SectionHead } from './ui';
import { buzz, Confetti, PopIn } from './fx';
import { colors, font, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { levelFor, stageFor } from '../game/scoring';
import { SKIN_INFO, BRED_SKIN_BOOST, INHERIT_CHANCE } from '../game/skins';
import { RARITY_INFO, STEPS_PER_KM, eggSteps } from '../game/rarity';
import { formatLeft } from '../game/expedition';
import * as Br from '../game/breeding';
import type { Egg } from '../game/types';
import { INHERIT_BETTER, INHERIT_OTHER, LUCKY_CHANCE, gradeOf, ivsOf, likelyGrade } from '../game/stats';

const STAT_LABEL = { hp: 'HP', atk: 'Attack', def: 'Defense', spd: 'Speed' } as const;

function Slot({ petId, label, onPress }: { petId: string | null; label: string; onPress: () => void }) {
  const { state } = useGame();
  const pet = petId ? state.pets.find((p) => p.id === petId) : null;
  const sp = pet ? SPECIES_BY_ID[pet.speciesId] : null;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.slot, pet && styles.slotFull, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="button" accessibilityLabel={pet ? `${label}: ${pet.nickname}, tap to change` : `Choose ${label}`}>
      {pet && sp ? (
        <>
          <PetSprite species={sp} stage={stageFor(pet.xp)} size={86} shiny={pet.shiny} skin={pet.skin} hat={pet.look?.hat} aura={pet.look?.aura} />
          <Text style={styles.slotName} numberOfLines={1}>{pet.nickname}</Text>
          <Text style={styles.slotSub}>Lv {levelFor(pet.xp)}{pet.skin ? ` · ${SKIN_INFO[pet.skin].label}` : ''}</Text>
        </>
      ) : (
        <>
          <Text style={styles.plus}>+</Text>
          <Text style={styles.slotSub}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export default function NurseryCard() {
  const { state, apply } = useGame();
  const overlay = useOverlay();
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [made, setMade] = useState<{ egg: Egg; surprise: boolean } | null>(null);
  const [details, setDetails] = useState(false);

  const adults = state.pets.filter((p) => levelFor(p.xp) >= Br.ADULT_LEVEL);
  const best = Math.max(1, ...state.pets.map((p) => levelFor(p.xp)));

  if (adults.length < 2) {
    return (
      <Card>
        <SectionHead title="Pet Nursery" meta={`Unlocks with 2 adults`} />
        <Text style={font.small}>
          When two of your pets grow into adults (level {Br.ADULT_LEVEL}), they can make an egg together. Nursery eggs are 3× more likely to hatch with a rare skin, and parents can pass their skin down!
        </Text>
        <Text style={[font.small, { fontWeight: '800' }]}>
          You have {adults.length} adult{adults.length === 1 ? '' : 's'}. Your highest level is {best}.
        </Text>
      </Card>
    );
  }

  const pick = (which: 'a' | 'b') => {
    const other = which === 'a' ? b : a;
    overlay.open(
      <PetPicker
        title={which === 'a' ? 'First parent' : 'Second parent'}
        subtitle={`Adults only (level ${Br.ADULT_LEVEL}+). Parents rest ${Br.REST_HOURS} hours after making an egg.`}
        pets={[...state.pets]
          .sort((x, y) => y.xp - x.xp)
          .map((p) => {
            const rest = Br.restLeftMs(state, p);
            const disabled =
              levelFor(p.xp) < Br.ADULT_LEVEL ? `${p.nickname} needs to reach level ${Br.ADULT_LEVEL}.` : rest > 0 ? `${p.nickname} is resting for ${formatLeft(rest)}.` : p.id === other ? 'Already picked as the other parent.' : state.expedition?.petId === p.id ? `${p.nickname} is out exploring.` : undefined;
            return { pet: p, disabled };
          })}
        initial={which === 'a' && a ? [a] : which === 'b' && b ? [b] : []}
        confirmLabel={() => 'Choose'}
        onConfirm={([id]) => {
          (which === 'a' ? setA : setB)(id);
          setMade(null);
          setMsg(null);
          overlay.close();
        }}
        onClose={overlay.close}
      />,
    );
  };

  const pa = a ? state.pets.find((p) => p.id === a) : null;
  const pb = b ? state.pets.find((p) => p.id === b) : null;
  const check = a && b ? Br.canBreed(state, a, b) : null;
  const skinChance = Math.round((0.05 + 0.03 + 0.015 + 0.005) * BRED_SKIN_BOOST * 100);
  const skinnedParents = [pa, pb].filter((p) => p?.skin);

  const makeEgg = () => {
    if (!a || !b) return;
    const r = Br.breed(state, a, b);
    if (!r) return setMsg(check && !check.ok ? check.reason : 'Can’t make an egg right now.');
    buzz('success', 'chime');
    apply(() => r.state);
    setMsg(null);
    setA(null);
    setB(null);
  };

  const nest = Br.nestingEgg(state);
  if (nest) return <NestView egg={nest} />;

  return (
    <Card style={{ backgroundColor: '#FFF4F8', borderColor: '#F9C9DD' }}>
      {made ? <Confetti key={made.egg.id} amount={40} width={400} height={400} colors={['#FF8FB1', '#FFD6E5', '#FFE27A', '#B18CFF']} /> : null}
      <SectionHead title="Pet Nursery" meta={`${adults.length} adults ready`} />
      {made ? (
        <PopIn>
          <View style={styles.made}>
            <EggSprite rarity={made.egg.rarity} size={90} spots={['#FF8FB1', '#FFD6E5', '#FF8FB1', '#B18CFF']} />
            <Text style={styles.madeTitle}>{made.egg.bred?.lucky ? `A Lucky ${RARITY_INFO[made.egg.rarity].label.toLowerCase()} egg!` : `A new ${RARITY_INFO[made.egg.rarity].label.toLowerCase()} egg!`}</Text>
            {made.egg.bred?.lucky ? <Text style={styles.luckyNote}>It shimmers! The baby gets +{made.egg.bred.lucky} on every stat.</Text> : null}
            <Text style={[font.small, { textAlign: 'center' }]}>Put it in an incubator on the Eggs tab and walk to hatch it. Who knows what skin it’ll have!</Text>
            <Button small label="Make another" onPress={() => setMade(null)} />
          </View>
        </PopIn>
      ) : (
        <>
          <View style={styles.parents}>
            <Slot petId={a} label="Parent 1" onPress={() => pick('a')} />
            <Icon name="heart" size={24} color="#E0567A" filled />
            <Slot petId={b} label="Parent 2" onPress={() => pick('b')} />
          </View>
          {pa && pb ? (
            <View style={styles.odds}>
              <Text style={styles.oddsTitle}>Baby could be</Text>
              <Text style={styles.babyLine}>{Br.outcomes(pa, pb).map((o) => `${o.speciesId === '?' ? 'Surprise' : SPECIES_BY_ID[o.speciesId].name} ${Math.round(o.chance * 100)}%`).join(' · ')}</Text>
              <View style={styles.chips}>
                <View style={[styles.chip, { backgroundColor: '#F3EAFE' }]}>
                  <Text style={[styles.chipLabel, { color: '#7A49B8' }]}>LIKELY GRADE</Text>
                  <Text style={[styles.chipValue, { color: '#5B2E99' }]}>{(() => { const r = likelyGrade(ivsOf(pa), ivsOf(pb)); return r.low === r.high ? `${r.low}%` : `${r.low}–${r.high}%`; })()}</Text>
                </View>
                <View style={[styles.chip, { backgroundColor: '#FFE6F0' }]}>
                  <Text style={[styles.chipLabel, { color: '#9C4C77' }]}>SKIN</Text>
                  <Text style={[styles.chipValue, { color: '#7A2F57' }]}>{skinnedParents.length ? `${Math.round(INHERIT_CHANCE * 100)}%+` : `${skinChance}%`}</Text>
                </View>
                <View style={[styles.chip, { backgroundColor: '#FFF1C4' }]}>
                  <Text style={[styles.chipLabel, { color: '#9A6A00' }]}>LUCKY</Text>
                  <Text style={[styles.chipValue, { color: '#7A5200' }]}>{Math.round(LUCKY_CHANCE * 100)}%</Text>
                </View>
              </View>
              <Pressable onPress={() => setDetails((v) => !v)} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.detailsLink}>{details ? 'Hide details' : 'Details'}</Text>
              </Pressable>
              {details ? (
                <>
                  <GradePreview a={pa} b={pb} />
                  <Text style={font.small}>Skin chance is {skinChance}% (3× normal eggs). A Lucky egg gives +1 to +2 on every stat.</Text>
                  {skinnedParents.length ? (
                    <Text style={[font.small, { color: '#9C4C77', fontWeight: '800' }]}>
                      {skinnedParents.map((p) => `${p!.nickname} has a ${SKIN_INFO[p!.skin!].label} skin`).join(' and ')}: {Math.round(INHERIT_CHANCE * 100)}% chance each to pass it down.
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : (
            <Text style={font.small}>Pick two adult pets to make an egg.</Text>
          )}
          <Button primary label={`Make an egg (${Br.BREED_COST} coins)`} disabled={!a || !b} onPress={makeEgg} />
          {check && !check.ok ? <Text style={styles.msg}>{check.reason}</Text> : null}
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        </>
      )}
    </Card>
  );
}

/** What the baby gets: which parent is stronger in each stat, the likely grade, and the Lucky egg chance. */
function GradePreview({ a, b }: { a: { nickname: string } & Parameters<typeof ivsOf>[0]; b: { nickname: string } & Parameters<typeof ivsOf>[0] }) {
  const ia = ivsOf(a);
  const ib = ivsOf(b);
  const range = likelyGrade(ia, ib);
  return (
    <View style={styles.preview}>
      <Text style={styles.oddsTitle}>What the baby gets</Text>
      <View style={styles.statRow}>
        <Text style={[styles.statName, { color: colors.muted }]} />
        <Text style={styles.statHead} numberOfLines={1}>{a.nickname} · {gradeOf(a)}%</Text>
        <Text style={styles.statHead} numberOfLines={1}>{b.nickname} · {gradeOf(b)}%</Text>
      </View>
      {(['hp', 'atk', 'def', 'spd'] as const).map((k) => (
        <View key={k} style={styles.statRow}>
          <Text style={styles.statName}>{STAT_LABEL[k]}</Text>
          <Text style={[styles.statVal, ia[k] > ib[k] && styles.better]}>{ia[k]}{ia[k] > ib[k] ? ' ★' : ''}</Text>
          <Text style={[styles.statVal, ib[k] > ia[k] && styles.better]}>{ib[k]}{ib[k] > ia[k] ? ' ★' : ''}</Text>
        </View>
      ))}
      <Text style={styles.small}>★ = the stronger parent. Each stat has a {Math.round(INHERIT_BETTER * 100)}% chance to copy ★, {Math.round(INHERIT_OTHER * 100)}% to copy the other parent, and {Math.round((1 - INHERIT_BETTER - INHERIT_OTHER) * 100)}% to roll fresh.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  nest: { height: 150, alignItems: 'center', justifyContent: 'flex-end' },
  nestBowl: { position: 'absolute', bottom: 6, width: 170, height: 56, borderRadius: 85, backgroundColor: '#C99A6B', borderWidth: 5, borderColor: '#A87A4E' },
  nestTitle: { fontSize: 20, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  nestBar: { height: 12, borderRadius: 6, backgroundColor: '#FBD9E6', overflow: 'hidden' },
  nestFill: { height: '100%', borderRadius: 6, backgroundColor: '#FF8FB1' },
  reveal: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#2A1F3D', zIndex: 150 },
  rarBanner: { borderRadius: 18, paddingHorizontal: 24, paddingVertical: 10, transform: [{ rotate: '-4deg' }], alignItems: 'center', maxWidth: '92%' },
  luckyTop: { color: '#FFF6C9', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  rarBannerText: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', letterSpacing: 0.5 },
  revealSub: { color: '#FFE9A8', fontSize: 16, fontWeight: '700', textAlign: 'center', paddingHorizontal: 30 },
  revealCard: { margin: 16, marginBottom: 34, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, gap: 12 },
  revealCardText: { fontSize: 15, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  babyLine: { fontSize: 15, fontWeight: '700', color: colors.ink },
  detailsLink: { fontSize: 14, fontWeight: '700', color: '#9C4C77', textDecorationLine: 'underline' },
  preview: { marginTop: 6, gap: 4 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statName: { width: 64, fontSize: 12, fontWeight: '600', color: colors.ink },
  statHead: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.muted },
  statVal: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.ink },
  better: { fontWeight: '800', color: '#C9662A' },
  small: { fontSize: 12, fontWeight: '600', color: colors.muted },
  chips: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chip: { flex: 1, borderRadius: 12, padding: 8 },
  chipLabel: { fontSize: 12, fontWeight: '600' },
  chipValue: { fontSize: 17, fontWeight: '800' },
  luckyNote: { fontSize: 13, fontWeight: '600', color: '#9A6A00', textAlign: 'center' },
  parents: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  slot: { width: 120, minHeight: 140, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: '#F2A7C6', backgroundColor: '#FFFFFF', padding: 6 },
  slotFull: { borderStyle: 'solid', borderColor: '#E26AA0' },
  plus: { fontSize: 40, fontWeight: '300', color: '#E26AA0' },
  slotName: { fontWeight: '600', fontSize: 13, color: colors.ink },
  slotSub: { fontWeight: '600', fontSize: 12, color: colors.muted },
  heart: { fontSize: 30 },
  odds: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: space.sm, gap: 2 },
  oddsTitle: { fontWeight: '600', fontSize: 13, color: colors.ink },
  msg: { fontWeight: '600', fontSize: 13, color: '#C4562F' },
  made: { alignItems: 'center', gap: 6, paddingVertical: space.sm },
  madeTitle: { fontWeight: '800', fontSize: 17, color: '#7A2E58' },
});

const NEST_SPOTS = ['#FF8FB1', '#FFD6E5', '#FF8FB1', '#B18CFF'];

/** An egg nesting in the nursery: a countdown that steps shorten, then a big reveal when it's ready. */
function NestView({ egg }: { egg: Egg }) {
  const { state, apply } = useGame();
  const overlay = useOverlay();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);
  const left = Br.nestLeftMs(state);
  const total = Br.NEST_HOURS[egg.rarity] * 3_600_000;
  const ready = left <= 0;
  const [err, setErr] = useState<string | null>(null);
  const collect = () => {
    const r = Br.collectNest(state);
    if (!r) return;
    if ('error' in r) return setErr(r.error);
    buzz('heavy', 'special');
    apply(() => r.state);
    overlay.open(<NestReveal egg={r.egg} overflow={r.overflow} onClose={overlay.close} />);
  };
  return (
    <Card style={{ backgroundColor: '#FFF4F8', borderColor: '#F9C9DD' }}>
      <SectionHead title="Pet Nursery" meta={ready ? 'Ready!' : 'Nesting'} />
      <View style={styles.nest}>
        <View style={styles.nestBowl} />
        <View style={{ marginBottom: 18 }}>
          <EggSprite rarity="common" size={96} color="#FFF6F9" spots={NEST_SPOTS} />
        </View>
      </View>
      {ready ? (
        <>
          <Text style={styles.nestTitle}>Your egg is ready!</Text>
          <Button primary label="Collect the egg" onPress={collect} />
          {err ? <Text style={styles.msg}>{err}</Text> : null}
        </>
      ) : (
        <>
          <Text style={styles.nestTitle} accessibilityLiveRegion="polite">Ready in {formatLeft(left)}</Text>
          <View style={styles.nestBar}><View style={[styles.nestFill, { width: `${Math.round(Math.min(1, Math.max(0, 1 - left / total)) * 100)}%` }]} /></View>
          <Text style={[font.small, { textAlign: 'center' }]}>Walk to speed it up: every 1,000 steps takes 15 minutes off. Rarer eggs nest longer.</Text>
        </>
      )}
    </Card>
  );
}

function NestReveal({ egg, overflow, onClose }: { egg: Egg; overflow: boolean; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const info = RARITY_INFO[egg.rarity];
  const lucky = egg.bred?.lucky;
  return (
    <View style={styles.reveal}>
      <Confetti amount={egg.rarity === 'common' ? 40 : 80} width={width} height={height} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <Rays color={info.color} size={Math.min(width, 420)} />
        <PopIn from={0.3}><EggSprite rarity={egg.rarity} size={170} spots={NEST_SPOTS} /></PopIn>
        <PopIn delay={250}>
          <View style={[styles.rarBanner, { backgroundColor: info.color }]}>
            {lucky ? <Text style={styles.luckyTop}>LUCKY</Text> : null}
            <Text style={styles.rarBannerText} numberOfLines={1} adjustsFontSizeToFit>{info.label.toUpperCase()} EGG!</Text>
          </View>
        </PopIn>
        {lucky ? <Text style={styles.revealSub}>It shimmers! The baby gets +{lucky} on every stat.</Text> : null}
      </View>
      <View style={styles.revealCard}>
        <Text style={styles.revealCardText}>
          {overflow ? 'Your basket is full, so it’s waiting on the Eggs tab.' : `It’s in your basket. Nursery eggs hatch with half the walk: ${+(eggSteps(egg) / STEPS_PER_KM).toFixed(1)} km.`}
        </Text>
        <Button primary label="Nice!" onPress={onClose} />
      </View>
    </View>
  );
}
