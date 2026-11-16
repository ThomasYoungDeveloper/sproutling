import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

export function friendOpponent(f: Friend): Opponent | null {
  const team = f.card?.team ?? [];
  if (!team.length) return null;
  return { name: f.username, team: team.slice(0, B.TEAM_SIZE), friendId: f.id };
}

/* ---------- Arena card ---------- */

export function ArenaCard() {
  const { state } = useGame();
  const battle = useBattle();
  const power = B.battlePower(state);
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
        <View style={styles.power}>
          <Text style={styles.powerText}>×{power.toFixed(2)}</Text>
          <Text style={styles.powerSub}>power</Text>
        </View>
      </View>
      <Text style={[font.small, { color: '#D6DCF5' }]}>
        Your streak and today’s pet care power up your team. {left > 0 ? `${left} rewarded battle${left === 1 ? '' : 's'} left today (first win gets a chest!).` : 'Rewards are used up for today, but you can still battle for fun.'}
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
      <View style={styles.miniArt}>{sp && p ? <PetSprite species={sp} stage={stageFor(p.xp)} size={60} shiny={p.shiny} /> : <Text style={{ fontSize: 28 }}>❔</Text>}</View>
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
  power: { alignItems: 'center', backgroundColor: colors.gold, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  powerText: { fontWeight: '900', fontSize: 16, color: '#5A3E00' },
  powerSub: { fontWeight: '800', fontSize: 10, color: '#5A3E00' },
  trade: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm, gap: 6 },
  swap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  arrow: { fontSize: 26, fontWeight: '900', color: colors.mintDark },
  mini: { alignItems: 'center', width: 110 },
  miniArt: { width: 72, height: 72, borderRadius: 18, backgroundColor: colors.sky, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  miniName: { fontWeight: '900', fontSize: 13, color: colors.ink, marginTop: 2 },
  miniSub: { fontWeight: '700', fontSize: 11, color: colors.muted },
  actions: { flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end' },
});
