import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from './ScaledText';
import Svg, { Path, Rect } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import { FitSheet, Button, Card } from './ui';
import { buzz, Confetti, PopIn, Rays } from './fx';
import PetSprite from './PetSprite';
import { SPECIES_BY_ID } from '../game/species';
import { stageFor, xpForLevel } from '../game/scoring';
import { colors, font, space } from '../theme';
import * as U from '../game/unlocks';
import * as A from '../game/actions';
import { accountProgress, accountXpFor, levelReward } from '../game/account';
import LevelBadge from './LevelBadge';
import BadgeMedal from './BadgeMedal';
import { TIERS as BTIERS, TIER_REWARD, claimTier, fmt, pendingTierUp } from '../game/badges';

function LockIcon({ color = colors.muted, size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={5} y={10.5} width={14} height={10} rx={2.5} fill="none" stroke={color} strokeWidth={2.2} />
      <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

/** Shown where a feature will be once it opens: what it is, and how close you are. */
export function LockedCard({ feature, compact }: { feature: U.Feature; compact?: boolean }) {
  const { state } = useGame();
  const f = U.FEATURE_BY_ID[feature];
  const xp = U.xpToLevel(state, f.level);
  return (
    <Card style={[styles.locked, compact && { padding: space.md }]}>
      <View style={styles.row}>
        <View style={styles.lockBubble}><LockIcon /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.lockTitle}>{f.name} open at level {f.level}</Text>
          <Text style={font.small}>{f.text}</Text>
          <Text style={styles.lockMeta}>You’re level {U.topLevel(state)} · {xp.toLocaleString()} XP to go</Text>
        </View>
      </View>
    </Card>
  );
}

/** A sheet for tapping something that's still locked (like the shop). */
export function LockedSheet({ feature, onClose }: { feature: U.Feature; onClose: () => void }) {
  return (
    <View style={styles.backdrop}>
      <FitSheet onClose={onClose}>
      <View style={styles.sheet}>
        <LockedCard feature={feature} />
        <Button label="OK" primary onPress={onClose} />
      </View>
      </FitSheet>
    </View>
  );
}

/** One card when something new opens: what it is and a button to go try it. */
export function UnlockCard({ onGo }: { onGo: (where: U.FeatureInfo['go']) => void }) {
  const { state, apply } = useGame();
  const f = U.newUnlock(state);
  if (!f) return null;
  const done = () => apply((s) => U.markSeen(s, f.id));
  return (
    <PopIn>
      <Card style={styles.newCard}>
        <Text style={styles.newTag}>NEW AT LEVEL {f.level}</Text>
        <Text style={styles.newTitle}>{f.title}</Text>
        <Text style={[font.small, { color: '#36505F' }]}>{f.text}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <Button small label="Later" onPress={done} />
          <Button
            small
            primary
            label="Try it now"
            onPress={() => {
              buzz('success');
              done();
              onGo(f.go);
            }}
          />
        </View>
      </Card>
    </PopIn>
  );
}

/** "Next: Trips at level 3" for the Today card. */
export function NextUnlockLine() {
  const { state } = useGame();
  const f = U.nextUnlock(state);
  if (!f) return null;
  return (
    <View style={styles.next}>
      <LockIcon size={14} color="#5C6F69" />
      <Text style={styles.nextText} numberOfLines={1}>
        Next unlock: {f.name} at level {f.level} ({U.xpToLevel(state, f.level).toLocaleString()} XP to go)
      </Text>
    </View>
  );
}

/** Icons for the unlock banner (no emoji). */
function FeatureIcon({ id, color = '#E8590C', size = 32 }: { id: U.Feature; color?: string; size?: number }) {
  const p = { fill: 'none', stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {id === 'trips' ? (<><Path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z" {...p} /><Path d="M9 4v13M15 7v13" {...p} /></>) : null}
      {id === 'shop' ? (<><Path d="M4 9l1.5-5h13L20 9" {...p} /><Path d="M4 9h16v2a3 3 0 0 1-6 0 3 3 0 0 1-4 0 3 3 0 0 1-6 0z" {...p} /><Path d="M5 13v7h14v-7" {...p} /></>) : null}
      {id === 'group' ? (<><Path d="M4 18c0-3 2.5-5 5-5s5 2 5 5M14 18c0-2.5 2-4 4-4s3 1 3 3" {...p} /><Path d="M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" {...p} /></>) : null}
      {id === 'battles' ? (<><Path d="M4 4l10 10M4 4h4M4 4v4M13 13l3 3M20 4L10 14M20 4h-4M20 4v4M11 13l-3 3" {...p} /><Path d="M6 18l2 2M18 18l-2 2" {...p} /></>) : null}
      {id === 'guild' ? (<><Path d="M5 4h14v8c0 4-3.5 7-7 8-3.5-1-7-4-7-8z" {...p} /><Path d="M9 11l2 2 4-4" {...p} /></>) : null}
      {id === 'tower' ? (<><Path d="M8 21V8l4-5 4 5v13z" {...p} /><Path d="M10 12h4M10 16h4M4 14c1.5-1 3-1 4 0M16 10c1.5-1 3-1 4 0" {...p} /></>) : null}
      {id === 'breeding' ? (<><Path d="M12 3c4 0 7 5.5 7 10a7 7 0 0 1-14 0c0-4.5 3-10 7-10z" {...p} /><Path d="M12 10.5c-1-1.6-3.5-.8-3 1.2.4 1.6 3 3.3 3 3.3s2.6-1.7 3-3.3c.5-2-2-2.8-3-1.2z" fill={color} stroke="none" /></>) : null}
    </Svg>
  );
}

/** The level-up moment: rays, the badge slams in and pulses, the number ticks up from your old level. */
function LevelBurst({ from, to }: { from: number; to: number }) {
  const pop = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(Math.max(1, Math.min(from, to - 1)));
  useEffect(() => {
    Animated.sequence([
      Animated.delay(150),
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
    ]).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const t = setTimeout(() => loop.start(), 900);
    // Count up through each level gained, with a tap on every step.
    let n = Math.max(1, Math.min(from, to - 1));
    const tick = setInterval(() => {
      n += 1;
      setShown(Math.min(n, to));
      buzz(n >= to ? 'heavy' : 'light', n >= to ? 'levelup' : 'none');
      if (n >= to) clearInterval(tick);
    }, Math.max(120, 600 / Math.max(1, to - from)));
    return () => {
      clearTimeout(t);
      clearInterval(tick);
      loop.stop();
    };
  }, [to]);
  return (
    <View style={{ width: 200, height: 170, alignItems: 'center', justifyContent: 'center', zIndex: 0 }}>
      <Rays color="#FFD84D" size={210} count={14} />
      <Animated.View
        style={{
          transform: [
            { scale: Animated.multiply(pop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }), pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] })) },
            { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '0deg'] }) },
          ],
        }}
      >
        <LevelBadge level={shown} size={120} />
      </Animated.View>
    </View>
  );
}

/** Coins that roll up from 0 to the reward. */
function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - start) / 1100);
      setN(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k >= 1) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [to]);
  return <>{n.toLocaleString()}</>;
}

/**
 * The level-up pop-up: shows once per new account level (also after leveling up while the app was closed).
 * If something opened, each unlock gets a big orange banner (swipe through several), with Try it now.
 * Otherwise a purple "Coming up" teaser shows the next unlock and how close it is.
 */
export function LevelUpPopup({ onGo }: { onGo: (f: U.FeatureInfo) => void }) {
  const { state, apply } = useGame();
  const m = U.levelMoment(state);
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const level = m?.level;
  const [burst2, setBurst2] = useState(0);
  useEffect(() => {
    if (level) buzz('success', 'levelup');
    setPage(0);
    // A second confetti burst once the badge lands.
    const t = setTimeout(() => setBurst2((n) => n + 1), 700);
    return () => clearTimeout(t);
  }, [level]);
  if (!m) return null;
  const pet = state.pets.reduce((b, p) => (p.xp > b.xp ? p : b), state.pets[0]);
  const sp = SPECIES_BY_ID[pet.speciesId];
  const name = pet.nickname || sp?.name || 'Your pet';
  const bannerW = Math.min(width, 440) - 48;
  const current = m.unlocks[page];
  const reward = levelReward(state.account?.rewarded ?? 1, m.level);
  const close = () => apply((s) => U.markLevelShown(A.claimLevelReward(s), m.level));
  const tryIt = () => {
    if (!current) return close();
    buzz('success');
    apply((s) => U.markLevelShown(U.markSeen(A.claimLevelReward(s), current.id), m.level));
    onGo(current);
  };
  const next = m.next;
  const prog = accountProgress(state);
  const from = accountXpFor(m.level);
  const pct = next ? Math.max(0, Math.min(1, (prog.xp - from) / Math.max(1, accountXpFor(next.level) - from))) : 0;
  return (
    <View style={styles.backdrop}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}><Confetti amount={70} width={width} height={700} />{burst2 ? <Confetti key={burst2} amount={90} width={width} height={800} colors={['#FFD84D', '#F2C14E', '#FFFFFF', '#2FB58A', '#FF8FB1']} /> : null}</View>
      <PopIn>
        <View style={styles.lvCard} accessibilityViewIsModal>
          <Text style={styles.lvTag}>LEVEL UP</Text>
          <Text style={[styles.lvBig, { zIndex: 2 }]} accessibilityRole="header">Level {m.level}!</Text>
          <LevelBurst from={state.onboard?.levelShown ?? m.level - 1} to={m.level} />
          <Text style={styles.lvLine}>
            {reward.coins ? (
              <>
                Reward: <Text style={styles.lvPoint}>+<CountUp to={reward.coins} /> coins</Text>
                {reward.silver ? <Text style={styles.lvPoint}>{` and ${reward.silver > 1 ? `${reward.silver} Silver chests` : 'a Silver chest'}`}</Text> : null}
              </>
            ) : (
              'Your account level went up.'
            )}
          </Text>
          {m.unlocks.length ? (
            <>
              {m.unlocks.length > 1 ? <Text style={styles.lvCount}>{m.unlocks.length} new unlocks · swipe</Text> : null}
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={{ width: bannerW + 8, marginTop: m.unlocks.length > 1 ? 4 : 14 }}
                onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / (bannerW + 8)))}
                onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / (bannerW + 8)))}
                scrollEventThrottle={64}
              >
                {m.unlocks.map((f) => (
                  <View key={f.id} style={{ width: bannerW + 8, paddingHorizontal: 4, paddingTop: 16 }}>
                    <View style={styles.unlockBanner}>
                      <View style={styles.unlockPill}><Text style={styles.unlockPillText}>NEW UNLOCK</Text></View>
                      <View style={styles.unlockRow}>
                        <View style={styles.unlockIcon}><FeatureIcon id={f.id} /></View>
                        <Text style={styles.unlockTitle} numberOfLines={2}>{f.title}</Text>
                      </View>
                      <Text style={styles.unlockText}>{f.tease(name)}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
              {m.unlocks.length > 1 ? (
                <View style={styles.dots}>{m.unlocks.map((f, i) => <View key={f.id} style={[styles.dot, i === page && styles.dotOn]} />)}</View>
              ) : null}
              <View style={styles.lvButtons}>
                <Button label="Later" onPress={close} style={{ flex: 1 }} />
                <Button label="Try it now" primary onPress={tryIt} style={{ flex: 1.6 }} />
              </View>
            </>
          ) : (
            <>
              {next ? (
                <View style={styles.soonBanner}>
                  <View style={styles.soonPill}><Text style={styles.soonPillText}>COMING UP</Text></View>
                  <View style={styles.unlockRow}>
                    <View style={styles.soonIcon}><LockIcon color="#FFFFFF" size={26} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.soonTitle}>{next.name}</Text>
                      <Text style={styles.soonSub}>Opens at level {next.level}: {next.soon.toLowerCase()}</Text>
                    </View>
                  </View>
                  <View style={styles.soonTrack}><View style={[styles.soonFill, { width: `${Math.round(pct * 100)}%` }]} /></View>
                  <Text style={styles.soonMeta}>{U.xpToLevel(state, next.level).toLocaleString()} XP to go</Text>
                </View>
              ) : null}
              <Button label="Nice!" primary onPress={close} style={{ alignSelf: 'stretch', marginTop: 6 }} />
            </>
          )}
        </View>
      </PopIn>
    </View>
  );
}

const styles = StyleSheet.create({
  tuTitle: { fontSize: 28, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  lvCard: { backgroundColor: '#FFFCF5', borderRadius: 28, paddingTop: 20, paddingBottom: 14, paddingHorizontal: 12, alignItems: 'center', gap: 6, width: '100%', maxWidth: 440, alignSelf: 'center' },
  lvTag: { fontSize: 13, fontWeight: '900', color: '#B06A00', letterSpacing: 1.5 },
  lvBig: { fontSize: 44, fontWeight: '900', color: colors.ink, lineHeight: 48 },
  lvPet: { width: 116, height: 116, borderRadius: 58, backgroundColor: '#E8E1FA', alignItems: 'center', justifyContent: 'center' },
  lvLine: { fontSize: 15, fontWeight: '800', color: '#4E615B', textAlign: 'center' },
  lvPoint: { color: '#1E8A68', fontWeight: '900' },
  lvCount: { fontSize: 12, fontWeight: '900', color: '#B06A00', marginTop: 8 },
  unlockBanner: { borderRadius: 22, paddingTop: 24, paddingBottom: 14, paddingHorizontal: 12, backgroundColor: '#FF8A4C', borderWidth: 4, borderColor: '#FFE7B0', gap: 8 },
  unlockPill: { position: 'absolute', top: -14, alignSelf: 'center', backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 },
  unlockPillText: { color: '#FFE27A', fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  unlockRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  unlockIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  unlockTitle: { flex: 1, fontSize: 27, lineHeight: 30, fontWeight: '900', color: '#FFFFFF' },
  unlockText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', lineHeight: 20 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E0D6C6' },
  dotOn: { backgroundColor: '#FF8A4C', width: 18 },
  lvButtons: { flexDirection: 'row', gap: 8, alignSelf: 'stretch', marginTop: 8 },
  soonBanner: { alignSelf: 'stretch', marginTop: 14, borderRadius: 20, paddingTop: 22, paddingBottom: 14, paddingHorizontal: 14, backgroundColor: '#5B4BB5', borderWidth: 4, borderColor: '#E3DCFF', gap: 10 },
  soonPill: { position: 'absolute', top: -13, alignSelf: 'center', backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 4 },
  soonPillText: { color: '#C9BEFF', fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  soonIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  soonTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  soonSub: { fontSize: 14, fontWeight: '800', color: '#E3DCFF' },
  soonTrack: { height: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  soonFill: { height: '100%', borderRadius: 999, backgroundColor: '#FFC94D' },
  soonMeta: { fontSize: 13, fontWeight: '900', color: '#FFFFFF', textAlign: 'right' },

  locked: { backgroundColor: '#F3F6F4', borderWidth: 2, borderColor: '#DCE6E1', borderStyle: 'dashed' },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  lockBubble: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E4ECE8', alignItems: 'center', justifyContent: 'center' },
  lockTitle: { fontSize: 16, fontWeight: '900', color: colors.ink, marginBottom: 2 },
  lockMeta: { fontSize: 12, fontWeight: '800', color: colors.mintDark, marginTop: 4 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.5)', justifyContent: 'center', padding: space.lg, zIndex: 80 },
  sheet: { gap: space.md, width: '100%', maxWidth: 420, alignSelf: 'center' },
  newCard: { backgroundColor: '#FFF4D6', borderWidth: 2, borderColor: '#F2C27B', gap: 4 },
  newTag: { fontSize: 12, fontWeight: '900', color: '#B06A00', letterSpacing: 1 },
  newTitle: { fontSize: 19, fontWeight: '900', color: colors.ink },
  next: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nextText: { flex: 1, fontSize: 12, fontWeight: '800', color: '#5C6F69' },
});

/** A badge tier-up: rays, the old medal turns into the new one, confetti and the reward. One tier at a time. */
export function BadgeTierUp() {
  const { state, apply } = useGame();
  const { width } = useWindowDimensions();
  const p = pendingTierUp(state);
  const pop = useRef(new Animated.Value(0)).current;
  const key = p ? `${p.b.id}:${p.claimed + 1}` : '';
  useEffect(() => {
    if (!p) return;
    pop.setValue(0);
    buzz('success', 'levelup');
    Animated.sequence([Animated.delay(450), Animated.spring(pop, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true })]).start(() => buzz('heavy', 'chime'));
  }, [key]);
  if (!p) return null;
  const next = p.claimed + 1;
  const reward = TIER_REWARD[next - 1];
  const close = () => apply((s) => claimTier(s, p.b.id));
  return (
    <View style={styles.backdrop}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}><Confetti key={key} amount={80} width={width} height={760} colors={next === 5 ? ['#FF6B9A', '#FFC53D', '#4CD7A0', '#4FA3FF', '#A06BFF'] : undefined} /></View>
      <PopIn>
        <View style={styles.lvCard} accessibilityViewIsModal>
          <Text style={[styles.lvTag, { zIndex: 2 }]}>BADGE UPGRADED</Text>
          <View style={{ width: 220, height: 170, alignItems: 'center', justifyContent: 'center' }}>
            <Rays color={next === 5 ? '#B89CFF' : '#FFD84D'} size={210} count={14} />
            <Animated.View style={{ position: 'absolute', opacity: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) }] }}>
              <BadgeMedal icon={p.b.icon} tier={next - 1} size={120} id="tu-old" />
            </Animated.View>
            <Animated.View style={{ opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }, { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] }) }] }}>
              <BadgeMedal icon={p.b.icon} tier={next} size={130} id="tu-new" />
            </Animated.View>
          </View>
          <Text style={styles.tuTitle} accessibilityRole="header">{p.b.name}: {BTIERS[next - 1].label}!</Text>
          <Text style={styles.lvLine}>{p.b.what}: {fmt(p.b, p.b.steps[next - 1])}</Text>
          <Text style={styles.lvLine}>
            Reward: <Text style={styles.lvPoint}>{reward.coins ? `+${reward.coins} coins` : `${reward.chest![0].toUpperCase()}${reward.chest!.slice(1)} chest`}</Text>
            {next === 5 ? <Text style={styles.lvPoint}> and a rainbow frame</Text> : null}
          </Text>
          <Button label="Nice!" primary onPress={close} style={{ alignSelf: 'stretch', marginTop: 6 }} />
        </View>
      </PopIn>
    </View>
  );
}
