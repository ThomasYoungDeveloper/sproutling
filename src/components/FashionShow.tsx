import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { supabase } from '../lib/supabase';
import { useGame } from '../state/GameContext';
import { useOverlay } from './Overlay';
import { WardrobeSheet, ShopSheet } from './ShopSheets';
import PetSprite from './PetSprite';
import { SceneSwatch } from './Cosmetics';
import { Button, Card } from './ui';
import { buzz, Confetti, PopIn } from './fx';
import { colors, font, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { stageFor } from '../game/scoring';
import * as A from '../game/actions';
import type { Skin } from '../game/types';

interface ShowPet {
  speciesId: string;
  nickname: string;
  xp: number;
  shiny: boolean;
  skin?: Skin;
  hat?: string;
  aura?: string;
  scene?: string;
}

interface Entry {
  id: string;
  username: string;
  pet: ShowPet;
  votes: number;
  mine: boolean;
  voted: boolean;
}

interface Board {
  week: string;
  entries: Entry[];
  votesLeft: number;
  last: { week: string; place: number | null; votes: number; claimed: boolean } | null;
}

/** A new theme every week, the same for everyone. */
const THEMES = [
  { name: 'Royal Ball', emoji: '👑', hint: 'Crowns, halos and sparkles shine this week.' },
  { name: 'Cozy Winter', emoji: '❄️', hint: 'Beanies and snowy hills are in style.' },
  { name: 'Garden Party', emoji: '🌸', hint: 'Flower crowns and sakura petals bloom.' },
  { name: 'Space Party', emoji: '🚀', hint: 'Shooting stars and outer space rule.' },
  { name: 'Beach Day', emoji: '🏖️', hint: 'Sunny beaches and bubbles splash in.' },
  { name: 'Sweet Treats', emoji: '🍭', hint: 'Candy Land and big bows are delicious.' },
  { name: 'Silly Hats', emoji: '🎩', hint: 'The sillier the hat, the better!' },
  { name: 'Magic Night', emoji: '🔮', hint: 'Wizard hats and fireflies cast a spell.' },
];
export function themeFor(week: string) {
  const n = Math.floor(new Date(week + 'T12:00:00Z').getTime() / (7 * 86_400_000));
  return THEMES[((n % THEMES.length) + THEMES.length) % THEMES.length];
}

const PRIZES: Record<number, { coins: number; chest?: 'gold' | 'silver' | 'bronze'; label: string }> = {
  1: { coins: 100, chest: 'gold', label: '🥇 1st place: Gold chest + 100 coins' },
  2: { coins: 50, chest: 'silver', label: '🥈 2nd place: Silver chest + 50 coins' },
  3: { coins: 30, chest: 'bronze', label: '🥉 3rd place: Bronze chest + 30 coins' },
};
const prizeFor = (place: number) => PRIZES[place] ?? { coins: 30, label: '🎀 Thanks for strutting: 30 coins' };

function Stage({ pet, size = 120 }: { pet: ShowPet; size?: number }) {
  const sp = SPECIES_BY_ID[pet.speciesId];
  if (!sp) return null;
  return (
    <View style={[styles.stage, { height: size * 0.95 }]}>
      <View style={StyleSheet.absoluteFill}>
        <SceneSwatch id={pet.scene ?? 'meadow'} size={size * 1.6} />
      </View>
      <PetSprite species={sp} stage={stageFor(pet.xp)} size={size * 0.85} shiny={pet.shiny} skin={pet.skin} hat={pet.hat} aura={pet.aura} />
    </View>
  );
}

export default function FashionShow() {
  const { state, apply } = useGame();
  const overlay = useOverlay();
  const { width, height } = useWindowDimensions();
  const [board, setBoard] = useState<Board | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [party, setParty] = useState(0);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('contest_board');
    if (!error && data) setBoard(data as Board);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (!board) return null;
  const theme = themeFor(board.week);
  const mine = board.entries.find((e) => e.mine);
  const pet = A.activePet(state);
  const myPet: ShowPet | null = pet ? { speciesId: pet.speciesId, nickname: pet.nickname, xp: pet.xp, shiny: pet.shiny, ...(pet.skin ? { skin: pet.skin } : {}), ...(pet.look?.hat ? { hat: pet.look.hat } : {}), ...(pet.look?.aura ? { aura: pet.look.aura } : {}), ...(state.scene ? { scene: state.scene } : {}) } : null;

  const enter = async () => {
    if (!myPet) return;
    setBusy(true);
    const { data } = await supabase.rpc('enter_contest', { pet: myPet });
    setBusy(false);
    if (data === 'entered') {
      buzz('success', 'chime');
      apply((s) => ({ ...s, coins: s.coins + 15 }));
      setMsg(`${myPet.nickname} is on the runway! +15 coins. Ask friends for hearts!`);
    } else if (data === 'updated') {
      buzz('light');
      setMsg('Outfit updated!');
    } else if (data === 'locked') {
      setMsg('Your entry already has hearts, so its outfit is locked in for this week.');
    } else setMsg('Couldn’t enter right now. Try again in a moment.');
    load();
  };

  const vote = async (e: Entry) => {
    const { data } = await supabase.rpc('vote_contest', { entry: e.id });
    if (data === 'ok') {
      buzz('success', 'pop');
      apply((s) => ({ ...s, coins: s.coins + 5 }));
      setMsg(`❤️ You gave ${e.username}’s ${e.pet.nickname} a heart! +5 coins`);
    } else if (data === 'no_votes') setMsg('You’ve used all 3 hearts this week.');
    else if (data === 'already') setMsg('You already gave them a heart.');
    else setMsg('Couldn’t vote right now.');
    load();
  };

  const claim = async () => {
    const { data } = await supabase.rpc('claim_contest_prize');
    const place = Number(data);
    if (!place) {
      setMsg(data === 'already' ? 'Prize already claimed.' : 'No prize to claim.');
      return load();
    }
    const p = prizeFor(place);
    buzz('success', place === 1 ? 'win' : 'chime');
    apply((s) => {
      let n = { ...s, coins: s.coins + p.coins };
      if (p.chest) n = A.grantChest(n, p.chest, `Fashion Show: place ${place}`);
      return n;
    });
    setParty((n) => n + 1);
    setMsg(`${p.label}!${p.chest ? ' Open your chest on the Chests tab.' : ''}`);
    load();
  };

  const openWardrobe = () => overlay.open(<WardrobeSheet onClose={overlay.close} onShop={() => overlay.open(<ShopSheet onClose={overlay.close} onWardrobe={openWardrobe} />)} />);

  return (
    <Card style={styles.card}>
      {party ? <Confetti key={party} amount={60} width={width} height={height} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text style={{ fontSize: 32 }}>🎀</Text>
        <View style={{ flex: 1 }}>
          <Text style={[font.h2, { color: '#7A2E58' }]}>Pet Fashion Show</Text>
          <Text style={[font.small, { color: '#9C4C77' }]}>This week: {theme.emoji} {theme.name}. {theme.hint}</Text>
        </View>
      </View>

      {board.last && !board.last.claimed && board.last.place ? (
        <PopIn>
          <View style={styles.prize}>
            <Text style={styles.prizeText}>Last week you got {board.last.votes} heart{board.last.votes === 1 ? '' : 's'}: {prizeFor(board.last.place).label}</Text>
            <Button primary label="Claim prize" onPress={claim} />
          </View>
        </PopIn>
      ) : null}

      {!mine && myPet ? (
        <View style={styles.enterRow}>
          <Stage pet={myPet} size={110} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.enterTitle}>Enter {myPet.nickname}?</Text>
            <Text style={font.small}>Your pet walks the runway in its outfit and scene. Entering gives you 15 coins.</Text>
            <Button primary label={busy ? 'Entering…' : '✨ Enter the show'} disabled={busy} onPress={enter} />
            <Button small label="👗 Change outfit first" onPress={openWardrobe} />
          </View>
        </View>
      ) : null}

      <Text style={styles.sub}>Runway · ❤️ {board.votesLeft} heart{board.votesLeft === 1 ? '' : 's'} left to give (+5 coins each)</Text>
      {board.entries.length === 0 ? <Text style={font.small}>No one has entered yet. Be the first!</Text> : null}
      <View style={styles.grid}>
        {board.entries.map((e, i) => (
          <View key={e.id} style={[styles.entry, e.mine && styles.entryMine]}>
            {i === 0 && e.votes > 0 ? <Text style={styles.leader}>👑 Leading</Text> : null}
            <Stage pet={e.pet} />
            <Text style={styles.entryName} numberOfLines={1}>{e.pet.nickname}</Text>
            <Text style={styles.entryOwner} numberOfLines={1}>{e.mine ? 'You' : e.username}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.hearts}>❤️ {e.votes}</Text>
              {!e.mine ? (
                <Button small primary={!e.voted && board.votesLeft > 0} label={e.voted ? 'Loved ✓' : 'Heart'} disabled={e.voted || board.votesLeft === 0} onPress={() => vote(e)} />
              ) : (
                <Button small label="Update" onPress={enter} />
              )}
            </View>
          </View>
        ))}
      </View>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      <Text style={font.tiny}>You and your friends compete each week (Monday to Sunday). Most hearts wins! Prizes: 🥇 Gold chest, 🥈 Silver, 🥉 Bronze.</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFF0F6', borderColor: '#F9C9DD' },
  prize: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: space.sm, gap: 8, borderWidth: 2, borderColor: colors.gold },
  prizeText: { fontWeight: '800', fontSize: 14, color: colors.ink },
  enterRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: space.sm },
  enterTitle: { fontWeight: '900', fontSize: 15, color: colors.ink },
  stage: { aspectRatio: 1, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  sub: { fontWeight: '900', fontSize: 14, color: '#7A2E58' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: '3%', rowGap: space.sm },
  entry: { width: '48.5%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 8, gap: 3, alignItems: 'center', borderWidth: 1.5, borderColor: '#F9C9DD' },
  entryMine: { borderColor: '#E26AA0', borderWidth: 2 },
  leader: { position: 'absolute', top: 12, left: 12, zIndex: 3, backgroundColor: colors.gold, color: '#5A3E00', fontWeight: '900', fontSize: 11, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  entryName: { fontWeight: '900', fontSize: 14, color: colors.ink },
  entryOwner: { fontWeight: '700', fontSize: 12, color: colors.muted },
  hearts: { fontWeight: '900', fontSize: 14, color: '#C2185B' },
  msg: { fontWeight: '800', fontSize: 13, color: '#9C4C77' },
});
