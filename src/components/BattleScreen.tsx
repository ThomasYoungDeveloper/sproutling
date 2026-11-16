import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useGame } from '../state/GameContext';
import PetSprite from './PetSprite';
import PetPicker from './PetPicker';
import { Backdrop, skyNow } from './PetScene';
import { Button } from './ui';
import { Confetti, PopIn, buzz } from './fx';
import { colors, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { stageFor } from '../game/scoring';
import * as B from '../game/battle';
import type { GameState } from '../game/types';

export interface Opponent {
  name: string;
  team: B.PetLike[];
  /** Set for a friend's team; wild battles have none. */
  friendId?: string;
}

type Phase = 'pick' | 'fight' | 'result';

const MOVE_LABEL: Record<B.Move, string> = { attack: 'Attack', special: 'Special', guard: 'Guard' };

export default function BattleScreen({ opponent, onClose, onResult }: { opponent: Opponent; onClose: () => void; onResult?: (won: boolean) => void }) {
  const { state, apply } = useGame();
  const stateRef = useRef<GameState>(state);
  stateRef.current = state;
  const [phase, setPhase] = useState<Phase>('pick');
  const [team, setTeam] = useState<string[]>(B.defaultTeam(state));
  const [battle, setBattle] = useState<B.Battle | null>(null);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState('');
  const [reward, setReward] = useState<B.BattleReward | null>(null);
  const [sky] = useState(skyNow);
  const power = B.battlePower(state);

  // Animation values for each side.
  const lunge = { me: useRef(new Animated.Value(0)).current, them: useRef(new Animated.Value(0)).current };
  const hit = { me: useRef(new Animated.Value(0)).current, them: useRef(new Animated.Value(0)).current };
  const faint = { me: useRef(new Animated.Value(1)).current, them: useRef(new Animated.Value(1)).current };
  const [pops, setPops] = useState<{ id: number; side: B.Side; text: string; color: string }[]>([]);

  const start = (ids: string[]) => {
    const mine = ids.map((id) => state.pets.find((p) => p.id === id)!).filter(Boolean);
    setTeam(ids);
    setBattle(B.startBattle(mine, opponent.team, power, 1));
    faint.me.setValue(1);
    faint.them.setValue(1);
    setLine(opponent.friendId ? `${opponent.name} wants to battle!` : 'Wild pets appeared!');
    setReward(null);
    setPhase('fight');
    buzz('medium');
  };

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const animateEvent = async (ev: B.TurnEvent, b: B.Battle) => {
    const att = ev.side;
    const def: B.Side = att === 'me' ? 'them' : 'me';
    const attacker = att === 'me' ? b.mine[b.mi] : b.theirs[b.ti];
    const name = attacker.nickname;
    if (ev.move === 'guard') {
      setLine(`${name} is guarding and charging up! ⚡`);
      buzz('light', 'guard');
      setPops((p) => [...p, { id: Date.now() + Math.random(), side: att, text: '🛡 +⚡', color: '#2E9BD6' }]);
      await wait(750);
      return;
    }
    setLine(`${name} used ${ev.move === 'special' ? 'a SPECIAL move' : 'Attack'}!${ev.effect > 1 ? ' Super effective!' : ev.effect < 1 ? ' Not very effective…' : ''}${ev.crit ? ' Critical hit!' : ''}`);
    Animated.sequence([
      Animated.timing(lunge[att], { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(lunge[att], { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    await wait(150);
    buzz(ev.move === 'special' || ev.crit ? 'heavy' : 'medium', ev.move === 'special' ? 'special' : 'hit');
    hit[def].setValue(0);
    Animated.timing(hit[def], { toValue: 1, duration: 420, useNativeDriver: true }).start();
    setPops((p) => [...p, { id: Date.now() + Math.random(), side: def, text: `-${ev.damage}`, color: ev.effect > 1 || ev.crit ? '#FF5A36' : '#FFFFFF' }]);
    await wait(600);
    if (ev.fainted) {
      Animated.timing(faint[def], { toValue: 0, duration: 450, useNativeDriver: true }).start();
      await wait(450);
      setLine(ev.next ? `${def === 'me' ? 'Your' : 'Their'} pet fainted! Go, ${ev.next}!` : `${def === 'me' ? 'Your' : 'Their'} last pet fainted!`);
      await wait(650);
      // The next pet steps in; after the last pet faints, the spot stays empty.
      if (ev.next) faint[def].setValue(1);
    }
  };

  const choose = async (move: B.Move) => {
    if (!battle || busy || battle.over) return;
    setBusy(true);
    const before = battle;
    const theirMove = B.aiMove(before.theirs[before.ti]);
    const { battle: after, events } = B.playTurn(before, move, theirMove);
    // Show HP changing event by event using intermediate snapshots.
    let shown = before;
    for (const ev of events) {
      const atkB = shown;
      await animateEvent(ev, atkB);
      // Apply this event's damage to the shown battle.
      const mine = shown.mine.map((f) => ({ ...f }));
      const theirs = shown.theirs.map((f) => ({ ...f }));
      if (ev.move !== 'guard') {
        if (ev.side === 'me') theirs[shown.ti].hp = Math.max(0, theirs[shown.ti].hp - ev.damage);
        else mine[shown.mi].hp = Math.max(0, mine[shown.mi].hp - ev.damage);
      }
      const mi = ev.side === 'them' && ev.fainted ? Math.min(shown.mi + 1, mine.length - 1) : shown.mi;
      const ti = ev.side === 'me' && ev.fainted ? Math.min(shown.ti + 1, theirs.length - 1) : shown.ti;
      shown = { ...shown, mine, theirs, mi, ti };
      setBattle(shown);
    }
    setBattle(after);
    if (after.over) {
      const won = after.over === 'win';
      const r = B.finishBattle(stateRef.current, won, !!opponent.friendId);
      apply(() => r.state);
      setReward(r.reward);
      onResult?.(won);
      buzz(won ? 'success' : 'medium', won ? 'win' : 'lose');
      await wait(400);
      setPhase('result');
    } else {
      setLine(`What will ${after.mine[after.mi].nickname} do?`);
    }
    setBusy(false);
  };

  if (phase === 'pick') {
    const theirNames = opponent.team.slice(0, B.TEAM_SIZE).map((p) => `${p.nickname} (Lv ${Math.max(1, B.makeFighter(p, 'x').level)})`).join(', ');
    return (
      <PetPicker
        title="Pick your battle team"
        subtitle={`Up to ${B.TEAM_SIZE} pets vs ${opponent.name}: ${theirNames}. Healthy habits power you up: ×${power.toFixed(2)} today.`}
        pets={state.pets.map((p) => ({ pet: p }))}
        max={B.TEAM_SIZE}
        initial={team}
        confirmLabel={(n) => (n ? `Battle with ${n} pet${n > 1 ? 's' : ''}!` : 'Pick at least 1 pet')}
        onConfirm={start}
        onClose={onClose}
      />
    );
  }

  if (!battle) return null;
  const me = battle.mine[battle.mi];
  const them = battle.theirs[battle.ti];

  return (
    <View style={styles.full}>
      <View style={styles.arena}>
        <Backdrop element={me.element} sky={sky} />
        <TeamDots fighters={battle.theirs} index={battle.ti} style={{ top: 10, right: 12 }} />
        <TeamDots fighters={battle.mine} index={battle.mi} style={{ bottom: 32, left: 16 }} />
        <FighterCard f={them} label={opponent.name} style={{ top: 34, left: 12 }} />
        <FighterCard f={me} label="You" style={{ bottom: 40, right: 12 }} power={power} />

        <FighterSprite f={them} side="them" lunge={lunge.them} hit={hit.them} faint={faint.them} style={{ top: 70, right: 24 }} />
        <FighterSprite f={me} side="me" lunge={lunge.me} hit={hit.me} faint={faint.me} style={{ bottom: 56, left: 20 }} />

        {pops.map((p) => (
          <DamagePop key={p.id} side={p.side} text={p.text} color={p.color} onDone={() => setPops((list) => list.filter((x) => x.id !== p.id))} />
        ))}
      </View>

      <View style={styles.panel}>
        {phase === 'fight' ? (
          <>
            <Text style={styles.line} numberOfLines={2}>{line}</Text>
            <View style={styles.moves}>
              <MoveButton icon="⚔️" label="Attack" sub="+1 ⚡" disabled={busy} onPress={() => choose('attack')} />
              <MoveButton icon="💥" label="Special" sub={`${me.charge}/${B.SPECIAL_COST} ⚡`} disabled={busy || me.charge < B.SPECIAL_COST} glow={me.charge >= B.SPECIAL_COST} onPress={() => choose('special')} />
              <MoveButton icon="🛡" label="Guard" sub="Half damage +1 ⚡" disabled={busy} onPress={() => choose('guard')} />
            </View>
            <Text style={styles.tip}>
              {them.element === B.BEATS[me.element]
                ? `${B.ELEMENT_LABEL[me.element]} beats ${B.ELEMENT_LABEL[them.element]}: you have the edge!`
                : B.BEATS[them.element] === me.element
                  ? `${B.ELEMENT_LABEL[them.element]} beats ${B.ELEMENT_LABEL[me.element]}: careful, they have the edge!`
                  : `Even match. Flower beats Tide, Tide beats Ember, Ember beats Moon, Moon beats Flower.`}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button"><Text style={styles.run}>Run away</Text></Pressable>
          </>
        ) : (
          <Result won={battle.over === 'win'} reward={reward} name={opponent.name} onRematch={() => setPhase('pick')} onClose={onClose} />
        )}
      </View>
    </View>
  );
}

function Result({ won, reward, name, onRematch, onClose }: { won: boolean; reward: B.BattleReward | null; name: string; onRematch: () => void; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      {won ? <Confetti width={width} height={height} amount={70} /> : null}
      <PopIn from={0.2}>
        <Text style={[styles.result, { color: won ? '#E5A800' : colors.ink }]}>{won ? '🏆 YOU WIN!' : 'So close!'}</Text>
      </PopIn>
      <Text style={styles.resultSub}>{won ? `You beat ${name === 'Wild pets' ? 'the wild pets' : name}!` : `${name === 'Wild pets' ? 'The wild pets' : name} won this time. Level up with healthy habits and try again!`}</Text>
      {reward && reward.rewarded ? (
        <PopIn delay={200}>
          <View style={styles.rewardRow}>
            <View style={styles.reward}><Text style={styles.rewardText}>🪙 +{reward.coins}</Text></View>
            {reward.chest ? <View style={styles.reward}><Text style={styles.rewardText}>🎁 Bronze chest</Text></View> : null}
          </View>
        </PopIn>
      ) : (
        <Text style={styles.tip}>Battle rewards are used up for today. You can still battle for fun!</Text>
      )}
      <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
        <Button label="Rematch" onPress={onRematch} style={{ flex: 1 }} />
        <Button primary label="Done" onPress={onClose} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function TeamDots({ fighters, index, style }: { fighters: B.Fighter[]; index: number; style: any }) {
  return (
    <View style={[styles.dots, style]}>
      {fighters.map((f, i) => (
        <View key={f.key} style={[styles.ball, f.hp === 0 && styles.ballOut, i === index && f.hp > 0 && styles.ballOn]} />
      ))}
    </View>
  );
}

function FighterCard({ f, label, style, power }: { f: B.Fighter; label: string; style: any; power?: number }) {
  const pct = f.hp / f.maxHp;
  const hpColor = pct > 0.5 ? '#2FB58A' : pct > 0.2 ? '#FFC94D' : '#FF6B4A';
  const w = useRef(new Animated.Value(pct)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: pct, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct]);
  return (
    <View style={[styles.fcard, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={styles.fname} numberOfLines={1}>{f.nickname}</Text>
        <Text style={styles.flv}>Lv {f.level}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={[styles.el, { backgroundColor: B.ELEMENT_COLOR[f.element] }]}><Text style={styles.elText}>{B.ELEMENT_LABEL[f.element]}</Text></View>
        <Text style={styles.flabel}>{label}{power && power > 1 ? ` · ×${power.toFixed(2)}` : ''}</Text>
      </View>
      <View style={styles.hpTrack}>
        <Animated.View style={{ height: '100%', borderRadius: 999, backgroundColor: hpColor, width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.hpText}>{f.hp} / {f.maxHp} HP</Text>
        <Text style={styles.hpText}>{'⚡'.repeat(f.charge)}{'·'.repeat(B.SPECIAL_COST - f.charge)}</Text>
      </View>
    </View>
  );
}

function FighterSprite({ f, side, lunge, hit, faint, style }: { f: B.Fighter; side: B.Side; lunge: Animated.Value; hit: Animated.Value; faint: Animated.Value; style: any }) {
  const sp = SPECIES_BY_ID[f.speciesId];
  const dir = side === 'me' ? 1 : -1;
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 700 + (side === 'me' ? 0 : 150), easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 700 + (side === 'me' ? 0 : 150), easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      key={f.key}
      style={[
        { position: 'absolute' },
        style,
        {
          opacity: Animated.multiply(faint, hit.interpolate({ inputRange: [0, 0.15, 0.3, 0.45, 0.6, 1], outputRange: [1, 0.3, 1, 0.3, 1, 1] })),
          transform: [
            { translateX: Animated.add(lunge.interpolate({ inputRange: [0, 1], outputRange: [0, 46 * dir] }), hit.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 1], outputRange: [0, -8, 8, -4, 0] })) },
            { translateY: Animated.add(Animated.add(lunge.interpolate({ inputRange: [0, 1], outputRange: [0, -24 * dir] }), bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] })), faint.interpolate({ inputRange: [0, 1], outputRange: [40, 0] })) },
          ],
        },
      ]}
    >
      <PopIn key={f.key}>
        <PetSprite species={sp} stage={stageFor(f.xp)} size={side === 'me' ? 150 : 128} shiny={f.shiny} hat={f.hat} />
      </PopIn>
    </Animated.View>
  );
}

function DamagePop({ side, text, color, onDone }: { side: B.Side; text: string; color: string; onDone: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(onDone);
  }, []);
  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        styles.pop,
        side === 'them' ? { top: 90, right: 70 } : { bottom: 150, left: 80 },
        { color, opacity: v.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -50] }) }, { scale: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.5, 1.3, 1] }) }] },
      ]}
    >
      {text}
    </Animated.Text>
  );
}

function MoveButton({ icon, label, sub, disabled, glow, onPress }: { icon: string; label: string; sub: string; disabled?: boolean; glow?: boolean; onPress: () => void }) {
  const press = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      style={{ flex: 1 }}
      onPress={() => { if (!disabled) onPress(); }}
      onPressIn={() => !disabled && Animated.spring(press, { toValue: 0.92, friction: 6, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(press, { toValue: 1, friction: 4, useNativeDriver: true }).start()}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.move, glow && styles.moveGlow, disabled && { opacity: 0.45 }, { transform: [{ scale: press }] }]}>
        <Text style={{ fontSize: 24 }}>{icon}</Text>
        <Text style={styles.moveLabel}>{label}</Text>
        <Text style={styles.moveSub}>{sub}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  full: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#1B2240', zIndex: 90 },
  arena: { flex: 1, overflow: 'hidden', minHeight: 380 },
  panel: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: space.lg, gap: space.sm, marginTop: -20 },
  line: { fontSize: 16, fontWeight: '800', color: colors.ink, minHeight: 44, textAlign: 'center' },
  moves: { flexDirection: 'row', gap: space.sm },
  move: { alignItems: 'center', paddingVertical: 10, borderRadius: 18, borderWidth: 2, borderColor: colors.line, backgroundColor: '#FAFCFB', gap: 1 },
  moveGlow: { borderColor: colors.gold, backgroundColor: '#FFF6DD' },
  moveLabel: { fontWeight: '900', fontSize: 14, color: colors.ink },
  moveSub: { fontWeight: '700', fontSize: 11, color: colors.muted },
  tip: { fontSize: 12, fontWeight: '700', color: colors.muted, textAlign: 'center' },
  run: { fontSize: 13, fontWeight: '800', color: colors.muted, textAlign: 'center', paddingVertical: 4, textDecorationLine: 'underline' },
  fcard: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 16, padding: 10, width: 190, gap: 4, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 3, zIndex: 4 },
  fname: { fontWeight: '900', fontSize: 15, color: colors.ink, flexShrink: 1 },
  flv: { fontWeight: '900', fontSize: 12, color: '#5A3E00', backgroundColor: colors.gold, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  flabel: { fontWeight: '700', fontSize: 11, color: colors.muted },
  el: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  elText: { color: '#fff', fontWeight: '900', fontSize: 10 },
  hpTrack: { height: 10, borderRadius: 999, backgroundColor: '#E7EEEA', overflow: 'hidden' },
  hpText: { fontWeight: '800', fontSize: 11, color: colors.muted },
  dots: { position: 'absolute', flexDirection: 'row', gap: 5, zIndex: 4 },
  ball: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: colors.ink },
  ballOn: { backgroundColor: colors.gold },
  ballOut: { backgroundColor: '#9AA6A8', opacity: 0.6 },
  pop: { position: 'absolute', fontSize: 34, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 }, zIndex: 6 },
  result: { fontSize: 34, fontWeight: '900' },
  resultSub: { fontSize: 15, fontWeight: '700', color: colors.muted, textAlign: 'center' },
  rewardRow: { flexDirection: 'row', gap: 8 },
  reward: { backgroundColor: '#FFF6DD', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1.5, borderColor: colors.gold },
  rewardText: { fontWeight: '900', fontSize: 15, color: '#5A3E00' },
});
