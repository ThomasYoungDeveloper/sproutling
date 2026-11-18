import React, { useEffect, useRef, useState } from 'react';
import * as H from '../game/hp';
import PotionIcon, { POTION_COLOR } from './PotionIcon';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useGame } from '../state/GameContext';
import { useTeam } from '../state/TeamContext';
import { useRanked } from '../state/RankedContext';
import { useLive } from '../state/LiveBattleContext';
import { tierFor } from '../game/ranked';
import { raidBoss } from '../game/team';
import PetSprite from './PetSprite';
import PetPicker from './PetPicker';
import PowerGlow from './PowerGlow';
import { Backdrop, skyNow } from './PetScene';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

/** A line on the result screen for special battles (wild pets, the Sky Tower). */
export type ResultLine = { label: string; value: string; color?: string };

/** Battles that use your pets' real HP and pay out their own way. */
export interface SpecialBattle {
  /** Called once when the battle ends (or you run away, which counts as a loss). Returns lines for the result screen. */
  onEnd: (won: boolean, b: B.Battle, teamIds: string[]) => ResultLine[];
  /** Extra fighter changes, e.g. Sky Tower blessings. */
  tweak?: (b: B.Battle) => B.Battle;
  /** How many of your pets can fight (default 3). */
  teamSize?: number;
  title?: string;
  /** Heading on the result screen when you win / lose. */
  winText?: string;
  loseText?: string;
}

export const REACTIONS = ['😤', '😂', '👏', '😱', '🔥', '🙏'];

export default function BattleScreen({ opponent, onClose, onResult, live, special }: { opponent: Opponent; onClose: () => void; onResult?: (won: boolean) => void; /** Id of a live battle against a real friend. */ live?: string; special?: SpecialBattle }) {
  const insets = useSafeAreaInsets();
  const { state, apply } = useGame();
  const L = useLive();
  const stateRef = useRef<GameState>(state);
  stateRef.current = state;
  const [phase, setPhase] = useState<Phase>(live ? 'fight' : 'pick');
  const [team, setTeam] = useState<string[]>(B.defaultTeam(state));
  const [battle, setBattle] = useState<B.Battle | null>(() => (live ? L.get(live)?.battle ?? null : null));
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState('');
  const [reward, setReward] = useState<B.BattleReward | null>(null);
  const [switching, setSwitching] = useState(false);
  const [sky] = useState(skyNow);
  const [lines, setLines] = useState<ResultLine[] | null>(null);
  const { team: guild, raidHit } = useTeam();
  const [raid, setRaid] = useState<{ dmg: number; boss: string } | null>(null);
  const { report, ranked } = useRanked();
  const [rp, setRp] = useState<number | null>(null);
  const setup = B.myBattleSetup(state);
  const lb = live ? L.get(live) : undefined;
  const shownTurn = useRef<number>(lb?.turn ?? 0);
  const [reactAt, setReactAt] = useState<string | null>(lb?.theirReact?.at ?? null);
  const [bubble, setBubble] = useState<string | null>(null);
  const [myBubble, setMyBubble] = useState<string | null>(null);
  const buffs = lb?.myTeam?.buffs ?? setup.buffs;

  const lunge = { me: useRef(new Animated.Value(0)).current, them: useRef(new Animated.Value(0)).current };
  const hit = { me: useRef(new Animated.Value(0)).current, them: useRef(new Animated.Value(0)).current };
  const faint = { me: useRef(new Animated.Value(1)).current, them: useRef(new Animated.Value(1)).current };
  const [pops, setPops] = useState<Pop[]>([]);
  // Battle drama: screen shake, element bursts, big callouts and a slow-motion final knockout.
  const shake = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const [bursts, setBursts] = useState<{ id: number; side: B.Side; color: string; big: boolean }[]>([]);
  const [callout, setCallout] = useState<{ id: number; text: string; color: string } | null>(null);
  const doShake = (power: number) => {
    shake.setValue(0);
    Animated.sequence(
      [1, -1, 0.7, -0.6, 0.3, 0].map((k) => Animated.timing(shake, { toValue: k * power, duration: 45, useNativeDriver: true })),
    ).start();
  };
  const burst = (side: B.Side, color: string, big: boolean) => setBursts((b) => [...b, { id: Date.now() + Math.random(), side, color, big }]);
  const pop = (side: B.Side, text: string, color: string) => setPops((p) => [...p, { id: Date.now() + Math.random(), side, text, color }]);

  const start = (ids: string[]) => {
    const mine = ids.map((id) => state.pets.find((p) => p.id === id)!).filter(Boolean);
    setTeam(ids);
    let b = B.startBattle(mine, opponent.team, setup.buffs, { care: setup.care, streak: setup.streak });
    if (special) {
      b = { ...b, mine: b.mine.map((f, i) => H.atSavedHp(f, H.hpPct(mine[i]))) };
      if (special.tweak) b = special.tweak(b);
    }
    setBattle(b);
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
        const superEff = (ev.effect ?? 1) > 1;
        buzz(big || superEff ? 'heavy' : 'medium', big || superEff ? 'special' : 'hit');
        const elColor = ev.move && ev.move.element !== 'normal' ? B.ELEMENT_COLOR[ev.move.element] : '#FFFFFF';
        burst(tgt, elColor, big || superEff);
        if (big || superEff) doShake(superEff && big ? 12 : 8);
        if (ev.crit || superEff) setCallout({ id: Date.now(), text: ev.crit && superEff ? 'CRITICAL! SUPER EFFECTIVE!' : ev.crit ? 'CRITICAL HIT!' : 'SUPER EFFECTIVE!', color: superEff ? elColor : '#FFD84D' });
        else if ((ev.effect ?? 1) < 1) setCallout({ id: Date.now(), text: 'Not very effective…', color: '#D6DCF5' });
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
      // The last knockout plays in slow motion with a flash.
      const final = !!f.battle.over;
      if (final) {
        doShake(14);
        flash.setValue(0.9);
        Animated.timing(flash, { toValue: 0, duration: 900, useNativeDriver: true }).start();
        buzz('heavy', 'special');
      }
      Animated.timing(faint[ev.side], { toValue: 0, duration: final ? 1300 : 450, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      await wait(final ? 1400 : 500);
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

  /** Rewards, ranked points and the result screen once a battle ends. */
  const ended = useRef(false);
  const [sureQuit, setSureQuit] = useState(false);
  const endBattle = async (won: boolean, after: B.Battle | null) => {
    if (live) {
      if (ended.current) return;
      ended.current = true;
    }
    if (special) {
      if (ended.current) return;
      ended.current = true;
      setLines(special.onEnd(won, after ?? battle!, team));
    } else if (live && lb) {
      // Only collect rewards for a live battle once, even across phones.
      if (!(stateRef.current.liveDone ?? []).includes(live)) {
        const r = B.finishBattle(stateRef.current, won, true);
        apply(() => ({ ...r.state, liveDone: [...(r.state.liveDone ?? []), live].slice(-200) }));
        setReward(r.reward);
        report(lb.friendId, won).then(setRp);
      }
      if (lb.status === 'active') L.finish(live, lb.iChallenged ? won : !won);
    } else {
      const r = B.finishBattle(stateRef.current, won, !!opponent.friendId);
      apply(() => r.state);
      setReward(r.reward);
      report(opponent.friendId ?? null, won).then(setRp);
      const dmg = after ? B.raidDamage(after) : 0;
      if (guild && dmg) raidHit(dmg).then((res) => setRaid(res === 'ok' ? { dmg, boss: raidBoss(guild.week).name } : null));
    }
    onResult?.(won);
    buzz(won ? 'success' : 'medium', won ? 'win' : 'lose');
    await wait(400);
    setPhase('result');
  };

  const act = async (action: B.Action) => {
    if (!battle || busy || battle.over) return;
    setSwitching(false);
    if (live && lb) {
      setBusy(true);
      const res = await L.move(live, lb.turn, action);
      if (!res.ok) {
        setLine(res.text);
        setBusy(false);
      } else if (res.text === 'waiting') {
        setLine(`Move locked in! Waiting for ${opponent.name}…`);
      }
      // When both moves are in, the turn plays out from the effect below.
      return;
    }
    setBusy(true);
    const frames = B.playTurn(battle, action, B.aiAction(battle, 'them'));
    for (const f of frames) await playFrame(f);
    const after = frames[frames.length - 1].battle;
    setBattle(after);
    if (after.over) await endBattle(after.over === 'win', after);
    else setLine(`What will ${B.active(after, 'me').nickname} do?`);
    setBusy(false);
  };

  // Live battles: play each new turn as soon as it arrives.
  useEffect(() => {
    if (!live || !lb || phase === 'result') return;
    if (lb.theirReact && lb.theirReact.at !== reactAt) {
      setReactAt(lb.theirReact.at);
      setBubble(lb.theirReact.e);
      buzz('light', 'pop');
      setTimeout(() => setBubble(null), 2600);
    }
    if (!lb.battle) return;
    if (lb.turn > shownTurn.current) {
      shownTurn.current = lb.turn;
      (async () => {
        setBusy(true);
        for (const f of lb.last) await playFrame(f);
        setBattle(lb.battle);
        if (lb.battle!.over) await endBattle(lb.battle!.over === 'win', lb.battle);
        else setLine(`What will ${B.active(lb.battle!, 'me').nickname} do?`);
        setBusy(false);
      })();
      return;
    }
    if (busy) return;
    if (lb.battle.over || lb.status === 'done') {
      // Opened after it ended, or someone gave up / ran out of time.
      setBattle(lb.battle);
      endBattle(lb.won ?? false, lb.battle);
      return;
    }
    if (lb.iMoved) setLine(`Move locked in! Waiting for ${opponent.name}…`);
    else if (!line || line.startsWith('Move locked')) setLine(lb.turn === 0 ? (lb.theyMoved ? `${opponent.name} picked a move. Your turn!` : `${opponent.name} is ready. Pick your first move!`) : `What will ${B.active(lb.battle, 'me').nickname} do?`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lb?.turn, lb?.status, lb?.iMoved, lb?.theirReact?.at, lb?.battle]);

  const sendReact = (e: string) => {
    if (!live) return;
    L.react(live, e);
    setMyBubble(e);
    buzz('light', 'pop');
    setTimeout(() => setMyBubble(null), 2000);
  };
  const late = !!lb && lb.status === 'active' && lb.iMoved && !lb.theyMoved && new Date(lb.deadline).getTime() < Date.now();

  if (phase === 'pick') {
    const theirNames = opponent.team.slice(0, B.TEAM_SIZE).map((p) => `${p.nickname} (Lv ${Math.max(1, B.makeFighter(p, 'x').level)})`).join(', ');
    const buffText = setup.buffs.length ? ` Today’s habit buffs: ${setup.buffs.map((b) => `${b.emoji} ${b.label}`).join(', ')}.` : ' Tip: sleep 7+ hours, drink 6 glasses and walk 8,000 steps for battle buffs!';
    return (
      <PetPicker
        title={special?.title ?? "Pick your battle team"}
        subtitle={`${(special?.teamSize ?? B.TEAM_SIZE) === 1 ? 'Pick 1 pet' : `Up to ${special?.teamSize ?? B.TEAM_SIZE} pets`} vs ${opponent.name}: ${theirNames}.${special ? ' Your pets fight with the HP they have now, and lost HP stays down until you use a potion.' : ''}${buffText}`}
        pets={state.pets.map((p) => (special ? { pet: p, showHp: true, disabled: H.isKnockedOut(p) ? `${p.nickname} is knocked out and resting. Its HP starts coming back within a few minutes.` : undefined } : { pet: p }))}
        max={special?.teamSize ?? B.TEAM_SIZE}
        initial={special ? team.slice(0, special.teamSize ?? B.TEAM_SIZE).filter((id) => !H.isKnockedOut(state.pets.find((p) => p.id === id))) : team}
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
    <View style={[styles.full, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <Animated.View style={[styles.arena, { transform: [{ translateX: shake }] }]}>
        <Backdrop element={me.element} sky={sky} scene={state.scene} />
        <TeamDots fighters={battle.theirs} index={battle.ti} style={{ top: 10, right: 12 }} />
        <TeamDots fighters={battle.mine} index={battle.mi} style={{ bottom: 32, left: 16 }} />
        <FighterCard f={them} label={opponent.name} style={{ top: 34, left: 12 }} />
        <FighterCard f={me} label="You" style={{ bottom: 40, right: 12 }} buffs={buffs} />
        <FighterSprite f={them} side="them" lunge={lunge.them} hit={hit.them} faint={faint.them} style={{ top: 78, right: 24 }} />
        <FighterSprite f={me} side="me" lunge={lunge.me} hit={hit.me} faint={faint.me} style={{ bottom: 56, left: 20 }} glow={buffs.length} />
        {bubble ? <View style={[styles.bubble, { top: 64, right: 120 }]}><PopIn from={0.3}><Text style={styles.bubbleText}>{bubble}</Text></PopIn></View> : null}
        {myBubble ? <View style={[styles.bubble, { bottom: 150, left: 110 }]}><PopIn from={0.3}><Text style={styles.bubbleText}>{myBubble}</Text></PopIn></View> : null}
        {live ? <View style={styles.liveTag}><Text style={styles.liveTagText}>● LIVE · Turn {(lb?.turn ?? 0) + 1}</Text></View> : null}
        {pops.map((p) => (
          <DamagePop key={p.id} side={p.side} text={p.text} color={p.color} onDone={() => setPops((list) => list.filter((x) => x.id !== p.id))} />
        ))}
        {bursts.map((b) => (
          <HitBurst key={b.id} side={b.side} color={b.color} big={b.big} onDone={() => setBursts((list) => list.filter((x) => x.id !== b.id))} />
        ))}
        {callout ? <Callout key={callout.id} text={callout.text} color={callout.color} onDone={() => setCallout(null)} /> : null}
        <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flash }]} />
      </Animated.View>

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
                    <MoveButton key={m.id} m={m} foe={them} energy={me.energy} disabled={busy || !!lb?.iMoved} onPress={() => act({ type: 'move', moveId: m.id })} />
                  ))}
                </View>
                {special ? (
                  <View style={styles.potionRow}>
                    {(['small', 'full'] as const).map((k) => {
                      const n = H.potionsOf(state, k);
                      const off = busy || !n || me.hp >= me.maxHp;
                      return (
                        <Pressable
                          key={k}
                          disabled={off}
                          onPress={() => {
                            const after = H.takePotion(stateRef.current, k);
                            if (!after) return;
                            apply(() => after);
                            act({ type: 'potion', heal: H.POTION_HEAL[k], label: H.POTION_ITEM[k] });
                          }}
                          style={[styles.potionBtn, { borderColor: POTION_COLOR[k] }, off && { opacity: 0.4 }]}
                          accessibilityRole="button"
                          accessibilityLabel={`Drink a ${H.POTION_ITEM[k]}, ${n} left. Uses your turn.`}
                        >
                          <PotionIcon kind={k} size={26} />
                          <Text style={styles.potionText}>{k === 'small' ? 'Small' : 'Full'} · {n}</Text>
                        </Pressable>
                      );
                    })}
                    <Text style={styles.potionHint}>Uses your turn</Text>
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Pressable onPress={() => !busy && !lb?.iMoved && battle.mine.filter((f) => f.hp > 0).length > 1 && setSwitching(true)} accessibilityRole="button" style={{ opacity: battle.mine.filter((f) => f.hp > 0).length > 1 ? 1 : 0.4 }}>
                    <Text style={styles.link}>🔄 Switch pet</Text>
                  </Pressable>
                  {live ? (
                    <Pressable onPress={() => { if (!sureQuit) { setSureQuit(true); setTimeout(() => setSureQuit(false), 4000); } else if (live) L.forfeit(live); }} accessibilityRole="button">
                      <Text style={[styles.run, sureQuit && { color: '#C4562F' }]}>{sureQuit ? 'Tap again to give up' : 'Give up'}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => {
                      // Running from a wild pet or the tower keeps the HP you lost.
                      if (special && battle && !ended.current) {
                        ended.current = true;
                        special.onEnd(false, battle, team);
                      }
                      onClose();
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.run}>{live ? 'Close' : 'Run away'}</Text>
                  </Pressable>
                </View>
                {live ? (
                  <View style={styles.reactRow}>
                    {REACTIONS.map((e) => (
                      <Pressable key={e} onPress={() => sendReact(e)} style={styles.reactBtn} accessibilityRole="button" accessibilityLabel={`React ${e}`}>
                        <Text style={{ fontSize: 20 }}>{e}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {late ? <Button small primary label={`${opponent.name} ran out of time. Claim the win`} onPress={() => live && L.claimTimeout(live)} /> : null}
              </>
            )}
          </>
        ) : (
          <Result won={battle.over === 'win'} lines={lines} special={special} reward={reward} raid={raid} rp={rp} points={ranked?.points ?? null} name={opponent.name} onRematch={live || special ? undefined : () => { setRaid(null); setRp(null); setPhase('pick'); }} onClose={onClose} />
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

function Result({ won, lines, special, reward, raid, rp, points, name, onRematch, onClose }: { won: boolean; lines?: ResultLine[] | null; special?: SpecialBattle; reward: B.BattleReward | null; raid: { dmg: number; boss: string } | null; rp: number | null; points: number | null; name: string; onRematch?: () => void; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const nm = name === 'Wild pets' ? 'the wild pets' : name;
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      {won ? <Confetti width={width} height={height} amount={70} /> : null}
      <PopIn from={0.2}>
        <Text style={[styles.result, { color: won ? '#E5A800' : colors.ink }]}>{won ? '🏆 YOU WIN!' : 'So close!'}</Text>
      </PopIn>
      <Text style={styles.resultSub}>{special ? (won ? special.winText : special.loseText) ?? '' : won ? `You beat ${nm}!` : `${nm[0].toUpperCase() + nm.slice(1)} won this time. Train your pets and try new moves!`}</Text>
      {special ? (
        lines && lines.length ? (
          <PopIn delay={200}>
            <View style={styles.lines}>
              {lines.map((l, i) => (
                <View key={i} style={styles.lineRow}>
                  <Text style={styles.lineLabel}>{l.label}</Text>
                  <Text style={[styles.lineValue, l.color ? { color: l.color } : null]}>{l.value}</Text>
                </View>
              ))}
            </View>
          </PopIn>
        ) : null
      ) : reward && reward.rewarded ? (
        <PopIn delay={200}>
          <View style={styles.rewardRow}>
            <View style={styles.reward}><Text style={styles.rewardText}>🪙 +{reward.coins}</Text></View>
            {reward.chest ? <View style={styles.reward}><Text style={styles.rewardText}>🎁 Bronze chest</Text></View> : null}
          </View>
        </PopIn>
      ) : (
        <Text style={styles.tip}>Battle rewards are used up for today. You can still battle for fun!</Text>
      )}
      {rp ? (
        <PopIn delay={300}>
          <View style={[styles.reward, { backgroundColor: tierFor(points ?? 0).color }]}>
            <Text style={[styles.rewardText, { color: '#fff' }]}>{tierFor(points ?? 0).emoji} {rp > 0 ? '+' : ''}{rp} ranked points{points != null ? ` · ${points} total` : ''}</Text>
          </View>
        </PopIn>
      ) : null}
      {raid ? (
        <PopIn delay={400}>
          <View style={[styles.reward, { backgroundColor: '#2A1E3D' }]}><Text style={[styles.rewardText, { color: '#fff' }]}>🐉 {raid.dmg} damage to {raid.boss}!</Text></View>
        </PopIn>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
        {onRematch ? <Button label="Rematch" onPress={onRematch} style={{ flex: 1 }} /> : null}
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

function FighterSprite({ f, side, lunge, hit, faint, style, glow = 0 }: { f: B.Fighter; side: B.Side; lunge: Animated.Value; hit: Animated.Value; faint: Animated.Value; style: any; glow?: number }) {
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
      <PowerGlow count={glow} size={side === 'me' ? 150 : 128} />
      <PopIn key={f.key}>
        <PetSprite species={sp} stage={stageFor(f.xp)} size={side === 'me' ? 150 : 128} shiny={f.shiny} skin={f.skin} hat={f.hat} aura={f.aura} mood={f.status?.type === 'drowsy' ? 'sleepy' : 'happy'} />
      </PopIn>
    </Animated.View>
  );
}

/** A ring of color that bursts out where a hit lands. */
function HitBurst({ side, color, big, onDone }: { side: B.Side; color: string; big: boolean; onDone: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: big ? 600 : 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(onDone);
  }, []);
  const size = big ? 170 : 120;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: big ? 10 : 6, borderColor: color },
        side === 'them' ? { top: 120 - size / 2 + 40, right: 84 - size / 2 + 40 } : { bottom: 120 - size / 2 + 40, left: 84 - size / 2 + 40 },
        { opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.9, 0.8, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.2] }) }] },
      ]}
    />
  );
}

/** Big text across the arena for critical and super effective hits. */
function Callout({ text, color, onDone }: { text: string; color: string; onDone: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(onDone);
  }, []);
  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        styles.callout,
        { color, opacity: v.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 0.12, 0.25, 1], outputRange: [0.4, 1.25, 1, 1] }) }, { rotate: '-4deg' }] },
      ]}
    >
      {text}
    </Animated.Text>
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
  potionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  potionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 2, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#FFFBF2' },
  potionText: { fontWeight: '900', fontSize: 13, color: colors.ink },
  potionHint: { fontSize: 11, fontWeight: '700', color: colors.muted, marginLeft: 'auto' },
  lines: { alignSelf: 'stretch', backgroundColor: '#F6F1E7', borderRadius: 14, padding: 12, gap: 6, minWidth: 260 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  lineLabel: { fontSize: 15, fontWeight: '800', color: colors.ink, flexShrink: 1 },
  lineValue: { fontSize: 15, fontWeight: '900', color: colors.ink },
  bubble: { position: 'absolute', backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 10, paddingVertical: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  bubbleText: { fontSize: 30 },
  liveTag: { position: 'absolute', top: 10, left: 12, backgroundColor: 'rgba(214,40,57,0.9)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  liveTagText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  reactRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  reactBtn: { width: 44, height: 40, borderRadius: 12, backgroundColor: '#F4F1EA', alignItems: 'center', justifyContent: 'center' },
  full: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#1B2240', zIndex: 90 },
  arena: { flex: 1, overflow: 'hidden', minHeight: 330 },
  flash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF' },
  callout: { position: 'absolute', top: '42%', left: 0, right: 0, textAlign: 'center', fontSize: 30, fontWeight: '900', letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 6 },
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
