import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from './ScaledText';
import { useTeam, type TeamMember } from '../state/TeamContext';
import { Button, Card, ProgressBar } from './ui';
import PetSprite from './PetSprite';
import { buzz, Confetti, PopIn } from './fx';
import { colors, font, space } from '../theme';
import ChestIcon from './ChestIcon';
import RankTag from './RankTag';
import FindGuilds from './FindGuilds';
import { supabase } from '../lib/supabase';
import { shortNumber } from '../lib/shortNumber';
import { SPECIES_BY_ID } from '../game/species';
import { stageFor } from '../game/scoring';
import { TEAM_EMOJIS, raidBoss, RAID_HITS_PER_DAY } from '../game/team';
import { copyText, shareGuildInvite } from '../screens/friendsShared';

function daysLeftInWeek(): number {
  const d = new Date().getUTCDay();
  return d === 0 ? 1 : 8 - d;
}

function MemberRow({ m, top }: { m: TeamMember; top: number }) {
  const p = m.card?.active;
  const sp = p ? SPECIES_BY_ID[p.speciesId] : undefined;
  return (
    <View style={styles.member}>
      <View style={styles.avatar}>
        {sp && p ? <PetSprite species={sp} stage={stageFor(p.xp)} size={40} shiny={p.shiny} skin={p.skin} hat={p.hat} aura={p.aura} /> : <Text style={{ fontSize: 20 }}>🥚</Text>}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.memberName} numberOfLines={1}>{m.username}{m.me ? ' (you)' : ''}</Text>
          <RankTag userId={m.id} small />
          {m.role === 'leader' ? <Text style={styles.leader}>👑</Text> : null}
        </View>
        <ProgressBar value={top ? m.steps / top : 0} height={7} color={m.me ? colors.mint : '#8FC9F0'} />
      </View>
      <Text style={styles.memberSteps}>{m.steps.toLocaleString()}</Text>
    </View>
  );
}

function RaidBox({ onWin, onMsg }: { onWin: () => void; onMsg: (m: { ok: boolean; text: string }) => void }) {
  const { team, claimRaid } = useTeam();
  if (!team) return null;
  const boss = raidBoss(team.week);
  const sp = SPECIES_BY_ID[boss.speciesId];
  const { hp, damage, hits_left } = team.raid;
  const left = Math.max(0, hp - damage);
  const beaten = left === 0;
  const claimed = team.claimed.includes('raid');
  const mine = team.members.find((m) => m.me)?.raid ?? 0;
  return (
    <View style={styles.raidBox}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={[styles.bossArt, beaten && { opacity: 0.45 }]}>
          {sp ? <PetSprite species={sp} stage="adult" size={78} /> : null}
          {beaten ? <Text style={styles.bossKo}>KO!</Text> : null}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.raidLabel}>WEEKLY GUILD BOSS</Text>
          <Text style={styles.bossName} numberOfLines={1}>{boss.name}</Text>
          <Text style={styles.bossTitle}>{boss.title}</Text>
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.raidHp}>{beaten ? 'Defeated!' : `${left.toLocaleString()} / ${hp.toLocaleString()} HP`}</Text>
          <Text style={styles.raidMine}>You: {mine.toLocaleString()} dmg</Text>
        </View>
        <ProgressBar value={hp ? left / hp : 0} height={14} color="#E5484D" />
      </View>
      <Text style={styles.raidHelp}>
        {beaten
          ? claimed
            ? 'Your guild beat this week’s boss. A new one appears Monday!'
            : 'Your guild beat the boss! Everyone gets a Gold chest and 150 coins.'
          : 'Walk to beat the boss: every 10 steps your guild takes is 1 damage.'}
      </Text>
      {beaten && !claimed ? (
        <PopIn>
          <Button
            primary
            label="Claim raid loot"
            onPress={async () => {
              const r = await claimRaid();
              onMsg(r);
              if (r.ok) {
                buzz('success', 'win');
                onWin();
              }
            }}
          />
        </PopIn>
      ) : null}
    </View>
  );
}

export default function TeamCard({ initialJoin, onUsedInitialJoin }: { initialJoin?: string | null; onUsedInitialJoin?: () => void } = {}) {
  const { team, loading, create, rename, join, leave, claim, refresh } = useTeam();
  const [mode, setMode] = useState<'none' | 'create' | 'join'>('none');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(TEAM_EMOJIS[0]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [party, setParty] = useState(0);

  // Opened from a friend's guild invite link: open the join form with their code.
  useEffect(() => {
    if (!initialJoin || loading) return;
    if (team) setMsg({ ok: false, text: team.code === initialJoin ? 'You’re already in this guild!' : 'You’re already in a guild. Leave it first to join your friend’s.' });
    else {
      setMode('join');
      setCode(initialJoin);
    }
    onUsedInitialJoin?.();
  }, [initialJoin, loading]);

  if (loading) return null;

  if (!team) {
    return (
      <Card style={styles.card}>
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <Text style={{ fontSize: 34 }}>🛡️</Text>
          <View style={{ flex: 1 }}>
            <Text style={[font.h2, { color: '#fff' }]}>Guilds</Text>
            <Text style={[font.small, { color: '#DDF4EA' }]}>Join forces with friends toward a weekly step goal. Everyone gets a guild chest!</Text>
          </View>
        </View>
        {mode === 'none' ? (
          <>
            <View style={styles.row}>
              <Button primary label="Start a guild" style={{ flex: 1 }} onPress={() => setMode('create')} />
              <Button label="Join with a code" style={{ flex: 1 }} onPress={() => setMode('join')} />
            </View>
            <FindGuilds />
          </>
        ) : mode === 'create' ? (
          <View style={{ gap: space.sm }}>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Guild name (like Morning Walkers)" maxLength={16} accessibilityLabel="Guild name" />
            <View style={styles.emojis}>
              {TEAM_EMOJIS.map((e) => (
                <Pressable key={e} onPress={() => setEmoji(e)} style={[styles.emoji, emoji === e && styles.emojiOn]} accessibilityRole="button" accessibilityLabel={`Guild badge ${e}`}>
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.row}>
              <Button label="Back" onPress={() => setMode('none')} />
              <Button
                primary
                label={busy ? 'Creating…' : 'Create guild'}
                disabled={busy}
                style={{ flex: 1 }}
                onPress={async () => {
                  setBusy(true);
                  const r = await create(name, emoji);
                  setBusy(false);
                  setMsg(r);
                  if (r.ok) buzz('success');
                }}
              />
            </View>
          </View>
        ) : (
          <View style={{ gap: space.sm }}>
            <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="Guild code" autoCapitalize="characters" maxLength={6} accessibilityLabel="Guild code" />
            <View style={styles.row}>
              <Button label="Back" onPress={() => setMode('none')} />
              <Button
                primary
                label={busy ? 'Joining…' : 'Join guild'}
                disabled={busy}
                style={{ flex: 1 }}
                onPress={async () => {
                  setBusy(true);
                  const r = await join(code);
                  setBusy(false);
                  setMsg(r);
                  if (r.ok) buzz('success');
                }}
              />
            </View>
          </View>
        )}
        {msg ? <Text style={[styles.msg, msg.ok && { color: '#DDF4EA' }]}>{msg.text}</Text> : null}
      </Card>
    );
  }

  const top = Math.max(1, ...team.members.map((m) => m.steps));
  const reached = team.total >= team.goal;
  const superReached = team.total >= team.goal * 2;
  const canGoal = reached && !team.claimed.includes('goal');
  const canSuper = superReached && !team.claimed.includes('super');
  const pct = Math.min(1, team.total / (team.goal * 2));

  const open = async (tier: 'goal' | 'super') => {
    const r = await claim(tier);
    setMsg(r);
    if (r.ok) {
      buzz('success');
      setParty((p) => p + 1);
    }
  };

  return (
    <Card style={styles.card}>
      {party ? <Confetti key={party} amount={50} width={400} height={500} /> : null}
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
        <View style={styles.crest}><Text style={{ fontSize: 28 }}>{team.emoji}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={[font.h2, { color: '#fff' }]} numberOfLines={1}>{team.name}</Text>
          <Text style={[font.small, { color: '#DDF4EA' }]}>{team.members.length} member{team.members.length === 1 ? '' : 's'} · {daysLeftInWeek()} day{daysLeftInWeek() === 1 ? '' : 's'} left this week</Text>
          {team.members.find((m) => m.me)?.role === 'leader' && renaming === null ? (
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <Pressable onPress={() => setRenaming(team.name)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Rename the guild">
                <Text style={styles.renameLink}>Rename guild</Text>
              </Pressable>
              {!team.spot ? (
                <Pressable
                  onPress={async () => {
                    const { data } = await supabase.rpc('set_team_open', { p_open: !team.open, p_city: null });
                    if (data === 'ok') {
                      setMsg({ ok: true, text: !team.open ? 'Your guild is Open: players can find it in Find a guild.' : 'Your guild is Invite only now.' });
                      refresh();
                    }
                  }}
                  hitSlop={8}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: !!team.open }}
                >
                  <Text style={styles.renameLink}>{team.open ? 'Open to anyone' : 'Invite only'}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={async () => {
            const r = await copyText(team.code);
            setMsg({ ok: true, text: r === 'copied' ? `Code ${team.code} copied! Share it with friends to invite them.` : `Your guild code is ${team.code}.` });
          }}
          style={styles.code}
          accessibilityRole="button"
          accessibilityLabel={`Guild code ${team.code}, tap to copy`}
        >
          <Text style={styles.codeLabel}>CODE</Text>
          <Text style={styles.codeText}>{team.code}</Text>
        </Pressable>
      </View>

      {renaming !== null ? (
        <View style={styles.renameBox}>
          <TextInput
            value={renaming}
            onChangeText={setRenaming}
            maxLength={16}
            autoFocus
            placeholder="Guild name"
            placeholderTextColor="#9AA7A2"
            style={styles.renameInput}
            accessibilityLabel="New guild name"
            returnKeyType="done"
          />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button small label="Cancel" onPress={() => setRenaming(null)} style={{ flex: 1 }} />
            <Button
              small
              primary
              label={busy ? 'Saving…' : 'Save name'}
              disabled={busy || renaming.trim().length < 2 || renaming.trim() === team.name}
              onPress={async () => {
                setBusy(true);
                const r = await rename(renaming);
                setBusy(false);
                setMsg(r);
                if (r.ok) {
                  buzz('success');
                  setRenaming(null);
                }
              }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : null}

      <Button
        label="Invite friends to the guild"
        onPress={async () => {
          const r = await shareGuildInvite(team.code, team.name);
          if (r === 'copied') setMsg({ ok: true, text: 'Invite link copied! Paste it in a text or group chat.' });
          else if (r === 'failed') setMsg({ ok: true, text: `Send friends your guild code: ${team.code}` });
        }}
      />

      <View style={styles.goalBox}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.goalTitle}>{superReached ? 'Super goal reached!' : reached ? 'Weekly goal reached!' : 'This week’s goal'}</Text>
          <Text style={styles.goalNum}>{team.total.toLocaleString()} / {(reached ? team.goal * 2 : team.goal).toLocaleString()}</Text>
        </View>
        <View style={{ position: 'relative' }}>
          <ProgressBar value={pct} height={16} color={superReached ? colors.gold : colors.mint} />
          <View style={[styles.marker, { left: '50%' }]}><ChestIcon kind="silver" size={26} /></View>
          <View style={[styles.marker, { right: -4 }]}><ChestIcon kind="gold" size={26} /></View>
        </View>
        <Text style={font.tiny}>Silver chest at {shortNumber(team.goal)} steps · Gold at {shortNumber(team.goal * 2)}</Text>
        {canGoal || canSuper ? (
          <View style={styles.row}>
            {canGoal ? (
              <PopIn>
                <Button primary label="Open Silver chest" onPress={() => open('goal')} />
              </PopIn>
            ) : null}
            {canSuper ? (
              <PopIn>
                <Button primary label="Open Gold chest" onPress={() => open('super')} />
              </PopIn>
            ) : null}
          </View>
        ) : null}
      </View>

      <RaidBox onWin={() => setParty((p) => p + 1)} onMsg={setMsg} />

      <View style={{ gap: 6 }}>
        {team.members.map((m) => (
          <MemberRow key={m.id} m={m} top={top} />
        ))}
      </View>
      {msg ? <Text style={[styles.msg, msg.ok && { color: '#DDF4EA' }]}>{msg.text}</Text> : null}
      <Pressable
        onPress={async () => {
          if (!confirmLeave) {
            setConfirmLeave(true);
            setTimeout(() => setConfirmLeave(false), 3000);
            return;
          }
          await leave();
        }}
        accessibilityRole="button"
      >
        <Text style={styles.leave}>{confirmLeave ? 'Tap again to leave the guild' : 'Leave guild'}</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1E8A68', borderColor: '#1E8A68', overflow: 'hidden' },
  row: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  input: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16, color: colors.ink, backgroundColor: '#FFFFFF' },
  emojis: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  emoji: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  emojiOn: { backgroundColor: '#FFFFFF' },
  msg: { fontSize: 13, fontWeight: '800', color: '#FFE0D1' },
  crest: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  code: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center' },
  codeLabel: { fontSize: 9, fontWeight: '900', color: colors.muted, letterSpacing: 1 },
  codeText: { fontSize: 16, fontWeight: '900', color: colors.mintDark, letterSpacing: 1.5 },
  raidBox: { backgroundColor: '#2A1E3D', borderRadius: 16, padding: space.md, gap: 8 },
  bossArt: { width: 86, height: 86, borderRadius: 18, backgroundColor: '#463066', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bossKo: { position: 'absolute', fontSize: 26, fontWeight: '900', color: '#FFD84D', transform: [{ rotate: '-12deg' }] },
  raidLabel: { fontSize: 12, fontWeight: '900', color: '#C9B4F2', letterSpacing: 1 },
  bossName: { fontSize: 19, fontWeight: '900', color: '#FFFFFF' },
  bossTitle: { fontSize: 13, fontWeight: '700', color: '#C9B4F2' },
  raidHp: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  raidMine: { fontSize: 12, fontWeight: '800', color: '#C9B4F2' },
  raidHelp: { fontSize: 12, fontWeight: '700', color: '#DCD0F2' },
  goalBox: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: space.md, gap: 8 },
  goalTitle: { fontWeight: '900', fontSize: 15, color: colors.ink },
  goalNum: { fontWeight: '800', fontSize: 13, color: colors.muted },
  marker: { position: 'absolute', top: -6, marginLeft: -12 },
  markerText: { fontSize: 18 },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 6 },
  avatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  memberName: { fontWeight: '900', fontSize: 14, color: '#FFFFFF', flexShrink: 1 },
  leader: { fontSize: 12 },
  renameLink: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', textDecorationLine: 'underline', marginTop: 2 },
  renameBox: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: space.sm, gap: space.sm },
  renameInput: { height: 46, borderRadius: 12, borderWidth: 2, borderColor: '#DDE6E2', paddingHorizontal: 12, fontSize: 17, fontWeight: '800', color: colors.ink },
  memberSteps: { fontWeight: '900', fontSize: 14, color: '#FFFFFF', minWidth: 60, textAlign: 'right' },
  leave: { fontSize: 12, fontWeight: '800', color: '#BFE8D6', textAlign: 'center', textDecorationLine: 'underline', paddingTop: 4 },
});
