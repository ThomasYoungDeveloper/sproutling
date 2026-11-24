import { postMoment } from '../lib/moments';
import type { OwnedPet } from '../game/types';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { useGame } from '../state/GameContext';
import { useOverlay } from './Overlay';
import BattleScreen, { type ResultLine } from './BattleScreen';
import PetSprite from './PetSprite';
import { FitSheet, Button } from './ui';
import { buzz, PopIn } from './fx';
import { colors, font, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { RARITY_INFO } from '../game/rarity';
import { FOOD_BY_ID } from '../game/food';
import * as H from '../game/hp';
import * as W from '../game/wild';
import * as Ex from '../game/expedition';
import { pendingWild, MAX_WILD_PER_DAY, type WildEncounter } from '../game/walkFinds';

/** Opens a wild pet: battle it with real HP, or let it go. */
export function useWild() {
  const { state, apply } = useGame();
  const { open, close } = useOverlay();
  const fight = (w: WildEncounter) => {
    const opp = W.wildOpponent(w);
    open(
      <BattleScreen
        opponent={{ name: opp.nickname, team: [opp] }}
        onClose={close}
        special={{
          teamSize: 1,
          // Wild pets aren't at full strength (same as on trips).
          tweak: (b) => ({ ...b, theirs: b.theirs.map((f) => { const hp = Math.max(1, Math.round(f.maxHp * Ex.WILD_STRENGTH)); return { ...f, maxHp: hp, hp }; }) }),
          title: `Who will face ${opp.nickname}?`,
          winText: `You beat ${opp.nickname}! Here's your surprise.`,
          loseText: `${opp.nickname} ran off. Your pet's HP stays down until you use a potion.`,
          onEnd: (won, b, ids) => {
            let lines: ResultLine[] = [];
            let caught: OwnedPet | null = null;
            apply((s) => {
              let next = H.saveTeamHp(s, b, ids);
              const r = W.resolveWild(next, w.id, won);
              next = r.state;
              if (r.reward) {
                lines = [
                  { label: 'Coins', value: `+${r.reward.coins}`, color: '#B8860B' },
                  ...(r.reward.foodId ? [{ label: FOOD_BY_ID[r.reward.foodId]?.name ?? 'Food', value: `${RARITY_INFO[FOOD_BY_ID[r.reward.foodId]?.rarity ?? 'common'].label} food`, color: RARITY_INFO[FOOD_BY_ID[r.reward.foodId]?.rarity ?? 'common'].color }] : []),
                  ...(r.reward.joined ? [{ label: `${r.reward.joined.nickname} joined your team!`, value: 'New pet', color: '#8A4FD8' }] : []),
                ];
                caught = r.reward.joined;
              }
              return next;
            });
            if (caught) postMoment('catch', caught);
            const hpLines = b.mine.map((f, i) => ({ label: `${f.nickname} HP`, value: f.hp <= 0 ? 'Knocked out' : `${Math.round((f.hp / f.maxHp) * 100)}%`, color: f.hp <= 0 ? '#C4562F' : colors.mintDark }));
            void ids;
            return [...lines, ...hpLines];
          },
        }}
      />,
    );
  };
  const meet = (w: WildEncounter) =>
    open(
      <WildSheet
        w={w}
        onFight={() => {
          close();
          setTimeout(() => fight(w), 50);
        }}
        onLetGo={() => {
          apply((s) => W.letGo(s, w.id));
          close();
        }}
        onClose={close}
        canFight={state.pets.some((p) => !H.isKnockedOut(p))}
      />,
    );
  return { meet, fight };
}

const BG: Record<string, [string, string]> = {
  common: ['#BFE8C4', '#8FD19B'],
  uncommon: ['#C7EBD6', '#7FCCA4'],
  rare: ['#C9E2FA', '#86BDEB'],
  epic: ['#E2D4FA', '#B497EA'],
  legendary: ['#FFF0BF', '#F5CC5C'],
};

export function WildSheet({ w, onFight, onLetGo, onClose, canFight }: { w: WildEncounter; onFight: () => void; onLetGo: () => void; onClose: () => void; canFight: boolean }) {
  const sp = SPECIES_BY_ID[w.speciesId];
  const r = RARITY_INFO[w.rarity];
  return (
    <View style={styles.backdrop}>
      <FitSheet onClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: (BG[w.rarity] ?? BG.common)[1] }]}>
        <View style={styles.pill}><Text style={styles.pillText}>{w.at.toLocaleString()} steps</Text></View>
        <Text style={styles.title}>A wild {sp?.name ?? 'pet'} appeared!</Text>
        <View style={styles.glow}>
          <PopIn from={0.3}>{sp ? <PetSprite species={sp} stage="adult" size={160} /> : null}</PopIn>
        </View>
        <View style={[styles.rarity, { backgroundColor: r.color }]}><Text style={styles.rarityText}>{r.label.toUpperCase()} · Lv {w.level}</Text></View>
        <Text style={styles.body}>Win for a surprise reward. It might even join your team.</Text>
        {canFight ? <Button primary label="Battle" onPress={() => { buzz('medium'); onFight(); }} style={{ alignSelf: 'stretch' }} /> : <Text style={styles.body}>All your pets are knocked out and resting. Their HP starts coming back within a few minutes.</Text>}
        <Button label="Let it go" onPress={onLetGo} style={{ alignSelf: 'stretch' }} />
        <Text style={styles.foot}>Wild pets wait until you open the app. Up to {MAX_WILD_PER_DAY} a day.</Text>
      </View>
      </FitSheet>
    </View>
  );
}

/** Home and Battle tab card listing wild pets waiting for you. */
export default function WildCard() {
  const { state } = useGame();
  const { meet } = useWild();
  const list = pendingWild(state);
  if (!list.length) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardHead}>WILD PETS FROM YOUR WALK</Text>
      {list.map((w) => {
        const sp = SPECIES_BY_ID[w.speciesId];
        return (
          <Pressable key={w.id} onPress={() => meet(w)} style={styles.row} accessibilityRole="button" accessibilityLabel={`Wild ${sp?.name}, level ${w.level}. Tap to battle`}>
            {sp ? <PetSprite species={sp} stage="adult" size={46} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>Wild {sp?.name ?? 'pet'}</Text>
              <Text style={[styles.rowSub, { color: RARITY_INFO[w.rarity].color }]}>{RARITY_INFO[w.rarity].label} · Lv {w.level}</Text>
            </View>
            <Text style={styles.go}>Battle ›</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,30,28,0.55)', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  sheet: { width: '100%', maxWidth: 420, alignSelf: 'center', borderRadius: 24, padding: space.lg, gap: 10, alignItems: 'center' },
  pill: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  title: { fontSize: 26, fontWeight: '800', color: '#1F2A2E', textAlign: 'center' },
  glow: { width: 200, height: 190, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
  rarity: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  rarityText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  body: { fontSize: 14, fontWeight: '700', color: '#1F2A2E', textAlign: 'center' },
  foot: { fontSize: 12, fontWeight: '600', color: '#1F2A2E', opacity: 0.8, textAlign: 'center' },
  card: { backgroundColor: '#FFFBF2', borderRadius: 22, padding: space.md, gap: 8, borderWidth: 2, borderColor: '#8FD19B' },
  cardHead: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowName: { ...font.body, fontWeight: '800' },
  rowSub: { fontSize: 12, fontWeight: '600' },
  go: { fontSize: 14, fontWeight: '700', color: '#E5484D' },
});
