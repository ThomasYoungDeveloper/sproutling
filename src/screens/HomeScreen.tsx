import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../state/GameContext';
import PetScene from '../components/PetScene';
import TodayCard from '../components/TodayCard';
import { useOverlay } from '../components/Overlay';
import { ShopSheet, WardrobeSheet } from '../components/ShopSheets';
import ExpeditionCard from '../components/ExpeditionCard';
import EventCard from '../components/EventCard';
import AchievementsSheet from '../components/AchievementsSheet';
import PetSheet from '../components/PetSheet';
import TrainingCard from '../components/TrainingCard';
import EggSprite from '../components/EggSprite';
import { Button } from '../components/ui';
import { buzz, PopIn } from '../components/fx';
import { colors, font, space } from '../theme';
import { RARITY_INFO } from '../game/rarity';
import * as A from '../game/actions';
import * as C from '../game/care';

type Tab = 'eggs' | 'chests';

/** Reminders that get a chip. Everything else already shows up on Home (tray, Today card, event and expedition rows). */
const CHIP_IDS = ['chests', 'badges', 'egg'];

function chipLabel(r: C.Reminder, s: ReturnType<typeof useGame>['state']): { icon: string; text: string } {
  if (r.id === 'train' && r.petId) {
    const p = s.pets.find((x) => x.id === r.petId);
    const pts = r.text.match(/has (\d+)/)?.[1] ?? '';
    return { icon: '💪', text: `Train ${p?.nickname ?? 'pet'} · ${pts} pt${pts === '1' ? '' : 's'}` };
  }
  if (r.id === 'chests') return { icon: '🎁', text: s.chests.length === 1 ? 'Open a chest' : `Open ${s.chests.length} chests` };
  if (r.id === 'badges') return { icon: '🏅', text: 'Badges' };
  if (r.id === 'egg') return { icon: '👣', text: r.text.replace(/^Your /, '').replace(' hatches in', ' hatches in') };
  return { icon: r.icon, text: r.text };
}

export default function HomeScreen({ onNavigate, onAccount, account, banner }: { onNavigate?: (tab: Tab) => void; onAccount?: () => void; account?: { initial: string; label: string; warn?: boolean }; banner?: React.ReactNode }) {
  const { state, apply } = useGame();
  const pet = A.activePet(state);
  const overlay = useOverlay();
  const openShop = () => overlay.open(<ShopSheet onClose={overlay.close} onWardrobe={openWardrobe} />);
  const openWardrobe = () => overlay.open(<WardrobeSheet onClose={overlay.close} onShop={openShop} />);
  const readyEggs = state.eggs.filter(A.isReady);
  const chips = C.reminders(state).filter((r) => CHIP_IDS.includes(r.id));

  const act = (r: C.Reminder) => {
    buzz('light');
    if (r.action === 'eggs' || r.action === 'chests') onNavigate?.(r.action);
    else if (r.action === 'badges') overlay.open(<AchievementsSheet onClose={overlay.close} />);
    else if (r.action === 'train' && r.petId) overlay.open(<PetSheet petId={r.petId} onClose={overlay.close} />);
    else if (r.id === 'egg') onNavigate?.('eggs');
  };

  return (
    <View>
      {pet ? <PetScene onShop={openShop} onDressUp={openWardrobe} onAccount={onAccount} account={account} /> : null}
      <View style={styles.homeSheet}>
      {banner}
      <TodayCard />

      {readyEggs.length ? <HatchCard rarity={readyEggs[0].rarity} count={readyEggs.length} onPress={() => { buzz('success'); onNavigate?.('eggs'); }} /> : null}

      {chips.length ? (
        <View style={styles.chips}>
          {chips.slice(0, 2).map((r) => {
            const c = chipLabel(r, state);
            return (
              <Pressable key={r.id} onPress={() => act(r)} style={({ pressed }) => [styles.chip, pressed && { transform: [{ scale: 0.96 }] }]} accessibilityRole="button" accessibilityLabel={r.text}>
                <Text style={{ fontSize: 15 }}>{c.icon}</Text>
                <Text style={styles.chipText}>{c.text}</Text>
              </Pressable>
            );
          })}
          {chips.length > 2 ? (
            <Pressable
              onPress={() => overlay.open(<TodoSheet items={chips} onPick={(r) => { overlay.close(); act(r); }} onClose={overlay.close} />)}
              style={({ pressed }) => [styles.chip, styles.more, pressed && { transform: [{ scale: 0.96 }] }]}
              accessibilityRole="button"
              accessibilityLabel={`${chips.length - 2} more to do`}
            >
              <Text style={[styles.chipText, { color: colors.mintDark }]}>+{chips.length - 2}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <EventCard />
      <ExpeditionCard />
      {pet ? <TrainingCard onOpen={() => overlay.open(<PetSheet petId={pet.id} onClose={overlay.close} />)} /> : null}
      </View>
    </View>
  );
}

/** A big, wobbling call to action when an egg is ready to hatch. */
function HatchCard({ rarity, count, onPress }: { rarity: Parameters<typeof EggSprite>[0]['rarity']; count: number; onPress: () => void }) {
  const wobble = useRef(new Animated.Value(0)).current;
  const twinkle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.delay(1100),
        Animated.timing(wobble, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: -1, duration: 160, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 0.6, duration: 140, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]),
    );
    const b = Animated.loop(Animated.timing(twinkle, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }));
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, []);
  const label = RARITY_INFO[rarity].label;
  const sparkle = (delay: number) => twinkle.interpolate({ inputRange: [0, (0.1 + delay) % 1, (0.5 + delay) % 1 > (0.1 + delay) % 1 ? (0.5 + delay) % 1 : 0.99, 1], outputRange: [0, 1, 0, 0], extrapolate: 'clamp' });
  return (
    <PopIn>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.hatch, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button" accessibilityLabel={`Your ${label} egg is ready to hatch. Hatch it now`}>
        <Animated.Text style={[styles.spark, { top: 8, left: 70, opacity: sparkle(0) }]}>✦</Animated.Text>
        <Animated.Text style={[styles.spark, { bottom: 8, left: 10, fontSize: 11, opacity: sparkle(0.3) }]}>✦</Animated.Text>
        <Animated.Text style={[styles.spark, { top: 10, right: 100, fontSize: 12, opacity: sparkle(0.6) }]}>✦</Animated.Text>
        <View style={styles.eggBox}>
          <Animated.View style={{ transform: [{ rotate: wobble.interpolate({ inputRange: [-1, 1], outputRange: ['-12deg', '12deg'] }) }] }}>
            <EggSprite rarity={rarity} size={46} />
          </Animated.View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.hatchKicker}>IT’S CRACKING!</Text>
          <Text style={styles.hatchTitle}>{count > 1 ? `${count} eggs are ready` : `Your ${label} egg is ready`}</Text>
        </View>
        <View style={styles.hatchBtn}><Text style={styles.hatchBtnText}>Hatch!</Text></View>
      </Pressable>
    </PopIn>
  );
}

function TodoSheet({ items, onPick, onClose }: { items: C.Reminder[]; onPick: (r: C.Reminder) => void; onClose: () => void }) {
  return (
    <View style={styles.dim}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.grab} />
        <Text style={font.title}>To do</Text>
        {items.map((r) => (
          <Pressable key={r.id} onPress={() => onPick(r)} style={({ pressed }) => [styles.todo, pressed && { opacity: 0.7 }]} accessibilityRole="button">
            <Text style={{ fontSize: 20 }}>{r.icon}</Text>
            <Text style={[font.body, { flex: 1, fontWeight: '800' }]}>{r.text}</Text>
            <Text style={styles.go}>›</Text>
          </Pressable>
        ))}
        <Button label="Close" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  homeSheet: { borderTopWidth: 3, borderTopColor: 'rgba(31,58,51,0.10)', backgroundColor: colors.bg, padding: space.lg, paddingTop: space.lg, gap: space.md, width: '100%', maxWidth: 520, alignSelf: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { height: 38, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { fontSize: 14, fontWeight: '900', color: colors.ink },
  more: { backgroundColor: colors.mintSoft, borderColor: colors.mintSoft, flexShrink: 0 },
  hatch: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFC93C', borderWidth: 3, borderColor: '#FFFFFF', borderRadius: 22, paddingVertical: 10, paddingLeft: 10, paddingRight: 14, overflow: 'hidden', shadowColor: '#E0A21A', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  eggBox: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#FFF3CC', alignItems: 'center', justifyContent: 'center' },
  hatchKicker: { fontSize: 12, fontWeight: '900', letterSpacing: 1, color: '#8A5A00' },
  hatchTitle: { fontSize: 19, fontWeight: '900', color: '#4A2F00', lineHeight: 22 },
  hatchBtn: { backgroundColor: '#E8590C', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#A63E06', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 3 } },
  hatchBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  spark: { position: 'absolute', color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.5)', justifyContent: 'flex-end', alignItems: 'center', zIndex: 50 },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.lg, paddingTop: 10, gap: space.sm, width: '100%', maxWidth: 520 },
  grab: { width: 44, height: 5, borderRadius: 999, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 4 },
  todo: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
  go: { fontSize: 22, fontWeight: '900', color: colors.muted },
});
