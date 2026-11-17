import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import type { Cosmetic, Slot } from '../game/cosmetics';

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
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <View style={styles.crystal}>
      <Text style={{ fontSize: 34 }}>💎</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.crystalTitle}>Training Crystal</Text>
        <Text style={styles.crystalBody}>+1 to any stat of any pet, from its page. You have {Pw.crystalsOf(state)}.</Text>
        {msg ? <Text style={[styles.crystalBody, { color: colors.mintDark, fontWeight: '900' }]}>{msg}</Text> : null}
      </View>
      <Pressable
        disabled={bought || state.coins < Pw.CRYSTAL_PRICE}
        onPress={() => {
          apply((s) => Pw.buyCrystal(s, today));
          buzz('success');
          setMsg('Got it! Open a pet and tap 💎 Crystals.');
        }}
        style={[styles.crystalBtn, (bought || state.coins < Pw.CRYSTAL_PRICE) && { opacity: 0.5 }]}
        accessibilityRole="button"
        accessibilityLabel={bought ? 'Bought today, back tomorrow' : `Buy a Training Crystal for ${Pw.CRYSTAL_PRICE} coins`}
      >
        <Text style={styles.crystalBtnText}>{bought ? 'Tomorrow' : `🪙 ${Pw.CRYSTAL_PRICE}`}</Text>
      </Pressable>
    </View>
  );
}

export function ShopSheet({ onClose, onWardrobe }: { onClose: () => void; onWardrobe: () => void }) {
  const { state, apply } = useGame();
  const items = K.shopToday(state);
  const left = useCountdown();
  const [justBought, setJustBought] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const slots: Slot[] = ['toy', 'hat', 'aura', 'scene'];
  const premium = K.COSMETICS.filter((c) => c.premium);
  const overlay = useOverlay();

  const purchase = (c: Cosmetic) => {
    const r = K.buy(state, c.id);
    if (!r.ok) {
      setMsg(r.reason);
      buzz('light');
      return;
    }
    buzz('success');
    setMsg(null);
    setJustBought(c.id);
    apply(() => r.state);
  };

  const wear = (c: Cosmetic) => {
    buzz('success');
    apply((s) => K.equip(s, c.slot, c.id));
    setMsg(c.slot === 'scene' ? `${c.name} is your new scene!` : `${A.activePet(state)?.nickname} is wearing the ${c.name}!`);
  };

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={font.title}>🛍️ Today’s shop</Text>
            <Text style={font.small}>New items in {left}</Text>
          </View>
          <View style={styles.coins}><Text style={styles.coinsText}>🪙 {state.coins.toLocaleString()}</Text></View>
        </View>
        <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: space.sm, paddingBottom: space.sm }}>
          {slots.map((slot) => {
            const list = items.filter((c) => c.slot === slot);
            if (!list.length) return null;
            return (
              <View key={slot} style={{ gap: 6 }}>
                <Text style={styles.section}>{SLOT_TITLE[slot]}</Text>
                <View style={styles.grid}>
                  {list.map((c) => {
                    const owned = K.owns(state, c.id);
                    const afford = state.coins >= c.price;
                    return (
                      <Tile key={c.id} c={c}>
                        {owned ? (
                          justBought === c.id && slot !== 'toy' ? (
                            <PopIn>
                              <Pressable onPress={() => wear(c)} style={[styles.price, styles.wear]}><Text style={[styles.priceText, { color: '#fff' }]}>{slot === 'scene' ? 'Use it' : 'Wear it'}</Text></Pressable>
                            </PopIn>
                          ) : (
                            <View style={[styles.price, styles.owned]}><Text style={[styles.priceText, { color: colors.mintDark }]}>Owned ✓</Text></View>
                          )
                        ) : (
                          <Pressable onPress={() => purchase(c)} style={[styles.price, !afford && { opacity: 0.55 }]} accessibilityRole="button" accessibilityLabel={`Buy ${c.name} for ${c.price} coins`}>
                            <Text style={styles.priceText}>🪙 {c.price}</Text>
                          </Pressable>
                        )}
                      </Tile>
                    );
                  })}
                </View>
              </View>
            );
          })}
          <View style={{ gap: 6 }}>
            <Text style={styles.section}>💎 Training Crystal</Text>
            <CrystalOffer />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={styles.section}>🥚 Incubators</Text>
            <IncubatorOffer />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={styles.section}>⭐ Premium (coming soon)</Text>
            <View style={styles.grid}>
              {premium.map((c) => (
                <Tile key={c.id} c={c} dim onPress={() => overlay.open(<PremiumSheet onClose={overlay.close} />)}>
                  <View style={[styles.price, { backgroundColor: '#F1EAFB' }]}><Text style={[styles.priceText, { color: '#7A4BC2' }]}>🔒 Premium</Text></View>
                </Tile>
              ))}
            </View>
          </View>
        </ScrollView>
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        <View style={styles.row}>
          <Button label="👗 My wardrobe" onPress={onWardrobe} style={{ flex: 1 }} />
          <Button primary label="Done" onPress={onClose} style={{ flex: 1 }} />
        </View>
        <Text style={[font.tiny, { textAlign: 'center' }]}>Earn coins from healthy habits, quests, chests, battles and gifts. Chests can hold items too!</Text>
      </View>
    </View>
  );
}

/* ---------------- Wardrobe ---------------- */

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
        <Text style={font.title}>👗 Style {pet.nickname}</Text>
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
          <Button label="🛍️ Shop" onPress={onShop} style={{ flex: 1 }} />
          <Button primary label="Done" onPress={onClose} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  crystal: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#E9F4FF', borderRadius: 16, padding: 12 },
  crystalTitle: { fontSize: 15, fontWeight: '900', color: colors.ink },
  crystalBody: { fontSize: 12, fontWeight: '700', color: '#3D5A73' },
  crystalBtn: { height: 40, minWidth: 78, borderRadius: 12, backgroundColor: '#4A8FE0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  crystalBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.6)', justifyContent: 'center', alignItems: 'center', padding: space.md, zIndex: 80 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: space.lg, gap: space.sm, width: '100%', maxWidth: 460, maxHeight: '96%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  coins: { backgroundColor: '#FFF6DD', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5, borderColor: colors.gold },
  coinsText: { fontWeight: '900', color: '#5A3E00', fontSize: 15 },
  section: { fontWeight: '900', fontSize: 15, color: colors.ink, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: '3%', rowGap: space.sm },
  tile: { width: '31%', alignItems: 'center', gap: 2, padding: 8, borderRadius: 16, borderWidth: 2, borderColor: colors.line, backgroundColor: '#FAFCFB' },
  tileOn: { borderColor: colors.mint, backgroundColor: colors.mintSoft },
  iconBox: { height: 50, alignItems: 'center', justifyContent: 'center' },
  tileName: { fontWeight: '800', fontSize: 12, color: colors.ink, textAlign: 'center' },
  rarity: { fontWeight: '900', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  price: { marginTop: 4, backgroundColor: '#FFF1C9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'stretch', alignItems: 'center' },
  priceText: { fontWeight: '900', fontSize: 13, color: '#5A3E00' },
  owned: { backgroundColor: colors.mintSoft },
  wear: { backgroundColor: colors.mint },
  msg: { fontSize: 13, fontWeight: '800', color: colors.mintDark, textAlign: 'center' },
  row: { flexDirection: 'row', gap: space.sm },
  preview: { height: 200, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 },
  tabs: { flexDirection: 'row', gap: 6, backgroundColor: '#F0F3F2', borderRadius: 999, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 999 },
  tabOn: { backgroundColor: colors.mint },
  tabText: { fontWeight: '900', fontSize: 13, color: colors.ink },
});
