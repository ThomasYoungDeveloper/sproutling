import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { useRanked } from '../state/RankedContext';
import { Button, Card, ProgressBar } from './ui';
import PetSprite from './PetSprite';
import { buzz, Confetti, PopIn } from './fx';
import { colors, font, space } from '../theme';
import { InfoDot, InfoPop } from './InfoTip';
import { useOverlay } from './Overlay';
import { SPECIES_BY_ID } from '../game/species';
import { stageFor } from '../game/scoring';
import * as R from '../game/ranked';

export default function RankedCard() {
  const overlay = useOverlay();
  const { ranked, claimSeason } = useRanked();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [party, setParty] = useState(0);
  const [tab, setTab] = useState<'global' | 'friends'>('global');
  if (!ranked) return null;
  const tier = R.tierFor(ranked.points);
  const prog = R.tierProgress(ranked.points);
  const days = R.seasonDaysLeft();
  const last = ranked.last;
  const lastTier = last ? R.tierFor(last.points) : null;
  return (
    <Card style={styles.card}>
      {party ? <Confetti key={party} amount={50} width={400} height={500} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={[styles.badge, { backgroundColor: tier.color }]}>
          <Text style={{ fontSize: 30 }}>{tier.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.label}>RANKED · {R.seasonName(ranked.season).toUpperCase()}</Text>
            <InfoDot color="#D6DCF5" label="ranked points" onPress={() => overlay.open(<InfoPop tip={{ title: 'Ranked points', text: `Friend battles: win +${R.RANKED_POINTS.friendWin}, lose ${R.RANKED_POINTS.friendLoss} (the first ${R.RANKED_POINTS.perFriendPerDay} a day with each friend count). Wild wins: +${R.RANKED_POINTS.wildWin}, up to ${R.RANKED_POINTS.wildPerDay} a day. Rewards come at the end of the month, by tier.` }} onClose={overlay.close} />)} />
          </View>
          <Text style={styles.tier}>{tier.name}</Text>
          <Text style={styles.sub}>
            {ranked.points} points · {ranked.wins}W {ranked.losses}L · {days} day{days === 1 ? '' : 's'} left
          </Text>
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <ProgressBar value={prog.frac} height={12} color={prog.next ? prog.next.color : tier.color} />
        <Text style={styles.sub}>{prog.next ? `${prog.need} points to ${prog.next.emoji} ${prog.next.name}` : 'Top tier! You’re a Legend this season.'}</Text>
      </View>

      {last && !last.claimed && lastTier ? (
        <PopIn>
          <View style={styles.claim}>
            <Text style={styles.claimText}>
              {R.seasonName(last.season)} is over! You finished {lastTier.emoji} {lastTier.name} with {last.points} points.
            </Text>
            <Button
              primary
              label="Claim season reward"
              onPress={async () => {
                const r = await claimSeason();
                setMsg(r);
                if (r.ok) {
                  buzz('success', 'win');
                  setParty((p) => p + 1);
                }
              }}
            />
          </View>
        </PopIn>
      ) : null}

      <View style={styles.tabs}>
        {(['global', 'friends'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t === 'global' ? 'Everyone' : 'Friends'}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'global' ? (
        <Text style={styles.sub}>
          {ranked.rank ? `You’re #${ranked.rank.toLocaleString()} of ${ranked.players.toLocaleString()} ranked players.` : `${ranked.players.toLocaleString()} ranked players this season. Win a battle to join the board!`}
        </Text>
      ) : null}
      <View style={{ gap: 6 }}>
        {(tab === 'global' ? ranked.global.slice(0, 25) : ranked.board.slice(0, 10)).map((r, i) => {
          const t = R.tierFor(r.points);
          const p = r.card?.active;
          const sp = p ? SPECIES_BY_ID[p.speciesId] : undefined;
          return (
            <View key={r.username + i} style={[styles.row, r.me && styles.rowMe]}>
              <Text style={styles.place}>{i + 1}</Text>
              <View style={styles.avatar}>{sp && p ? <PetSprite species={sp} stage={stageFor(p.xp)} size={32} skin={p.skin} hat={(p as any).hat} /> : <Text>🥚</Text>}</View>
              <Text style={styles.name} numberOfLines={1}>{r.username}{r.me ? ' (you)' : ''}</Text>
              <Text style={[styles.pts, { color: t.color }]}>{t.emoji} {r.points}</Text>
            </View>
          );
        })}
        {tab === 'global' && ranked.rank && ranked.rank > 25 ? (
          <View style={[styles.row, styles.rowMe]}>
            <Text style={[styles.place, { width: 44 }]}>#{ranked.rank}</Text>
            <Text style={styles.name} numberOfLines={1}>You</Text>
            <Text style={[styles.pts, { color: tier.color }]}>{tier.emoji} {ranked.points}</Text>
          </View>
        ) : null}
        {tab === 'friends' && ranked.board.length < 2 ? <Text style={styles.sub}>Add friends to see who’s on top this season!</Text> : null}
      </View>
      {msg ? <Text style={[styles.msg, msg.ok && { color: '#DDF4EA' }]}>{msg.text}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1B2240', borderColor: '#1B2240', gap: space.sm },
  badge: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '900', color: '#AFB8E8', letterSpacing: 1 },
  tier: { fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  sub: { fontSize: 12, fontWeight: '800', color: '#C8CEF0' },
  help: { fontSize: 12, fontWeight: '700', color: '#AFB8E8' },
  claim: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: space.sm, gap: 8 },
  claimText: { fontSize: 14, fontWeight: '800', color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 6 },
  rowMe: { backgroundColor: 'rgba(255,255,255,0.18)' },
  place: { width: 26, textAlign: 'center', fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  avatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  name: { flex: 1, fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  pts: { fontSize: 14, fontWeight: '900' },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabOn: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 14, fontWeight: '900', color: '#C8CEF0' },
  tabTextOn: { color: '#1B2240' },
  msg: { fontSize: 13, fontWeight: '800', color: '#FFE0D1' },
});
