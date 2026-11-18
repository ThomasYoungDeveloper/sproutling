import { CoinText } from './Coin';
import React, { useEffect, useRef, useState } from 'react';
import * as H from '../game/hp';
import { FOOD_BY_ID } from '../game/food';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
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

/** Each place has its own look on the Home card. */
const THEME: Record<string, { sky: [string, string]; ground: string; ink: string; sub: string; deco: (w: number) => React.ReactNode }> = {
  meadow: {
    sky: ['#9FE0B6', '#5DB57A'], ground: '#3F8F5A', ink: '#FFFFFF', sub: '#E6FFEF',
    deco: (w) => [0.12, 0.3, 0.7, 0.88].map((x, i) => <Circle key={i} cx={w * x} cy={112 - (i % 2) * 6} r={5} fill={['#FFE27A', '#FF9EB5', '#FFFFFF', '#FFE27A'][i]} />),
  },
  caves: {
    sky: ['#2B2050', '#4A3A86'], ground: '#1C1538', ink: '#FFFFFF', sub: '#E6DEFF',
    deco: (w) => [
      <Path key="a" d="M20 116l8-30 8 30z" fill="#7FE7FF" stroke="#2AA7D6" strokeWidth={2} />,
      <Path key="b" d="M40 118l5-18 5 18z" fill="#B9A6FF" stroke="#7A5FD6" strokeWidth={2} />,
      <Path key="c" d={`M${w - 70} 112l9-34 9 34z`} fill="#FF9EE0" stroke="#D65FB0" strokeWidth={2} />,
      <Path key="d" d={`M${w - 46} 114l6-20 6 20z`} fill="#7FE7FF" stroke="#2AA7D6" strokeWidth={2} />,
      <Path key="e" d={`M0 0h${w}v24c-30 10-50 24-90 16s-50-16-90-6-60 18-100 10S40 22 0 30z`} fill="#1C1538" />,
    ],
  },
  shrine: {
    sky: ['#FFD6E6', '#F59AB8'], ground: '#B8607E', ink: '#4A1730', sub: '#6E2A48',
    deco: (w) => [
      <Rect key="a" x={w - 96} y={52} width={66} height={8} rx={2} fill="#D93C3C" />,
      <Rect key="b" x={w - 102} y={44} width={78} height={8} rx={3} fill="#D93C3C" />,
      <Rect key="c" x={w - 88} y={52} width={7} height={58} fill="#D93C3C" />,
      <Rect key="d" x={w - 50} y={52} width={7} height={58} fill="#D93C3C" />,
      ...[0.1, 0.42, 0.6].map((x, i) => <Circle key={'p' + i} cx={w * x} cy={20 + i * 18} r={4} fill="#FFFFFF" opacity={0.8} />),
    ],
  },
  mountain: {
    sky: ['#1E2A5A', '#3E4E9A'], ground: '#2A2F5E', ink: '#FFFFFF', sub: '#DDE3FF',
    deco: (w) => [
      <Circle key="m" cx={w - 60} cy={34} r={18} fill="#FFF6D6" />,
      <Path key="mt" d={`M${w * 0.45} 120 L${w * 0.68} 50 L${w * 0.9} 120z`} fill="#4A5AA8" />,
      <Path key="snow" d={`M${w * 0.62} 68 L${w * 0.68} 50 L${w * 0.74} 68 L${w * 0.7} 64 L${w * 0.66} 70z`} fill="#FFFFFF" />,
      ...[0.1, 0.25, 0.4].map((x, i) => <Circle key={'s' + i} cx={w * x} cy={20 + (i % 2) * 22} r={1.8} fill="#FFFFFF" />),
    ],
  },
};

/** The place as a picture behind the pet on the return screen (same look as the Home card). */
function PlaceHeader({ placeId, children }: { placeId: string; children: React.ReactNode }) {
  const [w, setW] = useState(0);
  const t = THEME[placeId] ?? THEME.meadow;
  return (
    <View onLayout={(e) => setW(Math.ceil(e.nativeEvent.layout.width))} style={[styles.placeHead, { backgroundColor: t.sky[1] }]}>
      {w > 0 ? (
        <Svg width={w} height={170} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`home-${placeId}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={t.sky[0]} />
              <Stop offset="1" stopColor={t.sky[1]} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={w} height={170} fill={`url(#home-${placeId})`} />
          {t.deco(w)}
          <Path d={`M0 170V128c${w * 0.1}-8 ${w * 0.2} 4 ${w * 0.3}-2s${w * 0.18}-14 ${w * 0.3}-8 ${w * 0.2} 12 ${w * 0.4} 6V170z`} fill={t.ground} />
        </Svg>
      ) : null}
      <View style={{ alignItems: 'center', justifyContent: 'flex-end', height: 170, paddingBottom: 6 }}>{children}</View>
    </View>
  );
}

/** The trip as a little scene: the place's colors, its landmarks, and the pet walking the trail home. */
function TripScene({ placeId, speciesId, xp, hat, pct, title, pill, foot, onPress, label, done }: { placeId: string; speciesId: string; xp: number; hat?: string; pct: number; title: string; pill: string; foot: string; onPress: () => void; label: string; done?: boolean }) {
  const [w, setW] = useState(0);
  const t = THEME[placeId] ?? THEME.meadow;
  const step = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(step, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(step, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  const sp = SPECIES_BY_ID[speciesId];
  const x = 20 + Math.min(0.9, pct) * Math.max(0, w - 90);
  return (
    <Pressable onPress={onPress} onLayout={(e) => setW(Math.ceil(e.nativeEvent.layout.width))} style={({ pressed }) => [styles.scene, { backgroundColor: t.sky[1] }, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button" accessibilityLabel={label}>
      {w > 0 ? (
        <Svg width={w} height={150} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`trip-${placeId}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={t.sky[0]} />
              <Stop offset="1" stopColor={t.sky[1]} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={w} height={150} fill={`url(#trip-${placeId})`} />
          {t.deco(w)}
          <Path d={`M0 150V116c${w * 0.1}-8 ${w * 0.2} 4 ${w * 0.3}-2s${w * 0.18}-14 ${w * 0.3}-8 ${w * 0.2} 12 ${w * 0.4} 6V150z`} fill={t.ground} />
          <Path d={`M20 126 Q${w * 0.35} 108 ${w * 0.55} 122 T${w - 26} 118`} fill="none" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={3} strokeDasharray="2 9" strokeLinecap="round" />
          <Circle cx={w - 26} cy={118} r={9} fill="#FFE27A" stroke="#FFFFFF" strokeWidth={2} />
        </Svg>
      ) : null}
      {w > 0 ? (
        <Animated.View style={{ position: 'absolute', left: done ? w - 96 : x, top: 62, transform: [{ translateY: step.interpolate({ inputRange: [0, 1], outputRange: [0, done ? -10 : -6] }) }] }}>
          <PetSprite species={sp} stage={stageFor(xp)} size={58} hat={hat} mood={done ? 'joy' : undefined} />
        </Animated.View>
      ) : null}
      <View style={styles.sceneHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.sceneKicker, { color: t.sub }]}>ADVENTURE</Text>
          <Text style={[styles.sceneTitle, { color: t.ink }]} numberOfLines={1}>{title}</Text>
        </View>
        <View style={[styles.scenePill, done && { backgroundColor: '#FFE27A' }]}>
          <Text style={[styles.scenePillText, done && { color: '#5A2A0A' }]}>{pill}</Text>
        </View>
      </View>
      <Text style={[styles.sceneFoot, { color: t.sub }]} numberOfLines={1}>{foot}</Text>
    </Pressable>
  );
}

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
      {loot.knockedOut ? null : <Confetti amount={60} width={width} height={height} />}
      <View style={styles.sheet}>
        <Text style={[font.title, { textAlign: 'center' }]}>{loot.knockedOut ? `${loot.petName} was knocked out` : `Welcome home, ${loot.petName}!`}</Text>
        <PlaceHeader placeId={loot.placeId}>
          {loot.knockedOut ? null : <View style={{ position: 'absolute', top: 0 }}><Rays color={colors.gold} size={200} /></View>}
          <PopIn from={0.2}>
            <View style={loot.knockedOut ? { opacity: 0.6 } : undefined}>
              <PetSprite species={sp} stage="adult" size={loot.knockedOut ? 120 : 140} mood={loot.knockedOut ? 'sleepy' : 'joy'} />
            </View>
          </PopIn>
        </PlaceHeader>
        <PopIn delay={250}>
          <Text style={styles.story}>{loot.story}</Text>
        </PopIn>
        {loot.fights.length ? (
          <View style={styles.fights}>
            <Text style={styles.fightsHead}>{loot.placeName.toUpperCase()}</Text>
            {loot.fights.map((f, i) => (
              <View key={i} style={styles.fightRow}>
                <Text style={styles.fightName}>Fight {i + 1} · {f.name}</Text>
                <Text style={[styles.fightRes, { color: f.won ? colors.mintDark : '#C4562F' }]}>{f.won ? `Won · ${f.hpAfter}% HP left` : 'Knocked out'}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.lootRow}>
          {loot.coins > 0 ? <PopIn delay={400}><View style={styles.loot}><CoinText size={22} style={styles.lootBig}>+{loot.coins}</CoinText></View></PopIn> : null}
          {loot.xp > 0 ? <PopIn delay={500}><View style={styles.loot}><Text style={styles.lootBig}>⭐ +{loot.xp} XP</Text></View></PopIn> : null}
          {loot.chest ? <PopIn delay={600}><View style={styles.loot}><Text style={styles.lootBig}>🎁 {loot.chest[0].toUpperCase() + loot.chest.slice(1)} chest</Text></View></PopIn> : null}
          {loot.egg ? (
            <PopIn delay={700}>
              <View style={[styles.loot, { flexDirection: 'row', gap: 4, alignItems: 'center' }]}>
                <EggSprite rarity={loot.egg} size={26} />
                <Text style={[styles.lootBig, { color: RARITY_INFO[loot.egg].color }]}>{RARITY_INFO[loot.egg].label} egg</Text>
              </View>
            </PopIn>
          ) : null}
          {loot.foods.map((id, i) => (
            <PopIn key={`f${i}`} delay={750}><View style={styles.loot}><Text style={styles.lootBig}>{FOOD_BY_ID[id]?.name ?? 'Food'}</Text></View></PopIn>
          ))}
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
        {loot.knockedOut ? <Text style={[font.small, { textAlign: 'center' }]}>{loot.petName} is resting. Its HP comes back by itself over the next few hours.</Text> : null}
        <Button primary label={loot.knockedOut ? 'OK' : 'Yay!'} onPress={onClose} />
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
            // Places unlock with your best pet, but only pets at the level can go: say how many can.
            const canGo = state.pets.filter((p) => levelFor(p.xp) >= pl.minLevel && !H.isKnockedOut(p)).length;
            const sub = locked
              ? `Level ${pl.minLevel}+`
              : `${pl.hours}h or ${(pl.steps / 1000).toLocaleString()}k steps`;
            const who = locked ? null : canGo === 0 ? `Lv ${pl.minLevel}+ · pets resting` : `Lv ${pl.minLevel}+ · ${canGo} ${canGo === 1 ? 'pet' : 'pets'} can go`;
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
                <Text style={styles.placeSub}>{sub}</Text>
                {who ? <Text style={[styles.placeWho, canGo === 0 && { color: '#C4562F' }]}>{who}</Text> : null}
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
        subtitle={`Takes ${place.hours} hour${place.hours > 1 ? 's' : ''}, or walk ${place.steps.toLocaleString()} steps to bring them home sooner. ${place.fights[0] === 0 ? 'Up to' : `${place.fights[0]} to`} ${place.fights[1]} wild fights on the way. If your pet is knocked out, it comes home early. Pets need level ${place.minLevel}+.`}
        pets={[...state.pets]
          .sort((a, b) => b.xp - a.xp)
          .map((p) => ({
            pet: p,
            showHp: true,
            disabled:
              levelFor(p.xp) < place.minLevel
                ? `${p.nickname} needs to be level ${place.minLevel} for ${place.name}.`
                : H.isKnockedOut(p)
                  ? `${p.nickname} is knocked out and resting. Its HP starts coming back within a few minutes.`
                  : undefined,
          }))}
        initial={[...state.pets].sort((a, b) => b.xp - a.xp).filter((p) => levelFor(p.xp) >= place.minLevel && !H.isKnockedOut(p)).sort((a, b) => H.hpPct(b) - H.hpPct(a)).slice(0, 1).map((p) => p.id)}
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
    const might = [prog.place.chest ? `a ${prog.place.chest.kind} chest` : null, prog.place.egg ? 'an egg' : null, 'coins'].filter(Boolean).join(', ');
    if (prog.done) {
      return (
        <PopIn>
          <TripScene
            placeId={prog.place.id}
            speciesId={pet.speciesId}
            xp={pet.xp}
            hat={pet.look?.hat}
            pct={1}
            done
            title={state.expedition?.koAt ? `${pet.nickname} came home early` : `${pet.nickname} is back!`}
            pill={state.expedition?.koAt ? 'See what happened' : 'Open loot'}
            foot={state.expedition?.koAt ? `Knocked out on the way to ${prog.place.name}. Tap to see.` : `Home from ${prog.place.name} with treasure. Tap to see!`}
            onPress={collect}
            label={`${pet.nickname} is back from ${prog.place.name}. See what they found`}
          />
        </PopIn>
      );
    }
    void sp;
    return (
      <TripScene
        placeId={prog.place.id}
        speciesId={pet.speciesId}
        xp={pet.xp}
        hat={pet.look?.hat}
        pct={prog.pct}
        title={`${pet.nickname} is in ${prog.place.name}`}
        pill={`Back in ${Ex.formatLeft(prog.msLeft)}`}
        foot={`Might bring back: ${might}`}
        onPress={() => open(<TripSheet onClose={close} />)}
        label={`${pet.nickname} is at ${prog.place.name}, home in ${Ex.formatLeft(prog.msLeft)}`}
      />
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
  scene: { height: 150, borderRadius: 22, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 0, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  sceneHead: { position: 'absolute', left: 14, right: 14, top: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  sceneKicker: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  sceneTitle: { fontSize: 19, fontWeight: '900' },
  scenePill: { backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  scenePillText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  sceneFoot: { position: 'absolute', left: 14, bottom: 10, right: 14, fontSize: 12, fontWeight: '800' },
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
  placeWho: { fontSize: 12, fontWeight: '800', color: '#1E8A68', marginTop: 2 },
  placeSub: { fontWeight: '700', fontSize: 11, color: colors.muted },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(22,28,46,0.92)', justifyContent: 'center', alignItems: 'center', padding: space.lg },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: space.lg, gap: space.sm, width: '100%', maxWidth: 420 },
  placeHead: { alignSelf: 'stretch', height: 170, borderRadius: 18, overflow: 'hidden' },
  fights: { alignSelf: 'stretch', backgroundColor: '#F6F1E7', borderRadius: 14, padding: 10, gap: 6 },
  fightsHead: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6, color: colors.muted },
  fightRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  fightName: { fontSize: 14, fontWeight: '800', color: colors.ink, flexShrink: 1 },
  fightRes: { fontSize: 13, fontWeight: '900' },
  story: { fontSize: 16, fontWeight: '700', color: colors.ink, textAlign: 'center', lineHeight: 22 },
  lootRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginVertical: space.xs },
  loot: { backgroundColor: '#FFF6DD', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5, borderColor: colors.gold },
  lootBig: { fontWeight: '900', fontSize: 14, color: '#5A3E00' },
});
