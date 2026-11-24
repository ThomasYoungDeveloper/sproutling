import { useResetIn } from '../lib/useResetIn';
import Coin, { CoinText } from './Coin';
import * as U from '../game/unlocks';
import { LockedSheet } from './Unlocks';
import React, { useEffect, useState } from 'react';
import * as H from '../game/hp';
import PotionIcon from './PotionIcon';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { useGame } from '../state/GameContext';
import PetSprite from './PetSprite';
import { Backdrop, skyNow } from './PetScene';
import { ItemIcon } from './Cosmetics';
import { useOverlay } from './Overlay';
import PremiumSheet from './PremiumSheet';
import { IncubatorOffer } from './Incubator';
import { Button } from './ui';
import { buzz, PopIn } from './fx';
import { colors, font, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { stageFor } from '../game/scoring';
import * as A from '../game/actions';
import * as K from '../game/cosmetics';
import * as Pw from '../game/powerups';
import * as Dy from '../game/dyes';
import { SKIN_INFO } from '../game/skins';
import { DyeIcon, UseDyeSheet } from './Dyes';
import type { Skin } from '../game/types';
import type { Cosmetic, Slot } from '../game/cosmetics';
import CrystalIcon from './CrystalIcon';
import { shortNumber } from '../lib/shortNumber';

const SLOT_TITLE: Record<Slot, string> = { toy: 'Toys', hat: 'Hats', aura: 'Auras', scene: 'Scenes' };
const SLOT_HINT: Record<Slot, string> = {
  toy: 'Drag toys onto your pet to play.',
  hat: 'Hats go on your active pet.',
  aura: 'Auras float around your active pet.',
  scene: 'Scenes change the world behind your pet.',
};

function useCountdown() {
  const [secs, setSecs] = useState(K.shopRefreshIn());
  useEffect(() => {
    const t = setInterval(() => setSecs(K.shopRefreshIn()), 30_000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Tile({ c, children, selected, onPress, dim }: { c: Cosmetic; children?: React.ReactNode; selected?: boolean; onPress?: () => void; dim?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.tile, selected && styles.tileOn, dim && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel={c.name} accessibilityState={{ selected: !!selected }}>
      <View style={styles.iconBox}>
        <ItemIcon id={c.id} size={56} />
      </View>
      <Text style={styles.tileName} numberOfLines={1}>{c.name}</Text>
      <Text style={[styles.rarity, { color: K.ITEM_RARITY_COLOR[c.rarity] }]}>{c.premium ? 'Premium' : c.rarity[0].toUpperCase() + c.rarity.slice(1)}</Text>
      {children}
    </Pressable>
  );
}

/* ---------------- Daily shop ---------------- */

/** One Training Crystal a day: spend it on a pet's stat from its page (Grade section). */
function CrystalOffer() {
  const { state, apply } = useGame();
  const today = A.todayKey(state);
  const bought = Pw.crystalBoughtToday(state, today);
  const resetIn = useResetIn();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <View style={styles.crystal}>
      <CrystalIcon size={48} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.crystalTitle}>Training Crystal</Text>
        <Text style={styles.crystalBody}>+1 to any stat of any pet, from its page. You have {Pw.crystalsOf(state)}.</Text>
        {msg ? <Text style={[styles.crystalBody, { color: colors.mintDark, fontWeight: '800' }]}>{msg}</Text> : null}
      </View>
      <Pressable
        disabled={bought || state.coins < Pw.CRYSTAL_PRICE}
        onPress={() => {
          apply((s) => Pw.buyCrystal(s, today));
          buzz('success');
          setMsg('Got it! Open a pet and tap Crystals.');
        }}
        style={[styles.crystalBtn, (bought || state.coins < Pw.CRYSTAL_PRICE) && { opacity: 0.5 }]}
        accessibilityRole="button"
        accessibilityLabel={bought ? `Bought today, back in ${resetIn}` : `Buy a Training Crystal for ${Pw.CRYSTAL_PRICE} coins`}
      >
        {bought ? <Text style={styles.crystalBtnText}>{resetIn}</Text> : <CoinText style={styles.crystalBtnText}>{Pw.CRYSTAL_PRICE}</CoinText>}
      </Pressable>
    </View>
  );
}

function PotionOffer() {
  const { state, apply } = useGame();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <View style={[styles.crystal, { flexDirection: 'column', alignItems: 'stretch' }]}>
      <Text style={styles.crystalTitle}>Potions</Text>
      <Text style={styles.crystalBody}>Pets only get HP back with a potion. Use one from a pet’s page.</Text>
      {(['small', 'full'] as const).map((k) => (
        <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <PotionIcon kind={k} size={38} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.crystalTitle, { fontSize: 15 }]}>{H.POTION_ITEM[k]}</Text>
            <Text style={styles.crystalBody}>{H.POTION_INFO[k]} · you have {H.potionsOf(state, k)}</Text>
          </View>
          <Pressable
            disabled={state.coins < H.POTION_PRICE[k]}
            onPress={() => {
              apply((s) => H.buyPotion(s, k));
              buzz('success');
              setMsg(`Bought a ${H.POTION_ITEM[k]}.`);
            }}
            style={[styles.crystalBtn, state.coins < H.POTION_PRICE[k] && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel={`Buy a ${H.POTION_ITEM[k]} for ${H.POTION_PRICE[k]} coins`}
          >
            <CoinText style={styles.crystalBtnText}>{H.POTION_PRICE[k]}</CoinText>
          </Pressable>
        </View>
      ))}
      {msg ? <Text style={[styles.crystalBody, { color: colors.mintDark, fontWeight: '800' }]}>{msg}</Text> : null}
    </View>
  );
}

export type Store = 'food' | 'general';

/** A look in today's shop: tap to try it on your pet first. */
function LookTile({ c, onPress }: { c: Cosmetic; onPress: () => void }) {
  const { state } = useGame();
  const owned = K.owns(state, c.id);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.look, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="button" accessibilityLabel={`${c.name}, ${owned ? 'owned' : `${c.price} coins`}. Tap to try it on.`}>
      <View style={[styles.lookArt, { backgroundColor: LOOK_TINT[c.slot] }]}><ItemIcon id={c.id} size={58} /></View>
      <Text style={styles.tileName} numberOfLines={1}>{c.name}</Text>
      <Text style={[styles.rarity, { color: K.ITEM_RARITY_COLOR[c.rarity] }]}>{c.rarity}</Text>
      <View style={[styles.price, owned && styles.owned]}>
        {owned ? <Text style={[styles.priceText, { color: colors.mintDark }]}>Owned</Text> : <CoinText style={styles.priceText}>{c.price.toLocaleString()}</CoinText>}
      </View>
    </Pressable>
  );
}

const LOOK_TINT: Record<Slot, string> = { toy: '#E8F6EE', hat: '#EFE7FA', aura: '#FFF8DA', scene: '#FDEBF1' };

/** Try a look on the active pet before buying it. */
function TryOn({ c, onBack }: { c: Cosmetic; onBack: () => void }) {
  const { state, apply } = useGame();
  const pet = A.activePet(state);
  const sp = pet ? SPECIES_BY_ID[pet.speciesId] : undefined;
  const owned = K.owns(state, c.id);
  const [msg, setMsg] = useState<string | null>(null);
  const buy = () => {
    const r = K.buy(state, c.id);
    if (!r.ok) {
      buzz('light');
      return setMsg(r.reason);
    }
    buzz('success', 'coin');
    apply(() => K.equip(r.state, c.slot, c.id));
    setMsg(c.slot === 'scene' ? `${c.name} is your new yard!` : `${pet?.nickname ?? 'Your pet'} is wearing the ${c.name}!`);
  };
  return (
    <View style={{ gap: space.sm, alignItems: 'center' }}>
      <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'flex-start' }}><Text style={styles.back}>‹ Shop</Text></Pressable>
      <View style={[styles.tryBox, { backgroundColor: LOOK_TINT[c.slot] }]}>
        {c.slot === 'scene' ? (
          <View style={StyleSheet.absoluteFill}><Backdrop scene={c.id} sky={skyNow()} element={(sp?.element ?? 'flower') as never} /></View>
        ) : null}
        {pet && sp ? (
          <PetSprite species={sp} stage={stageFor(pet.xp)} size={150} skin={pet.skin} hat={c.slot === 'hat' ? c.id : pet.look?.hat} aura={c.slot === 'aura' ? c.id : pet.look?.aura} noShadow />
        ) : (
          <ItemIcon id={c.id} size={120} />
        )}
      </View>
      <Text style={styles.tryName}>{c.name}</Text>
      <Text style={[font.small, { textAlign: 'center' }]}>{c.slot === 'scene' ? 'A new yard behind your pet.' : `Here it is on ${pet?.nickname ?? 'your pet'}.`} Looks are just for fun and don’t change stats.</Text>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      <View style={[styles.row, { alignSelf: 'stretch' }]}>
        <Button label={owned || msg ? 'Back' : 'Not now'} onPress={onBack} style={{ flex: 1 }} />
        {owned ? (
          <Button primary label={c.slot === 'scene' ? 'Use it' : 'Wear it'} onPress={() => { apply((s) => K.equip(s, c.slot, c.id)); buzz('success'); setMsg('Done!'); }} style={{ flex: 1.6 }} />
        ) : (
          <Button primary label={`Buy for ${shortNumber(c.price)}`} onPress={buy} disabled={state.coins < c.price} style={{ flex: 1.6 }} />
        )}
      </View>
    </View>
  );
}

/** The featured spot on a dye day: a dark, gold-trimmed card that leaves at midnight. */
function DyeFeature({ onUse }: { onUse: (skin: Skin) => void }) {
  const { state, apply } = useGame();
  const day = A.todayKey(state);
  const d = Dy.dyeOfDay(day)!;
  const left = useCountdown();
  const pet = A.activePet(state);
  const sp = pet ? SPECIES_BY_ID[pet.speciesId] : undefined;
  const price = Dy.DYE_PRICE[d.rarity];
  const bought = state.boughtDye === day;
  const [msg, setMsg] = useState<string | null>(null);
  const info = SKIN_INFO[d.skin];
  const buy = () => {
    const r = Dy.buyDye(state, day);
    if (!r.ok) {
      buzz('light');
      return setMsg(r.reason);
    }
    buzz('success', 'coin');
    apply(() => r.state);
  };
  return (
    <View style={styles.dyeCard}>
      <View style={styles.dyeTop}><Text style={styles.dyeTopText}>{Dy.DYE_RARITY_LABEL[d.rarity].toUpperCase()} DYE · LEAVES IN {left.toUpperCase()}</Text></View>
      <View style={styles.dyeRow}>
        <View style={styles.dyeBottle}><DyeIcon skin={d.skin} size={58} /></View>
        <Text style={styles.dyeArrow}>›</Text>
        <View style={[styles.dyePet, { shadowColor: info.color }]}>
          {pet && sp ? <PetSprite species={sp} stage={stageFor(pet.xp)} size={96} skin={d.skin} noShadow /> : null}
        </View>
      </View>
      <Text style={styles.dyeName}>{Dy.dyeName(d.skin)}</Text>
      <Text style={styles.dyeBody}>Gives one pet the {info.label} skin for good.</Text>
      {bought ? (
        <Pressable onPress={() => onUse(d.skin)} style={[styles.dyeBtn, { backgroundColor: '#2FB58A' }]} accessibilityRole="button">
          <Text style={[styles.dyeBtnText, { color: '#FFFFFF' }]}>{Dy.dyesOwned(state, d.skin) ? 'Use it now' : 'Bought today'}</Text>
        </Pressable>
      ) : (
        <Pressable onPress={buy} style={[styles.dyeBtn, state.coins < price && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={`Buy ${Dy.dyeName(d.skin)} for ${price} coins`}>
          <CoinText style={styles.dyeBtnText}>{price.toLocaleString()}</CoinText>
        </Pressable>
      )}
      {msg ? <Text style={[styles.dyeBody, { color: '#FFE27A' }]}>{msg}</Text> : null}
    </View>
  );
}

/** The featured look of the day (on days without a dye): the priciest look in the shop. */
function FeaturedLook({ c, onPress }: { c: Cosmetic; onPress: () => void }) {
  const { state } = useGame();
  const pet = A.activePet(state);
  const sp = pet ? SPECIES_BY_ID[pet.speciesId] : undefined;
  const owned = K.owns(state, c.id);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.featured, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button" accessibilityLabel={`Featured look: ${c.name}. Tap to try it on.`}>
      <View style={styles.featTag}><Text style={styles.featTagText}>TODAY ONLY</Text></View>
      <View style={styles.featArt}>
        {pet && sp && c.slot !== 'scene' ? (
          <PetSprite species={sp} stage={stageFor(pet.xp)} size={86} skin={pet.skin} hat={c.slot === 'hat' ? c.id : pet.look?.hat} aura={c.slot === 'aura' ? c.id : pet.look?.aura} noShadow />
        ) : (
          <ItemIcon id={c.id} size={72} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.featKicker}>FEATURED LOOK</Text>
        <Text style={styles.featName}>{c.name}</Text>
        <Text style={styles.featBody}>{c.rarity[0].toUpperCase() + c.rarity.slice(1)} {c.slot === 'scene' ? 'yard' : c.slot}. Tap to try it on.</Text>
        <View style={styles.featPrice}>{owned ? <Text style={styles.featPriceText}>Owned</Text> : <CoinText style={styles.featPriceText}>{c.price.toLocaleString()}</CoinText>}</View>
      </View>
    </Pressable>
  );
}

/**
 * The shop: one screen. A featured look (or a rare dye on dye days), today's 4 looks,
 * then supplies that are always there: potions, the daily crystal and incubators.
 */
export function ShopSheet({ onClose, onWardrobe }: { onClose: () => void; onWardrobe: () => void; start?: Store }) {
  const { state } = useGame();
  const left = useCountdown();
  const [trying, setTrying] = useState<Cosmetic | null>(null);
  const [dyeFor, setDyeFor] = useState<Skin | null>(null);
  if (!U.unlocked(state, 'shop')) return <LockedSheet feature="shop" onClose={onClose} />;
  if (dyeFor) return <UseDyeSheet skin={dyeFor} onClose={() => setDyeFor(null)} />;
  const items = K.shopToday(state);
  const dye = Dy.dyeOfDay(A.todayKey(state));
  const featured = dye ? null : items.slice().sort((a, b) => b.price - a.price)[0];
  const looks = items.filter((c) => c !== featured).slice(0, 4);
  const ownedLooks = K.COSMETICS.filter((c) => c.slot !== 'toy' && c.price > 0 && K.owns(state, c.id)).length;
  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={font.title}>Shop</Text>
            <Text style={font.small}>New looks in {left}</Text>
          </View>
          <View style={styles.coins}><CoinText style={styles.coinsText}>{state.coins.toLocaleString()}</CoinText></View>
        </View>
        {trying ? (
          <TryOn c={trying} onBack={() => setTrying(null)} />
        ) : (
          <>
            <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ gap: space.sm, paddingBottom: space.sm }}>
              {dye ? <DyeFeature onUse={setDyeFor} /> : featured ? <FeaturedLook c={featured} onPress={() => setTrying(featured)} /> : null}
              <View style={styles.sectionRow}>
                <Text style={styles.section}>Looks</Text>
                <Text style={font.tiny}>Just for fun · changes daily</Text>
              </View>
              <View style={styles.lookGrid}>{looks.map((c) => <LookTile key={c.id} c={c} onPress={() => setTrying(c)} />)}</View>
              <Text style={styles.section}>Supplies</Text>
              <PotionOffer />
              <CrystalOffer />
              <IncubatorOffer />
              <Pressable onPress={onWardrobe} style={styles.yours} accessibilityRole="button" accessibilityLabel="Open your looks">
                <Text style={[font.small, { flex: 1 }]}>{ownedLooks} look{ownedLooks === 1 ? '' : 's'} owned</Text>
                <Text style={styles.yoursBtn}>Your looks ›</Text>
              </Pressable>
            </ScrollView>
            <Button primary label="Done" onPress={onClose} />
          </>
        )}
      </View>
    </View>
  );
}

export function WardrobeSheet({ onClose, onShop }: { onClose: () => void; onShop: () => void }) {
  const { state, apply } = useGame();
  const pet = A.activePet(state);
  const [tab, setTab] = useState<Slot>('hat');
  const [sky] = useState(skyNow);
  if (!pet) return null;
  const sp = SPECIES_BY_ID[pet.speciesId];
  const all = K.COSMETICS.filter((c) => c.slot === tab && !c.premium && !c.special);
  const owned = K.COSMETICS.filter((c) => c.slot === tab && K.owns(state, c.id));
  const current = tab === 'scene' ? state.scene ?? 'meadow' : tab === 'toy' ? null : pet.look?.[tab];

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <Text style={font.title}>Style {pet.nickname}</Text>
        <View style={styles.preview}>
          <Backdrop element={sp.element} sky={sky} scene={state.scene} />
          <PopIn key={`${pet.look?.hat}-${pet.look?.aura}`}>
            <PetSprite species={sp} stage={stageFor(pet.xp)} size={170} shiny={pet.shiny} skin={pet.skin} hat={pet.look?.hat} aura={pet.look?.aura} mood="joy" />
          </PopIn>
        </View>
        <View style={styles.tabs}>
          {(['hat', 'aura', 'scene', 'toy'] as Slot[]).map((s) => (
            <Pressable key={s} onPress={() => setTab(s)} style={[styles.tab, tab === s && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === s }}>
              <Text style={[styles.tabText, tab === s && { color: '#fff' }]}>{SLOT_TITLE[s]}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={font.small}>{SLOT_HINT[tab]} You have {owned.length} of {all.length}.</Text>
        <ScrollView style={{ maxHeight: 240 }} contentContainerStyle={styles.grid}>
          {tab !== 'scene' && tab !== 'toy' ? (
            <Pressable onPress={() => { buzz('light'); apply((s) => K.equip(s, tab, null)); }} style={[styles.tile, !current && styles.tileOn]} accessibilityRole="button" accessibilityLabel="None">
              <View style={styles.iconBox}><Text style={{ fontSize: 26, color: colors.muted }}>∅</Text></View>
              <Text style={styles.tileName}>None</Text>
            </Pressable>
          ) : null}
          {owned.map((c) => (
            <Tile
              key={c.id}
              c={c}
              selected={current === c.id}
              onPress={() => {
                if (tab === 'toy') return;
                buzz('light');
                apply((s) => K.equip(s, tab, current === c.id && tab !== 'scene' ? null : c.id));
              }}
            />
          ))}
        </ScrollView>
        <View style={styles.row}>
          <Button label="Shop" onPress={onShop} style={{ flex: 1 }} />
          <Button primary label="Done" onPress={onClose} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  crystal: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#E9F4FF', borderRadius: 16, padding: 12 },
  crystalTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  crystalBody: { fontSize: 12, fontWeight: '600', color: '#3D5A73' },
  crystalBtn: { height: 40, minWidth: 78, borderRadius: 12, backgroundColor: '#4A8FE0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  crystalBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.6)', justifyContent: 'center', alignItems: 'center', padding: space.md, zIndex: 80 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: space.lg, gap: space.sm, width: '100%', maxWidth: 460, maxHeight: '96%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  coins: { backgroundColor: '#FFF6DD', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5, borderColor: colors.gold },
  coinsText: { fontWeight: '700', color: '#5A3E00', fontSize: 15 },
  section: { fontWeight: '800', fontSize: 17, color: colors.ink, marginTop: 4 },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 },
  lookGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: '4%', rowGap: space.sm },
  look: { width: '48%', alignItems: 'center', gap: 2, padding: 8, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: colors.line },
  lookArt: { alignSelf: 'stretch', height: 84, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  tryBox: { width: 220, height: 220, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tryName: { fontSize: 22, fontWeight: '800', color: colors.ink },
  featured: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, padding: 14, paddingTop: 18, backgroundColor: '#4E3EA8' },
  featTag: { position: 'absolute', top: 0, right: 14, backgroundColor: '#FFE27A', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  featTagText: { fontSize: 12, fontWeight: '600', color: '#3E3290' },
  featArt: { width: 96, height: 96, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  featKicker: { fontSize: 12, fontWeight: '600', letterSpacing: 1, color: '#D8CEFF' },
  featName: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  featBody: { fontSize: 13, fontWeight: '600', color: '#E3DCFF' },
  featPrice: { marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#FFE27A', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  featPriceText: { fontSize: 15, fontWeight: '700', color: '#3E3290' },
  dyeCard: { borderRadius: 22, paddingHorizontal: 14, paddingTop: 30, paddingBottom: 16, backgroundColor: '#221A4D', borderWidth: 3, borderColor: '#FFD24D', alignItems: 'center', gap: 6 },
  dyeTop: { position: 'absolute', top: -1, alignSelf: 'center', backgroundColor: '#FFD24D', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, paddingHorizontal: 12, paddingVertical: 3 },
  dyeTopText: { fontSize: 12, fontWeight: '600', color: '#2A1F5C' },
  dyeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dyeBottle: { width: 92, height: 106, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  dyeArrow: { fontSize: 26, fontWeight: '800', color: '#B9A8FF' },
  dyePet: { width: 110, height: 110, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.8, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  dyeName: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  dyeBody: { fontSize: 13, fontWeight: '600', color: '#D8CEFF', textAlign: 'center' },
  dyeBtn: { marginTop: 4, backgroundColor: '#FFD24D', borderRadius: 14, paddingHorizontal: 22, paddingVertical: 10 },
  dyeBtnText: { fontSize: 17, fontWeight: '800', color: '#2A1F5C' },
  yours: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F3F6F5', borderRadius: 16, padding: 12, marginTop: 4 },
  yoursBtn: { fontSize: 14, fontWeight: '700', color: colors.mintDark },
  back: { fontSize: 15, fontWeight: '700', color: colors.mintDark },
  store: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 14 },
  storeIcon: { fontSize: 40 },
  storeName: { fontSize: 18, fontWeight: '800', color: colors.ink },
  storeSub: { fontSize: 13, fontWeight: '600' },
  newTag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  newTagText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  foodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 10 },
  specialRow: { borderWidth: 2, borderColor: '#FFD84D', backgroundColor: '#FFF8DC' },
  foodName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  have: { fontSize: 12, fontWeight: '600', color: colors.muted },
  foodMeta: { fontSize: 12, fontWeight: '600' },
  foodLeft: { fontSize: 12, fontWeight: '600', color: colors.muted },
  buyBtn: { minWidth: 76, height: 40, borderRadius: 12, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  buyText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: '3%', rowGap: space.sm },
  tile: { width: '31%', alignItems: 'center', gap: 2, padding: 8, borderRadius: 16, borderWidth: 2, borderColor: colors.line, backgroundColor: '#FAFCFB' },
  tileOn: { borderColor: colors.mint, backgroundColor: colors.mintSoft },
  iconBox: { height: 50, alignItems: 'center', justifyContent: 'center' },
  tileName: { fontWeight: '600', fontSize: 12, color: colors.ink, textAlign: 'center' },
  rarity: { fontWeight: '600', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  price: { marginTop: 4, backgroundColor: '#FFF1C9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'stretch', alignItems: 'center' },
  priceText: { fontWeight: '600', fontSize: 13, color: '#5A3E00' },
  owned: { backgroundColor: colors.mintSoft },
  wear: { backgroundColor: colors.mint },
  msg: { fontSize: 13, fontWeight: '600', color: colors.mintDark, textAlign: 'center' },
  row: { flexDirection: 'row', gap: space.sm },
  preview: { height: 200, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 },
  tabs: { flexDirection: 'row', gap: 6, backgroundColor: '#F0F3F2', borderRadius: 999, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 999 },
  tabOn: { backgroundColor: colors.mint },
  tabText: { fontWeight: '600', fontSize: 13, color: colors.ink },
});
