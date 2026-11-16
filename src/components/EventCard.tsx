import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import { Button, Card, ProgressBar } from './ui';
import { ItemIcon } from './Cosmetics';
import { buzz, Confetti, PopIn } from './fx';
import { colors, space } from '../theme';
import * as Ev from '../game/events';
import * as A from '../game/actions';
import { dailyQuests } from '../game/scoring';

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
  const todayTokens = Math.min(Ev.TOKENS_PER_DAY, state.days[today] ? dailyQuests(state.days[today]).filter((q) => q.done).length : 0);
  const max = ev.milestones[ev.milestones.length - 1].tokens;
  const ready = ev.milestones.filter((m, i) => tokens >= m.tokens && !got.includes(i)).length;
  const tokenName = ev.id === 'harvest' ? 'acorns' : 'stars';

  if (!open) {
    return (
      <Pressable
        onPress={() => { buzz('light'); setOpen(true); }}
        style={({ pressed }) => [styles.row, { backgroundColor: ev.colors[0] }, pressed && { transform: [{ scale: 0.98 }] }]}
        accessibilityRole="button"
        accessibilityLabel={`${ev.name}, ${daysLeft} days left${ready ? `, ${ready} rewards to claim` : ''}. Open`}
      >
        <Text style={{ fontSize: 26 }}>{ev.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{ev.name}</Text>
          <Text style={styles.rowSub} numberOfLines={2}>Earn {tokenName} from daily quests for limited gear · {daysLeft} day{daysLeft === 1 ? '' : 's'} left</Text>
        </View>
        {ready ? (
          <View style={styles.claimPill}><Text style={styles.claimPillText}>Claim {ready}</Text></View>
        ) : (
          <View style={styles.claimPill}><Text style={styles.claimPillText}>{ev.token} {tokens}</Text></View>
        )}
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
      <View style={{ gap: 4 }}>
        <ProgressBar value={tokens / max} height={12} color="#FFE27A" />
        <Text style={styles.small}>
          Today: {todayTokens} of {Ev.TOKENS_PER_DAY} {ev.token} (1 per daily quest)
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        {ev.milestones.map((m, i) => {
          const claimed = got.includes(i);
          const ready = tokens >= m.tokens && !claimed;
          return (
            <View key={i} style={[styles.tile, claimed && { opacity: 0.55 }, ready && styles.tileReady]}>
              <View style={styles.icon}>{m.item ? <ItemIcon id={m.item} size={48} /> : <Text style={{ fontSize: 30 }}>🎁</Text>}</View>
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
                      setMsg(m.item ? `${Ev.milestoneLabel(m)} added to your wardrobe!` : 'Chest added! Open it on the Chests tab.');
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
  label: { flex: 1, fontSize: 11, fontWeight: '900', color: '#FFE9C9', letterSpacing: 1 },
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
});
