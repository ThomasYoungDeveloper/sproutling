import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from './ScaledText';
import Svg, { Path, Rect } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import { Button } from './ui';
import { buzz, Confetti, Rays } from './fx';
import { play } from '../lib/sound';
import { colors, space } from '../theme';
import { dailyQuests } from '../game/scoring';
import { careTasks } from '../game/care';
import * as A from '../game/actions';

/**
 * Little bursts of joy when you finish things: a banner with confetti for each habit quest,
 * a bigger one when all your pet care is done, and a full celebration (with the chest) for all three habits.
 */

type Banner = { id: number; emoji: string; title: string; sub: string; color: string };

const QUEST_EMOJI: Record<string, string> = { walk: '👟', water: '💧', sleep: '😴' };
const QUEST_DONE: Record<string, string> = { walk: '8,000 steps walked', water: '6 glasses of water', sleep: '7+ hours of sleep' };
const QUEST_COLOR: Record<string, string> = { walk: '#2FB58A', water: '#3D8FD6', sleep: '#7A5FD6' };

export function useCelebrations(ready: boolean) {
  const { state } = useGame();
  const day = A.todayKey(state);
  const d = A.today(state);
  const quests = dailyQuests(d);
  const doneQ = quests.filter((q) => q.done).map((q) => q.id).join(',');
  const careDone = careTasks(d).every((t) => t.done);
  const seen = useRef<{ day: string; quests: string; care: boolean } | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [big, setBig] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const prev = seen.current;
    seen.current = { day, quests: doneQ, care: careDone };
    // First look (or a new day): remember without celebrating old news.
    if (!prev || prev.day !== day) return;
    const before = new Set(prev.quests ? prev.quests.split(',') : []);
    const fresh = quests.filter((q) => q.done && !before.has(q.id));
    if (fresh.length && quests.every((q) => q.done)) {
      setBanner(null);
      setBig(true);
      return;
    }
    if (fresh.length) {
      const q = fresh[0];
      const left = quests.filter((x) => !x.done).length;
      setBanner({ id: Date.now(), emoji: QUEST_EMOJI[q.id] ?? '✅', title: 'Quest complete!', sub: `${QUEST_DONE[q.id] ?? q.label} · ${left} more for a chest`, color: QUEST_COLOR[q.id] ?? colors.mint });
      return;
    }
    if (careDone && !prev.care) {
      setBanner({ id: Date.now(), emoji: '💖', title: 'All care done!', sub: 'Fed, played and treated: +30% XP today', color: '#E0567A' });
    }
  }, [ready, day, doneQ, careDone]);

  return { banner, dismissBanner: () => setBanner(null), big, dismissBig: () => setBig(false) };
}

export function QuestBanner({ banner, onDone }: { banner: Banner; onDone: () => void }) {
  const y = useRef(new Animated.Value(-120)).current;
  const { width } = useWindowDimensions();
  useEffect(() => {
    buzz('success', 'none');
    play('chime');
    Animated.spring(y, { toValue: 0, friction: 6, tension: 90, useNativeDriver: true }).start();
    const t = setTimeout(() => Animated.timing(y, { toValue: -140, duration: 260, useNativeDriver: true }).start(onDone), 3000);
    return () => clearTimeout(t);
  }, [banner.id]);
  return (
    <View pointerEvents="box-none" style={styles.bannerWrap}>
      <Confetti amount={34} width={width} height={420} />
      <Animated.View style={{ transform: [{ translateY: y }], alignItems: 'center' }}>
        <Pressable onPress={onDone} style={[styles.banner, { borderColor: banner.color }]} accessibilityRole="alert">
          <View style={[styles.bannerIcon, { backgroundColor: banner.color }]}><Text style={{ fontSize: 24 }}>{banner.emoji}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: banner.color }]}>{banner.title}</Text>
            <Text style={styles.bannerSub} numberOfLines={2}>{banner.sub}</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function BigChest() {
  return (
    <Svg width={130} height={120} viewBox="0 0 64 60">
      <Rect x={8} y={26} width={48} height={30} rx={5} fill="#C98A54" stroke="#24323A" strokeWidth={2.5} />
      <Path d="M8 28 Q8 12 32 12 Q56 12 56 28 Z" fill="#A86B3A" stroke="#24323A" strokeWidth={2.5} strokeLinejoin="round" />
      <Rect x={27} y={24} width={10} height={12} rx={2} fill="#FFE27A" stroke="#24323A" strokeWidth={2} />
    </Svg>
  );
}

/** All three habits done: rays, confetti, a bouncing chest and your streak. */
export function DayComplete({ onClose, onChests }: { onClose: () => void; onChests: () => void }) {
  const { state } = useGame();
  const { width, height } = useWindowDimensions();
  const pop = useRef(new Animated.Value(0)).current;
  const drop = useRef(new Animated.Value(0)).current;
  const streak = A.streak(state);
  useEffect(() => {
    buzz('success', 'none');
    play('win');
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
    Animated.sequence([
      Animated.delay(250),
      Animated.timing(drop, { toValue: 1, duration: 650, easing: Easing.bounce, useNativeDriver: true }),
    ]).start(() => play('chest'));
  }, []);
  return (
    <View style={styles.bigBack}>
      <Confetti amount={110} width={width} height={height} />
      <Animated.View style={[styles.bigCard, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]}>
        <Text style={styles.bigKicker}>DAILY QUESTS COMPLETE</Text>
        <Text style={styles.bigTitle}>All 3 habits done!</Text>
        <View style={styles.bigStage}>
          <Rays color="#FFC94D" size={260} />
          <Animated.View style={{ transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-160, 0] }) }] }}>
            <BigChest />
          </Animated.View>
        </View>
        <Text style={styles.bigLine}>Bronze chest earned</Text>
        <Text style={styles.bigLine}>🔥 {streak}-day streak{streak > 0 && streak % 7 === 0 ? ' · Silver chest too!' : ''}</Text>
        <View style={{ alignSelf: 'stretch', gap: space.sm, marginTop: space.sm }}>
          <Button primary label="Open my chest" onPress={() => { onClose(); onChests(); }} />
          <Button label="Woohoo!" onPress={onClose} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 95, paddingTop: 48, paddingHorizontal: space.md },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 3, padding: 10, width: '100%', maxWidth: 440, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  bannerIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 18, fontWeight: '900' },
  bannerSub: { fontSize: 13, fontWeight: '800', color: colors.muted },
  bigBack: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.72)', justifyContent: 'center', alignItems: 'center', padding: space.md, zIndex: 110 },
  bigCard: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: space.lg, width: '100%', maxWidth: 380, alignItems: 'center', gap: 4 },
  bigKicker: { fontSize: 12, fontWeight: '900', letterSpacing: 1.2, color: '#C99212' },
  bigTitle: { fontSize: 28, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  bigStage: { width: 260, height: 190, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bigLine: { fontSize: 16, fontWeight: '900', color: colors.ink },
});
