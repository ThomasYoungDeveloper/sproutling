import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { Icon } from './Icon';
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
        <View style={[styles.badge, { backgroundColor: tier.color + '33' }]}>
          <Text style={{ fontSize: 26 }}>{tier.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.label}>{R.seasonName(ranked.season)} · {days} day{days === 1 ? '' : 's'} left</Text>
            <InfoDot color={colors.muted} label="ranked points" onPress={() => overlay.open(<InfoPop tip={{ title: 'Ranked points', text: `Friend battles: win +${R.RANKED_POINTS.friendWin}, lose ${R.RANKED_POINTS.friendLoss} (the first ${R.RANKED_POINTS.perFriendPerDay} a day with each friend count). Wild wins: +${R.RANKED_POINTS.wildWin}, up to ${R.RANKED_POINTS.wildPerDay} a day. Rewards come at the end of the month, by tier.` }} onClose={overlay.close} />)} />
          </View>
          <Text style={styles.tier}>
            {tier.name} <Text style={styles.tierPts}>{ranked.points} pts · {ranked.wins}W {ranked.losses}L</Text>
          </Text>
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <ProgressBar value={prog.frac} height={8} color={prog.next ? prog.next.color : tier.color} />
        <Text style={styles.sub}>{prog.next ? `${prog.need} points to ${prog.next.name}` : 'Top tier! You’re a Legend this season.'}</Text>
      </View>

      {last && !last.claimed && lastTier ? (
        <PopIn>
          <View style={styles.claim}>
            <Icon name="trophy" size={20} color="#B86E00" />
            <Text style={styles.claimText}>
              {R.seasonName(last.season)}: you finished {lastTier.name}
            </Text>
            <Button
              small
              primary
              label="Claim"
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
      <View>
        {(tab === 'global' ? ranked.global.slice(0, 25) : ranked.board.slice(0, 10)).map((r, i) => {
          const t = R.tierFor(r.points);
          const p = r.card?.active;
          const sp = p ? SPECIES_BY_ID[p.speciesId] : undefined;
          return (
            <View key={r.username + i} style={[styles.row, r.me && styles.rowMe]} accessibilityLabel={`${i + 1}. ${r.username}, ${t.name}, ${r.points} points`}>
              <Text style={styles.place}>{i + 1}</Text>
              <View style={styles.avatar}>{sp && p ? <PetSprite species={sp} stage={stageFor(p.xp)} size={32} skin={p.skin} hat={(p as any).hat} /> : <Icon name="egg" size={18} color={colors.muted} />}</View>
              <Text style={styles.name} numberOfLines={1}>{r.username}{r.me ? ' (you)' : ''}</Text>
              <Text style={styles.pts}>{r.points.toLocaleString()}</Text>
            </View>
          );
        })}
        {tab === 'global' && ranked.rank && ranked.rank > 25 ? (
          <View style={[styles.row, styles.rowMe]}>
            <Text style={[styles.place, { width: 44 }]}>#{ranked.rank}</Text>
            <Text style={styles.name} numberOfLines={1}>You</Text>
            <Text style={styles.pts}>{ranked.points.toLocaleString()}</Text>
          </View>
        ) : null}
        {tab === 'friends' && ranked.board.length < 2 ? <Text style={styles.sub}>Add friends to see who’s on top this season!</Text> : null}
      </View>
      {msg ? <Text style={[styles.msg, msg.ok && { color: colors.mintDark }]}>{msg.text}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  badge: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '600', color: colors.muted },
  tier: { fontSize: 20, fontWeight: '800', color: colors.ink },
  tierPts: { fontSize: 14, fontWeight: '600', color: colors.muted },
  sub: { fontSize: 12, fontWeight: '600', color: colors.muted },
  help: { fontSize: 12, fontWeight: '600', color: colors.muted },
  claim: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF7E0', borderRadius: 14, padding: 12 },
  claimText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowMe: { backgroundColor: '#E8F7F0', borderRadius: 12, borderBottomColor: 'transparent' },
  place: { width: 22, textAlign: 'center', fontSize: 14, fontWeight: '700', color: colors.muted },
  avatar: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.tile, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
  pts: { fontSize: 14, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  tabs: { flexDirection: 'row', backgroundColor: '#E2ECE7', borderRadius: 12, padding: 3, gap: 2 },
  tab: { flex: 1, minHeight: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  tabTextOn: { color: colors.ink },
  msg: { fontSize: 13, fontWeight: '600', color: '#C2412D' },
});
