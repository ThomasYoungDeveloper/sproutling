import React, { useEffect, useRef, useState } from 'react';
import { useOpenChat } from './Chat';
import { useChat } from '../state/ChatContext';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFriends, type Friend } from '../state/FriendsContext';
import { Button, RarityBadge } from './ui';
import PetSprite from './PetSprite';
import { buzz, PopIn } from './fx';
import { colors, font, space } from '../theme';
import { SPECIES, SPECIES_BY_ID } from '../game/species';
import { levelFor, stageFor } from '../game/scoring';
import { gradeOf } from '../game/stats';
import { GIFT_COINS, GIFTS_PER_DAY } from '../game/actions';
import { activeToday, lastSeen } from '../screens/friendsShared';
import { YardBackdrop } from './PetScene';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PetZoom from './PetZoom';
import { friendOpponent, useBattle, useLiveBattle, useTradeOffer } from './SocialPanels';
import { useLive } from '../state/LiveBattleContext';

export default function FriendSheet({ friend, onClose }: { friend: Friend; onClose: () => void }) {
  // This screen covers the whole phone, so keep the Back button below the clock and camera.
  const insets = useSafeAreaInsets();
  const { gift, giftsLeft, remove, friends } = useFriends();
  const battle = useBattle();
  const tradeOffer = useTradeOffer();
  const liveB = useLiveBattle();
  const chat = useChat();
  const openChat = useOpenChat();
  const { battles } = useLive();
  const [choose, setChoose] = useState(false);
  const live = friends.find((f) => f.id === friend.id) ?? friend;
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [zoomPet, setZoomPet] = useState<any>(null);
  const card = live.card;
  const active = card?.active;
  const activeSpecies = active ? SPECIES_BY_ID[active.speciesId] : undefined;

  const doGift = async () => {
    buzz('success');
    const r = await gift(live.id);
    setMsg(
      r === 'limit'
        ? `You’ve sent all ${GIFTS_PER_DAY} gifts for today. More tomorrow!`
        : r === 'error' || r === 'not_friends'
          ? 'Couldn’t send that. Try again.'
          : `Gift sent! ${live.username} gets ${GIFT_COINS} coins, maybe more.`,
    );
  };
  const possessive = `${live.username}${/s$/i.test(live.username) ? '’' : '’s'}`;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: space.xl }}>
        <View style={styles.yard}>
          {activeSpecies ? <YardBackdrop element={activeSpecies.element} sky="day" scene={card?.scene} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.sky }]} />}
          {activeSpecies && active ? (
            <FriendPet onPress={() => setZoom(true)} label={`See ${active.nickname} up close`}>
              <PetSprite species={activeSpecies} stage={stageFor(active.xp)} size={170} shiny={active.shiny} skin={active.skin} hat={active.hat} aura={active.aura} />
            </FriendPet>
          ) : (
            <Text style={{ position: 'absolute', alignSelf: 'center', top: 220, fontSize: 64 }}>🥚</Text>
          )}
          <View style={[styles.yardTop, { top: 14 + insets.top }]}>
            <Pressable onPress={onClose} style={styles.backPill} accessibilityRole="button" accessibilityLabel="Back">
              <Text style={styles.backText}>‹ Back</Text>
            </Pressable>
            <View style={styles.seenPill}>
              {activeToday(live) ? <View style={styles.dot} /> : null}
              <Text style={styles.seenText}>{lastSeen(live)}</Text>
            </View>
          </View>
          <View style={[styles.hello, { top: Math.max(104, insets.top + 62) }]} pointerEvents="none">
            <Text style={styles.helloText}>Hi from {possessive} yard!</Text>
          </View>
        </View>

        <View style={styles.sheetBody}>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.who}>{live.username}</Text>
            {active && activeSpecies ? (
              <Text style={styles.whoSub}>Lv {levelFor(active.xp)} {active.nickname} the {activeSpecies.name}</Text>
            ) : (
              <Text style={styles.whoSub}>Hasn’t hatched a pet yet</Text>
            )}
          </View>

          <View style={styles.stats}>
            <Stat label="Streak" value={`🔥 ${card?.streak ?? 0}`} bg="#FFE7DA" ink="#B4532A" />
            <Stat label="Pets" value={`${card?.pets ?? 0}`} bg="#DCEBFB" ink="#245C94" />
            <Stat label="Pet-dex" value={`${card?.dex ?? 0}/${SPECIES.length}`} bg="#E8E1FA" ink="#4F3A9E" />
            <Stat label="Badges" value={`🏅 ${card?.badges ?? 0}`} bg="#FFF4CC" ink="#7A5900" />
          </View>

          <View style={styles.actions}>
            <Pressable onPress={doGift} disabled={live.giftedToday || giftsLeft === 0} style={[styles.action, { backgroundColor: colors.gold }, (live.giftedToday || giftsLeft === 0) && { opacity: 0.55 }]} accessibilityRole="button" accessibilityLabel={live.giftedToday ? 'Gift sent today' : 'Send a gift'}>
              <Text style={styles.actionIcon}>🎁</Text>
              <Text style={[styles.actionText, { color: '#5A3A00' }]}>{live.giftedToday ? 'Sent' : 'Gift'}</Text>
            </Pressable>
            <Pressable
              disabled={!friendOpponent(live)}
              onPress={() => {
                const going = battles.find((b) => b.friendId === live.id && (b.status === 'active' || (b.status === 'invited' && !b.iChallenged)));
                if (going) {
                  onClose();
                  if (going.status === 'active') liveB.openLive(going);
                  else liveB.accept(going);
                  return;
                }
                setChoose((c) => !c);
              }}
              style={[styles.action, { backgroundColor: '#E0567A' }, !friendOpponent(live) && { opacity: 0.5 }]}
              accessibilityRole="button"
              accessibilityLabel="Battle"
            >
              <Text style={styles.actionIcon}>⚔️</Text>
              <Text style={styles.actionText}>{battles.some((b) => b.friendId === live.id && b.myTurn) ? 'Your move!' : 'Battle'}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onClose();
                tradeOffer(live);
              }}
              style={[styles.action, { backgroundColor: '#4A8FE0' }]}
              accessibilityRole="button"
              accessibilityLabel="Trade"
            >
              <Text style={styles.actionIcon}>⇄</Text>
              <Text style={styles.actionText}>Trade</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => {
              onClose();
              openChat(chat.dmRoom(live.id), live.username, live.id);
            }}
            style={styles.chatBtn}
            accessibilityRole="button"
            accessibilityLabel={`Chat with ${live.username}`}
          >
            <Text style={styles.chatBtnText}>Chat with {live.username}</Text>
          </Pressable>
          {choose && friendOpponent(live) ? (
            <View style={styles.choose}>
              <Pressable
                onPress={() => {
                  setChoose(false);
                  if (battles.some((b) => b.friendId === live.id && b.status === 'invited')) {
                    setMsg(`You already sent ${live.username} a challenge.`);
                    return;
                  }
                  liveB.challenge(live, (t) => setMsg(t));
                }}
                style={[styles.chooseBtn, { backgroundColor: '#E0567A' }]}
                accessibilityRole="button"
              >
                <Text style={styles.chooseTitle}>⚡ Live battle</Text>
                <Text style={styles.chooseSub}>{live.username} picks their own moves</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const opp = friendOpponent(live);
                  if (!opp) return;
                  setChoose(false);
                  onClose();
                  battle(opp);
                }}
                style={[styles.chooseBtn, { backgroundColor: '#5B6BB5' }]}
                accessibilityRole="button"
              >
                <Text style={styles.chooseTitle}>🤖 Practice</Text>
                <Text style={styles.chooseSub}>Battle their team right now</Text>
              </Pressable>
            </View>
          ) : null}
          {!live.giftedToday && giftsLeft > 0 ? <Text style={[font.tiny, { textAlign: 'center' }]}>{giftsLeft} of {GIFTS_PER_DAY} gifts left today</Text> : null}
          {!friendOpponent(live) ? <Text style={[font.tiny, { textAlign: 'center' }]}>{live.username} needs to hatch a pet before you can battle.</Text> : null}
          {msg ? <Text style={[font.small, { textAlign: 'center', color: colors.mintDark }]}>{msg}</Text> : null}

          {card && card.team.length > 0 ? (
            <View style={styles.teamCard}>
              <Text style={styles.teamTitle}>{possessive} team</Text>
              <View style={styles.grid}>
                {card.team.map((p, i) => {
                  const sp = SPECIES_BY_ID[p.speciesId];
                  if (!sp) return null;
                  return (
                    <Pressable key={i} onPress={() => setZoomPet(p)} style={({ pressed }) => [styles.tile, { backgroundColor: RARITY_TINT[sp.rarity] ?? '#F2F6F4' }, pressed && { transform: [{ scale: 0.96 }] }]} accessibilityRole="button" accessibilityLabel={`See ${p.nickname} up close`}>
                      <View style={styles.lv}><Text style={styles.lvText}>Lv {levelFor(p.xp)} · {gradeOf(p)}%</Text></View>
                      <PetSprite species={sp} stage={stageFor(p.xp)} size={64} shiny={p.shiny} skin={p.skin} hat={p.hat} aura={p.aura} />
                      <Text style={styles.name} numberOfLines={1}>{p.nickname}</Text>
                      <RarityBadge rarity={sp.rarity} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={async () => {
              if (!confirmRemove) {
                setConfirmRemove(true);
                setTimeout(() => setConfirmRemove(false), 3000);
                return;
              }
              await remove(live.friendshipId);
              onClose();
            }}
            style={styles.remove}
            accessibilityRole="button"
          >
            <Text style={styles.removeText}>{confirmRemove ? 'Tap again to remove' : 'Remove friend'}</Text>
          </Pressable>
        </View>
      </ScrollView>
      {zoom && active ? <PetZoom pet={active} scene={card?.scene} onClose={() => setZoom(false)} /> : null}
      {zoomPet ? <PetZoom pet={zoomPet} onClose={() => setZoomPet(null)} /> : null}
    </View>
  );
}

const RARITY_TINT: Record<string, string> = { common: '#E8F6FF', uncommon: '#E2F6E6', rare: '#F1E8FF', epic: '#FFE8F2', legendary: '#FFF2D6' };

/** The friend's pet wandering around their yard. */
function FriendPet({ children, onPress, label }: { children: React.ReactNode; onPress: () => void; label: string }) {
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const face = useRef(new Animated.Value(1)).current;
  const at = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const bounce = Animated.loop(Animated.sequence([
      Animated.timing(hop, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(hop, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]));
    bounce.start();
    const t = setInterval(() => {
      const nx = (Math.random() * 2 - 1) * 90;
      const ny = (Math.random() * 2 - 1) * 40;
      face.setValue(nx < at.current.x ? -1 : 1);
      at.current = { x: nx, y: ny };
      Animated.parallel([
        Animated.timing(x, { toValue: nx, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(y, { toValue: ny, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]).start();
    }, 3600);
    return () => {
      bounce.stop();
      clearInterval(t);
    };
  }, []);
  const scale = y.interpolate({ inputRange: [-40, 40], outputRange: [0.86, 1.06] });
  return (
    <Animated.View style={{ position: 'absolute', alignSelf: 'center', top: 170, transform: [{ translateX: x }, { translateY: y }, { scale }] }}>
      <View style={{ position: 'absolute', bottom: 0, alignSelf: 'center', width: 90, height: 14, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.16)' }} />
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
        <Animated.View style={{ transform: [{ scaleX: face }, { translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }}>{children}</Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function Stat({ label, value, bg, ink }: { label: string; value: string; bg: string; ink: string }) {
  return (
    <View style={[styles.stat, { backgroundColor: bg }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={[styles.statLabel, { color: ink }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chatBtn: { borderRadius: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#CFE6DA' },
  chatBtnText: { fontWeight: '900', fontSize: 15, color: colors.ink },
  choose: { flexDirection: 'row', gap: space.sm },
  chooseBtn: { flex: 1, borderRadius: 16, padding: 12, gap: 2 },
  chooseTitle: { color: '#fff', fontWeight: '900', fontSize: 15 },
  chooseSub: { color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 11 },
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, zIndex: 50 },
  yard: { height: 460, overflow: 'hidden' },
  yardTop: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backPill: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  seenPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.mint },
  seenText: { fontSize: 13, fontWeight: '900', color: colors.ink },
  hello: { position: 'absolute', top: 104, left: 0, right: 0, alignItems: 'center' },
  helloText: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7, fontSize: 14, fontWeight: '900', color: colors.ink, overflow: 'hidden' },
  sheetBody: { marginTop: -26, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.bg, padding: space.lg, gap: space.md, width: '100%', maxWidth: 520, alignSelf: 'center' },
  who: { fontSize: 26, fontWeight: '900', color: '#1F3A33' },
  whoSub: { fontSize: 13, fontWeight: '800', color: '#3E6B5E' },
  statLabel: { fontSize: 11, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1, height: 48, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionIcon: { fontSize: 18, color: '#FFFFFF', fontWeight: '900' },
  actionText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  teamCard: { backgroundColor: colors.card, borderRadius: 22, padding: space.md, gap: space.sm },
  teamTitle: { fontSize: 18, fontWeight: '900', color: colors.ink },
  remove: { alignSelf: 'center', padding: 10 },
  removeText: { fontSize: 13, fontWeight: '800', color: colors.muted },
  back: { alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 10, marginLeft: -8, marginTop: -6, marginBottom: 4, justifyContent: 'center' },
  backText: { fontSize: 16, fontWeight: '900', color: colors.mintDark },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.55)', justifyContent: 'center', alignItems: 'center', padding: space.lg, zIndex: 50 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: space.lg, width: '100%', maxWidth: 420, maxHeight: '92%' },
  hero: { alignItems: 'center', gap: 2 },
  stage: { alignSelf: 'stretch', height: 200, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8, backgroundColor: colors.sky },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, alignItems: 'center', borderRadius: 16, paddingVertical: space.sm },
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
