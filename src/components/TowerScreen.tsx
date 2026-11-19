import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Polygon, RadialGradient, Rect, Stop, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '../state/GameContext';
import { useOverlay } from './Overlay';
import BattleScreen, { type ResultLine } from './BattleScreen';
import PetSprite from './PetSprite';
import { buzz, PopIn } from './fx';
import { colors, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { stageFor } from '../game/scoring';
import { supabase } from '../lib/supabase';
import * as T from '../game/tower';
import * as H from '../game/hp';
import * as A from '../game/actions';
import ChestIcon from './ChestIcon';

type Mate = { name: string; floor: number };

function useGuildFloors(week: string) {
  const [mates, setMates] = useState<Mate[]>([]);
  useEffect(() => {
    supabase.rpc('tower_guild', { p_week: week }).then(({ data }) => Array.isArray(data) && setMates(data as Mate[]));
  }, [week]);
  return mates;
}

/** The Social › Battle card that opens the tower. */
export function TowerCard() {
  const { state } = useGame();
  const { open, close } = useOverlay();
  const t = T.towerOf(state);
  const theme = T.themeFor(t.week);
  return (
    <Pressable onPress={() => open(<TowerScreen onClose={close} />)} accessibilityRole="button" accessibilityLabel={`${theme.name}, ${t.floor} of ${T.FLOORS} floors cleared`}>
      <View style={[styles.card, { backgroundColor: theme.sky[1] }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardKicker}>WEEKLY SKY TOWER</Text>
          <Text style={styles.cardTitle}>{theme.name}</Text>
          <Text style={styles.cardSub}>{t.floor >= T.FLOORS ? 'You reached the top!' : `${t.floor} of ${T.FLOORS} floors cleared`}</Text>
        </View>
        <View style={styles.cardBtn}><Text style={styles.cardBtnText}>{t.floor >= T.FLOORS ? 'View' : 'Climb'}</Text></View>
      </View>
    </Pressable>
  );
}

function useDaysLeft() {
  const now = new Date();
  const day = now.getDay(); // 0 Sun
  const d = (8 - day) % 7 || 7;
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
  const ms = end.getTime() - now.getTime();
  const dd = Math.floor(ms / 86_400_000);
  const hh = Math.floor((ms % 86_400_000) / 3_600_000);
  return `${dd}d ${hh}h`;
}

export default function TowerScreen({ onClose }: { onClose: () => void }) {
  const { state, apply } = useGame();
  const { open, close } = useOverlay();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const t = T.towerOf(state);
  const theme = T.themeFor(t.week);
  const mates = useGuildFloors(t.week);
  const left = useDaysLeft();
  const can = T.canClimb(state);
  const bob = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([Animated.timing(bob, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(bob, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true })])).start();
    Animated.loop(Animated.sequence([Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }), Animated.timing(glow, { toValue: 0, duration: 1200, useNativeDriver: true })])).start();
  }, []);

  const W = Math.min(width, 480);
  const towerW = 150;
  const floorH = 46;
  const towerH = floorH * T.FLOORS + 40;
  const cx = W / 2;
  const active = A.activePet(state) ?? state.pets[0];
  const sp = active ? SPECIES_BY_ID[active.speciesId] : undefined;
  const teamHp = state.pets.length ? Math.round(state.pets.reduce((a, p) => a + H.hpPct(p), 0) / state.pets.length) : 0;
  // Floor rows from the top (10) down to 1. y is measured from the top of the tower area.
  const yOf = (floor: number) => 60 + (T.FLOORS - floor) * floorH;
  const nextFloor = Math.min(T.FLOORS, t.floor + 1);

  const climb = () => {
    const floor = nextFloor;
    const team = T.floorTeam(state, floor);
    const tw = T.towerOf(state);
    open(
      <BattleScreen
        opponent={{ name: `Floor ${floor}${floor === T.FLOORS ? ' boss' : ''}`, team }}
        onClose={() => {
          close();
          setTimeout(() => open(<TowerScreen onClose={onClose} />), 30);
        }}
        special={{
          title: `Floor ${floor}: pick your team`,
          tweak: (b) => T.bless(b, tw.blessings),
          winText: `Floor ${floor} cleared!`,
          loseText: 'Knocked out. Your climb ends for today; tomorrow you start on this floor.',
          onEnd: (won, b, ids) => {
            let lines: ResultLine[] = [];
            apply((s) => {
              const r = T.finishFloor(H.saveTeamHp(s, b, ids), won);
              if (won) {
                lines = [{ label: 'Coins', value: `+${r.coins}`, color: '#B8860B' }];
                if (r.chest) lines.push({ label: `${r.chest[0].toUpperCase() + r.chest.slice(1)} chest`, value: 'Chests tab', color: '#8A4FD8' });
                if (r.crystals) lines.push({ label: 'Training Crystals', value: `+${r.crystals}`, color: '#4A8FE0' });
                supabase.rpc('tower_report', { p_week: r.state.tower!.week, p_floor: r.cleared }).then(() => {});
              }
              return r.state;
            });
            return [...lines, ...b.mine.map((f) => ({ label: `${f.nickname} HP`, value: f.hp <= 0 ? 'Knocked out' : `${Math.round((f.hp / f.maxHp) * 100)}%`, color: f.hp <= 0 ? '#C4562F' : colors.mintDark }))];
          },
        }}
      />,
    );
  };

  if (t.choose) return <BlessingPick onDone={() => {}} />;

  return (
    <View style={[styles.full, { backgroundColor: theme.sky[0] }]}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingTop: insets.top + 160, paddingBottom: 190 }} contentOffset={{ x: 0, y: Math.max(0, yOf(nextFloor) - 260) }}>
        <View style={{ width: W, height: towerH + 120 }}>
          <Svg width={W} height={towerH + 120} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.sky[0]} />
                <Stop offset="0.45" stopColor={theme.sky[1]} />
                <Stop offset="1" stopColor={theme.sky[2]} />
              </LinearGradient>
              <LinearGradient id="stone" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#2E2338" />
                <Stop offset="0.5" stopColor="#5B4656" />
                <Stop offset="1" stopColor="#2E2338" />
              </LinearGradient>
              <RadialGradient id="boss" cx="0.5" cy="0.5" r="0.5">
                <Stop offset="0" stopColor="#FFE3A0" />
                <Stop offset="1" stopColor="#E2552E" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width={W} height={towerH + 120} fill="url(#sky)" />
            <Rect x={cx - towerW / 2} y={60} width={towerW} height={towerH + 60} rx="8" fill="url(#stone)" />
            <Polygon points={`${cx - 70},62 ${cx - 56},18 ${cx - 30},44 ${cx},0 ${cx + 30},44 ${cx + 56},18 ${cx + 70},62`} fill="#2A1F3D" />
            {Array.from({ length: T.FLOORS }, (_, i) => {
              const floor = i + 1;
              const y = yOf(floor) + 10;
              const lit = floor <= t.floor;
              const c = lit ? '#FFC65A' : '#21182E';
              return (
                <React.Fragment key={floor}>
                  <Rect x={cx - 52} y={y} width="30" height="24" rx="10" fill={c} opacity={lit ? 1 : 0.9} />
                  <Rect x={cx + 22} y={y} width="30" height="24" rx="10" fill={c} opacity={lit ? 1 : 0.9} />
                </React.Fragment>
              );
            })}
            <Circle cx={cx} cy={yOf(T.FLOORS) + 22} r="22" fill="url(#boss)" />
          </Svg>
          {/* The prize waiting at the top: a Rainbow Chest */}
          <View style={{ position: 'absolute', left: cx - 42, top: -64, alignItems: 'center', opacity: t.floor >= T.FLOORS ? 0.5 : 1 }} accessibilityLabel="Rainbow Chest waiting at the top">
            <ChestIcon kind="rainbow" size={84} />
            <View style={styles.prizeTag}><Text style={styles.prizeText}>{t.floor >= T.FLOORS ? 'Claimed' : 'Top prize'}</Text></View>
          </View>
          {/* Floor labels on the right */}
          {Array.from({ length: T.FLOORS }, (_, i) => {
            const floor = i + 1;
            const chest = T.chestFor(floor);
            const mine = mates.filter((m) => m.floor === floor);
            return (
              <View key={floor} style={[styles.floorTag, { top: yOf(floor) + 12, left: cx + towerW / 2 + 8 }]}>
                <Text style={[styles.floorText, floor <= t.floor && { color: '#FFD98A' }]}>{floor === T.FLOORS ? 'Boss' : `Floor ${floor}`}{chest ? ` · ${chest === 'rainbow' ? 'Rainbow Chest' : chest[0].toUpperCase() + chest.slice(1)}` : ''}</Text>
                {mine.map((m) => (
                  <View key={m.name} style={styles.mate}><Text style={styles.mateText}>{m.name[0]?.toUpperCase()}</Text></View>
                ))}
              </View>
            );
          })}
          {/* Your pet on the next floor's balcony */}
          {sp && t.floor < T.FLOORS ? (
            <>
              <View style={[styles.balcony, { top: yOf(nextFloor) + 40, left: cx - towerW / 2 - 18, width: towerW + 36 }]} />
              <Animated.View style={{ position: 'absolute', top: yOf(nextFloor) - 22, left: cx - 32, transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] }}>
                <PetSprite species={sp} stage={stageFor(active!.xp)} size={64} skin={active!.skin} hat={active!.look?.hat} />
              </Animated.View>
            </>
          ) : null}
          <Animated.View style={{ position: 'absolute', top: yOf(T.FLOORS), left: cx - 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#FF8A3C', opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.45] }) }} />
        </View>
      </ScrollView>

      <View style={[styles.header, { paddingTop: insets.top + 8, paddingLeft: 16, paddingRight: 16 }]}>
        <Pressable onPress={onClose} style={styles.back} accessibilityRole="button" accessibilityLabel="Back"><Text style={styles.backText}>‹ Back</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>THIS WEEK</Text>
          <Text style={styles.title}>{theme.name}</Text>
          <Text style={styles.sub}>{theme.weakTo}</Text>
        </View>
        <View style={styles.timer}><Text style={styles.timerBig}>{left}</Text><Text style={styles.timerSmall}>until it crumbles</Text></View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 14, paddingLeft: 18, paddingRight: 18 }]}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'stretch' }}>
          <View style={styles.stat}><Text style={styles.statLabel}>TEAM HP</Text><View style={styles.hpTrack}><View style={[styles.hpFill, { width: `${teamHp}%` }]} /></View></View>
          <View style={styles.statSmall}><Text style={styles.statText} numberOfLines={1}>{t.blessings.length} blessing{t.blessings.length === 1 ? '' : 's'}</Text></View>
        </View>
        {can.ok ? (
          <Pressable onPress={() => { buzz('medium', 'whoosh'); climb(); }} style={styles.climb} accessibilityRole="button">
            <Text style={styles.climbText}>Climb to {nextFloor === T.FLOORS ? 'the boss' : `floor ${nextFloor}`}</Text>
          </Pressable>
        ) : (
          <Text style={styles.why}>{can.reason}</Text>
        )}
        <Text style={styles.foot}>HP carries from floor to floor. Heal with potions from a pet’s page.</Text>
      </View>
    </View>
  );
}

/** After each cleared floor: pick 1 of 3 blessings for the rest of the week. */
export function BlessingPick({ onDone }: { onDone: () => void }) {
  const { state, apply } = useGame();
  const insets = useSafeAreaInsets();
  const t = T.towerOf(state);
  const choices = T.blessingChoices(state);
  const tierColor = { COMMON: ['#2E9E78', '#1E6E58'], RARE: ['#3E7BD8', '#2A4F9E'], EPIC: ['#8A4FD8', '#5A2A9E'] } as const;
  return (
    <View style={[styles.full, { backgroundColor: '#1B0F2E', padding: space.lg, paddingTop: insets.top + 30, paddingLeft: space.lg, paddingRight: space.lg, gap: 12 }]}>
      <Text style={[styles.kicker, { textAlign: 'center' }]}>FLOOR {t.floor} CLEARED</Text>
      <Text style={[styles.title, { textAlign: 'center' }]}>Pick a blessing</Text>
      <Text style={[styles.sub, { textAlign: 'center' }]}>It lasts until the tower crumbles on Monday</Text>
      {choices.map((b, i) => (
        <PopIn key={b.id} delay={i * 120}>
          <Pressable
            onPress={() => {
              buzz('success', 'chime');
              apply((s) => T.chooseBlessing(s, b.id));
              onDone();
            }}
            style={[styles.bless, { backgroundColor: tierColor[b.tier][0], borderColor: tierColor[b.tier][1] }]}
            accessibilityRole="button"
            accessibilityLabel={`${b.name}: ${b.text}`}
          >
            <Text style={styles.blessTier}>{b.tier}</Text>
            <Text style={styles.blessName}>{b.name}</Text>
            <Text style={styles.blessText}>{b.text}</Text>
          </Pressable>
        </PopIn>
      ))}
      <View style={{ flex: 1 }} />
      <Text style={[styles.foot, { textAlign: 'center' }]}>Your team’s HP carries from floor to floor. Rest with a potion or push on.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  prizeTag: { marginTop: -6, backgroundColor: '#B45FE0', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 2 },
  prizeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  full: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 80 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: 'rgba(15,8,28,0.55)' },
  back: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4 },
  backText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  kicker: { color: '#FFB98A', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#fff', fontSize: 26, fontWeight: '900' },
  sub: { color: '#fff', opacity: 0.8, fontSize: 12, fontWeight: '800' },
  timer: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'flex-end' },
  timerBig: { color: '#fff', fontSize: 17, fontWeight: '900' },
  timerSmall: { color: '#fff', opacity: 0.75, fontSize: 10, fontWeight: '800' },
  floorTag: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 4 },
  floorText: { color: '#CFC2E0', fontSize: 11, fontWeight: '900' },
  mate: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#4A8FE0', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  mateText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  balcony: { position: 'absolute', height: 12, borderRadius: 4, backgroundColor: '#7A5466' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 14, gap: 8, backgroundColor: 'rgba(15,8,28,0.96)' },
  stat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  statSmall: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center' },
  statLabel: { color: '#fff', opacity: 0.7, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  statText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  hpTrack: { height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 4, overflow: 'hidden' },
  hpFill: { height: '100%', borderRadius: 4, backgroundColor: '#7CF0B5' },
  climb: { height: 54, borderRadius: 16, backgroundColor: '#E5484D', alignItems: 'center', justifyContent: 'center' },
  climbText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  why: { color: '#FFD9A8', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  foot: { color: '#fff', opacity: 0.7, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  bless: { borderRadius: 20, padding: 16, gap: 4, borderWidth: 2 },
  blessTier: { color: '#fff', opacity: 0.8, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  blessName: { color: '#fff', fontSize: 20, fontWeight: '900' },
  blessText: { color: '#fff', opacity: 0.92, fontSize: 14, fontWeight: '800' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, padding: space.md },
  cardKicker: { color: '#FFB98A', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  cardTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  cardSub: { color: '#fff', opacity: 0.85, fontSize: 13, fontWeight: '800' },
  cardBtn: { backgroundColor: '#E5484D', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
  cardBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});

