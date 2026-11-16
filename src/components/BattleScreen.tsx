import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import type { MoveDef } from '../game/stats';
import type { GameState } from '../game/types';

export interface Opponent {
  name: string;
  team: B.PetLike[];
  /** Set for a friend's team; wild battles have none. */
  friendId?: string;
}

type Phase = 'pick' | 'fight' | 'result';
type Pop = { id: number; side: B.Side; text: string; color: string };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const moveColor = (m: MoveDef) => (m.element === 'normal' ? B.NORMAL_COLOR : B.ELEMENT_COLOR[m.element]);

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
  const [switching, setSwitching] = useState(false);
  const [sky] = useState(skyNow);
  const setup = B.myBattleSetup(state);

  const lunge = { me: useRef(new Animated.Value(0)).current, them: useRef(new Animated.Value(0)).current };
  const hit = { me: useRef(new Animated.Value(0)).current, them: useRef(new Animated.Value(0)).current };
  const faint = { me: useRef(new Animated.Value(1)).current, them: useRef(new Animated.Value(1)).current };
  const [pops, setPops] = useState<Pop[]>([]);
  const pop = (side: B.Side, text: string, color: string) => setPops((p) => [...p, { id: Date.now() + Math.random(), side, text, color }]);

  const start = (ids: string[]) => {
    const mine = ids.map((id) => state.pets.find((p) => p.id === id)!).filter(Boolean);
    setTeam(ids);
    setBattle(B.startBattle(mine, opponent.team, setup.buffs, { care: setup.care, streak: setup.streak }));
    faint.me.setValue(1);
    faint.them.setValue(1);
    setLine(opponent.friendId ? `${opponent.name} wants to battle!` : 'Wild pets appeared!');
    setReward(null);
    setSwitching(false);
    setPhase('fight');
    buzz('medium', 'whoosh');
  };

  /** Animates one step of the turn, then shows the battle as it is after that step. */
  const playFrame = async (f: B.Frame) => {
    const ev = f.event;
    if (ev.kind === 'end') {
      setBattle(f.battle);
      return;
    }
    setLine(ev.text);
    const att = ev.side;
    const tgt = ev.target ?? (att === 'me' ? 'them' : 'me');
    if (ev.kind === 'move' || ev.kind === 'miss') {
      Animated.sequence([
        Animated.timing(lunge[att], { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(lunge[att], { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
      await wait(150);
      if (ev.kind === 'miss') {
        buzz('light', 'whoosh');
        pop(tgt, 'Dodged!', '#FFFFFF');
      } else {
        const big = (ev.move?.power ?? 0) >= 100 || ev.crit;
        buzz(big ? 'heavy' : 'medium', big ? 'special' : 'hit');
        hit[tgt].setValue(0);
        Animated.timing(hit[tgt], { toValue: 1, duration: 420, useNativeDriver: true }).start();
        pop(tgt, `-${ev.damage}`, (ev.effect ?? 1) > 1 || ev.crit ? '#FFD84D' : '#FFFFFF');
      }
      setBattle(f.battle);
      await wait(650);
    } else if (ev.kind === 'burn') {
      buzz('light', 'hit');
      hit[tgt].setValue(0);
      Animated.timing(hit[tgt], { toValue: 1, duration: 420, useNativeDriver: true }).start();
      pop(tgt, `🔥 -${ev.damage}`, '#FF8A4C');
      setBattle(f.battle);
      await wait(650);
    } else if (ev.kind === 'heal') {
      buzz('light', 'chime');
      pop(att, `+${ev.healed} HP`, '#7CF0B5');
      setBattle(f.battle);
      await wait(600);
    } else if (ev.kind === 'buff' || ev.kind === 'energy') {
      buzz('light', ev.kind === 'energy' ? 'pop' : 'guard');
      pop(att, ev.kind === 'energy' ? '+⚡⚡' : (ev.move?.emoji ?? '⬆'), '#FFE27A');
      setBattle(f.battle);
      await wait(600);
    } else if (ev.kind === 'status') {
      setBattle(f.battle);
      await wait(600);
    } else if (ev.kind === 'faint') {
      Animated.timing(faint[ev.side], { toValue: 0, duration: 450, useNativeDriver: true }).start();
      await wait(500);
      setBattle(f.battle);
      if (!f.battle.over) faint[ev.side].setValue(1);
      await wait(500);
    } else {
      // Switches, dozing and statuses wearing off.
      buzz('light', ev.kind === 'switch' ? 'whoosh' : 'tap');
      setBattle(f.battle);
      await wait(650);
    }
  };

  const act = async (action: B.Action) => {
    if (!battle || busy || battle.over) return;
    setBusy(true);
    setSwitching(false);
    const frames = B.playTurn(battle, action, B.aiAction(battle, 'them'));
    for (const f of frames) await playFrame(f);
    const after = frames[frames.length - 1].battle;
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
      setLine(`What will ${B.active(after, 'me').nickname} do?`);
    }
    setBusy(false);
  };

  if (phase === 'pick') {
    const theirNames = opponent.team.slice(0, B.TEAM_SIZE).map((p) => `${p.nickname} (Lv ${Math.max(1, B.makeFighter(p, 'x').level)})`).join(', ');
    const buffText = setup.buffs.length ? ` Today’s habit buffs: ${setup.buffs.map((b) => `${b.emoji} ${b.label}`).join(', ')}.` : ' Tip: sleep 7+ hours, drink 6 glasses and walk 8,000 steps for battle buffs!';
    return (
      <PetPicker
        title="Pick your battle team"
        subtitle={`Up to ${B.TEAM_SIZE} pets vs ${opponent.name}: ${theirNames}.${buffText}`}
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
  const me = B.active(battle, 'me');
  const them = B.active(battle, 'them');

  return (
    <View style={styles.full}>
      <View style={styles.arena}>
        <Backdrop element={me.element} sky={sky} />
        <TeamDots fighters={battle.theirs} index={battle.ti} style={{ top: 10, right: 12 }} />
        <TeamDots fighters={battle.mine} index={battle.mi} style={{ bottom: 32, left: 16 }} />
        <FighterCard f={them} label={opponent.name} style={{ top: 34, left: 12 }} />
        <FighterCard f={me} label="You" style={{ bottom: 40, right: 12 }} buffs={setup.buffs} />
        <FighterSprite f={them} side="them" lunge={lunge.them} hit={hit.them} faint={faint.them} style={{ top: 78, right: 24 }} />
        <FighterSprite f={me} side="me" lunge={lunge.me} hit={hit.me} faint={faint.me} style={{ bottom: 56, left: 20 }} />
        {pops.map((p) => (
          <DamagePop key={p.id} side={p.side} text={p.text} color={p.color} onDone={() => setPops((list) => list.filter((x) => x.id !== p.id))} />
        ))}
      </View>

      <View style={styles.panel}>
        {phase === 'fight' ? (
          <>
            <Text style={styles.line} numberOfLines={2}>{line}</Text>
            {switching ? (
              <View style={{ gap: 8 }}>
                <Text style={styles.tip}>Switching uses your turn. Pick a pet:</Text>
                <View style={styles.switchRow}>
                  {battle.mine.map((f, i) => {
                    const sp = SPECIES_BY_ID[f.speciesId];
                    const disabled = f.hp <= 0 || i === battle.mi;
                    return (
                      <Pressable key={f.key} onPress={() => !disabled && act({ type: 'switch', index: i })} style={[styles.switchPet, disabled && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel={`Switch to ${f.nickname}`}>
                        <PetSprite species={sp} stage={stageFor(f.xp)} size={52} skin={f.skin} hat={f.hat} />
                        <Text style={styles.switchName} numberOfLines={1}>{f.nickname}</Text>
                        <Text style={styles.switchHp}>{f.hp > 0 ? `${f.hp}/${f.maxHp}` : 'Fainted'}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Button small label="Back to moves" onPress={() => setSwitching(false)} />
              </View>
            ) : (
              <>
                <View style={styles.energyRow}>
                  <Text style={styles.energyLabel}>Energy</Text>
                  {Array.from({ length: B.MAX_ENERGY }, (_, i) => (
                    <View key={i} style={[styles.pip, i < me.energy && styles.pipOn]}>
                      <Text style={styles.pipText}>⚡</Text>
                    </View>
                  ))}
                  <Text style={styles.energyHint}>+1 each turn</Text>
                </View>
                <View style={styles.moves}>
                  {me.moves.map((m) => (
                    <MoveButton key={m.id} m={m} foe={them} energy={me.energy} disabled={busy} onPress={() => act({ type: 'move', moveId: m.id })} />
                  ))}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Pressable onPress={() => !busy && battle.mine.filter((f) => f.hp > 0).length > 1 && setSwitching(true)} accessibilityRole="button" style={{ opacity: battle.mine.filter((f) => f.hp > 0).length > 1 ? 1 : 0.4 }}>
                    <Text style={styles.link}>🔄 Switch pet</Text>
                  </Pressable>
                  <Pressable onPress={onClose} accessibilityRole="button">
                    <Text style={styles.run}>Run away</Text>
                  </Pressable>
                </View>
              </>
            )}
          </>
        ) : (
          <Result won={battle.over === 'win'} reward={reward} name={opponent.name} onRematch={() => setPhase('pick')} onClose={onClose} />
        )}
      </View>
    </View>
  );
}

function MoveButton({ m, foe, energy, disabled, onPress }: { m: MoveDef; foe: B.Fighter; energy: number; disabled?: boolean; onPress: () => void }) {
  const press = useRef(new Animated.Value(1)).current;
  const affordable = energy >= m.cost;
  const eff = m.kind === 'attack' ? B.effectiveness(m.element, foe.element) : 1;
  const off = disabled || !affordable;
  const c = moveColor(m);
  const hint = m.kind === 'attack' ? `Power ${m.power}${m.priority ? ' · First' : ''}` : m.desc;
  return (
    <Pressable
      style={{ width: '48.5%' }}
      onPress={off ? undefined : onPress}
      onPressIn={() => !off && Animated.spring(press, { toValue: 0.93, friction: 6, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(press, { toValue: 1, friction: 4, useNativeDriver: true }).start()}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      accessibilityLabel={`${m.name}, costs ${m.cost} energy`}
    >
      <Animated.View style={[styles.move, { borderColor: c }, off && { opacity: 0.4 }, { transform: [{ scale: press }] }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 20 }}>{m.emoji}</Text>
          <Text style={styles.moveName} numberOfLines={1}>{m.name}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.moveHint} numberOfLines={1}>{hint}</Text>
          <Text style={[styles.cost, { backgroundColor: m.cost ? '#FFF1C9' : '#EAF7F1' }]}>{m.cost ? `${m.cost}⚡` : 'Free'}</Text>
        </View>
        {eff !== 1 ? <Text style={[styles.eff, { color: eff > 1 ? '#1E8A68' : '#C4562F' }]}>{eff > 1 ? '▲ Super effective' : '▼ Not very effective'}</Text> : null}
      </Animated.View>
    </Pressable>
  );
}

function Result({ won, reward, name, onRematch, onClose }: { won: boolean; reward: B.BattleReward | null; name: string; onRematch: () => void; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const nm = name === 'Wild pets' ? 'the wild pets' : name;
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      {won ? <Confetti width={width} height={height} amount={70} /> : null}
      <PopIn from={0.2}>
        <Text style={[styles.result, { color: won ? '#E5A800' : colors.ink }]}>{won ? '🏆 YOU WIN!' : 'So close!'}</Text>
      </PopIn>
      <Text style={styles.resultSub}>{won ? `You beat ${nm}!` : `${nm[0].toUpperCase() + nm.slice(1)} won this time. Train your pets and try new moves!`}</Text>
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

function FighterCard({ f, label, style, buffs }: { f: B.Fighter; label: string; style: any; buffs?: B.HabitBuff[] }) {
  const pct = f.hp / f.maxHp;
  const hpColor = pct > 0.5 ? '#2FB58A' : pct > 0.2 ? '#FFC94D' : '#FF6B4A';
  const w = useRef(new Animated.Value(pct)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: pct, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct]);
  const icons = [
    ...(f.status ? [B.STATUS_INFO[f.status.type].emoji] : []),
    ...(Object.keys(f.buffs) as (keyof typeof B.BUFF_INFO)[]).map((k) => B.BUFF_INFO[k].emoji),
  ];
  return (
    <View style={[styles.fcard, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={styles.fname} numberOfLines={1}>{f.nickname}</Text>
        <Text style={styles.flv}>Lv {f.level}</Text>
        {icons.length ? <Text style={{ fontSize: 13 }}>{icons.join('')}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={[styles.el, { backgroundColor: B.ELEMENT_COLOR[f.element] }]}><Text style={styles.elText}>{B.ELEMENT_LABEL[f.element]}</Text></View>
        <Text style={styles.flabel} numberOfLines={1}>{label}{buffs?.length ? ` · ${buffs.map((b) => b.emoji).join('')}` : ''}</Text>
      </View>
      <View style={styles.hpTrack}>
        <Animated.View style={{ height: '100%', borderRadius: 999, backgroundColor: hpColor, width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.hpText}>{f.hp} / {f.maxHp} HP</Text>
        <Text style={styles.hpText}>⚡{f.energy}</Text>
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
        <PetSprite species={sp} stage={stageFor(f.xp)} size={side === 'me' ? 150 : 128} shiny={f.shiny} skin={f.skin} hat={f.hat} mood={f.status?.type === 'drowsy' ? 'sleepy' : 'happy'} />
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

const styles = StyleSheet.create({
  full: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#1B2240', zIndex: 90 },
  arena: { flex: 1, overflow: 'hidden', minHeight: 330 },
  panel: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: space.md, gap: 8, marginTop: -20 },
  line: { fontSize: 15, fontWeight: '800', color: colors.ink, minHeight: 40, textAlign: 'center' },
  energyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  energyLabel: { fontWeight: '900', fontSize: 12, color: colors.ink, marginRight: 4 },
  pip: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#EEF1F0', alignItems: 'center', justifyContent: 'center' },
  pipOn: { backgroundColor: '#FFE27A' },
  pipText: { fontSize: 12 },
  energyHint: { fontSize: 11, fontWeight: '700', color: colors.muted, marginLeft: 'auto' },
  moves: { flexDirection: 'row', flexWrap: 'wrap', gap: '3%', rowGap: 8 },
  move: { padding: 9, borderRadius: 14, borderWidth: 2, backgroundColor: '#FAFCFB', gap: 3, minHeight: 66 },
  moveName: { fontWeight: '900', fontSize: 14, color: colors.ink, flexShrink: 1 },
  moveHint: { fontWeight: '700', fontSize: 10.5, color: colors.muted, flexShrink: 1 },
  cost: { fontWeight: '900', fontSize: 11, color: '#5A3E00', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden', flexShrink: 0, marginLeft: 4 },
  eff: { fontWeight: '900', fontSize: 10.5 },
  switchRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  switchPet: { alignItems: 'center', width: 96, padding: 6, borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, backgroundColor: '#FAFCFB' },
  switchName: { fontWeight: '900', fontSize: 12, color: colors.ink },
  switchHp: { fontWeight: '700', fontSize: 10, color: colors.muted },
  tip: { fontSize: 12, fontWeight: '700', color: colors.muted, textAlign: 'center' },
  link: { fontSize: 13, fontWeight: '900', color: colors.mintDark, paddingVertical: 4 },
  run: { fontSize: 13, fontWeight: '800', color: colors.muted, paddingVertical: 4, textDecorationLine: 'underline' },
  fcard: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 16, padding: 10, width: 196, gap: 4, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 3, zIndex: 4 },
  fname: { fontWeight: '900', fontSize: 15, color: colors.ink, flexShrink: 1 },
  flv: { fontWeight: '900', fontSize: 12, color: '#5A3E00', backgroundColor: colors.gold, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  flabel: { fontWeight: '700', fontSize: 11, color: colors.muted, flexShrink: 1 },
  el: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  elText: { color: '#fff', fontWeight: '900', fontSize: 10 },
  hpTrack: { height: 10, borderRadius: 999, backgroundColor: '#E7EEEA', overflow: 'hidden' },
  hpText: { fontWeight: '800', fontSize: 11, color: colors.muted },
  dots: { position: 'absolute', flexDirection: 'row', gap: 5, zIndex: 4 },
  ball: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: colors.ink },
  ballOn: { backgroundColor: colors.gold },
  ballOut: { backgroundColor: '#9AA6A8', opacity: 0.6 },
  pop: { position: 'absolute', fontSize: 30, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 }, zIndex: 6 },
  result: { fontSize: 34, fontWeight: '900' },
  resultSub: { fontSize: 15, fontWeight: '700', color: colors.muted, textAlign: 'center' },
  rewardRow: { flexDirection: 'row', gap: 8 },
  reward: { backgroundColor: '#FFF6DD', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1.5, borderColor: colors.gold },
  rewardText: { fontWeight: '900', fontSize: 15, color: '#5A3E00' },
});
