import React, { useState } from 'react';
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

/* ---------- Picking a pet to trade ---------- */

function TradePicker({ title, subtitle, onSend, onClose }: { title: string; subtitle: string; onSend: (petId: string) => Promise<{ ok: boolean; text: string }>; onClose: () => void }) {
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
      confirmLabel={() => (msg?.ok ? 'Sent!' : 'Offer this pet')}
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
  if (b.status === 'done') return b.won ? '🏆 You won' : 'They won';
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
      <SectionHead title="⚡ Live battles" meta={waiting ? `${waiting} waiting on you` : undefined} />
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
  const battle = useBattle();
  const buffs = B.habitBuffs(state);
  const has = (id: string) => buffs.some((b) => b.id === id);
  const left = B.battlesLeftToday(state);
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
          { id: 'hydrated', emoji: '💧', label: 'Hydrated', hint: '6 glasses' },
          { id: 'energized', emoji: '👟', label: 'Energized', hint: '8k steps' },
          { id: 'cared', emoji: '💖', label: 'Cared for', hint: 'Pet care' },
          ...(isVerified(healthProvider())
            ? [
                { id: 'trained', emoji: '🏋️', label: 'Trained', hint: '30 min exercise' },
                { id: 'calm', emoji: '🧘', label: 'Calm', hint: '5 mindful min' },
                { id: 'rings', emoji: '⭕', label: 'Rings Closed', hint: 'Close 3 rings' },
              ]
            : []),
        ].map((b) => (
          <View key={b.id} style={[styles.buff, has(b.id) && styles.buffOn]}>
            <Text style={{ fontSize: 16, opacity: has(b.id) ? 1 : 0.5 }}>{b.emoji}</Text>
            <Text style={[styles.buffText, has(b.id) && { color: '#1B2240' }]}>{has(b.id) ? b.label : b.hint}</Text>
          </View>
        ))}
      </View>
      <Text style={[font.small, { color: '#D6DCF5' }]}>
        {left > 0 ? `${left} rewarded battle${left === 1 ? '' : 's'} left today (first win gets a chest!).` : 'Rewards are used up for today, but you can still battle for fun.'} Train pets and pick moves on the Pets tab.
      </Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button
          primary
          label="🌿 Wild battle"
          style={{ flex: 1 }}
          onPress={() => {
            const levels = B.defaultTeam(state).map((id) => levelFor(state.pets.find((p) => p.id === id)!.xp));
            battle({ name: 'Wild pets', team: B.wildTeam(levels) });
          }}
        />
      </View>
      <Text style={[font.tiny, { color: '#AEB6DA' }]}>To battle a friend, tap them in your friends list.</Text>
    </Card>
  );
}

/* ---------- Trades card ---------- */

function MiniPet({ p, label }: { p: TradePet | null; label: string }) {
  const sp = p ? SPECIES_BY_ID[p.speciesId] : null;
  return (
    <View style={styles.mini}>
      <View style={styles.miniArt}>{sp && p ? <PetSprite species={sp} stage={stageFor(p.xp)} size={60} shiny={p.shiny} skin={p.skin} hat={(p as any).hat} aura={(p as any).aura} /> : <Text style={{ fontSize: 28 }}>❔</Text>}</View>
      <Text style={styles.miniName} numberOfLines={1}>{p ? p.nickname : '???'}</Text>
      <Text style={styles.miniSub} numberOfLines={1}>{p && sp ? `Lv ${levelFor(p.xp)} · ${sp.rarity[0].toUpperCase() + sp.rarity.slice(1)}` : label}</Text>
    </View>
  );
}

function TradeRow({ t }: { t: Trade }) {
  const { counterTrade, confirmTrade, cancelTrade } = useFriends();
  const { open, close } = useOverlay();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const mine = t.fromMe ? t.offer : t.counter;
  const theirs = t.fromMe ? t.counter : t.offer;

  let text = '';
  let actions: React.ReactNode = null;
  if (t.status === 'offered' && t.fromMe) {
    text = `Waiting for ${t.friendName} to pick a pet to offer back.`;
    actions = <Button small label="Cancel" onPress={() => cancelTrade(t.id)} />;
  } else if (t.status === 'offered') {
    text = `${t.friendName} wants to trade ${t.offer.nickname}! Pick a pet to offer back.`;
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
    text = `${t.friendName} offered ${t.counter?.nickname} for your ${t.offer.nickname}. Deal?`;
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
    text = t.fromMe ? `${t.friendName} said no thanks to this trade.` : 'You passed on this trade.';
  } else if (t.status === 'cancelled') {
    text = t.fromMe ? 'You cancelled this trade.' : `${t.friendName} cancelled this trade.`;
  }

  const closed = t.status === 'declined' || t.status === 'cancelled';
  return (
    <View style={[styles.trade, closed && { opacity: 0.55 }]}>
      <View style={styles.swap}>
        <MiniPet p={mine} label="Your pet" />
        <Text style={styles.arrow}>⇄</Text>
        <MiniPet p={theirs} label={t.fromMe ? 'They pick' : 'You pick'} />
      </View>
      <Text style={[font.small, { color: colors.ink }]}>{text}</Text>
      {msg ? <Text style={[font.small, { color: '#C4562F' }]}>{msg}</Text> : null}
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

export function TradesCard() {
  const { trades } = useFriends();
  const shown = trades.filter((t) => t.status !== 'completed');
  if (!shown.length) return null;
  const waiting = shown.filter((t) => (t.status === 'offered' && !t.fromMe) || (t.status === 'countered' && t.fromMe)).length;
  return (
    <Card style={waiting ? { borderColor: colors.peach } : undefined}>
      <SectionHead title="Trades" meta={waiting ? `${waiting} need${waiting === 1 ? 's' : ''} you` : undefined} />
      {shown.map((t) => (
        <TradeRow key={t.id} t={t} />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  arena: { backgroundColor: '#2A3366', borderColor: '#2A3366' },
  buffs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  buff: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.12)' },
  buffOn: { backgroundColor: colors.gold },
  buffText: { fontWeight: '900', fontSize: 11, color: '#D6DCF5' },
  trade: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm, gap: 6 },
  swap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  arrow: { fontSize: 26, fontWeight: '900', color: colors.mintDark },
  mini: { alignItems: 'center', width: 110 },
  miniArt: { width: 72, height: 72, borderRadius: 18, backgroundColor: colors.sky, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  miniName: { fontWeight: '900', fontSize: 13, color: colors.ink, marginTop: 2 },
  miniSub: { fontWeight: '700', fontSize: 11, color: colors.muted },
  actions: { flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm },
  liveDot: { width: 10, height: 10, borderRadius: 5 },
  liveName: { fontWeight: '900', fontSize: 15, color: colors.ink },
  liveGo: { fontWeight: '900', fontSize: 14, color: '#C2365C' },
});
