import { postMoment } from '../lib/moments';
import { AdBonusButton } from './Ads';
import { addCoins } from '../game/adBonus';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SnackIcon from './SnackIcon';
import React, { createContext, useContext, useEffect, useState } from 'react';
import PotionIcon, { POTION_COLOR } from './PotionIcon';
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from './ScaledText';
import Svg, { Path, Rect } from 'react-native-svg';
import type { ChestKind, OwnedPet, Rarity, Stage } from '../game/types';
import type { ChestResult } from '../game/loot';
import { CHESTS } from '../game/loot';
import { RARITY_INFO } from '../game/rarity';
import { SPECIES_BY_ID } from '../game/species';
import { levelFor } from '../game/scoring';
import { gradeInfo, gradeOf, gradeStars } from '../game/stats';
import type { Skin } from '../game/types';
import { COSMETIC_BY_ID } from '../game/cosmetics';
import { SKIN_INFO } from '../game/skins';
import { ItemIcon } from './Cosmetics';
import EggSprite from './EggSprite';
import PetSprite from './PetSprite';
import { Button } from './ui';
import EggChooser from './EggChooser';
import { EGG_BASKET } from '../game/actions';
import { Confetti, Flash, PopIn, Rays, buzz, useCountUp, useIdleWobble, useShake } from './fx';
import CrystalIcon from './CrystalIcon';
import ChestIcon from './ChestIcon';
import { DyeIcon } from './Dyes';
import { dyeName } from '../game/dyes';

export type Reveal =
  | { kind: 'egg'; rarity: Rarity; pet: OwnedPet; isNew: boolean; title?: string; eggColor?: string; eggSpots?: string[]; onMakeActive?: () => void; lucky?: number }
  | { kind: 'chest'; chest: ChestKind; result: ChestResult }
  | { kind: 'grow'; pet: OwnedPet; stage: Stage }
  | { kind: 'trade'; gave: { speciesId: string; nickname: string; shiny: boolean; skin?: Skin } | null; got: OwnedPet; isNew: boolean; friend: string };

const Ctx = createContext<(r: Reveal) => void>(() => {});
export const useReveal = () => useContext(Ctx);

export function RevealProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<{ id: number; r: Reveal }[]>([]);
  const show = (r: Reveal) => {
    // Every hatch goes to your guild chat so the guild can cheer.
    if (r.kind === 'egg') postMoment('hatch', r.pet);
    setQueue((q) => [...q, { id: Date.now() + Math.random(), r }]);
  };
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
  // Stays inside the app's own area (never under a side camera column).
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.backdrop}>
      {reveal.kind === 'egg' && <EggReveal r={reveal} onClose={onClose} />}
      {reveal.kind === 'chest' && <ChestReveal r={reveal} onClose={onClose} />}
      {reveal.kind === 'grow' && <GrowReveal r={reveal} onClose={onClose} />}
      {reveal.kind === 'trade' && <TradeReveal r={reveal} onClose={onClose} />}
    </View>
  );
}

/* ---------------- Skin found: a big shiny banner ---------------- */
/** How rare a skin sounds, from its hatch chance. */
export function skinHype(skin: Skin): { kicker: string; odds: string | null } {
  const c = SKIN_INFO[skin].chance;
  // Same words as pet rarity, from how often the skin turns up in an egg.
  const kicker = c <= 0 ? 'EVENT SKIN!' : c >= 0.03 ? 'UNCOMMON SKIN!' : c >= 0.005 ? 'RARE SKIN!' : c >= 0.002 ? 'EPIC SKIN!' : 'LEGENDARY SKIN!';
  return { kicker, odds: c > 0 ? `Only about 1 in ${Math.round(1 / c).toLocaleString()} eggs` : 'Only during its event' };
}

function SkinBanner({ skin }: { skin: Skin }) {
  const s = SKIN_INFO[skin];
  const hype = skinHype(skin);
  const sweep = React.useRef(new Animated.Value(0)).current;
  const pulse = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(sweep, { toValue: 1, duration: 1100, useNativeDriver: true }), Animated.delay(700), Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true })]));
    const b = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 650, useNativeDriver: true })]));
    a.start();
    b.start();
    return () => { a.stop(); b.stop(); };
  }, []);
  return (
    <PopIn delay={550} from={0.2}>
      <Animated.View style={[styles.skinBanner, { backgroundColor: s.color, transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }, { rotate: '-3deg' }] }]} accessibilityRole="header" accessibilityLabel={`${hype.kicker} ${s.label} skin. ${hype.odds ?? ''}`}>
        <Animated.View pointerEvents="none" style={[styles.skinShine, { transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-120, 320] }) }, { rotate: '20deg' }] }]} />
        <Text style={styles.skinKicker}>{hype.kicker}</Text>
        <Text style={styles.skinName}>{s.label.toUpperCase()}</Text>
      </Animated.View>
      {hype.odds ? <Text style={styles.skinOdds}>{hype.odds}</Text> : null}
    </PopIn>
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
  const big = BIG.includes(sp.rarity) || !!r.pet.skin || !!r.lucky;

  const tap = () => {
    if (phase !== 'tap') return;
    const n = taps + 1;
    setTaps(n);
    buzz(n < 3 ? 'light' : 'heavy', 'crack');
    if (n >= 3) setTimeout(() => setPhase('flash'), 260);
  };
  useEffect(() => {
    if (phase === 'reveal') buzz('success', 'hatch');
  }, [phase]);
  // A second, bigger buzz when the skin banner lands.
  useEffect(() => {
    if (phase === 'tap' || !r.pet.skin) return;
    const t = setTimeout(() => buzz('heavy', 'coin'), 650);
    return () => clearTimeout(t);
  }, [phase, r.pet.skin]);

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
          <Rays color={r.pet.skin ? SKIN_INFO[r.pet.skin].color : big ? '#FFD84D' : info.color} size={big ? 420 : 340} />
          <Confetti amount={r.pet.skin ? 160 : big ? 110 : 50} width={width} height={height} />
          <PopIn from={0.1}>
            <PetSprite species={sp} stage="baby" size={220} shiny={r.pet.shiny} skin={r.pet.skin} mood="joy" />
          </PopIn>
          {r.pet.skin ? <SkinBanner skin={r.pet.skin} /> : null}
          <PopIn delay={250}>
            <View style={[styles.banner, { backgroundColor: info.color }]}>
              <Text style={styles.bannerText}>{sp.rarity === 'legendary' ? 'LEGENDARY!' : sp.rarity === 'epic' ? 'EPIC!' : info.label.toUpperCase()}</Text>
            </View>
          </PopIn>
          {r.lucky ? (
            <PopIn delay={300}>
              <View style={styles.lucky}>
                <Text style={styles.luckyText}>LUCKY EGG! +{r.lucky} to every stat</Text>
              </View>
            </PopIn>
          ) : null}
          <PopIn delay={400}>
            <Text style={styles.name}>{sp.name}{r.pet.shiny ? ' ✦ Shiny!' : ''}</Text>
          </PopIn>
          <PopIn delay={460}>
            <View style={[styles.skinTag, { borderColor: gradeInfo(gradeOf(r.pet)).color }]}>
              <Text style={[styles.skinText, { color: gradeInfo(gradeOf(r.pet)).color }]}>
                {gradeOf(r.pet) >= 100 ? 'PERFECT 100%!' : `${gradeStars(gradeOf(r.pet)) ? `${gradeStars(gradeOf(r.pet))} ` : ''}Grade ${gradeOf(r.pet)}% · ${gradeInfo(gradeOf(r.pet)).label}`}
              </Text>
            </View>
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

/* ---------------- Trade: your pet waves goodbye, theirs pops in ---------------- */
function TradeReveal({ r, onClose }: { r: Extract<Reveal, { kind: 'trade' }>; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const [phase, setPhase] = useState<'swap' | 'reveal'>('swap');
  const out = React.useRef(new Animated.Value(0)).current;
  const got = SPECIES_BY_ID[r.got.speciesId];
  const gave = r.gave ? SPECIES_BY_ID[r.gave.speciesId] : null;
  const info = RARITY_INFO[got.rarity];
  useEffect(() => {
    buzz('medium', 'whoosh');
    Animated.sequence([
      Animated.delay(700),
      Animated.timing(out, { toValue: 1, duration: 650, useNativeDriver: true }),
    ]).start(() => {
      buzz('success', 'hatch');
      setPhase('reveal');
    });
  }, []);
  const level = levelFor(r.got.xp);
  return (
    <View style={styles.stage}>
      {phase === 'swap' ? (
        <View style={styles.center}>
          <Text style={styles.kicker}>Trading with {r.friend}…</Text>
          {gave && r.gave ? (
            <Animated.View style={{ opacity: out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ translateX: out.interpolate({ inputRange: [0, 1], outputRange: [0, 260] }) }, { rotate: out.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '25deg'] }) }] }}>
              <PetSprite species={gave} stage="adult" size={180} shiny={r.gave.shiny} skin={r.gave.skin} />
            </Animated.View>
          ) : (
            <Text style={{ fontSize: 80 }}>⇄</Text>
          )}
          <Text style={styles.hint}>{gave && r.gave ? `Bye, ${r.gave.nickname}! Have fun with ${r.friend}!` : 'Swapping…'}</Text>
        </View>
      ) : (
        <View style={styles.center}>
          <Rays color={info.color} size={360} />
          <Confetti amount={70} width={width} height={height} />
          <Text style={styles.kicker}>Trade complete!</Text>
          <PopIn from={0.1}>
            <PetSprite species={got} stage="adult" size={210} shiny={r.got.shiny} skin={r.got.skin} mood="joy" />
          </PopIn>
          {r.got.skin ? <SkinBanner skin={r.got.skin} /> : null}
          <PopIn delay={200}>
            <View style={[styles.banner, { backgroundColor: info.color }]}>
              <Text style={styles.bannerText}>{info.label.toUpperCase()} · LV {level}</Text>
            </View>
          </PopIn>
          <PopIn delay={350}>
            <Text style={styles.name}>{r.got.nickname}{r.got.shiny ? ' ✦ Shiny!' : ''}</Text>
          </PopIn>
          <PopIn delay={450}>
            <Text style={styles.blurb}>Say hi to your new {got.name} from {r.friend}!</Text>
          </PopIn>
          {r.isNew && (
            <PopIn delay={600}>
              <View style={styles.newTag}><Text style={styles.newText}>NEW! Added to your Pet-dex</Text></View>
            </PopIn>
          )}
          <PopIn delay={750}>
            <Button primary label="Yay!" onPress={onClose} />
          </PopIn>
        </View>
      )}
    </View>
  );
}

/* ---------------- Chest: tap twice to burst it open ---------------- */
const CHEST_COLORS: Record<ChestKind, [string, string]> = { bronze: ['#C98A54', '#A86B3A'], silver: ['#C9D3DA', '#9AA8B2'], gold: ['#FFD25E', '#E3A81E'], rainbow: ['#FF9AD8', '#8A6BFF'] };

function BigChest({ kind, open }: { kind: ChestKind; open: boolean }) {
  return <View style={open ? { transform: [{ scale: 1.08 }] } : undefined}><ChestIcon kind={kind} size={190} /></View>;
}

function ChestReveal({ r, onClose }: { r: Extract<Reveal, { kind: 'chest' }>; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const [taps, setTaps] = useState(0);
  const [phase, setPhase] = useState<'tap' | 'flash' | 'loot'>('tap');
  const shake = useShake(taps, 10 + taps * 6);
  const idle = useIdleWobble();
  const [doubled, setDoubled] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const coins = useCountUp(r.result.coins * (doubled ? 2 : 1), doubled ? 1400 : 900, phase === 'loot');
  const eggInfo = r.result.eggRarity ? RARITY_INFO[r.result.eggRarity] : null;
  const big = r.result.eggRarity ? BIG.includes(r.result.eggRarity) : false;

  const tap = () => {
    if (phase !== 'tap') return;
    const n = taps + 1;
    setTaps(n);
    buzz(n < 2 ? 'medium' : 'heavy', n < 2 ? 'thud' : 'whoosh');
    if (n >= 2) setTimeout(() => setPhase('flash'), 240);
  };
  useEffect(() => {
    if (phase === 'loot') buzz('success', 'chest');
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
          {r.result.upgraded ? <PopIn><Text style={styles.rainbowFlash}>It turned into a Rainbow Chest!</Text></PopIn> : null}
          <PopIn from={0.6}>
            <BigChest kind={r.result.upgraded ? 'rainbow' : r.chest} open />
          </PopIn>
          <View style={styles.lootRow}>
            <PopIn delay={150}>
              <View style={[styles.lootCard, doubled && { borderColor: '#FF8A4C' }]}>
                {doubled ? (
                  <View pointerEvents="none" style={styles.doubleWrap}>
                    <PopIn from={0.3}><View style={styles.doubleTag}><Text style={styles.doubleTagText} numberOfLines={1}>2× DOUBLED</Text></View></PopIn>
                  </View>
                ) : null}
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
                  <SnackIcon name={r.result.item} size={40} />
                  <Text style={[styles.lootBig, { fontSize: 14, textAlign: 'center' }]}>{r.result.item}</Text>
                  <Text style={styles.lootSmall}>snack</Text>
                </View>
              </PopIn>
            ) : null}
            {r.result.dye ? (
              <PopIn delay={900}>
                <View style={[styles.lootCard, { borderColor: '#B45FE0', backgroundColor: '#F3E8FF' }]}>
                  <DyeIcon skin={r.result.dye} size={40} />
                  <Text style={[styles.lootBig, { fontSize: 14, textAlign: 'center' }]}>{dyeName(r.result.dye)}</Text>
                  <Text style={styles.lootSmall}>in your Bag</Text>
                </View>
              </PopIn>
            ) : null}
            {r.result.crystals ? (
              <PopIn delay={1000}>
                <View style={[styles.lootCard, { borderColor: '#4A8FE0', backgroundColor: '#E9F4FF' }]}>
                  <CrystalIcon size={40} />
                  <Text style={[styles.lootBig, { fontSize: 14, textAlign: 'center' }]}>+{r.result.crystals} Crystal{r.result.crystals > 1 ? 's' : ''}</Text>
                  <Text style={styles.lootSmall}>power up a pet</Text>
                </View>
              </PopIn>
            ) : null}
            {(['small', 'full'] as const).map((k) =>
              r.result.potions?.[k] ? (
                <PopIn key={k} delay={1050}>
                  <View style={[styles.lootCard, { borderColor: POTION_COLOR[k], backgroundColor: '#FFF0F5' }]}>
                    <PotionIcon kind={k} size={40} />
                    <Text style={[styles.lootBig, { fontSize: 14, textAlign: 'center' }]}>{k === 'small' ? 'Small Potion' : 'Full Potion'}</Text>
                    <Text style={styles.lootSmall}>heals HP</Text>
                  </View>
                </PopIn>
              ) : null,
            )}
            {r.result.cosmetic && COSMETIC_BY_ID[r.result.cosmetic] ? (
              <PopIn delay={1100}>
                <View style={[styles.lootCard, { borderColor: '#9C5FD8', backgroundColor: '#F4ECFF' }]}>
                  <ItemIcon id={r.result.cosmetic} size={52} />
                  <Text style={[styles.lootBig, { fontSize: 13, textAlign: 'center' }]}>{COSMETIC_BY_ID[r.result.cosmetic].name}</Text>
                  <Text style={styles.lootSmall}>{COSMETIC_BY_ID[r.result.cosmetic].slot === 'toy' ? 'new toy!' : 'dress-up!'}</Text>
                </View>
              </PopIn>
            ) : null}
          </View>
          {doubled ? <Confetti key="dbl" amount={70} width={width} height={height} /> : null}
          {r.result.basketFull ? <Text style={[styles.blurb, { color: '#FFC27A' }]}>Your basket is full ({EGG_BASKET} / {EGG_BASKET})</Text> : r.result.eggRarity ? <Text style={styles.blurb}>Put it in an incubator and go for a walk.</Text> : null}
          <PopIn delay={1000}>
            <View style={{ alignSelf: 'stretch', gap: 10, width: 300, maxWidth: '100%' }}>
              {r.result.coins > 0 ? <AdBonusButton title={`Double it: ${r.result.coins * 2} coins`} onReward={addCoins(r.result.coins)} onDone={() => setDoubled(true)} /> : null}
              {r.result.basketFull ? <Button primary label="Make room for it" onPress={() => setChoosing(true)} /> : null}
              <Button primary={!r.result.basketFull} label={`Collect ${r.result.coins * (doubled ? 2 : 1)}`} onPress={onClose} />
            </View>
          </PopIn>
        </View>
      )}
      {phase === 'flash' && <Flash onDone={() => setPhase('loot')} />}
      {choosing ? <EggChooser onClose={onClose} /> : null}
    </View>
  );
}

/* ---------------- Grow: pet reaches a new stage ---------------- */
function GrowReveal({ r, onClose }: { r: Extract<Reveal, { kind: 'grow' }>; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const sp = SPECIES_BY_ID[r.pet.speciesId];
  useEffect(() => buzz('success', 'levelup'), []);
  return (
    <View style={styles.stage}>
      <View style={styles.center}>
        <Rays color="#2FB58A" size={360} />
        <Confetti amount={70} width={width} height={height} />
        <Text style={styles.kicker}>Level up!</Text>
        <PopIn from={0.4}>
          <PetSprite species={sp} stage={r.stage} size={230} shiny={r.pet.shiny} skin={r.pet.skin} mood="joy" />
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
  doubleWrap: { position: 'absolute', top: -16, left: -40, right: -40, alignItems: 'center', zIndex: 3 },
  doubleTag: { backgroundColor: '#FF8A4C', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 2, borderColor: '#FFFFFF', transform: [{ rotate: '-4deg' }] },
  doubleTagText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },
  rainbowFlash: { fontSize: 20, fontWeight: '800', color: '#B45FE0', backgroundColor: '#FFFFFFEE', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6, overflow: 'hidden', marginBottom: 6, textAlign: 'center' },
  lucky: { backgroundColor: '#FFD84D', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14, marginTop: 6 },
  luckyText: { color: '#5A3A00', fontWeight: '700', fontSize: 14 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(22,28,46,0.97)', zIndex: 100, alignItems: 'center', justifyContent: 'center' },
  stage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 14 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 10, maxWidth: 420, width: '100%' },
  kicker: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  hint: { color: '#FFE9A8', fontSize: 18, fontWeight: '800' },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.3)' },
  banner: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: 999 },
  bannerText: { color: '#FFFFFF', fontWeight: '800', fontSize: 18, letterSpacing: 1.5 },
  name: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  blurb: { color: '#D9E2EE', fontSize: 15, textAlign: 'center', fontWeight: '600', maxWidth: 320 },
  newTag: { backgroundColor: '#FF9E7A', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  newText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  skinBanner: { minWidth: 230, alignItems: 'center', paddingHorizontal: 26, paddingVertical: 10, borderRadius: 20, borderWidth: 4, borderColor: '#FFFFFF', overflow: 'hidden', marginTop: 18, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  skinShine: { position: 'absolute', top: -40, bottom: -40, width: 46, backgroundColor: 'rgba(255,255,255,0.45)' },
  skinKicker: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, letterSpacing: 2 },
  skinName: { color: '#FFFFFF', fontWeight: '900', fontSize: 38, letterSpacing: 2, textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 2 } },
  skinOdds: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, textAlign: 'center', marginTop: 8, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 3 },
  skinTag: { backgroundColor: '#FFFFFF', borderRadius: 999, borderWidth: 3, paddingHorizontal: 16, paddingVertical: 6, marginTop: 6 },
  skinText: { fontWeight: '700', fontSize: 16, letterSpacing: 1 },
  lootRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  lootCard: { width: 104, minHeight: 116, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#FFD25E', alignItems: 'center', justifyContent: 'center', padding: 8, gap: 2 },
  coin: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFC94D', borderWidth: 4, borderColor: '#E9A92A' },
  lootBig: { fontSize: 22, fontWeight: '800', color: '#1F2A2E' },
  lootSmall: { fontSize: 12, fontWeight: '600', color: '#6B7C80' },
});
