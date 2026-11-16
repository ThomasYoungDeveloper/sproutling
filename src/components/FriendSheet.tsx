import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFriends, type Friend } from '../state/FriendsContext';
import { Button, RarityBadge } from './ui';
import PetSprite from './PetSprite';
import { buzz, PopIn } from './fx';
import { colors, font, space } from '../theme';
import { SPECIES, SPECIES_BY_ID } from '../game/species';
import { levelFor, stageFor } from '../game/scoring';
import { GIFT_COINS, GIFTS_PER_DAY } from '../game/actions';
import { lastSeen } from '../screens/friendsShared';
import { Backdrop } from './PetScene';
import { friendOpponent, useBattle, useTradeOffer } from './SocialPanels';

export default function FriendSheet({ friend, onClose }: { friend: Friend; onClose: () => void }) {
  const { gift, giftsLeft, remove, friends } = useFriends();
  const battle = useBattle();
  const tradeOffer = useTradeOffer();
  const live = friends.find((f) => f.id === friend.id) ?? friend;
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const card = live.card;
  const active = card?.active;
  const activeSpecies = active ? SPECIES_BY_ID[active.speciesId] : undefined;

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={{ gap: space.sm }}>
          <View style={styles.hero}>
            {activeSpecies ? <Backdrop element={activeSpecies.element} sky="day" scene={card?.scene} /> : null}
            {activeSpecies && active ? (
              <PopIn>
                <PetSprite species={activeSpecies} stage={stageFor(active.xp)} size={150} shiny={active.shiny} hat={active.hat} aura={active.aura} />
              </PopIn>
            ) : (
              <Text style={{ fontSize: 64 }}>🥚</Text>
            )}
            <Text style={font.title}>{live.username}</Text>
            {active && activeSpecies ? (
              <Text style={font.small}>
                Lv {levelFor(active.xp)} {active.nickname} the {activeSpecies.name}
              </Text>
            ) : (
              <Text style={font.small}>Hasn’t hatched a pet yet</Text>
            )}
          </View>

          <View style={styles.stats}>
            <Stat label="Streak" value={`▲ ${card?.streak ?? 0}`} />
            <Stat label="Pets" value={`${card?.pets ?? 0}`} />
            <Stat label="Pet-dex" value={`${card?.dex ?? 0}/${SPECIES.length}`} />
            <Stat label="Badges" value={`🏅 ${card?.badges ?? 0}`} />
          </View>
          <Text style={[font.small, { textAlign: 'center' }]}>{lastSeen(live)}</Text>

          {card && card.team.length > 1 ? (
            <>
              <Text style={[font.body, { fontWeight: '800', marginTop: space.sm }]}>Their team</Text>
              <View style={styles.grid}>
                {card.team.map((p, i) => {
                  const sp = SPECIES_BY_ID[p.speciesId];
                  if (!sp) return null;
                  return (
                    <View key={i} style={styles.tile}>
                      <PetSprite species={sp} stage={stageFor(p.xp)} size={64} shiny={p.shiny} hat={p.hat} />
                      <View style={styles.lv}><Text style={styles.lvText}>Lv {levelFor(p.xp)}</Text></View>
                      <Text style={styles.name} numberOfLines={1}>{p.nickname}</Text>
                      <RarityBadge rarity={sp.rarity} />
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          <Button
            primary
            label={live.giftedToday ? 'Gift sent today ✓' : giftsLeft === 0 ? 'No gifts left today' : '🎁 Send a gift'}
            disabled={live.giftedToday || giftsLeft === 0}
            onPress={async () => {
              buzz('success');
              const r = await gift(live.id);
              setMsg(
                r === 'limit'
                  ? `You’ve sent all ${GIFTS_PER_DAY} gifts for today. More tomorrow!`
                  : r === 'error' || r === 'not_friends'
                    ? 'Couldn’t send that. Try again.'
                    : `Gift sent! ${live.username} gets ${GIFT_COINS} coins, maybe more.`,
              );
            }}
            style={{ marginTop: space.sm }}
          />
          {!live.giftedToday && giftsLeft > 0 ? <Text style={[font.tiny, { textAlign: 'center' }]}>{giftsLeft} of {GIFTS_PER_DAY} gifts left today</Text> : null}
          {msg ? <Text style={[font.small, { textAlign: 'center', color: colors.mintDark }]}>{msg}</Text> : null}

          <View style={styles.row2}>
            <Button
              label="⚔️ Battle"
              disabled={!friendOpponent(live)}
              style={{ flex: 1 }}
              onPress={() => {
                const opp = friendOpponent(live);
                if (!opp) return;
                onClose();
                battle(opp);
              }}
            />
            <Button
              label="⇄ Trade"
              style={{ flex: 1 }}
              onPress={() => {
                onClose();
                tradeOffer(live);
              }}
            />
          </View>
          {!friendOpponent(live) ? <Text style={[font.tiny, { textAlign: 'center' }]}>{live.username} needs to hatch a pet before you can battle.</Text> : null}

          <View style={styles.row}>
            <Button
              label={confirmRemove ? 'Tap again to remove' : 'Remove friend'}
              onPress={async () => {
                if (!confirmRemove) {
                  setConfirmRemove(true);
                  setTimeout(() => setConfirmRemove(false), 3000);
                  return;
                }
                await remove(live.friendshipId);
                onClose();
              }}
            />
            <Button primary label="Done" onPress={onClose} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={font.tiny}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.55)', justifyContent: 'center', alignItems: 'center', padding: space.lg, zIndex: 50 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: space.lg, width: '100%', maxWidth: 420, maxHeight: '92%' },
  hero: { alignItems: 'center', gap: 2, backgroundColor: colors.sky, borderRadius: 18, paddingVertical: space.md, overflow: 'hidden' },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingVertical: space.sm, backgroundColor: '#FAFCFB' },
  statValue: { fontSize: 18, fontWeight: '900', color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: '3.5%', rowGap: space.sm },
  tile: { width: '31%', alignItems: 'center', gap: 3, padding: space.xs, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FAFCFB' },
  name: { fontWeight: '800', fontSize: 12, color: colors.ink },
  lv: { position: 'absolute', top: 4, left: 4, backgroundColor: colors.ink, borderRadius: 7, paddingHorizontal: 5, paddingVertical: 1 },
  lvText: { color: '#fff', fontWeight: '900', fontSize: 10 },
  row2: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  soon: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: space.xs },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center', marginTop: space.md },
});
