import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../state/GameContext';
import PetSprite from './PetSprite';
import { Button } from './ui';
import { buzz, PopIn } from './fx';
import { colors, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { stageFor } from '../game/scoring';
import { SKIN_INFO } from '../game/skins';
import * as Dy from '../game/dyes';
import type { Skin } from '../game/types';

/** Three colors per dye: light, middle, dark (for the bottle swirl). */
export const DYE_COLORS: Partial<Record<Skin, [string, string, string]>> = {
  pastel: ['#FFD6EA', '#C9B8FF', '#7FD9B6'],
  mono: ['#FFFFFF', '#9A9AA8', '#2A2A36'],
  retro: ['#D8F07A', '#8DBA2A', '#2F5A12'],
  sakura: ['#FFC2D6', '#F27BA6', '#B24A8A'],
  ocean: ['#9BF0E6', '#3BB0D6', '#1E5C9A'],
  ember: ['#FFD36B', '#E2302A', '#8C0C12'],
  moonlit: ['#C8CCFF', '#6E74D6', '#2A2E80'],
  crystal: ['#FFFFFF', '#9EC2FF', '#4A6ED6'],
  shadow: ['#B98CFF', '#4A2E80', '#120A20'],
  galaxy: ['#FF8AD8', '#7E4FD6', '#1E2A80'],
  ancient: ['#F0C75A', '#6A3AA8', '#2A1046'],
  slime: ['#D2FF86', '#5CC42A', '#1D6A14'],
  harvest: ['#FFC86E', '#D25C1C', '#78300E'],
};

/** Bottle art for each dye (from the Mad Scientist Laboratory pack; see scripts/make_bottles2.py). The liquid matches the skin. */
const DYE_IMAGES: Partial<Record<Skin, number>> = {
  pastel: require('../../assets/dyes/pastel.png'),
  mono: require('../../assets/dyes/mono.png'),
  retro: require('../../assets/dyes/retro.png'),
  slime: require('../../assets/dyes/slime.png'),
  sakura: require('../../assets/dyes/sakura.png'),
  ocean: require('../../assets/dyes/ocean.png'),
  ember: require('../../assets/dyes/ember.png'),
  moonlit: require('../../assets/dyes/moonlit.png'),
  crystal: require('../../assets/dyes/crystal.png'),
  shadow: require('../../assets/dyes/shadow.png'),
  galaxy: require('../../assets/dyes/galaxy.png'),
  ancient: require('../../assets/dyes/ancient.png'),
  harvest: require('../../assets/dyes/harvest.png'),
};

/** A dye bottle: its liquid shows the skin (Shadow holds shadow, Galaxy holds stars), its shape shows the rarity. */
export function DyeIcon({ skin, size = 40 }: { skin: Skin; size?: number }) {
  const src = DYE_IMAGES[skin];
  const h = size * 1.25;
  if (!src) return <View style={{ width: h, height: h }} />;
  return <Image source={src} style={{ width: h, height: h }} resizeMode="contain" accessibilityIgnoresInvertColors />;
}

export function RarityTag({ rarity }: { rarity: Dy.DyeRarity }) {
  return (
    <View style={[styles.tag, { backgroundColor: Dy.DYE_RARITY_COLOR[rarity] }]}>
      <Text style={styles.tagText}>{Dy.DYE_RARITY_LABEL[rarity].toUpperCase()}</Text>
    </View>
  );
}

/** Pick a pet for a dye: shows the pet before and after, then uses it. */
export function UseDyeSheet({ skin, onClose }: { skin: Skin; onClose: () => void }) {
  const { state, apply } = useGame();
  const [pick, setPick] = useState<string | null>(state.activePetId ?? state.pets[0]?.id ?? null);
  const [done, setDone] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const pet = state.pets.find((p) => p.id === pick);
  const sp = pet ? SPECIES_BY_ID[pet.speciesId] : undefined;
  const info = SKIN_INFO[skin];
  const have = Dy.dyesOwned(state, skin);
  const replaces = pet?.skin && pet.skin !== skin ? SKIN_INFO[pet.skin].label : null;

  const use = () => {
    if (!pet) return;
    const r = Dy.useDye(state, pet.id, skin);
    if (!r.ok) {
      buzz('light');
      return setMsg(r.reason);
    }
    buzz('success', 'levelup');
    apply(() => r.state);
    setDone(pet.nickname);
  };

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <Text style={styles.kicker}>{info.label.toUpperCase()} DYE</Text>
        {done && pet && sp ? (
          <PopIn>
            <View style={{ alignItems: 'center', gap: space.sm }}>
              <Text style={styles.title}>{done} has the {info.label} look!</Text>
              <View style={[styles.after, { borderColor: info.color }]}>
                <PetSprite species={sp} stage={stageFor(pet.xp)} size={150} skin={skin} hat={pet.look?.hat} noShadow />
              </View>
              <Text style={styles.body}>It’s theirs to keep.</Text>
              <Button primary label="Yay!" onPress={onClose} style={{ alignSelf: 'stretch' }} />
            </View>
          </PopIn>
        ) : (
          <>
            <Text style={styles.title}>Give a pet the {info.label} look</Text>
            <Text style={styles.body}>It’s theirs to keep. One dye, one pet, so choose wisely. You have {have}.</Text>
            {pet && sp ? (
              <View style={styles.compare}>
                <View style={styles.col}>
                  <View style={styles.before}><PetSprite species={sp} stage={stageFor(pet.xp)} size={110} skin={pet.skin} noShadow /></View>
                  <Text style={styles.colLabel}>Now</Text>
                </View>
                <Text style={styles.arrow}>›</Text>
                <View style={styles.col}>
                  <View style={[styles.before, { backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: info.color }]}><PetSprite species={sp} stage={stageFor(pet.xp)} size={110} skin={skin} noShadow /></View>
                  <Text style={[styles.colLabel, { color: info.color }]}>{info.label}</Text>
                </View>
              </View>
            ) : null}
            {replaces ? <Text style={[styles.body, { color: '#B5462E' }]}>This replaces {pet?.nickname}’s {replaces} skin.</Text> : null}
            <Text style={styles.section}>Choose a pet</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {state.pets.map((p) => {
                const s2 = SPECIES_BY_ID[p.speciesId];
                if (!s2) return null;
                const on = p.id === pick;
                return (
                  <Pressable key={p.id} onPress={() => setPick(p.id)} style={[styles.petTile, on && { borderColor: info.color }]} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={p.nickname}>
                    <PetSprite species={s2} stage={stageFor(p.xp)} size={58} skin={p.skin} noShadow />
                    <Text style={styles.petName} numberOfLines={1}>{p.nickname}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {msg ? <Text style={styles.msg}>{msg}</Text> : null}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button label="Not now" onPress={onClose} style={{ flex: 1 }} />
              <Button primary label={pet ? `Use on ${pet.nickname}` : 'Pick a pet'} onPress={use} disabled={!pet || have < 1} style={{ flex: 1.6 }} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.6)', justifyContent: 'center', alignItems: 'center', padding: space.md, zIndex: 85 },
  sheet: { backgroundColor: '#FFFCF5', borderRadius: 24, padding: space.lg, gap: space.sm, width: '100%', maxWidth: 460 },
  kicker: { fontSize: 12, fontWeight: '900', color: '#B06A00', letterSpacing: 1.5 },
  title: { fontSize: 22, fontWeight: '900', color: colors.ink },
  body: { fontSize: 14, fontWeight: '700', color: colors.muted },
  compare: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginVertical: 4 },
  col: { alignItems: 'center', gap: 4 },
  before: { width: 130, height: 130, borderRadius: 20, backgroundColor: '#EEF3F1', alignItems: 'center', justifyContent: 'center' },
  after: { width: 190, height: 190, borderRadius: 26, borderWidth: 4, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  colLabel: { fontSize: 13, fontWeight: '900', color: colors.ink },
  arrow: { fontSize: 28, fontWeight: '900', color: '#B06A00' },
  section: { fontSize: 15, fontWeight: '900', color: colors.ink, marginTop: 4 },
  petTile: { width: 82, alignItems: 'center', padding: 6, borderRadius: 14, borderWidth: 3, borderColor: 'transparent', backgroundColor: '#F1F4F2' },
  petName: { fontSize: 12, fontWeight: '900', color: colors.ink },
  msg: { fontSize: 13, fontWeight: '800', color: '#B5462E', textAlign: 'center' },
  tag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  tagText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
});
