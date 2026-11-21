import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import { Button, Card, ProgressBar } from './ui';
import { ItemIcon } from './Cosmetics';
import { buzz, Confetti, PopIn } from './fx';
import { colors, space } from '../theme';
import * as Ev from '../game/events';
import * as A from '../game/actions';
import EggSprite from './EggSprite';
import { DyeIcon } from './Dyes';
import type { Milestone } from '../game/events';

const EVENT_CHEST = require('../../assets/chests/event.png');

/** The picture for a reward: the item itself, a dye bottle, an event egg, or a chest. */
function RewardIcon({ m, size }: { m: Milestone; size: number }) {
  if (m.item) return <ItemIcon id={m.item} size={size} />;
  if (m.egg) return <EggSprite rarity="rare" size={size} color="#F6C27A" spots={['#E0802E', '#B5462E']} />;
  if (m.dye && !m.chest) return <DyeIcon skin={m.dye} size={size * 0.75} />;
  return <Image source={EVENT_CHEST} style={{ width: size, height: size }} resizeMode="contain" />;
}

/** A few emoji drifting down the banner (leaves for Harvest, snow for Winter). */
function Falling({ emojis, width, height }: { emojis: string[]; width: number; height: number }) {
  const vals = useRef(emojis.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (!width) return;
    const loops = vals.map((v, i) => {
      const l = Animated.loop(Animated.timing(v, { toValue: 1, duration: 6500 + i * 1700, delay: i * 1300, easing: Easing.linear, useNativeDriver: true }));
      l.start();
      return l;
    });
    return () => loops.forEach((l) => l.stop());
  }, [width]);
  if (!width) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {emojis.map((e, i) => (
        <Animated.Text
          key={i}
          style={{
            position: 'absolute',
            left: width * (0.2 + 0.3 * i),
            top: -24,
            fontSize: 18,
            opacity: 0.75,
            transform: [
              { translateY: vals[i].interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
              { translateX: vals[i].interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 18, -10] }) },
              { rotate: vals[i].interpolate({ inputRange: [0, 1], outputRange: ['0deg', '220deg'] }) },
            ],
          }}
        >
          {e}
        </Animated.Text>
      ))}
    </View>
  );
}

/** Gently pulses its child, for buttons that have something waiting. */
function Pulse({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, []);
  return <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>{children}</Animated.View>;
}

export default function EventCard() {
  const { state, apply } = useGame();
  const [msg, setMsg] = useState<string | null>(null);
  const [party, setParty] = useState(0);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const today = A.todayKey(state);
  const run = Ev.eventOn(today);

  if (!run) {
    const nx = Ev.nextEvent(today);
    const days = Ev.daysBetween(today, nx.start);
    return (
      <Card style={styles.off}>
        <Text style={styles.offText}>
          {nx.event.emoji} Next event: <Text style={{ fontWeight: '900' }}>{nx.event.name}</Text> starts in {days} day{days === 1 ? '' : 's'}. Limited items await!
        </Text>
      </Card>
    );
  }

  const ev = run.event;
  const tokens = Ev.eventTokens(state, run);
  const got = Ev.claimedMilestones(state, run.key);
  const daysLeft = Ev.daysBetween(today, run.end) + 1;
  const checklist = Ev.dayChecklist(state.days[today]);
  const todayTokens = Ev.dayTokens(state.days[today]);
  const max = ev.milestones[ev.milestones.length - 1].tokens;
  const ready = ev.milestones.filter((m, i) => tokens >= m.tokens && !got.includes(i)).length;
  const tokenName = ev.id === 'harvest' ? 'acorns' : 'stars';

  if (!open) {
    const next = ev.milestones.find((m, i) => !got.includes(i) && tokens < m.tokens);
    const nextIdx = next ? ev.milestones.indexOf(next) : -1;
    return (
      <Pressable
        onPress={() => { buzz('light'); setOpen(true); }}
        onLayout={(e) => setBox({ w: Math.ceil(e.nativeEvent.layout.width), h: Math.ceil(e.nativeEvent.layout.height) })}
        style={({ pressed }) => [styles.banner, { backgroundColor: ev.colors[1] }, pressed && { transform: [{ scale: 0.98 }] }]}
        accessibilityRole="button"
        accessibilityLabel={`${ev.name}, ${daysLeft} days left, ${tokens} ${tokenName}${ready ? `, ${ready} rewards to claim` : ''}. Open`}
      >
        {box.w > 0 ? (
          <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={`evb-${ev.id}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={ev.colors[0]} />
                <Stop offset="1" stopColor={ev.colors[1]} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={box.w} height={box.h} fill={`url(#evb-${ev.id})`} />
          </Svg>
        ) : null}
        <Falling emojis={ev.id === 'harvest' ? ['🍂', '🍁', '🍂'] : ['❄️', '✨', '❄️']} width={box.w} height={box.h} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={styles.badgeBox}><Text style={{ fontSize: 26 }}>{ev.emoji}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.bannerKicker} numberOfLines={1}>EVENT · {daysLeft} DAY{daysLeft === 1 ? '' : 'S'} LEFT</Text>
            <Text style={styles.bannerTitle} numberOfLines={1}>{ev.name}</Text>
          </View>
          <View style={styles.countPill}><Text style={styles.countPillText} numberOfLines={1}>{ev.token} {tokens}</Text></View>
        </View>
        <View style={styles.track}>
          <View style={styles.trackLine} />
          <View style={[styles.trackFill, { width: `${Math.min(100, (tokens / max) * 100)}%` }]} />
          {ev.milestones.map((m, i) => {
            const have = got.includes(i);
            const can = !have && tokens >= m.tokens;
            return (
              <View key={i} style={[styles.stop, { left: `${(m.tokens / max) * 100}%` }]}>
                <View style={[styles.stopDot, have && styles.stopHave, can && styles.stopCan]}>
                  <RewardIcon m={m} size={22} />
                  {have ? <View style={styles.stopCheck}><Text style={styles.stopCheckText}>✓</Text></View> : null}
                </View>
                <Text style={styles.stopNum}>{m.tokens}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.nextRow}>
          <Text style={styles.nextText} numberOfLines={2}>
            {next ? <>Next: <Text style={{ fontWeight: '900' }}>{Ev.milestoneLabel(next)}</Text> in {next.tokens - tokens} {tokenName}. Today: {todayTokens} of {Ev.TOKENS_PER_DAY}.</> : 'You’ve unlocked everything. Amazing!'}
          </Text>
          {ready ? (
            <Pulse><View style={styles.claim}><Text style={styles.claimText}>Claim {ready}</Text></View></Pulse>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <Card
      style={[styles.card, { borderColor: ev.colors[1], backgroundColor: ev.colors[1] }]}
      onLayout={(e) => setBox({ w: Math.ceil(e.nativeEvent.layout.width), h: Math.ceil(e.nativeEvent.layout.height) })}
    >
      {box.w > 0 ? (
        // Sized from the card's real size: a percent-sized gradient doesn't resize on iPhone.
        <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={box.w} height={box.h}>
          <Defs>
            <LinearGradient id={`ev-${ev.id}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={ev.colors[0]} />
              <Stop offset="1" stopColor={ev.colors[1]} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={box.w} height={box.h} fill={`url(#ev-${ev.id})`} />
        </Svg>
      ) : null}
      {party ? <Confetti key={party} amount={50} width={400} height={400} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text style={styles.label} numberOfLines={1}>{ev.emoji}  LIMITED EVENT · {daysLeft} DAY{daysLeft === 1 ? '' : 'S'} LEFT</Text>
        <Pressable onPress={() => setOpen(false)} style={styles.collapse} accessibilityRole="button" accessibilityLabel="Collapse">
          <Text style={styles.collapseText}>⌃</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text style={styles.title} numberOfLines={2}>{ev.name}</Text>
        <View style={styles.count}>
          <Text style={styles.countText}>{ev.token} {tokens}</Text>
        </View>
      </View>
      <Text style={styles.blurb}>{ev.blurb}</Text>
      <View style={styles.list}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.listHead}>TODAY’S {tokenName.toUpperCase()}</Text>
          <Text style={styles.listHead}>{todayTokens} of {Ev.TOKENS_PER_DAY}</Text>
        </View>
        {checklist.map((r) => {
          const done = r.got >= r.max;
          return (
            <View key={r.id} style={styles.listRow} accessibilityLabel={`${r.label}: ${r.got} of ${r.max}`}>
              <View style={[styles.tick, done && styles.tickOn]}>{done ? <Text style={styles.tickText}>✓</Text> : null}</View>
              <Text style={[styles.listText, done && { opacity: 0.7 }]}>{r.label}</Text>
              <Text style={styles.listMeta}>{r.max > 1 ? `${r.got}/${r.max}` : '+1'}</Text>
            </View>
          );
        })}
      </View>
      <ProgressBar value={tokens / max} height={10} color="#FFE27A" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        {ev.milestones.map((m, i) => {
          const claimed = got.includes(i);
          const ready = tokens >= m.tokens && !claimed;
          return (
            <View key={i} style={[styles.tile, claimed && { opacity: 0.55 }, ready && styles.tileReady]}>
              <View style={styles.icon}><RewardIcon m={m} size={48} /></View>
              <Text style={styles.tileName} numberOfLines={2}>{Ev.milestoneLabel(m)}</Text>
              {claimed ? (
                <Text style={styles.tileState}>✓ Got it</Text>
              ) : ready ? (
                <PopIn>
                  <Button
                    primary
                    label="Claim!"
                    onPress={() => {
                      const r = Ev.claimMilestone(state, i);
                      if (!r.ok) return setMsg(r.reason ?? null);
                      apply(() => r.state);
                      buzz('success', 'win');
                      setParty((p) => p + 1);
                      setMsg(m.item ? `${Ev.milestoneLabel(m)} added to your wardrobe!` : m.egg ? 'A Harvest Egg is in your Eggs tab. It always hatches with the Harvest look!' : m.chest ? 'Chest and dye added! Open the chest on the Chests tab; the dye is in your Bag.' : 'Festival Dye added to your Bag. Use it to give a pet the Harvest look for good.');
                    }}
                  />
                </PopIn>
              ) : (
                <Text style={styles.tileState}>{ev.token} {m.tokens}</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: 24, overflow: 'hidden', padding: 14, paddingBottom: 12, gap: 10, shadowColor: '#7A3418', shadowOpacity: 0.3, shadowRadius: 0, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  badgeBox: { width: 46, height: 46, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  bannerKicker: { fontSize: 12, fontWeight: '900', letterSpacing: 1, color: '#FFE9C9' },
  bannerTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  countPill: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  countPillText: { fontSize: 15, fontWeight: '900', color: '#8A3E15' },
  track: { height: 56, marginTop: 16, marginHorizontal: 18 },
  trackLine: { position: 'absolute', left: 0, right: 0, top: 0, height: 8, borderRadius: 999, backgroundColor: 'rgba(59,32,10,0.35)' },
  trackFill: { position: 'absolute', left: 0, top: 0, height: 8, borderRadius: 999, backgroundColor: '#FFE27A' },
  stop: { position: 'absolute', top: -15, width: 40, marginLeft: -20, alignItems: 'center', gap: 2 },
  stopDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF6E6', borderWidth: 3, borderColor: '#E7C79B', alignItems: 'center', justifyContent: 'center' },
  stopHave: { backgroundColor: '#FFE27A', borderColor: '#FFFFFF' },
  stopCan: { backgroundColor: '#FFFFFF', borderColor: '#FFE27A' },
  stopCheck: { position: 'absolute', right: -5, top: -5, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  stopCheckText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  stopNum: { fontSize: 12, fontWeight: '900', color: '#FFF3E0' },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10 },
  nextText: { flex: 1, fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  claim: { backgroundColor: '#FFE27A', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  claimText: { fontSize: 14, fontWeight: '900', color: '#5A2A0A' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14 },
  rowTitle: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  rowSub: { fontSize: 12, fontWeight: '800', color: '#FFE9C9' },
  claimPill: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
  claimPillText: { color: '#8A3E15', fontSize: 14, fontWeight: '900' },
  collapse: { width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  collapseText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: 4 },
  card: { overflow: 'hidden', gap: space.sm },
  off: { backgroundColor: '#FFF8EC', borderColor: '#F2E2C2' },
  offText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  label: { flex: 1, fontSize: 12, fontWeight: '900', color: '#FFE9C9', letterSpacing: 1 },
  title: { flex: 1, fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  count: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  countText: { fontSize: 18, fontWeight: '900', color: colors.ink },
  blurb: { fontSize: 13, fontWeight: '700', color: '#FFF3E0' },
  small: { fontSize: 12, fontWeight: '800', color: '#FFE9C9' },
  tile: { width: 104, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 16, padding: 8, alignItems: 'center', gap: 4 },
  tileReady: { backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#FFE27A' },
  icon: { height: 52, alignItems: 'center', justifyContent: 'center' },
  tileName: { fontSize: 12, fontWeight: '900', color: colors.ink, textAlign: 'center', minHeight: 30 },
  tileState: { fontSize: 13, fontWeight: '900', color: colors.muted },
  msg: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  list: { backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 16, padding: 10, gap: 7 },
  listHead: { fontSize: 12, fontWeight: '900', color: '#FFE3B8', letterSpacing: 1 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tick: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#FFE3B8', alignItems: 'center', justifyContent: 'center' },
  tickOn: { backgroundColor: '#FFE3B8' },
  tickText: { fontSize: 12, fontWeight: '900', color: '#7A3F1D' },
  listText: { flex: 1, fontSize: 13, fontWeight: '800', color: '#FFF3E0' },
  listMeta: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
});
