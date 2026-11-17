import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import PetSprite from './PetSprite';
import * as A from '../game/actions';
import { SPECIES_BY_ID } from '../game/species';
import { stageFor } from '../game/scoring';
import { STATS, STAT_INFO, gradeOf, pointsLeft, statsFor } from '../game/stats';

/** A little dojo on Home: your pet punches a training dummy, with its stats, grade and any points to spend. */
export default function TrainingCard({ onOpen }: { onOpen: () => void }) {
  const { state } = useGame();
  const pet = A.activePet(state);
  const [w, setW] = useState(0);
  const punch = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const pts = pet ? pointsLeft(pet) : 0;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(punch, { toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(punch, { toValue: 0, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    const g = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]));
    if (pts) g.start();
    return () => {
      loop.stop();
      g.stop();
    };
  }, [pts]);
  if (!pet) return null;
  const sp = SPECIES_BY_ID[pet.speciesId];
  const st = statsFor(pet);
  const max = Math.max(200, st.hp);
  const scale: Record<string, number> = { hp: max, atk: max / 3, def: max / 3, spd: max / 3 };
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.98 }] }]} onLayout={(e) => setW(Math.ceil(e.nativeEvent.layout.width))} accessibilityRole="button" accessibilityLabel={`Training: ${pet.nickname}${pts ? `, ${pts} points to spend` : ''}, grade ${gradeOf(pet)}%`}>
      {w > 0 ? (
        <Svg width={w} height={150} style={StyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={w} height={150} fill="#B04A30" />
          <Rect x={0} y={30} width={w} height={3} fill="#8E3420" />
          <Rect x={0} y={62} width={w} height={3} fill="#8E3420" />
          <Rect x={w - 100} y={8} width={84} height={40} rx={4} fill="#F4E3C3" stroke="#5A2A10" strokeWidth={3} />
          <Path d={`M${w - 86} 20h56M${w - 86} 28h40M${w - 86} 36h50`} stroke="#C8553A" strokeWidth={3} strokeLinecap="round" />
          <Rect x={0} y={92} width={w} height={58} fill="#E3B676" />
          {[60, 140, 220, 300, 380].filter((x) => x < w).map((x) => <Rect key={x} x={x} y={92} width={2} height={58} fill="#C79552" />)}
          <Rect x={0} y={112} width={w} height={2} fill="#C79552" />
          <Rect x={w - 70} y={70} width={8} height={54} fill="#8A5A2E" />
          <Ellipse cx={w - 66} cy={74} rx={22} ry={26} fill="#F2C98A" stroke="#5A2A10" strokeWidth={3} />
          <Path d={`M${w - 76} 70h20M${w - 76} 80h20`} stroke="#5A2A10" strokeWidth={3} strokeLinecap="round" />
          <Ellipse cx={w - 66} cy={128} rx={22} ry={5} fill="#000" opacity={0.18} />
          <Ellipse cx={w - 136} cy={132} rx={30} ry={6} fill="#000" opacity={0.18} />
        </Svg>
      ) : null}
      <Animated.View style={[styles.fighter, { transform: [{ translateX: punch.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) }, { rotate: punch.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '6deg'] }) }] }]}>
        <PetSprite species={sp} stage={stageFor(pet.xp)} size={74} shiny={pet.shiny} skin={pet.skin} hat={pet.look?.hat} />
      </Animated.View>
      <View style={styles.info}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={styles.kicker}>TRAINING</Text>
          {pts ? (
            <Animated.View style={[styles.points, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) }]}>
              <Text style={styles.pointsText}>{pts} point{pts === 1 ? '' : 's'}</Text>
            </Animated.View>
          ) : null}
          <View style={styles.grade}><Text style={styles.gradeText}>Grade {gradeOf(pet)}%</Text></View>
        </View>
        <Text style={styles.title} numberOfLines={1}>{pts ? `Make ${pet.nickname} stronger` : `${pet.nickname}'s stats`}</Text>
        {STATS.map((k) => (
          <View key={k} style={styles.statRow}>
            <Text style={styles.statLabel}>{STAT_INFO[k].short}</Text>
            <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, Math.round((st[k] / scale[k]) * 100))}%`, backgroundColor: STAT_INFO[k].color }]} /></View>
            <Text style={styles.statVal}>{st[k]}</Text>
          </View>
        ))}
      </View>
      <View style={styles.go}><Text style={styles.goText}>Train ›</Text></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { height: 150, borderRadius: 22, overflow: 'hidden', backgroundColor: '#B04A30', shadowColor: '#7A2A14', shadowOpacity: 0.25, shadowRadius: 0, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  fighter: { position: 'absolute', right: 96, top: 58 },
  info: { position: 'absolute', left: 14, top: 12, width: 156, gap: 4 },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 1, color: '#FFD9C7' },
  points: { backgroundColor: '#FFE27A', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  pointsText: { fontSize: 11, fontWeight: '900', color: '#5A2A0A' },
  grade: { borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 7, paddingVertical: 1 },
  gradeText: { fontSize: 11, fontWeight: '900', color: '#FFFFFF' },
  title: { fontSize: 17, fontWeight: '900', color: '#FFFFFF' },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLabel: { width: 30, fontSize: 11, fontWeight: '900', color: '#FFE9D6' },
  track: { flex: 1, height: 8, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.25)', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 999 },
  statVal: { width: 30, textAlign: 'right', fontSize: 11, fontWeight: '900', color: '#FFFFFF' },
  go: { position: 'absolute', right: 12, bottom: 10, backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  goText: { fontSize: 13, fontWeight: '900', color: '#9C3A26' },
});
