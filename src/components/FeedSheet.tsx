import { useResetIn } from '../lib/useResetIn';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { Icon, type IconName } from './Icon';
import { useGame } from '../state/GameContext';
import * as A from '../game/actions';
import * as F from '../game/food';
import { RARITY_INFO } from '../game/rarity';
import { colors, font } from '../theme';
import { buzz } from './fx';

/** Pick what to feed: free Pellets, food found on walks, or food from the shop. */
export default function FeedSheet({ onFeed, onClose, onShop }: { onFeed: (foodId: string) => void; onClose: () => void; onShop?: () => void }) {
  const { state, apply } = useGame();
  const pet = A.activePet(state);
  const day = A.today(state);
  const needs = F.needsFor(day);
  const used = F.boostsUsedToday(day);
  const resetIn = useResetIn();
  const [msg, setMsg] = useState<string | null>(null);
  if (!pet) return null;

  const owned = F.FOODS.filter((f) => F.foodCount(state, f.id) > 0);

  const tile = (f: F.FoodDef) => {
    const have = F.foodCount(state, f.id);
    const gain = F.boostFor(pet, f, day);
    const check = F.canFeed(state, day, pet.id, f.id);
    const rare = RARITY_INFO[f.rarity];
    const known = F.tasteKnown(pet, f.id);
    return (
      <Pressable
        key={f.id}
        onPress={() => {
          if (!check.ok) return setMsg(check.reason);
          onFeed(f.id);
        }}
        style={({ pressed }) => [styles.tile, { backgroundColor: '#F1F8F4' }, known === 'fav' && styles.tileFav, known === 'dislike' && { opacity: 0.75 }, pressed && { transform: [{ scale: 0.96 }] }]}
        accessibilityRole="button"
        accessibilityLabel={`${f.name}, ${rare.label}, ${F.pct(gain)} ${F.statLabel(f.stat)}, you have ${have}${known === 'fav' ? ', favorite' : known === 'dislike' ? ', not a fan' : known === 'new' ? ', not tried yet' : ''}`}
      >
        <View style={[styles.taste, known === 'fav' && { backgroundColor: '#FFE3EA' }]}>
          <Text style={[styles.tasteText, known === 'fav' && { color: '#C2334E' }]}>{known === 'fav' ? 'Favorite' : known === 'dislike' ? 'Not a fan' : known === 'tried' ? 'Tried' : '?'}</Text>
        </View>
        <Text style={{ fontSize: 26 }}>{f.emoji}</Text>
        <Text style={styles.tileName} numberOfLines={1}>{f.name} ×{have}</Text>
        <Text style={[styles.tileRarity, { color: rare.color }]}>{rare.label.toUpperCase()}</Text>
        <Text style={styles.tileGain}>{gain > 0 ? `${F.pct(gain)} ${F.statLabel(f.stat)}` : used >= F.BOOSTS_PER_DAY ? 'Just a snack' : 'Stat maxed'}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.head}>
          <Text style={font.title}>Feed {pet.nickname}</Text>
          <View style={styles.chips}>
            <View style={[styles.chip, { backgroundColor: '#FBE7DA' }]}>
              <Icon name="bowl" size={14} color="#B24E1C" />
              <Text style={[styles.chipText, { color: '#B24E1C' }]}>Food {needs.food}%</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: '#E6F4EE' }]} accessibilityLabel={`${F.BOOSTS_PER_DAY - used} of ${F.BOOSTS_PER_DAY} stat bonuses left today`}>
              <Icon name="dumbbell" size={14} color={colors.mintDark} />
              <Text style={[styles.chipText, { color: colors.mintDark }]}>{used >= F.BOOSTS_PER_DAY ? `Stat bonuses back in ${resetIn}` : `Stat bonuses: ${F.BOOSTS_PER_DAY - used} of ${F.BOOSTS_PER_DAY} left`}</Text>
            </View>
          </View>
          <Text style={styles.small}>
            Food makes {pet.nickname} a little stronger for good. The first {F.BOOSTS_PER_DAY} foods each day give a stat bonus; after that, food just fills the tummy.
          </Text>
        </View>
        <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
          <Pressable
            onPress={() => onFeed(F.PELLETS.id)}
            style={({ pressed }) => [styles.pellets, pressed && { transform: [{ scale: 0.98 }] }]}
            accessibilityRole="button"
            accessibilityLabel="Feed Pellets, free, fills the food bar"
          >
            <Text style={{ fontSize: 28 }}>{F.PELLETS.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.pelletsTitle}>Pellets · always free</Text>
              <Text style={styles.small}>Fills the food bar. No bonus.</Text>
            </View>
            <Text style={styles.feedWord}>Feed</Text>
          </Pressable>

          <Text style={styles.section}>YOUR FOOD</Text>
          <Text style={styles.small}>{pet.nickname} secretly loves one food (double boost) and isn’t a fan of one (half boost). Try foods to find out.</Text>
          {owned.length ? (
            <View style={styles.grid}>{owned.map((f) => tile(f))}</View>
          ) : (
            <Text style={styles.small}>No food yet. Go for a walk: every 1,000 steps {pet.nickname} might sniff out berries, mushrooms or something rarer.</Text>
          )}


          <Text style={styles.small}>
            Bonus size by rarity: Common +0.8%, Uncommon +1.2%, Rare +1.8%, Epic +2.5%, Legendary +4%. Each stat can gain up to +10% from food.
          </Text>
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        </ScrollView>
      </View>
    </View>
  );
}

/** Four tiny bars (food, fun, water, energy) for the name pill. */
export function NeedsMini({ needs }: { needs: F.Needs }) {
  const bars: [IconName, number, string, string][] = [
    ['bowl', needs.food, '#E07A3F', '#F2E1D6'],
    ['ball', needs.fun, '#E5A800', '#F3EBC8'],
    ['drop', needs.water, '#2E7FB8', '#D7E9F5'],
    ['moon', needs.energy, '#6E62C6', '#E6E2F6'],
  ];
  return (
    <View style={styles.mini}>
      {bars.map(([icon, v, fill, track]) => (
        <View key={icon} style={styles.miniItem}>
          <Icon name={icon} size={11} color={fill} strokeWidth={2.4} />
          <View style={[styles.miniTrack, { backgroundColor: track }]}>
            <View style={[styles.miniFill, { width: `${v}%`, backgroundColor: fill }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** The full "How your pet feels" panel, opened by tapping the name pill. */
export function NeedsSheet({ name, needs, onClose, onFeed, onPlay }: { name: string; needs: F.Needs; onClose: () => void; onFeed: () => void; onPlay: () => void }) {
  const rows: { icon: IconName; label: string; v: number; fill: string; track: string; action: string; onPress?: () => void }[] = [
    { icon: 'bowl', label: 'Food', v: needs.food, fill: '#E07A3F', track: '#F2E1D6', action: 'Feed', onPress: onFeed },
    { icon: 'ball', label: 'Fun', v: needs.fun, fill: '#E5A800', track: '#F3EBC8', action: 'Play', onPress: onPlay },
    { icon: 'drop', label: 'Water', v: needs.water, fill: '#2E7FB8', track: '#D7E9F5', action: 'Log water' },
    { icon: 'moon', label: 'Energy', v: needs.energy, fill: '#6E62C6', track: '#E6E2F6', action: 'Log sleep' },
  ];
  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={font.title}>How {name} feels</Text>
        {rows.map((r) => (
          <View key={r.label} style={styles.needRow} accessibilityLabel={`${r.label} ${r.v}%`}>
            <View style={{ width: 28, alignItems: 'center' }}><Icon name={r.icon} size={20} color={r.fill} /></View>
            <Text style={styles.needLabel}>{r.label}</Text>
            <View style={[styles.needTrack, { backgroundColor: r.track }]}>
              <View style={[styles.miniFill, { width: `${r.v}%`, backgroundColor: r.fill }]} />
            </View>
            {r.onPress ? (
              <Pressable onPress={r.onPress} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.needAction, { color: r.fill }]}>{r.action}</Text>
              </Pressable>
            ) : (
              <Text style={[styles.needAction, { color: r.fill }]}>{r.action}</Text>
            )}
          </View>
        ))}
        <Text style={styles.small}>Bars drift down slowly through the day and never hit zero. All of them full makes {name} Joyful; low bars just make it grumpy.</Text>
        <Pressable onPress={onClose} style={styles.close} accessibilityRole="button">
          <Text style={styles.closeText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tileFav: { borderWidth: 2, borderColor: '#F2617A' },
  taste: { position: 'absolute', top: 4, right: 4, backgroundColor: '#EEF3F1', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  tasteText: { fontSize: 9, fontWeight: '600', color: '#5C6F69' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,30,35,0.45)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 30, gap: 10, width: '100%', maxWidth: 520 },
  handle: { width: 44, height: 5, borderRadius: 999, backgroundColor: '#DCE7E2', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: 13, fontWeight: '600' },
  market: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFE3B8', borderRadius: 14, padding: 10 },
  pellets: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F1F4F3', borderRadius: 14, padding: 10 },
  pelletsTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  feedWord: { fontSize: 14, fontWeight: '700', color: colors.mintDark },
  section: { fontSize: 12, fontWeight: '600', color: '#3E6B5E', letterSpacing: 0.4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '23%', minWidth: 74, flexGrow: 1, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 2, alignItems: 'center', gap: 1 },
  tileName: { fontSize: 12, fontWeight: '600', color: colors.ink },
  tileRarity: { fontSize: 9, fontWeight: '600' },
  tileGain: { fontSize: 12, fontWeight: '600', color: colors.mintDark },
  price: { fontSize: 12, fontWeight: '600', color: '#9A6A00' },
  small: { fontSize: 12, fontWeight: '600', color: colors.muted },
  msg: { fontSize: 13, fontWeight: '600', color: '#C4562F' },
  mini: { flexDirection: 'row', gap: 6, marginTop: 3 },
  miniItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  miniIcon: { fontSize: 12 },
  miniTrack: { flex: 1, height: 5, borderRadius: 999, overflow: 'hidden' },
  miniFill: { height: '100%', borderRadius: 999 },
  needRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  needLabel: { width: 58, fontSize: 14, fontWeight: '700', color: colors.ink },
  needTrack: { flex: 1, height: 12, borderRadius: 999, overflow: 'hidden' },
  needAction: { fontSize: 13, fontWeight: '600', minWidth: 64, textAlign: 'right' },
  close: { height: 48, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  closeText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
