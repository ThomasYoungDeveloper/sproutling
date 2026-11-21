import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '../state/GameContext';
import EggSprite from './EggSprite';
import { Button } from './ui';
import { PopIn, buzz } from './fx';
import { colors } from '../theme';
import { RARITY_INFO } from '../game/rarity';
import * as A from '../game/actions';
import type { Egg, Rarity } from '../game/types';

const RANK: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

/**
 * Basket full: the player picks one egg to leave behind (any basket egg, or the new one).
 * The active pet gets a little XP for it. Runs again while more eggs are waiting.
 */
export default function EggChooser({ onClose }: { onClose: () => void }) {
  const { state, apply } = useGame();
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const incoming = A.overflowEggs(state)[0];
  const basket = A.basketEggs(state);
  const pet = A.activePet(state);
  if (!incoming) {
    return (
      <View style={[styles.wrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 18 }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Text style={styles.title}>All set!</Text>
          {note ? <Text style={styles.sub}>{note}</Text> : null}
        </View>
        <Button primary label="Done" onPress={onClose} />
      </View>
    );
  }
  const eggs: Egg[] = [incoming, ...[...basket].sort((a, b) => RANK[a.rarity] - RANK[b.rarity])];
  const sel = eggs.find((e) => e.id === picked);
  const xp = sel ? A.LEAVE_XP[sel.rarity] : 0;
  const leave = () => {
    if (!sel) return;
    buzz('success', 'coin');
    let gained = 0;
    apply((s) => {
      const r = A.leaveEgg(s, sel.id);
      gained = r?.xp ?? 0;
      return r?.state ?? s;
    });
    setNote(`${RARITY_INFO[sel.rarity].label} egg left behind${gained && pet ? `. ${pet.nickname} got +${gained} XP` : ''}.`);
    setPicked(null);
  };
  const more = A.overflowEggs(state).length - 1;
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 14 }]}>
      <Text style={styles.title} accessibilityRole="header">Basket full</Text>
      <Text style={styles.sub}>
        Pick 1 egg to leave behind. The other {A.EGG_BASKET} stay.{more > 0 ? ` ${more} more waiting after this.` : ''}
      </Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <ScrollView contentContainerStyle={styles.grid} style={{ flex: 1 }}>
        {eggs.map((e) => {
          const isNew = e.id === incoming.id;
          const on = e.id === picked;
          return (
            <Pressable
              key={e.id}
              onPress={() => { buzz('light'); setPicked(on ? null : e.id); }}
              style={[styles.tile, isNew && { borderColor: RARITY_INFO[e.rarity].color }, on && styles.tileOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${isNew ? 'New ' : ''}${RARITY_INFO[e.rarity].label} egg${on ? ', picked to leave behind' : ''}`}
            >
              {isNew ? <View style={[styles.newTag, { backgroundColor: RARITY_INFO[e.rarity].color }]}><Text style={styles.newText}>NEW</Text></View> : null}
              {on ? <View style={styles.x}><Text style={styles.xText}>✕</Text></View> : null}
              <View style={on ? { opacity: 0.5 } : undefined}>
                <EggSprite rarity={e.rarity} size={isNew ? 54 : 46} />
              </View>
              <Text style={[styles.rar, { color: RARITY_INFO[e.rarity].color }]} numberOfLines={1}>{RARITY_INFO[e.rarity].label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ gap: 8 }}>
        {sel ? (
          <PopIn from={0.9}>
            <Pressable onPress={leave} style={styles.leave} accessibilityRole="button">
              <Text style={styles.leaveText}>Leave {RARITY_INFO[sel.rarity].label} egg{xp && pet ? ` · +${xp} XP for ${pet.nickname}` : ''}</Text>
            </Pressable>
          </PopIn>
        ) : (
          <View style={[styles.leave, { backgroundColor: '#C9D3CF' }]}><Text style={styles.leaveText}>Tap an egg to leave behind</Text></View>
        )}
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
          <Text style={styles.later}>Decide later (it waits on the Eggs tab)</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F6FAF8', paddingHorizontal: 16, gap: 8, zIndex: 120 },
  title: { fontSize: 26, fontWeight: '900', color: colors.ink },
  sub: { fontSize: 15, fontWeight: '800', color: colors.muted },
  note: { fontSize: 14, fontWeight: '900', color: '#1E9E6A' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 14, paddingBottom: 10 },
  tile: { width: '22.5%', height: 96, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#E3EAE7', alignItems: 'center', justifyContent: 'center' },
  tileOn: { borderColor: '#E5533D', backgroundColor: '#FFF1EE' },
  newTag: { position: 'absolute', top: -10, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, zIndex: 2 },
  newText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  x: { position: 'absolute', top: -9, right: -9, width: 24, height: 24, borderRadius: 12, backgroundColor: '#E5533D', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  xText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  rar: { fontSize: 12, fontWeight: '900' },
  leave: { backgroundColor: '#E5533D', borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  leaveText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16, textAlign: 'center' },
  later: { textAlign: 'center', fontSize: 14, fontWeight: '800', color: colors.muted, paddingVertical: 4 },
});
