import { AdBonusButton } from './Ads';
import { addCoins } from '../game/adBonus';
import { useResetIn } from '../lib/useResetIn';
import Coin from './Coin';
import React, { useState } from 'react';
import PotionIcon from './PotionIcon';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useGame } from '../state/GameContext';
import { Button } from './ui';
import { Confetti, PopIn, buzz, useIdleWobble } from './fx';
import { colors, font, space } from '../theme';
import * as A from '../game/actions';
import type { ChestKind } from '../game/types';
import CoinBundle from './CoinBundle';
import ChestIcon from './ChestIcon';

const CHEST_LABEL: Record<ChestKind, string> = { bronze: 'Bronze chest', silver: 'Silver chest', gold: 'Gold chest', rainbow: 'Rainbow Chest' };
const CHEST_COLOR: Record<ChestKind, string> = { bronze: '#C98A4B', silver: '#8FA3B5', gold: '#E5A800', rainbow: '#B45FE0' };

function RewardLabel({ r, big }: { r: A.LoginReward; big?: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      {r.chest ? <ChestIcon kind={r.chest} size={big ? 56 : 28} /> : big ? <CoinBundle size={52} /> : <Coin size={24} />}
      {r.chest ? <Text style={[big ? styles.bigText : styles.tileText, { color: CHEST_COLOR[r.chest] }]}>{big ? CHEST_LABEL[r.chest] : r.chest[0].toUpperCase() + r.chest.slice(1)}</Text> : null}
      {r.coins ? <Text style={big ? styles.bigText : styles.tileText}>{r.chest ? '+ ' : ''}{r.coins}{big ? ' coins' : ''}</Text> : null}
    </View>
  );
}

export default function DailyLoginSheet({ onClose }: { onClose: () => void }) {
  const { state, apply } = useGame();
  const { width, height } = useWindowDimensions();
  const wobble = useIdleWobble();
  const status = A.loginStatus(state);
  const resetIn = useResetIn();
  const [got, setGot] = useState<{ reward: A.LoginReward; day: number } | null>(null);
  const [doubled, setDoubled] = useState(false);

  const collect = () => {
    const r = A.claimLogin(state);
    if (!r) return;
    buzz('success');
    apply(() => r.state);
    setGot({ reward: r.reward, day: r.day });
  };

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      {got ? <Confetti width={width} height={height} amount={60} /> : null}
      <View style={styles.sheet}>
        <Text style={[font.title, { textAlign: 'center' }]}>Daily rewards</Text>
        <Text style={[font.small, { textAlign: 'center' }]}>Come back each day. Day 7 is a Silver chest.</Text>

        <View style={styles.grid}>
          {A.LOGIN_REWARDS.map((r, i) => {
            // Earlier days in this week's loop are collected; today's is collected once claimed.
            const done = status.canClaim ? i < status.index : i <= status.index;
            const isToday = i === status.index;
            const tile = (
              <View style={[styles.tile, i === 6 && styles.tileBig, done && styles.tileDone, isToday && styles.tileToday, done && styles.tileDone]}>
                <Text style={styles.day}>Day {i + 1}</Text>
                <RewardLabel r={r} />
                {done ? <View style={styles.check}><Text style={styles.checkText}>✓</Text></View> : null}
              </View>
            );
            return (
              <View key={i} style={i === 6 ? { width: '100%' } : { width: '31%' }}>
                {isToday && status.canClaim ? <Animated.View style={wobble}>{tile}</Animated.View> : tile}
              </View>
            );
          })}
        </View>

        {got ? (
          <PopIn>
            <View style={styles.got}>
              <Text style={font.small}>Day {got.day} reward</Text>
              <RewardLabel r={got.reward} big />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <PotionIcon kind="small" size={26} />
                <Text style={[font.small, { fontWeight: '900' }]}>Plus your daily Small Potion</Text>
              </View>
              {got.reward.chest ? <Text style={font.small}>Open it on the Chests tab.</Text> : null}
              {got.reward.coins && !doubled ? <AdBonusButton title={`Double today’s coins: ${got.reward.coins * 2}`} onReward={addCoins(got.reward.coins)} onDone={() => setDoubled(true)} /> : null}
              {doubled ? <PopIn from={0.4}><Text style={styles.doubled}>2× DOUBLED! +{got.reward.coins} more coins</Text></PopIn> : null}
            </View>
          </PopIn>
        ) : null}

        {status.canClaim ? (
          <Button primary label={`Collect day ${status.index + 1} reward`} onPress={collect} />
        ) : (
          <>
            {!got ? <Text style={[font.small, { textAlign: 'center' }]}>You’ve collected today’s reward. Day {((status.index + 1) % 7) + 1} unlocks in {resetIn}!</Text> : null}
            <Button primary label={got ? 'Awesome!' : 'Done'} onPress={onClose} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  doubled: { fontSize: 18, fontWeight: '900', color: '#FF8A4C', textAlign: 'center' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.6)', justifyContent: 'center', alignItems: 'center', padding: space.lg, zIndex: 60 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: space.lg, gap: space.sm, width: '100%', maxWidth: 420 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', marginVertical: space.xs },
  tile: { alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, backgroundColor: '#FAFCFB' },
  tileBig: { backgroundColor: '#FFF6DD', borderColor: colors.gold },
  tileToday: { borderColor: colors.mint, borderWidth: 2.5, backgroundColor: colors.mintSoft },
  tileDone: { opacity: 0.55 },
  day: { fontSize: 12, fontWeight: '900', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  tileText: { fontSize: 13, fontWeight: '900', color: colors.ink },
  bigText: { fontSize: 22, fontWeight: '900', color: colors.ink },
  check: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  checkText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  got: { alignItems: 'center', gap: 4, paddingVertical: space.sm, backgroundColor: '#FFF6DD', borderRadius: 16 },
});
