import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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

  return (
    <Card style={[styles.card, { borderColor: ev.colors[1] }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={`ev-${ev.id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={ev.colors[0]} />
            <Stop offset="1" stopColor={ev.colors[1]} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill={`url(#ev-${ev.id})`} />
      </Svg>
      {party ? <Confetti key={party} amount={50} width={400} height={400} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text style={{ fontSize: 34 }}>{ev.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>LIMITED EVENT · {daysLeft} DAY{daysLeft === 1 ? '' : 'S'} LEFT</Text>
          <Text style={styles.title}>{ev.name}</Text>
        </View>
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
  card: { overflow: 'hidden', gap: space.sm },
  off: { backgroundColor: '#FFF8EC', borderColor: '#F2E2C2' },
  offText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  label: { fontSize: 11, fontWeight: '900', color: '#FFE9C9', letterSpacing: 1 },
  title: { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
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
