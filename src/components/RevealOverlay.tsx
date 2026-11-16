import React, { createContext, useContext, useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import type { ChestKind, OwnedPet, Rarity, Stage } from '../game/types';
import type { ChestResult } from '../game/loot';
import { CHESTS } from '../game/loot';
import { RARITY_INFO } from '../game/rarity';
import { SPECIES_BY_ID } from '../game/species';
import EggSprite from './EggSprite';
import PetSprite from './PetSprite';
import { Button } from './ui';
import { Confetti, Flash, PopIn, Rays, buzz, useCountUp, useIdleWobble, useShake } from './fx';

export type Reveal =
  | { kind: 'egg'; rarity: Rarity; pet: OwnedPet; isNew: boolean; title?: string; eggColor?: string; eggSpots?: string[]; onMakeActive?: () => void }
  | { kind: 'chest'; chest: ChestKind; result: ChestResult }
  | { kind: 'grow'; pet: OwnedPet; stage: Stage };

const Ctx = createContext<(r: Reveal) => void>(() => {});
export const useReveal = () => useContext(Ctx);

export function RevealProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<{ id: number; r: Reveal }[]>([]);
  const show = (r: Reveal) => setQueue((q) => [...q, { id: Date.now() + Math.random(), r }]);
  const current = queue[0];
  return (
    <Ctx.Provider value={show}>
      {children}
      {current ? <Overlay key={current.id} reveal={current.r} onClose={() => setQueue((q) => q.slice(1))} /> : null}
    </Ctx.Provider>
  );
}

const STAGE_LABEL: Record<Stage, string> = { baby: 'Baby', teen: 'Teen', adult: 'Adult' };
const BIG: Rarity[] = ['epic', 'legendary'];

function Overlay({ reveal, onClose }: { reveal: Reveal; onClose: () => void }) {
  return (
    <View style={styles.backdrop}>
      {reveal.kind === 'egg' && <EggReveal r={reveal} onClose={onClose} />}
      {reveal.kind === 'chest' && <ChestReveal r={reveal} onClose={onClose} />}
      {reveal.kind === 'grow' && <GrowReveal r={reveal} onClose={onClose} />}
    </View>
  );
}

/* ---------------- Egg: tap 3 times to crack ---------------- */
function EggReveal({ r, onClose }: { r: Extract<Reveal, { kind: 'egg' }>; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const [taps, setTaps] = useState(0);
  const [phase, setPhase] = useState<'tap' | 'flash' | 'reveal'>('tap');
  const shake = useShake(taps, 8 + taps * 4);
  const idle = useIdleWobble();
  const sp = SPECIES_BY_ID[r.pet.speciesId];
  const info = RARITY_INFO[sp.rarity];
  const big = BIG.includes(sp.rarity);

  const tap = () => {
    if (phase !== 'tap') return;
    const n = taps + 1;
    setTaps(n);
    buzz(n < 3 ? 'light' : 'heavy');
    if (n >= 3) setTimeout(() => setPhase('flash'), 260);
  };
  useEffect(() => {
    if (phase === 'reveal') buzz('success');
  }, [phase]);

  return (
    <View style={styles.stage}>
      {phase === 'tap' && (
        <>
          <Text style={styles.kicker}>{r.title ?? 'Your egg is hatching!'}</Text>
          <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel="Tap the egg to crack it">
            <Animated.View style={taps ? shake : idle}>
              <EggSprite rarity={r.rarity} color={r.eggColor} spots={r.eggSpots} size={190} cracked={taps >= 1} />
            </Animated.View>
          </Pressable>
          <Text style={styles.hint}>{['Tap to crack it!', 'Keep going!', 'One more!', '…'][taps]}</Text>
          <View style={styles.dots}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.dot, i < taps && { backgroundColor: '#FFD25E' }]} />
            ))}
          </View>
        </>
      )}
      {phase !== 'tap' && (
        <View style={styles.center}>
          <Rays color={big ? '#FFD84D' : info.color} size={big ? 420 : 340} />
          <Confetti amount={big ? 110 : 50} width={width} height={height} />
          <PopIn from={0.1}>
            <PetSprite species={sp} stage="baby" size={220} shiny={r.pet.shiny} mood="joy" />
          </PopIn>
          <PopIn delay={250}>
            <View style={[styles.banner, { backgroundColor: info.color }]}>
              <Text style={styles.bannerText}>{sp.rarity === 'legendary' ? 'LEGENDARY!' : sp.rarity === 'epic' ? 'EPIC!' : info.label.toUpperCase()}</Text>
            </View>
          </PopIn>
          <PopIn delay={400}>
            <Text style={styles.name}>{sp.name}{r.pet.shiny ? ' ✦ Shiny!' : ''}</Text>
          </PopIn>
          <PopIn delay={520}>
            <Text style={styles.blurb}>{sp.blurb}</Text>
          </PopIn>
          {r.isNew && (
            <PopIn delay={650}>
              <View style={styles.newTag}><Text style={styles.newText}>NEW! Added to your Pet-dex</Text></View>
            </PopIn>
          )}
          <PopIn delay={800}>
            <View style={styles.row}>
              {r.onMakeActive ? <Button primary label="Make active" onPress={() => { r.onMakeActive?.(); onClose(); }} /> : null}
              <Button primary={!r.onMakeActive} label={r.onMakeActive ? 'Keep current' : 'Yay!'} onPress={onClose} />
            </View>
          </PopIn>
        </View>
      )}
      {phase === 'flash' && <Flash onDone={() => setPhase('reveal')} />}
    </View>
  );
}

/* ---------------- Chest: tap twice to burst it open ---------------- */
const CHEST_COLORS: Record<ChestKind, [string, string]> = { bronze: ['#C98A54', '#A86B3A'], silver: ['#C9D3DA', '#9AA8B2'], gold: ['#FFD25E', '#E3A81E'] };

function BigChest({ kind, open }: { kind: ChestKind; open: boolean }) {
  const [a, b] = CHEST_COLORS[kind];
  return (
    <Svg width={190} height={190} viewBox="0 0 64 64">
      <Rect x={8} y={26} width={48} height={30} rx={5} fill={a} stroke="#24323A" strokeWidth={2.5} />
      {open ? (
        <Path d="M10 22 Q14 4 36 6 Q56 8 56 20 Z" fill={b} stroke="#24323A" strokeWidth={2.5} strokeLinejoin="round" />
      ) : (
        <Path d="M8 28 Q8 12 32 12 Q56 12 56 28 Z" fill={b} stroke="#24323A" strokeWidth={2.5} strokeLinejoin="round" />
      )}
      <Rect x={27} y={24} width={10} height={12} rx={2} fill="#FFE27A" stroke="#24323A" strokeWidth={2} />
    </Svg>
  );
}

function ChestReveal({ r, onClose }: { r: Extract<Reveal, { kind: 'chest' }>; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const [taps, setTaps] = useState(0);
  const [phase, setPhase] = useState<'tap' | 'flash' | 'loot'>('tap');
  const shake = useShake(taps, 10 + taps * 6);
  const idle = useIdleWobble();
  const coins = useCountUp(r.result.coins, 900, phase === 'loot');
  const eggInfo = r.result.eggRarity ? RARITY_INFO[r.result.eggRarity] : null;
  const big = r.result.eggRarity ? BIG.includes(r.result.eggRarity) : false;

  const tap = () => {
    if (phase !== 'tap') return;
    const n = taps + 1;
    setTaps(n);
    buzz(n < 2 ? 'medium' : 'heavy');
    if (n >= 2) setTimeout(() => setPhase('flash'), 240);
  };
  useEffect(() => {
    if (phase === 'loot') buzz('success');
  }, [phase]);

  return (
    <View style={styles.stage}>
      {phase === 'tap' && (
        <>
          <Text style={styles.kicker}>{CHESTS[r.chest].label}</Text>
          <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel="Tap the chest to open it">
            <Animated.View style={taps ? shake : idle}>
              <BigChest kind={r.chest} open={false} />
            </Animated.View>
          </Pressable>
          <Text style={styles.hint}>{taps === 0 ? 'Tap to open!' : 'Again!'}</Text>
        </>
      )}
      {phase !== 'tap' && (
        <View style={styles.center}>
          <Rays color={big ? '#FFD84D' : eggInfo?.color ?? '#FFD25E'} size={360} />
          <Confetti amount={big ? 100 : 45} width={width} height={height} />
          <PopIn from={0.6}>
            <BigChest kind={r.chest} open />
          </PopIn>
          <View style={styles.lootRow}>
            <PopIn delay={150}>
              <View style={styles.lootCard}>
                <View style={styles.coin} />
                <Text style={styles.lootBig}>+{coins}</Text>
                <Text style={styles.lootSmall}>coins</Text>
              </View>
            </PopIn>
            {r.result.eggRarity && eggInfo ? (
              <PopIn delay={500}>
                <View style={[styles.lootCard, { borderColor: eggInfo.color, backgroundColor: eggInfo.soft }]}>
                  <EggSprite rarity={r.result.eggRarity} size={58} />
                  <Text style={[styles.lootBig, { color: eggInfo.color, fontSize: 16 }]}>{eggInfo.label}</Text>
                  <Text style={styles.lootSmall}>egg!</Text>
                </View>
              </PopIn>
            ) : null}
            {r.result.item ? (
              <PopIn delay={r.result.eggRarity ? 850 : 500}>
                <View style={styles.lootCard}>
                  <Text style={{ fontSize: 30 }}>✦</Text>
                  <Text style={[styles.lootBig, { fontSize: 14, textAlign: 'center' }]}>{r.result.item}</Text>
                  <Text style={styles.lootSmall}>collectible</Text>
                </View>
              </PopIn>
            ) : null}
          </View>
          {!r.result.eggRarity ? <Text style={styles.blurb}>No egg this time. Keep your streak going!</Text> : <Text style={styles.blurb}>Put it in an incubator and go for a walk.</Text>}
          <PopIn delay={1000}>
            <Button primary label="Collect" onPress={onClose} />
          </PopIn>
        </View>
      )}
      {phase === 'flash' && <Flash onDone={() => setPhase('loot')} />}
    </View>
  );
}

/* ---------------- Grow: pet reaches a new stage ---------------- */
function GrowReveal({ r, onClose }: { r: Extract<Reveal, { kind: 'grow' }>; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const sp = SPECIES_BY_ID[r.pet.speciesId];
  useEffect(() => buzz('success'), []);
  return (
    <View style={styles.stage}>
      <View style={styles.center}>
        <Rays color="#2FB58A" size={360} />
        <Confetti amount={70} width={width} height={height} />
        <Text style={styles.kicker}>Level up!</Text>
        <PopIn from={0.4}>
          <PetSprite species={sp} stage={r.stage} size={230} shiny={r.pet.shiny} mood="joy" />
        </PopIn>
        <PopIn delay={300}>
          <Text style={styles.name}>{r.pet.nickname} grew into a {STAGE_LABEL[r.stage]}!</Text>
        </PopIn>
        <PopIn delay={600}>
          <Button primary label="Amazing!" onPress={onClose} />
        </PopIn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(22,28,46,0.97)', zIndex: 100, alignItems: 'center', justifyContent: 'center' },
  stage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 14 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 10, maxWidth: 420, width: '100%' },
  kicker: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  hint: { color: '#FFE9A8', fontSize: 18, fontWeight: '800' },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.3)' },
  banner: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: 999 },
  bannerText: { color: '#FFFFFF', fontWeight: '900', fontSize: 18, letterSpacing: 1.5 },
  name: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  blurb: { color: '#D9E2EE', fontSize: 15, textAlign: 'center', fontWeight: '600', maxWidth: 320 },
  newTag: { backgroundColor: '#FF9E7A', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  newText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  lootRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  lootCard: { width: 104, minHeight: 116, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#FFD25E', alignItems: 'center', justifyContent: 'center', padding: 8, gap: 2 },
  coin: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFC94D', borderWidth: 4, borderColor: '#E9A92A' },
  lootBig: { fontSize: 22, fontWeight: '900', color: '#24323A' },
  lootSmall: { fontSize: 12, fontWeight: '800', color: '#6B7C80' },
});
