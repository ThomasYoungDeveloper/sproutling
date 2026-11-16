import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFriends, type Friend, type Trainer } from '../state/FriendsContext';
import { Button, Card, SectionHead } from '../components/ui';
import PetSprite from '../components/PetSprite';
import FriendSheet from '../components/FriendSheet';
import { useOverlay } from '../components/Overlay';
import { buzz } from '../components/fx';
import { colors, font, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { levelFor, stageFor } from '../game/scoring';
import { GIFTS_PER_DAY } from '../game/actions';
import { activeToday, copyText, lastSeen, shareInvite } from './friendsShared';
import { ArenaCard, TradesCard } from '../components/SocialPanels';
import TeamCard from '../components/TeamCard';

export default function FriendsScreen({ initialAdd, onUsedInitialAdd }: { initialAdd?: string | null; onUsedInitialAdd?: () => void }) {
  const { myCode, friends, incoming, outgoing, loading, error, addFriend, respond, remove, gift, giftsLeft, refresh } = useFriends();
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [addMsg, setAddMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const overlay = useOverlay();
  const openFriend = (f: Friend) => overlay.open(<FriendSheet friend={f} onClose={overlay.close} />);
  const [inviteTop, setInviteTop] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  // Arrived from someone's invite link: fill in their code.
  useEffect(() => {
    if (initialAdd) {
      setTarget(initialAdd);
      setInviteTop(true);
      setAddMsg({ ok: true, text: 'Tap Add to send your friend request.' });
      onUsedInitialAdd?.();
    }
  }, [initialAdd]);

  const submit = async () => {
    setBusy(true);
    const r = await addFriend(target);
    setAddMsg(r);
    if (r.ok) {
      buzz('success');
      setTarget('');
    }
    setBusy(false);
  };

  const invite = (
    <>
      <Card style={{ backgroundColor: colors.mintSoft, borderColor: '#BFE8D6' }}>
        <Text style={font.small}>Your friend code</Text>
        <View style={styles.codeRow}>
          {(myCode ?? '······').split('').map((ch, i) => (
            <View key={i} style={styles.codeChar}>
              <Text style={styles.codeText}>{ch}</Text>
            </View>
          ))}
        </View>
        <View style={styles.row}>
          <Button
            primary
            label="Share invite link"
            disabled={!myCode}
            style={{ flex: 1 }}
            onPress={async () => {
              if (!myCode) return;
              const r = await shareInvite(myCode);
              setCodeMsg(r === 'copied' ? 'Invite link copied. Paste it in a text!' : r === 'failed' ? 'Couldn’t open sharing. Tell them your code instead.' : null);
            }}
          />
          <Button
            label="Copy code"
            disabled={!myCode}
            onPress={async () => {
              if (!myCode) return;
              const r = await copyText(myCode);
              setCodeMsg(r === 'copied' ? 'Code copied!' : 'Tell your friend this code.');
            }}
          />
        </View>
        {codeMsg ? <Text style={[font.small, { color: colors.mintDark }]}>{codeMsg}</Text> : null}
      </Card>

      <Card>
        <SectionHead title="Add a friend" />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={target}
            onChangeText={(v) => {
              setTarget(v);
              setAddMsg(null);
            }}
            placeholder="Friend code or trainer name"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            returnKeyType="send"
            onSubmitEditing={submit}
            accessibilityLabel="Friend code or trainer name"
          />
          <Button primary label={busy ? 'Adding…' : 'Add'} disabled={busy} onPress={submit} />
        </View>
        {addMsg ? <Text style={[styles.msg, addMsg.ok && styles.ok]}>{addMsg.text}</Text> : null}
      </Card>

    </>
  );

  return (
    <View style={{ gap: space.md }}>
      {(friends.length === 0 || inviteTop) && invite}
      {incoming.length > 0 && (
        <Card style={{ borderColor: colors.peach }}>
          <SectionHead title="Friend requests" meta={`${incoming.length} new`} />
          {incoming.map((r) => (
            <View key={r.id} style={styles.person}>
              <Avatar t={r.from} />
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{r.from.username}</Text>
                <Text style={font.small}>wants to be friends</Text>
              </View>
              <Button small label="Not now" onPress={() => respond(r.id, false)} />
              <Button
                small
                primary
                label="Accept"
                onPress={() => {
                  buzz('success');
                  respond(r.id, true);
                }}
              />
            </View>
          ))}
        </Card>
      )}

      <TeamCard />
      <TradesCard />
      <ArenaCard />

      <Card>
        <SectionHead title="Friends" meta={friends.length ? `🎁 ${giftsLeft} of ${GIFTS_PER_DAY} gifts left today` : undefined} />
        {error ? <Text style={styles.msg}>{error}</Text> : null}
        {!loading && !error && friends.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>👋</Text>
            <Text style={[font.body, { fontWeight: '800', textAlign: 'center' }]}>No friends yet</Text>
            <Text style={[font.small, { textAlign: 'center' }]}>
              Share your invite link with family or friends. You’ll see each other’s pets and streaks, and you can send each other gifts every day.
            </Text>
          </View>
        ) : null}
        {friends.map((f) => (
          <Pressable key={f.id} onPress={() => openFriend(f)} style={({ pressed }) => [styles.person, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={`Open ${f.username}'s profile`}>
            <Avatar t={f} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.personName} numberOfLines={1}>{f.username}</Text>
                {activeToday(f) ? <View style={styles.onlineDot} /> : null}
              </View>
              <Text style={font.small} numberOfLines={1}>
                ▲ {f.card?.streak ?? 0}-day · {lastSeen(f)}
              </Text>
            </View>
            <Button
              small
              primary={!f.giftedToday && giftsLeft > 0}
              label={f.giftedToday ? 'Sent ✓' : '🎁 Gift'}
              disabled={f.giftedToday || giftsLeft === 0}
              onPress={() => {
                buzz('success');
                gift(f.id);
              }}
            />
          </Pressable>
        ))}
        {friends.length > 0 ? <Text style={font.tiny}>Send up to 3 gifts a day, one per friend. Each gift holds 20 coins, and sometimes a surprise chest.</Text> : null}
      </Card>

      {friends.length > 0 && !inviteTop && invite}

      {outgoing.length > 0 && (
        <Card>
          <SectionHead title="Waiting on" meta={`${outgoing.length}`} />
          {outgoing.map((r) => (
            <View key={r.id} style={styles.person}>
              <Avatar t={r.to} />
              <Text style={[styles.personName, { flex: 1 }]}>{r.to.username}</Text>
              <Button small label="Cancel" onPress={() => remove(r.id)} />
            </View>
          ))}
        </Card>
      )}

    </View>
  );
}

function Avatar({ t }: { t: Trainer }) {
  const p = t.card?.active;
  const sp = p ? SPECIES_BY_ID[p.speciesId] : undefined;
  return (
    <View style={styles.avatar}>
      {sp && p ? <PetSprite species={sp} stage={stageFor(p.xp)} size={48} shiny={p.shiny} /> : <Text style={{ fontSize: 24 }}>🥚</Text>}
      {sp && p ? <View style={styles.lv}><Text style={styles.lvText}>{levelFor(p.xp)}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  codeRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginVertical: space.xs },
  codeChar: { width: 40, height: 50, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#BFE8D6', alignItems: 'center', justifyContent: 'center' },
  codeText: { fontSize: 26, fontWeight: '900', color: colors.mintDark },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16, color: colors.ink, backgroundColor: '#FAFCFB' },
  msg: { fontSize: 13, fontWeight: '700', color: '#C4562F' },
  ok: { color: colors.mintDark },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6 },
  personName: { fontWeight: '800', fontSize: 15, color: colors.ink, flexShrink: 1 },
  lv: { position: 'absolute', bottom: 2, right: 2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  lvText: { color: '#fff', fontWeight: '900', fontSize: 10 },
  avatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.sky, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.mint },
  empty: { alignItems: 'center', gap: 4, paddingVertical: space.md, paddingHorizontal: space.sm },
});
