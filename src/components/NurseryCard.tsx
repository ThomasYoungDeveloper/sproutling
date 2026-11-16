import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { RARITY_INFO } from '../game/rarity';
import { formatLeft } from '../game/expedition';
import * as Br from '../game/breeding';
import type { Egg } from '../game/types';

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
          <Text style={styles.slotSub}>Lv {levelFor(pet.xp)}{pet.skin ? ` · ${SKIN_INFO[pet.skin].emoji}` : ''}</Text>
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

  const adults = state.pets.filter((p) => levelFor(p.xp) >= Br.ADULT_LEVEL);
  const best = Math.max(1, ...state.pets.map((p) => levelFor(p.xp)));

  if (adults.length < 2) {
    return (
      <Card>
        <SectionHead title="💞 Pet Nursery" meta={`Unlocks with 2 adults`} />
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
    setMade({ egg: r.egg, surprise: r.surprise });
    setMsg(null);
    setA(null);
    setB(null);
  };

  return (
    <Card style={{ backgroundColor: '#FFF4F8', borderColor: '#F9C9DD' }}>
      {made ? <Confetti key={made.egg.id} amount={40} width={400} height={400} colors={['#FF8FB1', '#FFD6E5', '#FFE27A', '#B18CFF']} /> : null}
      <SectionHead title="💞 Pet Nursery" meta={`${adults.length} adults ready`} />
      {made ? (
        <PopIn>
          <View style={styles.made}>
            <EggSprite rarity={made.egg.rarity} size={90} spots={['#FF8FB1', '#FFD6E5', '#FF8FB1', '#B18CFF']} />
            <Text style={styles.madeTitle}>A new {RARITY_INFO[made.egg.rarity].label.toLowerCase()} egg! 💕</Text>
            <Text style={[font.small, { textAlign: 'center' }]}>Put it in an incubator on the Eggs tab and walk to hatch it. Who knows what skin it’ll have!</Text>
            <Button small label="Make another" onPress={() => setMade(null)} />
          </View>
        </PopIn>
      ) : (
        <>
          <View style={styles.parents}>
            <Slot petId={a} label="Parent 1" onPress={() => pick('a')} />
            <Text style={styles.heart}>💞</Text>
            <Slot petId={b} label="Parent 2" onPress={() => pick('b')} />
          </View>
          {pa && pb ? (
            <View style={styles.odds}>
              <Text style={styles.oddsTitle}>The baby could be:</Text>
              {Br.outcomes(pa, pb).map((o) => (
                <Text key={o.speciesId} style={font.small}>
                  {o.speciesId === '?' ? '✨ A surprise pet of the same element' : SPECIES_BY_ID[o.speciesId].name} · {Math.round(o.chance * 100)}%
                </Text>
              ))}
              <Text style={font.small}>🎨 Skin chance: {skinChance}% (3× normal eggs)</Text>
              {skinnedParents.length ? (
                <Text style={[font.small, { color: '#9C4C77', fontWeight: '800' }]}>
                  {skinnedParents.map((p) => `${p!.nickname} has a ${SKIN_INFO[p!.skin!].label} skin`).join(' and ')}: {Math.round(INHERIT_CHANCE * 100)}% chance each to pass it down!
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={font.small}>Pick two adult pets. Their baby is usually one of their species, with a 10% chance of a surprise!</Text>
          )}
          <Button primary label={`💞 Make an egg (● ${Br.BREED_COST})`} disabled={!a || !b} onPress={makeEgg} />
          {check && !check.ok ? <Text style={styles.msg}>{check.reason}</Text> : null}
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  parents: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  slot: { width: 120, minHeight: 140, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: '#F2A7C6', backgroundColor: '#FFFFFF', padding: 6 },
  slotFull: { borderStyle: 'solid', borderColor: '#E26AA0' },
  plus: { fontSize: 40, fontWeight: '300', color: '#E26AA0' },
  slotName: { fontWeight: '900', fontSize: 13, color: colors.ink },
  slotSub: { fontWeight: '700', fontSize: 11, color: colors.muted },
  heart: { fontSize: 30 },
  odds: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: space.sm, gap: 2 },
  oddsTitle: { fontWeight: '900', fontSize: 13, color: colors.ink },
  msg: { fontWeight: '800', fontSize: 13, color: '#C4562F' },
  made: { alignItems: 'center', gap: 6, paddingVertical: space.sm },
  madeTitle: { fontWeight: '900', fontSize: 17, color: '#7A2E58' },
});
