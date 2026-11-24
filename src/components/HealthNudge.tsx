import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Text } from './ScaledText';
import { Icon, type IconName } from './Icon';
import { Button } from './ui';
import { useGame } from '../state/GameContext';
import { healthAvailable, nativeHealth } from '../lib/health';
import { colors } from '../theme';
import { dateKey } from '../game/dates';

const SNOOZE_DAYS = 3;
const MAX_DISMISS = 3;

const PERKS: { icon: IconName; tint: string; color: string; title: string; sub: string }[] = [
  { icon: 'egg', tint: '#FFF4D6', color: '#B86E00', title: 'Find eggs on walks', sub: 'Only Health steps can find them' },
  { icon: 'sprout', tint: '#E3F5EC', color: '#1E8A68', title: 'Hatch and level faster', sub: 'Steps fill your incubator' },
  { icon: 'people', tint: '#ECE7FB', color: '#5B45C2', title: 'Help your guild', sub: 'Quests and the boss' },
  { icon: 'moon', tint: '#E3EEFB', color: '#3D6FB8', title: 'Sleep logs itself', sub: 'No typing it in' },
];

/** Shown on Home to iPhone players who skipped Apple Health: what they're missing, with Connect and Not now. */
export function HealthNudge() {
  const { state, apply } = useGame();
  const nudge = state.onboard?.healthNudge;
  const show =
    healthAvailable() &&
    state.onboard?.health === 'skipped' &&
    (nudge?.dismissed ?? 0) < MAX_DISMISS &&
    !(nudge?.until && nudge.until > Date.now());

  // Remember when it first showed: the weekly reminders count from that day.
  useEffect(() => {
    if (show && !nudge?.since) apply((s) => ({ ...s, onboard: { ...s.onboard, healthNudge: { ...s.onboard?.healthNudge, since: dateKey() } } }));
  }, [show, nudge?.since, apply]);

  if (!show) return null;

  const connect = async () => {
    const h = nativeHealth();
    if (!h) return;
    await h.requestAccess();
    apply((s) => ({ ...s, onboard: { ...s.onboard, health: 'connected' } }));
  };
  const later = () =>
    apply((s) => {
      const n = s.onboard?.healthNudge ?? {};
      return { ...s, onboard: { ...s.onboard, healthNudge: { ...n, until: Date.now() + SNOOZE_DAYS * 86400000, dismissed: (n.dismissed ?? 0) + 1 } } };
    });

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="hn" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FF7A93" />
              <Stop offset="0.55" stopColor="#F5527A" />
              <Stop offset="1" stopColor="#E0567A" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#hn)" />
        </Svg>
        <View style={styles.ring}>
          <Svg width={58} height={58} style={StyleSheet.absoluteFill}>
            <Circle cx={29} cy={29} r={26} stroke="rgba(255,255,255,0.3)" strokeWidth={5} fill="none" />
            <Circle cx={29} cy={29} r={26} stroke="#FFFFFF" strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 26 * 0.62} 999`} transform="rotate(-90 29 29)" />
          </Svg>
          <Icon name="heart" size={22} color="#FFFFFF" filled />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.kicker}>APPLE HEALTH · NOT CONNECTED</Text>
          <Text style={styles.headline}>Your walks aren’t counting yet</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.lead}>Connect Apple Health and every step works for you:</Text>
        <View style={styles.grid}>
          {PERKS.map((p) => (
            <View key={p.title} style={[styles.perk, { backgroundColor: p.tint }]}>
              <Icon name={p.icon} size={22} color={p.color} />
              <Text style={styles.perkTitle}>{p.title}</Text>
              <Text style={styles.perkSub}>{p.sub}</Text>
            </View>
          ))}
        </View>
        <View style={styles.row}>
          <Button label="Not now" onPress={later} style={{ flex: 1 }} />
          <Button primary label="Connect Apple Health" onPress={connect} style={{ flex: 1.7 }} />
        </View>
        <Text style={styles.fine}>Read-only: steps and sleep. Nothing is shared.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: '#F5527A', overflow: 'hidden' },
  ring: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, color: 'rgba(255,255,255,0.88)' },
  headline: { fontSize: 19, fontWeight: '800', color: '#FFFFFF', lineHeight: 23 },
  body: { padding: 16, paddingTop: 14, gap: 12 },
  lead: { fontSize: 14, fontWeight: '600', color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  perk: { flexBasis: '48%', flexGrow: 1, borderRadius: 16, padding: 12, gap: 6 },
  perkTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, lineHeight: 17 },
  perkSub: { fontSize: 11, fontWeight: '600', color: colors.muted },
  row: { flexDirection: 'row', gap: 8 },
  fine: { fontSize: 11, fontWeight: '600', color: colors.muted, textAlign: 'center', marginTop: -4 },
});
