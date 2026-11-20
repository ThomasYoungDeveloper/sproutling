import { useResetIn } from '../lib/useResetIn';
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

function TradePicker({ title, subtitle, onSend, onClose, want, confirm }: { title: string; subtitle: string; onSend: (petId: string) => Promise<{ ok: boolean; text: string }>; onClose: () => void; /** Asking for this pet: shows a You get / You give summary. */ want?: TradePet; confirm?: string }) {
  const { state } = useGame();
  const { busyPetIds } = useFriends();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const pets = [...state.pets]
    .sort((a, b) => b.xp - a.xp)
    .map((p) => {
      const c = T.canOffer(state, p.id, busyPetIds);
      return { pet: p, disabled: c.ok ? undefined : c.reason };
    });
  return (
    <PetPicker
      title={title}
      subtitle={subtitle}
      pets={pets}
      busy={busy}
      message={msg}
      confirmLabel={() => (msg?.ok ? 'Sent!' : confirm ?? 'Offer this pet')}
      header={
        want
          ? (picked) => {
              const mine = state.pets.find((p) => p.id === picked[0]);
              return (
                <View style={styles.swap}>
                  <MiniPet p={want} label="You get" top="YOU GET" />
                  <Text style={styles.arrow}>⇄</Text>
                  <MiniPet p={mine ? T.toTradePet(mine) : null} label="Pick below" top="YOU GIVE" />
                </View>
              );
            }
          : undefined
      }
      onConfirm={async ([id]) => {
        if (msg?.ok) return onClose();
        setBusy(true);
        const r = await onSend(id);
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

export function useTradeOffer() {
  const { open, close } = useOverlay();
  const { offerTrade } = useFriends();
  return (friend: Friend) =>
    open(
      <TradePicker
        title={`Trade with ${friend.username}`}
        subtitle="Pick one of your pets to offer. They’ll choose a pet to offer back, then you decide if it’s a deal."
        onSend={(petId) => offerTrade(friend.id, petId)}
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
          subtitle={`Pick one of your pets to offer for ${want.nickname}. It’s held for this trade until ${friend.username} answers. Offers last 3 days.`}
          want={want}
          confirm={`Send offer to ${friend.username}`}
          onSend={(petId) => requestTrade(friend.id, want, petId)}
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
    <Card style={waiting ? { borderColor: '#E0567A' } : undefined}>
      <SectionHead title="Live battles" meta={waiting ? `${waiting} waiting on you` : undefined} />
      {shown.map((b) => {
        const invite = b.status === 'invited' && !b.iChallenged;
        const canOpen = b.status === 'active' || (b.status === 'done' && !!b.battle);
        return (
          <Pressable key={b.id} disabled={!canOpen} onPress={() => openLive(b)} style={styles.liveRow} accessibilityRole="button" accessibilityLabel={`Live battle with ${b.friendName}: ${liveLine(b)}`}>
            <View style={[styles.liveDot, { backgroundColor: b.myTurn ? '#E0567A' : b.status === 'active' ? colors.gold : colors.line }]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.liveName} numberOfLines={1}>{b.friendName}</Text>
              <Text style={[font.small, b.myTurn && { color: '#C2365C', fontWeight: '800' }]} numberOfLines={1}>{liveLine(b)}</Text>
            </View>
            {invite ? (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Button small label="Not now" onPress={() => decline(b)} />
                <Button small primary label="Accept" onPress={() => accept(b)} />
              </View>
            ) : canOpen ? (
              <Text style={styles.liveGo}>{b.status === 'done' ? 'See' : b.myTurn ? 'Play ›' : 'Open ›'}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </Card>
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
  const rec = state.battle;
  return (
    <Card style={styles.arena}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text style={{ fontSize: 34 }}>⚔️</Text>
        <View style={{ flex: 1 }}>
          <Text style={[font.h2, { color: '#FFFFFF' }]}>Battle arena</Text>
          <Text style={[font.small, { color: '#D6DCF5' }]}>
            {rec ? `${rec.wins} wins · ${rec.losses} losses` : 'Battle wild pets or a friend’s team'}
          </Text>
        </View>

      </View>
      <Text style={[font.small, { color: '#D6DCF5', fontWeight: '800' }]}>Today’s habit buffs</Text>
      <View style={styles.buffs}>
        {[
          { id: 'rested', emoji: '😴', label: 'Rested', hint: 'Sleep 7+ h' },
          { id: 'hydrated', emoji: '💧', label: 'Hydrated', hint: 'Water goal' },
          { id: 'energized', emoji: '👟', label: 'Energized', hint: 'Step goal' },
          { id: 'cared', emoji: '💖', label: 'Cared for', hint: 'Pet care' },
          ...(isVerified(healthProvider())
            ? [
                { id: 'trained', emoji: '🏋️', label: 'Trained', hint: '30 min exercise' },
                { id: 'calm', emoji: '🧘', label: 'Calm', hint: '5 mindful min' },
                { id: 'rings', emoji: '⭕', label: 'Rings Closed', hint: 'Close 3 rings' },
              ]
            : []),
        ].map((b) => (
          <Pressable key={b.id} onPress={() => overlay.open(<BuffSheet id={b.id as B.BuffInfo['id']} onClose={overlay.close} />)} style={({ pressed }) => [styles.buff, has(b.id) && styles.buffOn, pressed && { transform: [{ scale: 0.95 }] }]} accessibilityRole="button" accessibilityLabel={`${b.label}${has(b.id) ? ', on today' : ''}. Tap to see how to earn it`}>
            <Text style={{ fontSize: 16, opacity: has(b.id) ? 1 : 0.5 }}>{b.emoji}</Text>
            <Text style={[styles.buffText, has(b.id) && { color: '#1B2240' }]}>{has(b.id) ? b.label : b.hint}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[font.small, { color: '#D6DCF5' }]}>
        {left > 0 ? `${left} rewarded battle${left === 1 ? '' : 's'} left today. First win gets a chest.` : `Rewards are back in ${resetIn}. You can still battle for fun.`}
      </Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button
          primary
          label="Wild battle"
          style={{ flex: 1 }}
          onPress={() => {
            const levels = B.defaultTeam(state).map((id) => levelFor(state.pets.find((p) => p.id === id)!.xp));
            battle({ name: 'Wild pets', team: B.wildTeam(levels) });
          }}
        />
      </View>
    </Card>
  );
}

/* ---------- Trades card ---------- */

function MiniPet({ p, label, top, onPress }: { p: TradePet | null; label: string; top?: string; onPress?: () => void }) {
  const sp = p ? SPECIES_BY_ID[p.speciesId] : null;
  return (
    <Pressable onPress={onPress} disabled={!onPress || !p} style={styles.mini} accessibilityRole={onPress && p ? 'button' : undefined} accessibilityLabel={onPress && p ? `See ${p.nickname}’s stats and moves` : undefined}>
      {top ? <Text style={[styles.miniTop, { color: top === 'YOU GET' ? colors.mintDark : '#B4532A' }]}>{top}</Text> : null}
      <View style={styles.miniArt}>{sp && p ? <PetSprite species={sp} stage={stageFor(p.xp)} size={60} shiny={p.shiny} skin={p.skin} hat={(p as any).hat} aura={(p as any).aura} /> : <Text style={{ fontSize: 28 }}>❔</Text>}</View>
      <Text style={styles.miniName} numberOfLines={1}>{p ? p.nickname : '???'}</Text>
      <Text style={styles.miniSub} numberOfLines={1}>{p && sp ? `Lv ${levelFor(p.xp)} · ${sp.rarity[0].toUpperCase() + sp.rarity.slice(1)}` : label}</Text>
      {/* Same height on both sides so the two pets line up. */}
      {top ? <Text style={[styles.miniLink, !(onPress && p) && { opacity: 0 }]}>Stats ›</Text> : null}
    </Pressable>
  );
}

function TradeRow({ t, onDismiss }: { t: Trade; onDismiss?: () => void }) {
  const { counterTrade, confirmTrade, cancelTrade, acceptRequest } = useFriends();
  const { state } = useGame();
  const view = useViewTradePet();
  const { open, close } = useOverlay();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // On a request, the friend's side of the swap is the pet that was asked for.
  const mine = t.fromMe ? t.offer : (t.want ?? t.counter);
  const theirs = t.fromMe ? (t.want ?? t.counter) : t.offer;
  const stillHave = !t.want || t.fromMe || state.pets.some((p) => p.id === t.want!.id);

  let text = '';
  let actions: React.ReactNode = null;
  if (t.want && t.status === 'offered' && t.fromMe) {
    text = `Waiting for ${t.friendName}. Your ${t.offer.nickname} for their ${t.want.nickname}.${t.expiresAt ? ` ${leftText(t.expiresAt)}` : ''}`;
    actions = <Button small label="Cancel" onPress={() => cancelTrade(t.id)} />;
  } else if (t.want && t.status === 'offered') {
    text = stillHave
      ? `${t.friendName} wants your ${t.want.nickname} and offers ${t.offer.nickname}. Tap a pet to see its stats.${t.expiresAt ? ` ${leftText(t.expiresAt)}` : ''}`
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
    text = `Waiting for ${t.friendName} to pick a pet to offer back.`;
    actions = <Button small label="Cancel" onPress={() => cancelTrade(t.id)} />;
  } else if (t.status === 'offered') {
    text = `${t.friendName} wants your ${t.offer.nickname}`;
    actions = (
      <>
        <Button small label="No thanks" onPress={() => cancelTrade(t.id)} />
        <Button
          small
          primary
          label="Choose a pet"
          onPress={() =>
            open(
              <TradePicker
                title={`Offer ${t.friendName} a pet`}
                subtitle={`For their ${t.offer.nickname} (Lv ${levelFor(t.offer.xp)}). ${t.friendName} gets the final say.`}
                onSend={(petId) => counterTrade(t.id, petId)}
                onClose={close}
              />,
            )
          }
        />
      </>
    );
  } else if (t.status === 'countered' && t.fromMe) {
    text = `${t.friendName} offers ${t.counter?.nickname} for ${t.offer.nickname}`;
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
        <MiniPet p={mine} label="Your pet" top={t.want ? 'YOU GIVE' : undefined} />
        <Text style={styles.arrow}>⇄</Text>
        <MiniPet p={theirs} label={t.fromMe ? 'They pick' : 'You pick'} top={t.want ? 'YOU GET' : undefined} onPress={theirs && !closed ? () => view(theirs, t.friendName) : undefined} />
      </View>
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
  arena: { backgroundColor: '#2A3366', borderColor: '#2A3366' },
  buffs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  buff: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.12)' },
  buffOn: { backgroundColor: colors.gold },
  buffText: { fontWeight: '900', fontSize: 12, color: '#D6DCF5' },
  closedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trade: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm, gap: 6 },
  swap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  arrow: { fontSize: 26, fontWeight: '900', color: colors.mintDark },
  mini: { alignItems: 'center', width: 110 },
  miniArt: { width: 72, height: 72, borderRadius: 18, backgroundColor: colors.sky, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  miniName: { fontWeight: '900', fontSize: 13, color: colors.ink, marginTop: 2 },
  miniSub: { fontWeight: '700', fontSize: 12, color: colors.muted },
  miniTop: { fontWeight: '900', fontSize: 12, letterSpacing: 0.5, marginBottom: 2 },
  miniLink: { fontWeight: '900', fontSize: 12, color: colors.mintDark },
  actions: { flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm },
  liveDot: { width: 10, height: 10, borderRadius: 5 },
  liveName: { fontWeight: '900', fontSize: 15, color: colors.ink },
  liveGo: { fontWeight: '900', fontSize: 14, color: '#C2365C' },
});
