import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useGame } from '../state/GameContext';
import { useOverlay } from './Overlay';
import PetPicker from './PetPicker';
import PetSprite from './PetSprite';
import EggSprite from './EggSprite';
import { ItemIcon } from './Cosmetics';
import { Button, Card, SectionHead } from './ui';
import { buzz, Confetti, PopIn, Rays } from './fx';
import { colors, font, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { levelFor, stageFor } from '../game/scoring';
import { COSMETIC_BY_ID } from '../game/cosmetics';
import { RARITY_INFO } from '../game/rarity';
import * as Ex from '../game/expedition';

/** The pet walking along the trail while it explores. */
function Walker({ speciesId, xp, hat, pct }: { speciesId: string; xp: number; hat?: string; pct: number }) {
  const step = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(step, { toValue: 1, duration: 320, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(step, { toValue: 0, duration: 320, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const sp = SPECIES_BY_ID[speciesId];
  return (
    <View style={styles.trail}>
      <View style={styles.path} />
      <View style={[styles.pathDone, { width: `${Math.round(pct * 100)}%` }]} />
      <Animated.View style={{ position: 'absolute', bottom: 6, left: `${Math.min(86, pct * 100)}%`, marginLeft: -4, transform: [{ translateY: step.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }, { rotate: step.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] }) }] }}>
        <PetSprite species={sp} stage={stageFor(xp)} size={58} hat={hat} />
      </Animated.View>
    </View>
  );
}

function ReturnSheet({ loot, onClose }: { loot: Ex.ExpeditionLoot; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const sp = SPECIES_BY_ID[loot.speciesId];
  return (
    <View style={styles.backdrop}>
      <Confetti amount={60} width={width} height={height} />
      <View style={styles.sheet}>
        <Text style={[font.title, { textAlign: 'center' }]}>Welcome home, {loot.petName}!</Text>
        <View style={{ alignItems: 'center', height: 190, justifyContent: 'center' }}>
          <Rays color={colors.gold} size={240} />
          <PopIn from={0.2}>
            <PetSprite species={sp} stage="adult" size={170} mood="joy" />
          </PopIn>
        </View>
        <PopIn delay={250}>
          <Text style={styles.story}>{loot.story}</Text>
        </PopIn>
        <View style={styles.lootRow}>
          <PopIn delay={400}><View style={styles.loot}><Text style={styles.lootBig}>🪙 +{loot.coins}</Text></View></PopIn>
          <PopIn delay={500}><View style={styles.loot}><Text style={styles.lootBig}>⭐ +{loot.xp} XP</Text></View></PopIn>
          {loot.chest ? <PopIn delay={600}><View style={styles.loot}><Text style={styles.lootBig}>🎁 {loot.chest[0].toUpperCase() + loot.chest.slice(1)} chest</Text></View></PopIn> : null}
          {loot.egg ? (
            <PopIn delay={700}>
              <View style={[styles.loot, { flexDirection: 'row', gap: 4, alignItems: 'center' }]}>
                <EggSprite rarity={loot.egg} size={26} />
                <Text style={[styles.lootBig, { color: RARITY_INFO[loot.egg].color }]}>{RARITY_INFO[loot.egg].label} egg</Text>
              </View>
            </PopIn>
          ) : null}
          {loot.item ? <PopIn delay={800}><View style={styles.loot}><Text style={styles.lootBig}>✦ {loot.item}</Text></View></PopIn> : null}
          {loot.cosmetic && COSMETIC_BY_ID[loot.cosmetic] ? (
            <PopIn delay={900}>
              <View style={[styles.loot, { flexDirection: 'row', gap: 4, alignItems: 'center' }]}>
                <ItemIcon id={loot.cosmetic} size={30} />
                <Text style={styles.lootBig}>{COSMETIC_BY_ID[loot.cosmetic].name}</Text>
              </View>
            </PopIn>
          ) : null}
        </View>
        <Button primary label="Yay!" onPress={onClose} />
      </View>
    </View>
  );
}

export default function ExpeditionCard() {
  const { state, apply } = useGame();
  const { open, close } = useOverlay();
  const [, tick] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmRecall, setConfirmRecall] = useState(false);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const prog = Ex.progress(state);
  const pet = state.expedition ? state.pets.find((p) => p.id === state.expedition!.petId) : undefined;

  const pickPet = (place: Ex.Place) =>
    open(
      <PetPicker
        title={`Explore ${place.name} ${place.emoji}`}
        subtitle={`Takes ${place.hours} hour${place.hours > 1 ? 's' : ''}, or walk ${place.steps.toLocaleString()} steps to bring them home sooner. Pets need level ${place.minLevel}+.`}
        pets={[...state.pets]
          .sort((a, b) => b.xp - a.xp)
          .map((p) => ({ pet: p, disabled: levelFor(p.xp) < place.minLevel ? `${p.nickname} needs to be level ${place.minLevel} for ${place.name}.` : undefined }))}
        initial={[...state.pets].sort((a, b) => b.xp - a.xp).filter((p) => levelFor(p.xp) >= place.minLevel).slice(0, 1).map((p) => p.id)}
        confirmLabel={() => 'Off you go!'}
        onConfirm={([id]) => {
          buzz('success');
          apply((s) => Ex.start(s, id, place.id));
          close();
        }}
        onClose={close}
      />,
    );

  const collect = () => {
    const r = Ex.finish(state);
    if (!r) return;
    buzz('success');
    apply(() => r.state);
    open(<ReturnSheet loot={r.loot} onClose={close} />);
  };

  if (prog && pet) {
    return (
      <Card style={prog.done ? { borderColor: colors.gold, backgroundColor: '#FFFBEF' } : undefined}>
        <SectionHead title={`${prog.place.emoji} ${prog.place.name}`} meta={prog.done ? 'Back home!' : 'Exploring'} />
        <Walker speciesId={pet.speciesId} xp={pet.xp} hat={pet.look?.hat} pct={prog.pct} />
        {prog.done ? (
          <PopIn>
            <Button primary label={`🎒 See what ${pet.nickname} found!`} onPress={collect} />
          </PopIn>
        ) : (
          <>
            <Text style={font.small}>
              {pet.nickname} is home in {Ex.formatLeft(prog.msLeft)}, or walk {prog.stepsLeft.toLocaleString()} more steps to bring them back sooner. 👟
            </Text>
            <Pressable
              onPress={() => {
                if (!confirmRecall) {
                  setConfirmRecall(true);
                  setTimeout(() => setConfirmRecall(false), 3000);
                  return;
                }
                apply(Ex.recall);
              }}
            >
              <Text style={styles.recall}>{confirmRecall ? 'Tap again to call them home (no loot)' : 'Call home early'}</Text>
            </Pressable>
          </>
        )}
      </Card>
    );
  }

  const best = Math.max(1, ...state.pets.map((p) => levelFor(p.xp)));
  return (
    <Card>
      <SectionHead title="🧭 Expeditions" meta="Walk to bring them home faster" />
      <Text style={font.small}>Send a pet on an adventure. They come back with coins, treasure and a story.</Text>
      <View style={styles.places}>
        {Ex.PLACES.map((pl) => {
          const locked = best < pl.minLevel;
          return (
            <Pressable
              key={pl.id}
              onPress={() => (locked ? setMsg(`Reach level ${pl.minLevel} with a pet to unlock ${pl.name}.`) : pickPet(pl))}
              style={({ pressed }) => [styles.place, locked && { opacity: 0.5 }, pressed && !locked && { transform: [{ scale: 0.97 }] }]}
              accessibilityRole="button"
              accessibilityLabel={`${pl.name}${locked ? `, unlocks at level ${pl.minLevel}` : ''}`}
            >
              <Text style={{ fontSize: 28 }}>{locked ? '🔒' : pl.emoji}</Text>
              <Text style={styles.placeName}>{pl.name}</Text>
              <Text style={styles.placeSub}>{locked ? `Level ${pl.minLevel}+` : `${pl.hours}h or ${(pl.steps / 1000).toLocaleString()}k steps`}</Text>
            </Pressable>
          );
        })}
      </View>
      {msg ? <Text style={[font.small, { color: '#C4562F' }]}>{msg}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  trail: { height: 76, justifyContent: 'flex-end' },
  path: { position: 'absolute', left: 0, right: 0, bottom: 8, height: 8, borderRadius: 4, backgroundColor: '#E7EEEA' },
  pathDone: { position: 'absolute', left: 0, bottom: 8, height: 8, borderRadius: 4, backgroundColor: '#BDE5CF' },
  recall: { fontSize: 12, fontWeight: '800', color: colors.muted, textDecorationLine: 'underline' },
  places: { flexDirection: 'row', flexWrap: 'wrap', gap: '3%', rowGap: space.sm },
  place: { width: '48.5%', alignItems: 'center', gap: 2, padding: space.sm, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, backgroundColor: '#FAFCFB' },
  placeName: { fontWeight: '900', fontSize: 14, color: colors.ink },
  placeSub: { fontWeight: '700', fontSize: 11, color: colors.muted },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(22,28,46,0.92)', justifyContent: 'center', alignItems: 'center', padding: space.lg },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: space.lg, gap: space.sm, width: '100%', maxWidth: 420 },
  story: { fontSize: 16, fontWeight: '700', color: colors.ink, textAlign: 'center', lineHeight: 22 },
  lootRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginVertical: space.xs },
  loot: { backgroundColor: '#FFF6DD', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5, borderColor: colors.gold },
  lootBig: { fontWeight: '900', fontSize: 14, color: '#5A3E00' },
});
