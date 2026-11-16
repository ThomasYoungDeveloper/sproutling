import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useGame } from '../state/GameContext';
import { useOverlay } from './Overlay';
import PetPicker from './PetPicker';
import PetSprite from './PetSprite';
import EggSprite from './EggSprite';
import { ItemIcon } from './Cosmetics';
import { Button } from './ui';
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

/** Choose where to send a pet. */
function PlaceSheet({ onPick, onClose }: { onPick: (place: Ex.Place) => void; onClose: () => void }) {
  const { state } = useGame();
  const [msg, setMsg] = useState<string | null>(null);
  const best = Math.max(1, ...state.pets.map((p) => levelFor(p.xp)));
  return (
    <View style={styles.dim}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.bottomSheet}>
        <View style={styles.grab} />
        <Text style={font.title}>🧭 Expeditions</Text>
        <Text style={font.small}>Send a pet on an adventure. They come back with coins, treasure and a story. Walking brings them home sooner.</Text>
        <View style={styles.places}>
          {Ex.PLACES.map((pl) => {
            const locked = best < pl.minLevel;
            return (
              <Pressable
                key={pl.id}
                onPress={() => (locked ? setMsg(`Reach level ${pl.minLevel} with a pet to unlock ${pl.name}.`) : onPick(pl))}
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
        <Button label="Close" onPress={onClose} />
      </View>
    </View>
  );
}

/** Where your pet is right now, with the option to call it home early. */
function TripSheet({ onClose }: { onClose: () => void }) {
  const { state, apply } = useGame();
  const [confirmRecall, setConfirmRecall] = useState(false);
  const prog = Ex.progress(state);
  const pet = state.expedition ? state.pets.find((p) => p.id === state.expedition!.petId) : undefined;
  if (!prog || !pet) return null;
  return (
    <View style={styles.dim}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.bottomSheet}>
        <View style={styles.grab} />
        <Text style={font.title}>{prog.place.emoji} {pet.nickname} at {prog.place.name}</Text>
        <Walker speciesId={pet.speciesId} xp={pet.xp} hat={pet.look?.hat} pct={prog.pct} />
        <Text style={font.body}>
          Home in {Ex.formatLeft(prog.msLeft)}, or walk {prog.stepsLeft.toLocaleString()} more steps to bring {pet.nickname} back sooner. 👟
        </Text>
        <Pressable
          onPress={() => {
            if (!confirmRecall) {
              setConfirmRecall(true);
              setTimeout(() => setConfirmRecall(false), 3000);
              return;
            }
            apply(Ex.recall);
            onClose();
          }}
        >
          <Text style={styles.recall}>{confirmRecall ? 'Tap again to call them home (no loot)' : 'Call home early'}</Text>
        </Pressable>
        <Button primary label="OK" onPress={onClose} />
      </View>
    </View>
  );
}

/** One compact row on Home: who's out exploring, or a way to send someone. */
export default function ExpeditionCard() {
  const { state, apply } = useGame();
  const { open, close } = useOverlay();
  const [, tick] = useState(0);
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
    const sp = SPECIES_BY_ID[pet.speciesId];
    if (prog.done) {
      return (
        <PopIn>
          <Pressable onPress={collect} style={({ pressed }) => [styles.row, styles.rowDone, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button" accessibilityLabel={`${pet.nickname} is back from ${prog.place.name}. See what they found`}>
            <PetSprite species={sp} stage={stageFor(pet.xp)} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{pet.nickname} is back!</Text>
              <Text style={styles.rowSub}>Home from {prog.place.name} with treasure</Text>
            </View>
            <View style={styles.openBtn}><Text style={styles.openText}>Open</Text></View>
          </Pressable>
        </PopIn>
      );
    }
    return (
      <Pressable onPress={() => open(<TripSheet onClose={close} />)} style={({ pressed }) => [styles.row, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button" accessibilityLabel={`${pet.nickname} is at ${prog.place.name}, home in ${Ex.formatLeft(prog.msLeft)}`}>
        <PetSprite species={sp} stage={stageFor(pet.xp)} size={42} />
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>{pet.nickname} is at {prog.place.name}</Text>
          <View style={styles.bar}><View style={[styles.barFill, { width: `${Math.round(prog.pct * 100)}%` }]} /></View>
        </View>
        <Text style={styles.left}>{Ex.formatLeft(prog.msLeft)}</Text>
        <Text style={styles.chev}>›</Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={() => open(<PlaceSheet onPick={pickPet} onClose={close} />)} style={({ pressed }) => [styles.row, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button" accessibilityLabel="Send a pet on an expedition">
      <Text style={{ fontSize: 26 }}>🧭</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>Send a pet on an adventure</Text>
        <Text style={styles.rowSub}>Coins, treasure and a story</Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  rowDone: { backgroundColor: '#FFF6DD', borderColor: colors.gold, borderWidth: 2 },
  rowTitle: { fontSize: 15, fontWeight: '900', color: colors.ink },
  rowSub: { fontSize: 12, fontWeight: '800', color: colors.muted },
  bar: { height: 6, borderRadius: 999, backgroundColor: '#E8EEEC', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999, backgroundColor: '#3D8FD6' },
  left: { fontSize: 13, fontWeight: '900', color: colors.muted },
  chev: { fontSize: 24, fontWeight: '900', color: colors.muted, marginTop: -2 },
  openBtn: { backgroundColor: '#E8590C', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  openText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.5)', justifyContent: 'flex-end', alignItems: 'center', zIndex: 50 },
  bottomSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.lg, paddingTop: 10, gap: space.sm, width: '100%', maxWidth: 520 },
  grab: { width: 44, height: 5, borderRadius: 999, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 4 },
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
