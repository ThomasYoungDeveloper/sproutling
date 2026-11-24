import { useResetIn } from '../lib/useResetIn';
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { Icon, type IconName } from './Icon';
import { useLive, type LiveBattle } from '../state/LiveBattleContext';
import { useGame } from '../state/GameContext';
import { useFriends, type Friend, type Trade } from '../state/FriendsContext';
import { useOverlay } from './Overlay';
import PetPicker from './PetPicker';
import PetSprite from './PetSprite';
import BattleScreen, { type Opponent } from './BattleScreen';
import { Button, Card, SectionHead } from './ui';
import { buzz } from './fx';
import { colors, font, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { levelFor, stageFor } from '../game/scoring';
import * as B from '../game/battle';
import { healthProvider, isVerified } from '../lib/health';
import * as T from '../game/trade';
import type { TradePet } from '../game/trade';
import { BuffSheet } from './BuffInfo';
import FriendPetSheet, { type ViewPet } from './FriendPetSheet';

/* ---------- Picking a pet to trade ---------- */

/** Pick up to 3 of your pets for a trade. Shows both sides and a rough fairness hint as you pick. */
function TradePicker({
  title,
  subtitle,
  onSend,
  onClose,
  get,
  takeFrom,
  confirm,
  initial,
  skipBusy,
}: {
  title: string;
  subtitle: string;
  onSend: (petIds: string[], takeIds?: string[]) => Promise<{ ok: boolean; text: string }>;
  onClose: () => void;
  /** The pets you'd get (a request, or the friend's offer). */
  get?: TradePet[];
  /** Countering a multi-pet offer: you can leave some of their pets out. */
  takeFrom?: TradePet[];
  confirm?: string;
  initial?: string[];
  /** Pets already in this trade (changing an offer) aren't "busy". */
  skipBusy?: string[];
}) {
  const { state } = useGame();
  const { busyPetIds } = useFriends();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [take, setTake] = useState<string[]>(() => (takeFrom ?? []).map((p) => p.id));
  const busySet = skipBusy?.length ? new Set([...busyPetIds].filter((id) => !skipBusy.includes(id))) : busyPetIds;
  const pets = [...state.pets]
    .sort((a, b) => b.xp - a.xp)
    .map((p) => {
      const c = T.canOffer(state, p.id, busySet);
      return { pet: p, disabled: c.ok ? undefined : c.reason };
    });
  const getting = takeFrom ? takeFrom.filter((p) => take.includes(p.id)) : (get ?? []);
  return (
    <PetPicker
      title={title}
      subtitle={subtitle}
      pets={pets}
      max={T.MAX_TRADE_PETS}
      initial={initial}
      busy={busy}
      message={msg}
      confirmLabel={(n) => (msg?.ok ? 'Sent!' : confirm ?? (n > 1 ? `Offer these ${n} pets` : 'Offer this pet'))}
      header={(picked) => {
        const mine = picked.map((id) => state.pets.find((p) => p.id === id)).filter(Boolean).map((p) => T.toTradePet(p!));
        return (
          <View style={{ gap: 6 }}>
            {getting.length || takeFrom ? (
              <View style={styles.swap}>
                <PetStack ps={mine} top="YOU GIVE" empty="Pick below" />
                <Text style={styles.arrow}>⇄</Text>
                {takeFrom && takeFrom.length > 1 ? (
                  <PetStack
                    ps={takeFrom}
                    top="YOU GET"
                    empty="Tap to take"
                    off={takeFrom.filter((p) => !take.includes(p.id)).map((p) => p.id)}
                    onToggle={(id) => setTake((l) => (l.includes(id) ? (l.length > 1 ? l.filter((x) => x !== id) : l) : [...l, id]))}
                  />
                ) : (
                  <PetStack ps={getting} top="YOU GET" empty="They pick" />
                )}
              </View>
            ) : null}
            {takeFrom && takeFrom.length > 1 ? <Text style={[font.small, { textAlign: 'center' }]}>Tap their pets to leave any out.</Text> : null}
            {mine.length && getting.length ? <FairBar give={mine} get={getting} /> : null}
          </View>
        );
      }}
      onConfirm={async (ids) => {
        if (msg?.ok) return onClose();
        setBusy(true);
        const r = await onSend(ids, takeFrom && take.length < takeFrom.length ? take : undefined);
        setBusy(false);
        setMsg(r);
        if (r.ok) {
          buzz('success');
          setTimeout(onClose, 1100);
        }
      }}
      onClose={onClose}
    />
  );
}

/** One side of a trade: one pet shows big; two or three sit side by side. */
function PetStack({ ps, top, empty, onPress, off, onToggle }: { ps: TradePet[]; top?: string; empty: string; onPress?: (p: TradePet) => void; off?: string[]; onToggle?: (id: string) => void }) {
  if (ps.length <= 1) return <MiniPet p={ps[0] ?? null} label={empty} top={top} onPress={ps[0] && (onToggle || onPress) ? () => (onToggle ? onToggle(ps[0].id) : onPress!(ps[0])) : undefined} />;
  return (
    <View style={styles.mini}>
      {top ? <Text style={[styles.miniTop, { color: top === 'YOU GET' ? colors.mintDark : '#B4532A' }]} numberOfLines={1}>{top}</Text> : null}
      <View style={styles.stack}>
        {ps.map((p) => {
          const sp = SPECIES_BY_ID[p.speciesId];
          const out = off?.includes(p.id);
          const tap = onToggle ? () => onToggle(p.id) : onPress ? () => onPress(p) : undefined;
          return (
            <Pressable key={p.id} onPress={tap} disabled={!tap} style={[styles.stackPet, out && { opacity: 0.35 }]} accessibilityRole={tap ? 'button' : undefined} accessibilityLabel={onToggle ? `${out ? 'Take' : 'Leave out'} ${p.nickname}` : `See ${p.nickname}`}>
              {sp ? <PetSprite species={sp} stage={stageFor(p.xp)} size={36} shiny={p.shiny} skin={p.skin} /> : null}
              <Text style={styles.stackLv} numberOfLines={1}>Lv {levelFor(p.xp)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.miniName} numberOfLines={1}>{off?.length ? `${ps.length - off.length} of ${ps.length} pets` : `${ps.length} pets`}</Text>
      <Text style={styles.miniSub} numberOfLines={1}>{ps.filter((p) => !off?.includes(p.id)).map((p) => p.nickname).join(', ')}</Text>
    </View>
  );
}

/** A rough "is this fair?" hint from rarity, level, skin and grade. Only a hint: the players decide. */
function FairBar({ give, get }: { give: TradePet[]; get: TradePet[] }) {
  const g = T.groupValue(give);
  const r = T.groupValue(get);
  const share = g + r > 0 ? r / (g + r) : 0.5;
  const label = share > 0.62 ? 'You get more' : share < 0.38 ? 'You give more' : 'Looks fair';
  const tint = share > 0.62 ? colors.mintDark : share < 0.38 ? '#C4562F' : colors.ink;
  return (
    <View style={{ gap: 3 }} accessibilityLabel={`Fairness hint: ${label}`}>
      <View style={styles.fairTrack}>
        <View style={[styles.fairFill, { width: `${Math.round(share * 100)}%` }]} />
        <View style={styles.fairMid} />
      </View>
      <Text style={[font.small, { textAlign: 'center', color: tint, fontWeight: '800' }]}>{label} <Text style={{ fontWeight: '400', color: colors.ink }}>(rarity, level, skin and grade)</Text></Text>
    </View>
  );
}

export function useTradeOffer() {
  const { open, close } = useOverlay();
  const { offerTrade } = useFriends();
  return (friend: Friend) =>
    open(
      <TradePicker
        title={`Trade with ${friend.username}`}
        subtitle="Pick up to 3 of your pets to offer. They’ll choose pets to offer back, then you decide if it’s a deal."
        onSend={(ids) => offerTrade(friend.id, ids)}
        onClose={close}
      />,
    );
}

/** Tap a friend's pet: see its stats and moves, then offer one of your pets for it. Lives inside the friend's profile. */
export function AskForPet({ friend, pet, onClose }: { friend: Friend; pet: ViewPet; onClose: () => void }) {
  const { requestTrade, trades } = useFriends();
  const [picking, setPicking] = useState(false);
  const want = T.toWantPet(pet);
  const asked = want && trades.some((t) => t.status === 'offered' && t.fromMe && t.friendId === friend.id && t.want?.id === want.id);
  const disabled = !want
    ? `${friend.username} needs to update Sproutling before you can ask for this pet.`
    : pet.away
      ? `${pet.nickname} is out on a trip. Try again when they’re back.`
      : asked
        ? 'You already have an offer waiting for this pet.'
        : undefined;
  if (picking && want) {
    return (
      <View style={[StyleSheet.absoluteFill, { zIndex: 95 }]}>
        <TradePicker
          title="Your offer"
          subtitle={`Pick up to 3 of your pets to offer for ${want.nickname}. They’re held for this trade until ${friend.username} answers. Offers last 3 days.`}
          get={[want]}
          confirm={`Send offer to ${friend.username}`}
          onSend={(ids) => requestTrade(friend.id, want, ids)}
          onClose={onClose}
        />
      </View>
    );
  }
  return <FriendPetSheet pet={pet} owner={friend.username} onClose={onClose} action={{ label: 'Make a trade offer', disabled, onPress: () => setPicking(true) }} />;
}

/** See a pet that's part of a trade up close (stats and moves). */
function useViewTradePet() {
  const { open, close } = useOverlay();
  return (p: TradePet, owner: string) => open(<FriendPetSheet pet={p} owner={owner} onClose={close} />);
}

/* ---------- Starting a battle ---------- */

export function useBattle() {
  const { open, close } = useOverlay();
  const { recordBattle } = useFriends();
  return (opponent: Opponent) =>
    open(<BattleScreen opponent={opponent} onClose={close} onResult={(won) => opponent.friendId && recordBattle(opponent.friendId, won)} />);
}

/** Open, start or accept live battles against a friend who plays their own moves. */
export function useLiveBattle() {
  const { open, close } = useOverlay();
  const { state } = useGame();
  const L = useLive();
  const watch = (id: string, name: string, team: B.PetLike[], friendId: string) =>
    open(<BattleScreen live={id} opponent={{ name, team, friendId }} onClose={close} />);
  const openLive = (b: LiveBattle) => {
    const theirs = b.battle ? b.battle.theirs : [];
    watch(b.id, b.friendName, theirs as unknown as B.PetLike[], b.friendId);
  };
  const pick = (title: string, subtitle: string, label: string, onPick: (ids: string[]) => Promise<void>) =>
    open(
      <PetPicker
        title={title}
        subtitle={subtitle}
        pets={state.pets.map((p) => ({ pet: p }))}
        max={B.TEAM_SIZE}
        initial={B.defaultTeam(state)}
        confirmLabel={(n) => (n ? label : 'Pick at least 1 pet')}
        onConfirm={(ids) => onPick(ids)}
        onClose={close}
      />,
    );
  const challenge = (f: Friend, onMsg?: (t: string) => void) =>
    pick(`Live battle vs ${f.username}`, `${f.username} plays their own moves. You each pick a move every turn, and get a notification when it’s your turn. Up to ${B.TEAM_SIZE} pets.`, 'Send challenge ⚡', async (ids) => {
      const r = await L.challenge(f.id, B.liveTeamFrom(state, ids));
      close();
      buzz(r.ok ? 'success' : 'medium');
      onMsg?.(r.ok ? `Challenge sent! We’ll let you know when ${f.username} accepts.` : r.text);
    });
  const accept = (b: LiveBattle) =>
    pick(`${b.friendName} challenged you!`, `Pick up to ${B.TEAM_SIZE} pets for a live battle. You each pick a move every turn.`, 'Accept ⚡', async (ids) => {
      const r = await L.respond(b.id, true, B.liveTeamFrom(state, ids));
      close();
      const now = L.get(b.id);
      if (r.ok && now) openLive(now);
    });
  return { openLive, challenge, accept, decline: (b: LiveBattle) => L.respond(b.id, false) };
}

function liveLine(b: LiveBattle) {
  if (b.status === 'invited') return b.iChallenged ? 'Waiting for them to accept' : 'Challenged you!';
  if (b.status === 'declined') return 'Said not right now';
  if (b.status === 'cancelled') return 'Challenge expired';
  if (b.status === 'done') return b.won ? 'You won' : 'They won';
  if (b.myTurn) return `Turn ${b.turn + 1} · Your move!`;
  return `Turn ${b.turn + 1} · Waiting for their move`;
}

export function LiveBattlesCard() {
  const { battles } = useLive();
  const { openLive, accept, decline } = useLiveBattle();
  const shown = battles.filter((b) => b.status === 'invited' || b.status === 'active' || (b.status === 'done' && Date.now() - new Date(b.updatedAt).getTime() < 86400000)).slice(0, 8);
  if (!shown.length) return null;
  const waiting = shown.filter((b) => b.myTurn).length;
  return (
    <>
    <SectionHead title="Your turn" meta={waiting ? `${waiting} waiting` : undefined} />
    <Card style={{ paddingVertical: 4 }}>
      {shown.map((b, i) => {
        const invite = b.status === 'invited' && !b.iChallenged;
        const canOpen = b.status === 'active' || (b.status === 'done' && !!b.battle);
        return (
          <Pressable key={b.id} disabled={!canOpen} onPress={() => openLive(b)} style={[styles.liveRow, i < shown.length - 1 && styles.liveDivider]} accessibilityRole="button" accessibilityLabel={`Live battle with ${b.friendName}: ${liveLine(b)}`}>
            <View style={[styles.liveDot, { backgroundColor: b.myTurn ? '#E0567A' : b.status === 'active' ? colors.gold : colors.line }]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.liveName} numberOfLines={1}>{b.friendName}</Text>
              <Text style={[font.small, b.myTurn && { color: '#C2412D', fontWeight: '600' }]} numberOfLines={1}>{liveLine(b)}</Text>
            </View>
            {invite ? (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Button small label="Later" onPress={() => decline(b)} />
                <Button small primary label="Accept" onPress={() => accept(b)} />
              </View>
            ) : canOpen ? (
              b.myTurn ? <Button small primary label="Play" onPress={() => openLive(b)} /> : <Text style={styles.liveGo}>{b.status === 'done' ? 'See' : 'Open'}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </Card>
    </>
  );
}

export function friendOpponent(f: Friend): Opponent | null {
  const team = f.card?.team ?? [];
  if (!team.length) return null;
  return { name: f.username, team: team.slice(0, B.TEAM_SIZE), friendId: f.id };
}

/* ---------- Arena card ---------- */

export function ArenaCard() {
  const { state } = useGame();
  const overlay = useOverlay();
  const battle = useBattle();
  const buffs = B.habitBuffs(state);
  const has = (id: string) => buffs.some((b) => b.id === id);
  const left = B.battlesLeftToday(state);
  const resetIn = useResetIn();
  const list: { id: string; icon: IconName; color: string; label: string; hint: string }[] = [
    { id: 'rested', icon: 'moon', color: '#6E56CF', label: 'Rested', hint: 'Sleep 7h' },
    { id: 'hydrated', icon: 'drop', color: '#2E7FB8', label: 'Hydrated', hint: 'Water' },
    { id: 'energized', icon: 'steps', color: colors.mintDark, label: 'Energized', hint: 'Steps' },
    { id: 'cared', icon: 'heart', color: '#D6456B', label: 'Cared for', hint: 'Pet care' },
    ...(isVerified(healthProvider())
      ? ([
          { id: 'trained', icon: 'dumbbell', color: '#B86E00', label: 'Trained', hint: '30 min exercise' },
          { id: 'calm', icon: 'calm', color: '#3D8FD6', label: 'Calm', hint: '5 mindful min' },
          { id: 'rings', icon: 'rings', color: '#E0567A', label: 'Rings closed', hint: 'Close 3 rings' },
        ] as const)
      : []),
  ];
  const on = list.filter((b) => has(b.id)).length;
  return (
    <Card>
      <View style={styles.arenaTop}>
        <View style={[styles.arenaTile, { backgroundColor: '#E9E5FB' }]}><Icon name="swords" size={23} color="#5B45C2" /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={font.h2}>Wild battle</Text>
          <Text style={font.small}>
            {left > 0 ? `${left} rewarded battle${left === 1 ? '' : 's'} left · first win gets a chest` : `Rewards are back in ${resetIn}. Battle for fun.`}
          </Text>
        </View>
      </View>
      <Text style={styles.buffHead}>TODAY’S BUFFS · {on} OF {list.length}</Text>
      <View style={styles.buffs}>
        {list.map((b) => {
          const got = has(b.id);
          return (
            <Pressable key={b.id} onPress={() => overlay.open(<BuffSheet id={b.id as B.BuffInfo['id']} onClose={overlay.close} />)} style={({ pressed }) => [styles.buff, got && styles.buffOn, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={`${b.label}${got ? ', on today' : ''}. Tap to see how to earn it`}>
              <Icon name={b.icon} size={14} color={got ? b.color : '#9AA8A3'} />
              <Text style={[styles.buffText, got && { color: '#1E8A68' }]}>{got ? b.label : b.hint}</Text>
              {got ? <Icon name="check" size={13} color="#1E8A68" strokeWidth={2.6} /> : null}
            </Pressable>
          );
        })}
      </View>
      <Button
        primary
        label="Battle a wild pet"
        onPress={() => {
          const levels = B.defaultTeam(state).map((id) => levelFor(state.pets.find((p) => p.id === id)!.xp));
          battle({ name: 'Wild pets', team: B.wildTeam(levels) });
        }}
      />
    </Card>
  );
}

/** Two small tiles under the arena: the weekly Sky Tower and battling a friend. */
export function BattleTiles({ tower, onFriends }: { tower: React.ReactNode; onFriends: () => void }) {
  const { battles } = useLive();
  const waiting = battles.filter((b) => b.myTurn || (b.status === 'invited' && !b.iChallenged)).length;
  return (
    <View style={styles.tiles}>
      {tower}
      <Pressable onPress={onFriends} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={`Battle a friend${waiting ? `, ${waiting} waiting on you` : ''}`}>
        {waiting ? <View style={styles.tileBadge}><Text style={styles.tileBadgeText}>{waiting}</Text></View> : null}
        <View style={[styles.arenaTile, { width: 36, height: 36, borderRadius: 11, backgroundColor: '#FDE7EC' }]}><Icon name="bolt" size={19} color="#D6456B" /></View>
        <View>
          <Text style={styles.tileTitle}>Battle a friend</Text>
          <Text style={styles.tileSub} numberOfLines={2}>Live, turn by turn</Text>
        </View>
      </Pressable>
    </View>
  );
}

/* ---------- Trades card ---------- */

function MiniPet({ p, label, top, onPress }: { p: TradePet | null; label: string; top?: string; onPress?: () => void }) {
  const sp = p ? SPECIES_BY_ID[p.speciesId] : null;
  return (
    <Pressable onPress={onPress} disabled={!onPress || !p} style={styles.mini} accessibilityRole={onPress && p ? 'button' : undefined} accessibilityLabel={onPress && p ? `See ${p.nickname}’s stats and moves` : undefined}>
      {top ? <Text style={[styles.miniTop, { color: top === 'YOU GET' ? colors.mintDark : '#B4532A' }]} numberOfLines={1}>{top}</Text> : null}
      <View style={styles.miniArt}>{sp && p ? <PetSprite species={sp} stage={stageFor(p.xp)} size={60} shiny={p.shiny} skin={p.skin} hat={(p as any).hat} aura={(p as any).aura} /> : <Text style={{ fontSize: 28 }}>❔</Text>}</View>
      <Text style={styles.miniName} numberOfLines={1}>{p ? p.nickname : '???'}</Text>
      <Text style={styles.miniSub} numberOfLines={1}>{p && sp ? `Lv ${levelFor(p.xp)} · ${sp.rarity[0].toUpperCase() + sp.rarity.slice(1)}` : label}</Text>
      {/* Same height on both sides so the two pets line up. */}
      {top ? <Text style={[styles.miniLink, !(onPress && p) && { opacity: 0 }]}>Stats ›</Text> : null}
    </Pressable>
  );
}

function TradeRow({ t, onDismiss }: { t: Trade; onDismiss?: () => void }) {
  const { counterTrade, confirmTrade, cancelTrade, acceptRequest, changeRequest } = useFriends();
  const { state } = useGame();
  const view = useViewTradePet();
  const { open, close } = useOverlay();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // On a request, the friend's side of the swap is the pet that was asked for.
  const mine: TradePet[] = t.fromMe ? t.offers : t.want ? [t.want] : (t.counters ?? []);
  const theirs: TradePet[] = t.fromMe ? (t.want ? [t.want] : (t.counters ?? [])) : t.offers;
  const names = (ps: TradePet[]) => (ps.length <= 1 ? (ps[0]?.nickname ?? 'a pet') : ps.length === 2 ? `${ps[0].nickname} and ${ps[1].nickname}` : `${ps[0].nickname}, ${ps[1].nickname} and ${ps[2].nickname}`);
  const stillHave = !t.want || t.fromMe || state.pets.some((p) => p.id === t.want!.id);

  let text = '';
  let actions: React.ReactNode = null;
  if (t.want && t.status === 'offered' && t.fromMe) {
    text = `Waiting for ${t.friendName}. Your ${names(t.offers)} for their ${t.want.nickname}.${t.expiresAt ? ` ${leftText(t.expiresAt)}` : ''}`;
    const want = t.want;
    actions = (
      <>
        <Button small label="Cancel" onPress={() => cancelTrade(t.id)} />
        <Button
          small
          label="Change it"
          onPress={() =>
            open(
              <TradePicker
                title="Change your offer"
                subtitle={`Pick up to 3 of your pets to offer for ${want.nickname}. This replaces your current offer.`}
                get={[want]}
                initial={t.offers.map((p) => p.id)}
                skipBusy={t.offers.map((p) => p.id)}
                confirm="Update offer"
                onSend={(ids) => changeRequest(t.id, ids)}
                onClose={close}
              />,
            )
          }
        />
      </>
    );
  } else if (t.want && t.status === 'offered') {
    text = stillHave
      ? `${t.friendName} wants your ${t.want.nickname} and offers ${names(t.offers)}. Tap a pet to see its stats.${t.expiresAt ? ` ${leftText(t.expiresAt)}` : ''}`
      : `${t.friendName} asked for ${t.want.nickname}, but you don’t have that pet anymore.`;
    actions = (
      <>
        <Button small label="Decline" onPress={() => cancelTrade(t.id)} />
        {stillHave ? (
          <Button
            small
            primary
            label={busy ? 'Trading…' : 'Accept trade'}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              buzz('medium');
              const r = await acceptRequest(t.id);
              if (!r.ok) setMsg(r.text);
              setBusy(false);
            }}
          />
        ) : null}
      </>
    );
  } else if (t.status === 'expired') {
    text = t.fromMe ? `Your offer for ${t.friendName}’s ${t.want?.nickname ?? 'pet'} ran out of time.` : `${t.friendName}’s offer ran out of time.`;
    actions = <Button small primary label="OK" onPress={() => onDismiss?.()} />;
  } else if (t.status === 'offered' && t.fromMe) {
    text = `Waiting for ${t.friendName} to pick pets to offer back.`;
    actions = <Button small label="Cancel" onPress={() => cancelTrade(t.id)} />;
  } else if (t.status === 'offered') {
    text = `${t.friendName} offers ${names(t.offers)}. Pick up to 3 pets to offer back.`;
    actions = (
      <>
        <Button small label="No thanks" onPress={() => cancelTrade(t.id)} />
        <Button
          small
          primary
          label="Choose pets"
          onPress={() =>
            open(
              <TradePicker
                title={`Offer ${t.friendName} pets`}
                subtitle={`For their ${names(t.offers)}. ${t.friendName} gets the final say.`}
                get={t.offers}
                takeFrom={t.offers.length > 1 ? t.offers : undefined}
                onSend={(ids, takeIds) => counterTrade(t.id, ids, takeIds)}
                onClose={close}
              />,
            )
          }
        />
      </>
    );
  } else if (t.status === 'countered' && t.fromMe) {
    text = `${t.friendName} offers ${names(t.counters ?? [])} for your ${names(t.offers)}`;
    actions = (
      <>
        <Button small label="No deal" onPress={() => cancelTrade(t.id)} />
        <Button
          small
          primary
          label={busy ? 'Trading…' : 'Confirm trade'}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            buzz('medium');
            const r = await confirmTrade(t.id);
            if (!r.ok) setMsg(r.text);
            setBusy(false);
          }}
        />
      </>
    );
  } else if (t.status === 'countered') {
    text = `Waiting for ${t.friendName} to confirm the trade.`;
    actions = <Button small label="Cancel" onPress={() => cancelTrade(t.id)} />;
  } else if (t.status === 'declined') {
    text = t.fromMe ? (t.want ? `${t.friendName} passed on your offer for ${t.want.nickname}.` : `${t.friendName} said no thanks to this trade.`) : 'You passed on this trade.';
    actions = <Button small primary label="OK" onPress={() => onDismiss?.()} />;
  } else if (t.status === 'cancelled') {
    text = t.fromMe ? 'You cancelled this trade.' : `${t.friendName} cancelled this trade.`;
    actions = <Button small primary label="OK" onPress={() => onDismiss?.()} />;
  }

  const closed = t.status === 'declined' || t.status === 'cancelled' || t.status === 'expired';
  return (
    <View style={styles.trade}>
      {/* A finished trade: only the pets fade; the message and OK stay clear, side by side. */}
      <View style={[styles.swap, closed && { opacity: 0.5 }]}>
        <PetStack ps={mine} empty="Your pet" top={t.want || mine.length > 1 || theirs.length > 1 ? 'YOU GIVE' : undefined} />
        <Text style={styles.arrow}>⇄</Text>
        <PetStack ps={theirs} empty={t.fromMe ? 'They pick' : 'You pick'} top={t.want || mine.length > 1 || theirs.length > 1 ? 'YOU GET' : undefined} onPress={!closed ? (p) => view(p, t.friendName) : undefined} />
      </View>
      {!closed && mine.length && theirs.length && (mine.length > 1 || theirs.length > 1) ? <FairBar give={mine} get={theirs} /> : null}
      {closed ? (
        <View style={styles.closedRow}>
          <Text style={[font.small, { color: colors.ink, flex: 1 }]}>{text}</Text>
          {actions}
        </View>
      ) : (
        <>
          <Text style={[font.small, { color: colors.ink }]}>{text}</Text>
          {msg ? <Text style={[font.small, { color: '#C4562F' }]}>{msg}</Text> : null}
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </>
      )}
    </View>
  );
}

/** "2 days left" for an offer that expires. */
function leftText(at: string): string {
  const h = Math.max(0, Math.round((new Date(at).getTime() - Date.now()) / 3_600_000));
  return h >= 36 ? `${Math.round(h / 24)} days left.` : h >= 1 ? `${h} hour${h === 1 ? '' : 's'} left.` : 'Ends soon.';
}

const DISMISSED_KEY = 'sproutling/trades-dismissed';

export function TradesCard() {
  const { trades } = useFriends();
  // Declined and cancelled trades show once, until you tap OK.
  const [dismissed, setDismissed] = useState<string[] | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY).then((v) => setDismissed(v ? JSON.parse(v) : [])).catch(() => setDismissed([]));
  }, []);
  const dismiss = (id: string) => {
    const next = [...(dismissed ?? []), id].slice(-100);
    setDismissed(next);
    AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(next)).catch(() => {});
  };
  const shown = trades.filter((t) => t.status !== 'completed' && !((t.status === 'declined' || t.status === 'cancelled' || t.status === 'expired') && (dismissed === null || dismissed.includes(t.id))));
  if (!shown.length) return null;
  const waiting = shown.filter((t) => (t.status === 'offered' && !t.fromMe) || (t.status === 'countered' && t.fromMe)).length;
  return (
    <Card style={waiting ? { borderColor: colors.peach } : undefined}>
      <SectionHead title="Trades" meta={waiting ? `${waiting} need${waiting === 1 ? 's' : ''} you` : undefined} />
      {shown.map((t) => (
        <TradeRow key={t.id} t={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  arenaTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  arenaTile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buffHead: { fontSize: 12, fontWeight: '600', color: colors.muted, letterSpacing: 0.3, marginTop: 6 },
  buffs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  buff: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 9, minHeight: 30, backgroundColor: '#F2F5F4' },
  buffOn: { backgroundColor: '#E3F5EC' },
  buffText: { fontWeight: '600', fontSize: 12, color: colors.muted },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 14, gap: 8, minHeight: 112 },
  tileTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  tileSub: { fontSize: 12, fontWeight: '500', color: colors.muted },
  tileBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#E0567A', borderRadius: 9, minWidth: 20, paddingHorizontal: 6, alignItems: 'center' },
  tileBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  liveDivider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  closedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trade: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm, gap: 6 },
  stack: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'stretch', gap: 4, justifyContent: 'center', backgroundColor: colors.sky, borderRadius: 18, padding: 6, minHeight: 72, alignItems: 'center' },
  stackPet: { alignItems: 'center', width: 38 },
  stackLv: { fontSize: 10, fontWeight: '600', color: colors.ink },
  fairTrack: { height: 8, borderRadius: 4, backgroundColor: '#F2D9C9', overflow: 'hidden', marginHorizontal: space.md },
  fairFill: { height: 8, backgroundColor: colors.mint },
  fairMid: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, backgroundColor: colors.ink, opacity: 0.4 },
  swap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs },
  arrow: { fontSize: 26, fontWeight: '800', color: colors.mintDark },
  mini: { alignItems: 'center', flex: 1, minWidth: 0, maxWidth: 160 },
  miniArt: { width: 72, height: 72, borderRadius: 18, backgroundColor: colors.sky, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  miniName: { fontWeight: '600', fontSize: 13, color: colors.ink, marginTop: 2 },
  miniSub: { fontWeight: '600', fontSize: 12, color: colors.muted },
  miniTop: { fontWeight: '600', fontSize: 12, letterSpacing: 0.5, marginBottom: 2 },
  miniLink: { fontWeight: '600', fontSize: 12, color: colors.mintDark },
  actions: { flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: 10 },
  liveDot: { width: 10, height: 10, borderRadius: 5 },
  liveName: { fontWeight: '700', fontSize: 15, color: colors.ink },
  liveGo: { fontWeight: '600', fontSize: 14, color: colors.muted },
});
