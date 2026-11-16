import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTeam, type TeamMember } from '../state/TeamContext';
import { Button, Card, ProgressBar } from './ui';
import PetSprite from './PetSprite';
import { buzz, Confetti, PopIn } from './fx';
import { colors, font, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { stageFor } from '../game/scoring';
import { TEAM_EMOJIS } from '../game/team';
import { copyText } from '../screens/friendsShared';

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
        {sp && p ? <PetSprite species={sp} stage={stageFor(p.xp)} size={40} shiny={p.shiny} hat={p.hat} /> : <Text style={{ fontSize: 20 }}>🥚</Text>}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.memberName} numberOfLines={1}>{m.username}{m.me ? ' (you)' : ''}</Text>
          {m.role === 'leader' ? <Text style={styles.leader}>👑</Text> : null}
        </View>
        <ProgressBar value={top ? m.steps / top : 0} height={7} color={m.me ? colors.mint : '#8FC9F0'} />
      </View>
      <Text style={styles.memberSteps}>{m.steps.toLocaleString()}</Text>
    </View>
  );
}

export default function TeamCard() {
  const { team, loading, create, join, leave, claim } = useTeam();
  const [mode, setMode] = useState<'none' | 'create' | 'join'>('none');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(TEAM_EMOJIS[0]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [party, setParty] = useState(0);

  if (loading) return null;

  if (!team) {
    return (
      <Card style={styles.card}>
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <Text style={{ fontSize: 34 }}>🏡</Text>
          <View style={{ flex: 1 }}>
            <Text style={[font.h2, { color: '#fff' }]}>Family team</Text>
            <Text style={[font.small, { color: '#DDF4EA' }]}>Walk together toward a weekly goal. Everyone gets a team chest!</Text>
          </View>
        </View>
        {mode === 'none' ? (
          <View style={styles.row}>
            <Button primary label="Start a team" style={{ flex: 1 }} onPress={() => setMode('create')} />
            <Button label="Join with a code" style={{ flex: 1 }} onPress={() => setMode('join')} />
          </View>
        ) : mode === 'create' ? (
          <View style={{ gap: space.sm }}>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Team name (like The Youngs)" maxLength={24} accessibilityLabel="Team name" />
            <View style={styles.emojis}>
              {TEAM_EMOJIS.map((e) => (
                <Pressable key={e} onPress={() => setEmoji(e)} style={[styles.emoji, emoji === e && styles.emojiOn]} accessibilityRole="button" accessibilityLabel={`Team badge ${e}`}>
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.row}>
              <Button label="Back" onPress={() => setMode('none')} />
              <Button
                primary
                label={busy ? 'Creating…' : 'Create team'}
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
            <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="Team code" autoCapitalize="characters" maxLength={6} accessibilityLabel="Team code" />
            <View style={styles.row}>
              <Button label="Back" onPress={() => setMode('none')} />
              <Button
                primary
                label={busy ? 'Joining…' : 'Join team'}
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
        </View>
        <Pressable
          onPress={async () => {
            const r = await copyText(team.code);
            setMsg({ ok: true, text: r === 'copied' ? `Code ${team.code} copied! Send it to your family.` : `Your team code is ${team.code}.` });
          }}
          style={styles.code}
          accessibilityRole="button"
          accessibilityLabel={`Team code ${team.code}, tap to copy`}
        >
          <Text style={styles.codeLabel}>CODE</Text>
          <Text style={styles.codeText}>{team.code}</Text>
        </Pressable>
      </View>

      <View style={styles.goalBox}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.goalTitle}>{superReached ? '🌟 Super goal reached!' : reached ? '🎉 Weekly goal reached!' : 'This week’s goal'}</Text>
          <Text style={styles.goalNum}>{team.total.toLocaleString()} / {(reached ? team.goal * 2 : team.goal).toLocaleString()}</Text>
        </View>
        <View style={{ position: 'relative' }}>
          <ProgressBar value={pct} height={16} color={superReached ? colors.gold : colors.mint} />
          <View style={[styles.marker, { left: '50%' }]}><Text style={styles.markerText}>🎁</Text></View>
          <View style={[styles.marker, { right: -4 }]}><Text style={styles.markerText}>🌟</Text></View>
        </View>
        <Text style={font.tiny}>Goal: {team.goal.toLocaleString()} steps for a Silver chest each. Super goal: {(team.goal * 2).toLocaleString()} for a Gold chest each.</Text>
        {canGoal || canSuper ? (
          <View style={styles.row}>
            {canGoal ? (
              <PopIn>
                <Button primary label="🎁 Open Silver chest" onPress={() => open('goal')} />
              </PopIn>
            ) : null}
            {canSuper ? (
              <PopIn>
                <Button primary label="🌟 Open Gold chest" onPress={() => open('super')} />
              </PopIn>
            ) : null}
          </View>
        ) : null}
      </View>

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
        <Text style={styles.leave}>{confirmLeave ? 'Tap again to leave the team' : 'Leave team'}</Text>
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
  goalBox: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: space.md, gap: 8 },
  goalTitle: { fontWeight: '900', fontSize: 15, color: colors.ink },
  goalNum: { fontWeight: '800', fontSize: 13, color: colors.muted },
  marker: { position: 'absolute', top: -6, marginLeft: -12 },
  markerText: { fontSize: 18 },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 6 },
  avatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  memberName: { fontWeight: '900', fontSize: 14, color: '#FFFFFF', flexShrink: 1 },
  leader: { fontSize: 12 },
  memberSteps: { fontWeight: '900', fontSize: 14, color: '#FFFFFF', minWidth: 60, textAlign: 'right' },
  leave: { fontSize: 12, fontWeight: '800', color: '#BFE8D6', textAlign: 'center', textDecorationLine: 'underline', paddingTop: 4 },
});
