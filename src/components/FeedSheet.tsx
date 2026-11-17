import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  const [msg, setMsg] = useState<string | null>(null);
  if (!pet) return null;

  const owned = F.FOODS.filter((f) => F.foodCount(state, f.id) > 0);
  const shopFoods = F.SHOP_FOODS;

  const tile = (f: F.FoodDef, shop: boolean) => {
    const have = F.foodCount(state, f.id);
    const gain = F.boostFor(pet, f);
    const check = F.canFeed(state, day, pet.id, f.id);
    const rare = RARITY_INFO[f.rarity];
    const canBuy = shop;
    return (
      <Pressable
        key={f.id}
        onPress={() => {
          if (canBuy) {
            if (state.coins < (f.price ?? 0)) return setMsg(`${f.name} costs ${f.price} coins.`);
            apply((s) => F.buyFood(s, f.id));
            buzz('light', 'coin');
            return setMsg(`Bought ${f.name}! It's in your food now.`);
          }
          if (!check.ok) return setMsg(check.reason);
          onFeed(f.id);
        }}
        style={({ pressed }) => [styles.tile, { backgroundColor: shop ? '#FFF3E6' : '#F1F8F4' }, pressed && { transform: [{ scale: 0.96 }] }]}
        accessibilityRole="button"
        accessibilityLabel={`${f.name}, ${rare.label}, +${gain} ${F.statLabel(f.stat)}${canBuy ? `, buy for ${f.price} coins` : `, you have ${have}`}`}
      >
        <Text style={{ fontSize: 26 }}>{f.emoji}</Text>
        <Text style={styles.tileName} numberOfLines={1}>{f.name}{!shop && have > 0 ? ` ×${have}` : ''}</Text>
        <Text style={[styles.tileRarity, { color: rare.color }]}>{rare.label.toUpperCase()}</Text>
        <Text style={styles.tileGain}>{gain > 0 ? `+${gain} ${F.statLabel(f.stat)}` : 'Stat maxed'}</Text>
        {canBuy ? <Text style={styles.price}>🪙 {f.price}</Text> : null}
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
              <Text style={styles.chipEmoji}>🍙</Text>
              <Text style={[styles.chipText, { color: '#B24E1C' }]}>Food {needs.food}%</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: '#E6F4EE' }]} accessibilityLabel={`${F.BOOSTS_PER_DAY - used} stat boosts left today`}>
              <Text style={styles.chipEmoji}>💪</Text>
              <Text style={[styles.chipText, { color: colors.mintDark }]}>{F.BOOSTS_PER_DAY - used} boosts left today</Text>
            </View>
          </View>
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
          {owned.length ? (
            <View style={styles.grid}>{owned.map((f) => tile(f, false))}</View>
          ) : (
            <Text style={styles.small}>No food yet. Buy some below, or go for a walk: every 1,000 steps {pet.nickname} might sniff out berries, mushrooms or something rarer.</Text>
          )}

          <Text style={styles.section}>BUY FOOD</Text>
          <View style={styles.grid}>{shopFoods.map((f) => tile(f, true))}</View>

          <Text style={styles.small}>
            Every food except Pellets raises one stat a little: Common +1, Uncommon +2, Rare +3, Epic +5, Legendary +8 (HP 4×). Up to {F.BOOSTS_PER_DAY} stat boosts a day; Pellets anytime.
          </Text>
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        </ScrollView>
        {onShop ? null : null}
      </View>
    </View>
  );
}

/** Four tiny bars (food, fun, water, energy) for the name pill. */
export function NeedsMini({ needs }: { needs: F.Needs }) {
  const bars: [string, number, string, string][] = [
    ['🍙', needs.food, '#E07A3F', '#F2E1D6'],
    ['🎾', needs.fun, '#E5A800', '#F3EBC8'],
    ['💧', needs.water, '#2E7FB8', '#D7E9F5'],
    ['🌙', needs.energy, '#6E62C6', '#E6E2F6'],
  ];
  return (
    <View style={styles.mini}>
      {bars.map(([icon, v, fill, track]) => (
        <View key={icon} style={styles.miniItem}>
          <Text style={styles.miniIcon}>{icon}</Text>
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
  const rows: { icon: string; label: string; v: number; fill: string; track: string; action: string; onPress?: () => void }[] = [
    { icon: '🍙', label: 'Food', v: needs.food, fill: '#E07A3F', track: '#F2E1D6', action: 'Feed', onPress: onFeed },
    { icon: '🎾', label: 'Fun', v: needs.fun, fill: '#E5A800', track: '#F3EBC8', action: 'Play', onPress: onPlay },
    { icon: '💧', label: 'Water', v: needs.water, fill: '#2E7FB8', track: '#D7E9F5', action: 'Log water' },
    { icon: '🌙', label: 'Energy', v: needs.energy, fill: '#6E62C6', track: '#E6E2F6', action: 'Log sleep' },
  ];
  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={font.title}>How {name} feels</Text>
        {rows.map((r) => (
          <View key={r.label} style={styles.needRow} accessibilityLabel={`${r.label} ${r.v}%`}>
            <Text style={{ fontSize: 20, width: 28 }}>{r.icon}</Text>
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
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,30,35,0.45)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { backgroundColor: '#FFFCF5', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 30, gap: 10, width: '100%', maxWidth: 520 },
  handle: { width: 44, height: 5, borderRadius: 999, backgroundColor: '#DCE7E2', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: 13, fontWeight: '900' },
  pellets: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F1F4F3', borderRadius: 14, padding: 10 },
  pelletsTitle: { fontSize: 15, fontWeight: '900', color: colors.ink },
  feedWord: { fontSize: 14, fontWeight: '900', color: colors.mintDark },
  section: { fontSize: 12, fontWeight: '900', color: '#3E6B5E', letterSpacing: 0.4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '23%', minWidth: 74, flexGrow: 1, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 2, alignItems: 'center', gap: 1 },
  tileName: { fontSize: 11, fontWeight: '900', color: colors.ink },
  tileRarity: { fontSize: 9, fontWeight: '900' },
  tileGain: { fontSize: 10, fontWeight: '800', color: colors.mintDark },
  price: { fontSize: 10, fontWeight: '900', color: '#9A6A00' },
  small: { fontSize: 12, fontWeight: '700', color: colors.muted },
  msg: { fontSize: 13, fontWeight: '800', color: '#C4562F' },
  mini: { flexDirection: 'row', gap: 6, marginTop: 3 },
  miniItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  miniIcon: { fontSize: 10 },
  miniTrack: { flex: 1, height: 5, borderRadius: 999, overflow: 'hidden' },
  miniFill: { height: '100%', borderRadius: 999 },
  needRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  needLabel: { width: 58, fontSize: 14, fontWeight: '900', color: colors.ink },
  needTrack: { flex: 1, height: 12, borderRadius: 999, overflow: 'hidden' },
  needAction: { fontSize: 13, fontWeight: '900', minWidth: 64, textAlign: 'right' },
  close: { height: 48, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  closeText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
});
