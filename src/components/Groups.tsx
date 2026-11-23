import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Text } from './ScaledText';
import { Button, FitSheet, useSidePad } from './ui';
import { useOverlay } from './Overlay';
import { useOpenChat } from './Chat';
import { buzz } from './fx';
import PetSprite from './PetSprite';
import { PlayerLevel } from './GuildTag';
import { useGame } from '../state/GameContext';
import { accountLevel } from '../game/account';
import { readCard } from '../game/card';
import { SPECIES_BY_ID } from '../game/species';
import { stageFor } from '../game/scoring';
import { colors, font } from '../theme';
import {
  GROUP_LEVEL,
  KINDS,
  MAX_GROUPS,
  createGroup,
  joinGroup,
  kindOf,
  leaveGroup,
  loadGroup,
  setPin,
  useFindGroups,
  useMyGroups,
  type Group,
  type GroupKind,
  type GroupPage,
} from '../lib/groups';

const CREAM = '#F6EFE4';

function KindIcon({ kind, size = 26 }: { kind: GroupKind; size?: number }) {
  const p = { stroke: '#FFFFFF', strokeWidth: 3, fill: 'none', strokeLinecap: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 50 50">
      {kind === 'cafe' ? <Path d="M14 18h20v10a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8zM34 21h3a4 4 0 0 1 0 8h-3" {...p} /> : null}
      {kind === 'club' ? (
        <>
          <Circle cx={28} cy={13} r={3.5} fill="#FFFFFF" />
          <Path d="M20 36l5-9 5 3 2 9M25 27l2-8 6 4 4-1" {...p} />
        </>
      ) : null}
      {kind === 'work' ? (
        <>
          <Rect x={13} y={19} width={24} height={16} rx={3} {...p} />
          <Path d="M20 19v-3h10v3" {...p} />
        </>
      ) : null}
      {kind === 'pets' ? (
        <>
          <Circle cx={25} cy={30} r={6} fill="#FFFFFF" />
          <Circle cx={17} cy={21} r={3} fill="#FFFFFF" />
          <Circle cx={23} cy={16} r={3} fill="#FFFFFF" />
          <Circle cx={30} cy={16} r={3} fill="#FFFFFF" />
          <Circle cx={35} cy={22} r={3} fill="#FFFFFF" />
        </>
      ) : null}
      {kind === 'other' ? <Path d="M25 13l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#FFFFFF" /> : null}
    </Svg>
  );
}

/** A group's round picture: the place's own logo when it has one, otherwise an icon for its kind. */
function Bubble({ kind, size = 46, logo }: { kind: GroupKind; size?: number; logo?: string | null }) {
  return (
    <View style={[styles.bubble, { width: size, height: size, borderRadius: size / 2, backgroundColor: logo ? '#FFFFFF' : kindOf(kind).color, overflow: 'hidden' }]}>
      {logo ? <Image source={{ uri: logo }} style={{ width: size - 4, height: size - 4, borderRadius: size / 2 }} resizeMode="contain" accessibilityIgnoresInvertColors /> : <KindIcon kind={kind} size={size * 0.62} />}
    </View>
  );
}

function GroupRow({ g, onOpen, right }: { g: Group; onOpen: () => void; right?: React.ReactNode }) {
  return (
    <Pressable onPress={onOpen} style={styles.gcard} accessibilityRole="button" accessibilityLabel={`${g.name}, ${g.members} members`}>
      <View style={[styles.cover, { backgroundColor: kindOf(g.kind).color }]} />
      <View style={styles.gbody}>
        <View style={{ marginTop: -20 }}><Bubble kind={g.kind} logo={g.logo} /></View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={styles.gname} numberOfLines={1}>{g.name}</Text>
          <Text style={styles.gmeta} numberOfLines={1}>
            {g.spot ? 'Cafe spot' : kindOf(g.kind).label} · {g.members} member{g.members === 1 ? '' : 's'}
            {g.live ? <Text style={{ color: '#1F9A6E' }}>{` · ${g.live} chatting now`}</Text> : null}
          </Text>
          {g.about ? <Text style={styles.gabout} numberOfLines={2}>{g.about}</Text> : null}
        </View>
        {right}
      </View>
    </Pressable>
  );
}

/** Social › Chat: your groups, with Find and Start buttons. */
export function YourGroups() {
  const groups = useMyGroups();
  const overlay = useOverlay();
  const openGroup = (id: string) => overlay.open(<GroupScreen id={id} onClose={overlay.close} />);
  return (
    <View style={styles.box}>
      <View style={styles.between}>
        <Text style={font.h2}>Groups</Text>
        <Text style={styles.gmeta}>{groups ? `${groups.length} of ${MAX_GROUPS}` : ''}</Text>
      </View>
      <Text style={font.tiny}>Cafes, walking clubs, coworkers, dog walkers. Chat and walk together. Groups don’t change your guild.</Text>
      {groups === null ? <ActivityIndicator color={colors.mintDark} /> : null}
      {groups?.map((g) => (
        <GroupRow key={g.id} g={g} onOpen={() => openGroup(g.id)} />
      ))}
      <Button primary label="Find groups" onPress={() => overlay.open(<GroupsBrowser onClose={overlay.close} onOpen={openGroup} />)} />
    </View>
  );
}

/** Groups near you or popular ones, by kind, with Join; and Start a group. */
export function GroupsBrowser({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => void }) {
  const insets = useSafeAreaInsets();
  const pad = useSidePad();
  const { state } = useGame();
  const [scope, setScope] = useState<'nearby' | 'popular'>('nearby');
  const [kind, setKind] = useState<GroupKind | null>(null);
  const { list, reload } = useFindGroups(scope, kind);
  const mine = useMyGroups();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const lv = accountLevel(state);
  return (
    <View style={[styles.full, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: pad, paddingBottom: insets.bottom + 30, gap: 10 }}>
        <View style={styles.between}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button"><Text style={styles.back}>‹ Back</Text></Pressable>
        </View>
        <Text style={styles.big} accessibilityRole="header">Groups</Text>
        <Text style={styles.gmeta}>Join up to {MAX_GROUPS} · chat and walk together · you’re in {mine?.length ?? 0}</Text>
        <View style={styles.segs}>
          {(['nearby', 'popular'] as const).map((s) => (
            <Pressable key={s} onPress={() => setScope(s)} style={[styles.seg, scope === s && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: scope === s }}>
              <Text style={[styles.segText, scope === s && { color: colors.ink }]}>{s === 'nearby' ? 'Near you' : 'Popular'}</Text>
            </Pressable>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {[{ id: null as GroupKind | null, label: 'All' }, ...KINDS.map((k) => ({ id: k.id as GroupKind | null, label: k.label === 'Cafe' ? 'Cafes' : k.label === 'Club' ? 'Clubs' : k.label }))].map((k) => (
            <Pressable key={k.label} onPress={() => setKind(k.id)} style={[styles.pill, kind === k.id && styles.pillOn]} accessibilityRole="button" accessibilityState={{ selected: kind === k.id }}>
              <Text style={[styles.pillText, kind === k.id && { color: '#FFFFFF' }]}>{k.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {list === null ? <ActivityIndicator color={colors.mintDark} /> : null}
        {list && list.length === 0 ? (
          <Text style={font.small}>{scope === 'nearby' ? 'No groups in your city yet. Set your city in Social › Ranks › Settings, or start the first one.' : 'No groups yet. Start the first one!'}</Text>
        ) : null}
        {list?.map((g) => (
          <GroupRow
            key={g.id}
            g={g}
            onOpen={() => onOpen(g.id)}
            right={
              g.joined ? (
                <View style={styles.joined}><Text style={styles.joinedText}>Joined</Text></View>
              ) : (
                <Button
                  small
                  primary
                  label={busy === g.id ? '…' : 'Join'}
                  disabled={!!busy}
                  onPress={async () => {
                    setBusy(g.id);
                    const r = await joinGroup(g.id);
                    setBusy(null);
                    if (r.ok) {
                      buzz('success');
                      reload();
                    } else setMsg(r.text);
                  }}
                />
              )
            }
          />
        ))}
        {msg ? <Text style={styles.err}>{msg}</Text> : null}
        <View style={styles.box}>
          <Text style={font.h2}>Start a group</Text>
          <Text style={font.tiny}>{lv >= GROUP_LEVEL ? 'For your walking club, coworkers, neighbors or dog park crew.' : `Opens at account level ${GROUP_LEVEL}. You’re level ${lv}. Joining is open now.`}</Text>
          {making ? (
            <CreateGroup
              onDone={(id) => {
                setMaking(false);
                onOpen(id);
              }}
              onCancel={() => setMaking(false)}
            />
          ) : (
            <Button label="Start a group" disabled={lv < GROUP_LEVEL} onPress={() => setMaking(true)} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function CreateGroup({ onDone, onCancel }: { onDone: (id: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [kind, setKind] = useState<GroupKind>('club');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <View style={{ gap: 8 }}>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Group name (like Lake Loop Walkers)" maxLength={24} accessibilityLabel="Group name" />
      <TextInput style={[styles.input, { minHeight: 64 }]} value={about} onChangeText={setAbout} placeholder="One line about it" maxLength={140} multiline accessibilityLabel="About the group" />
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {KINDS.filter((k) => k.id !== 'cafe').map((k) => (
          <Pressable key={k.id} onPress={() => setKind(k.id)} style={[styles.pill, kind === k.id && styles.pillOn]} accessibilityRole="button" accessibilityState={{ selected: kind === k.id }}>
            <Text style={[styles.pillText, kind === k.id && { color: '#FFFFFF' }]}>{k.label}</Text>
          </Pressable>
        ))}
      </View>
      {msg ? <Text style={styles.err}>{msg}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Cancel" onPress={onCancel} style={{ flex: 1 }} />
        <Button
          primary
          label={busy ? 'Starting…' : 'Start group'}
          disabled={busy}
          style={{ flex: 1.4 }}
          onPress={async () => {
            setBusy(true);
            const r = await createGroup(name, about, kind);
            setBusy(false);
            if (r.ok) {
              buzz('success');
              onDone(r.id);
            } else setMsg(r.text);
          }}
        />
      </View>
    </View>
  );
}

/** A group's page: cover, pinned note, and Chat / Steps this week / About. */
export function GroupScreen({ id, onClose }: { id: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const pad = useSidePad();
  const openChat = useOpenChat();
  const [g, setG] = useState<GroupPage | null | undefined>(undefined);
  const [tab, setTab] = useState<'steps' | 'about'>('steps');
  const [pin, setPinText] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = () => loadGroup(id).then(setG);
  useEffect(() => {
    load();
  }, [id]);
  if (g === undefined) return <View style={[styles.full, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={colors.mintDark} /></View>;
  if (g === null)
    return (
      <View style={[styles.full, { padding: 24, paddingTop: insets.top + 24, gap: 12 }]}>
        <Text style={font.h2}>This group isn’t available.</Text>
        <Button label="Back" onPress={onClose} />
      </View>
    );
  const color = kindOf(g.kind).color;
  return (
    <View style={styles.full}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
        <View style={[styles.hero, { backgroundColor: color, paddingTop: insets.top + 10, paddingHorizontal: pad }]}>
          {g.photo ? <Image source={{ uri: g.photo }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
          {g.photo ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,20,20,0.38)' }]} /> : null}
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button"><Text style={[styles.back, { color: '#FFFFFF' }]}>‹ Groups</Text></Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: g.photo ? 110 : 18 }}>
            <Bubble kind={g.kind} size={56} logo={g.logo} />
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName} accessibilityRole="header">{g.name}</Text>
              <Text style={styles.heroMeta}>{g.spot ? 'Cafe spot' : kindOf(g.kind).label}{g.city ? ` · ${g.city}` : ''} · {g.members} member{g.members === 1 ? '' : 's'}</Text>
            </View>
          </View>
        </View>
        <View style={{ paddingHorizontal: pad, paddingTop: 12, gap: 10 }}>
          {g.pinned ? <View style={styles.pinned}><Text style={styles.pinnedText}>Pinned: {g.pinned}</Text></View> : null}
          {g.joined ? (
            <Button primary label={g.live ? `Open chat · ${g.live} chatting now` : 'Open group chat'} onPress={() => openChat(`group:${g.id}`, g.name)} />
          ) : (
            <Button
              primary
              label={busy ? 'Joining…' : 'Join this group'}
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                await joinGroup(g.id);
                setBusy(false);
                buzz('success');
                load();
              }}
            />
          )}
          <View style={styles.segs}>
            {(['steps', 'about'] as const).map((t) => (
              <Pressable key={t} onPress={() => setTab(t)} style={[styles.seg, tab === t && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
                <Text style={[styles.segText, tab === t && { color: colors.ink }]}>{t === 'steps' ? 'Steps this week' : 'About'}</Text>
              </Pressable>
            ))}
          </View>
          {tab === 'steps' ? (
            <View style={styles.box}>
              {g.board.map((m, i) => {
                const c = readCard(m.card);
                const sp = c?.active ? SPECIES_BY_ID[c.active.speciesId] : undefined;
                return (
                  <View key={m.id} style={styles.boardRow}>
                    <Text style={styles.rank}>{i + 1}</Text>
                    <View style={styles.av}>{sp && c?.active ? <PetSprite species={sp} stage={stageFor(c.active.xp)} size={34} skin={c.active.skin} /> : null}</View>
                    <Text style={[styles.gname, { flex: 1 }]} numberOfLines={1}>{m.username}</Text>
                    <PlayerLevel userId={m.id} size={18} />
                    <Text style={styles.steps}>{m.steps.toLocaleString()}</Text>
                  </View>
                );
              })}
              <Text style={font.tiny}>Apple Health steps · resets Monday</Text>
            </View>
          ) : (
            <View style={styles.box}>
              <Text style={font.body}>{g.about || 'No description yet.'}</Text>
              {g.owner ? (
                pin === null ? (
                  <Button small label={g.pinned ? 'Change pinned note' : 'Pin a note'} onPress={() => setPinText(g.pinned ?? '')} />
                ) : (
                  <View style={{ gap: 6 }}>
                    <TextInput style={styles.input} value={pin} onChangeText={setPinText} placeholder="Like: Saturday walk leaves at 9am" maxLength={140} accessibilityLabel="Pinned note" />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Button small label="Cancel" onPress={() => setPinText(null)} style={{ flex: 1 }} />
                      <Button
                        small
                        primary
                        label="Save"
                        style={{ flex: 1 }}
                        onPress={async () => {
                          await setPin(g.id, pin);
                          setPinText(null);
                          load();
                        }}
                      />
                    </View>
                  </View>
                )
              ) : null}
              <Text style={font.tiny}>Be kind. Messages are checked, and you can hold a message to report or block someone. Players reported by 3 people are removed.</Text>
              {g.joined ? (
                <Pressable
                  onPress={async () => {
                    if (!confirmLeave) {
                      setConfirmLeave(true);
                      setTimeout(() => setConfirmLeave(false), 3000);
                      return;
                    }
                    await leaveGroup(g.id);
                    onClose();
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.leave}>{confirmLeave ? 'Tap again to leave' : 'Leave group'}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#FFFCF5', borderRadius: 22, padding: 14, gap: 8 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  full: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: CREAM },
  big: { fontSize: 30, fontWeight: '900', color: colors.ink },
  back: { fontSize: 15, fontWeight: '900', color: colors.mintDark },
  segs: { flexDirection: 'row', backgroundColor: '#EADFCF', borderRadius: 14, padding: 3, gap: 3 },
  seg: { flex: 1, minHeight: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#FFFFFF' },
  segText: { fontSize: 13, fontWeight: '900', color: '#7A6A55' },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: '#FFFFFF' },
  pillOn: { backgroundColor: '#24323A' },
  pillText: { fontSize: 13, fontWeight: '900', color: '#4A5A55' },
  gcard: { backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden' },
  cover: { height: 30 },
  gbody: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingHorizontal: 12, paddingBottom: 12 },
  bubble: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF' },
  gname: { fontSize: 15, fontWeight: '900', color: colors.ink, marginTop: 4 },
  gmeta: { fontSize: 12, fontWeight: '800', color: colors.muted },
  gabout: { fontSize: 12, fontWeight: '700', color: '#4A5A55' },
  joined: { borderWidth: 2, borderColor: colors.mint, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8 },
  joinedText: { fontSize: 12, fontWeight: '900', color: colors.mintDark },
  err: { fontSize: 13, fontWeight: '800', color: '#C4562F' },
  input: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16, color: colors.ink, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E4EEEA' },
  hero: { paddingBottom: 18, overflow: 'hidden' },
  heroTall: {},
  heroName: { fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  heroMeta: { fontSize: 13, fontWeight: '800', color: '#FFF1DE' },
  pinned: { backgroundColor: '#FFF4D6', borderWidth: 2, borderColor: '#F2D58A', borderRadius: 14, padding: 10 },
  pinnedText: { fontSize: 13, fontWeight: '800', color: '#7A5A10' },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rank: { width: 22, textAlign: 'center', fontWeight: '900', color: colors.muted },
  av: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F4F9F6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  steps: { fontSize: 14, fontWeight: '900', color: colors.ink, minWidth: 64, textAlign: 'right' },
  leave: { fontSize: 13, fontWeight: '800', color: colors.muted, textAlign: 'center', textDecorationLine: 'underline', paddingTop: 6 },
});
