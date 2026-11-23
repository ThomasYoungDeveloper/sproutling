import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from './ScaledText';
import { Button, Card, FitSheet } from './ui';
import PetSprite from './PetSprite';
import RankTag from './RankTag';
import GuildTag from './GuildTag';
import { useGame } from '../state/GameContext';
import { useOverlay } from './Overlay';
import { colors, font, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { stageFor } from '../game/scoring';
import * as A from '../game/actions';
import * as Team from '../game/team';
import { healthProvider, isVerified } from '../lib/health';
import { citySuggestions, loadBoard, saveRankPrefs, type Board, type RankScope } from '../lib/ranks';
import { supabase } from '../lib/supabase';

const SCOPES: { id: RankScope; label: string }[] = [
  { id: 'friends', label: 'Friends' },
  { id: 'guild', label: 'Guild' },
  { id: 'city', label: 'City' },
  { id: 'everyone', label: 'Everyone' },
];

const MEDAL: Record<number, { bg: string; fg: string }> = {
  1: { bg: '#F7C948', fg: '#8A5A00' },
  2: { bg: '#D6DEE6', fg: '#4A5866' },
  3: { bg: '#E8A87C', fg: '#7A3E12' },
};

/** Social › Ranks: this week's steps (Apple Health only) with friends, your guild, your city and everyone. */
export default function RanksCard() {
  const { state } = useGame();
  const overlay = useOverlay();
  const [scope, setScope] = useState<RankScope>('friends');
  const [board, setBoard] = useState<Board | null>(null);
  const [busy, setBusy] = useState(true);
  const week = Team.weekStart(A.todayKey(state));
  const verified = isVerified(healthProvider());

  const load = useCallback(async () => {
    setBusy(true);
    setBoard(await loadBoard(scope, week));
    setBusy(false);
  }, [scope, week]);
  useEffect(() => {
    load();
  }, [load]);

  const openSettings = () => overlay.open(<RankSettings onClose={overlay.close} onSaved={load} />);
  const rows = board?.rows ?? [];
  const mine = board?.mine;
  const meInTop = rows.some((r) => r.me);

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[font.h2, { flex: 1 }]}>This week’s steps</Text>
        <Pressable onPress={openSettings} hitSlop={8} accessibilityRole="button">
          <Text style={styles.link}>Settings</Text>
        </Pressable>
      </View>
      <View style={styles.segs}>
        {SCOPES.map((s) => (
          <Pressable key={s.id} onPress={() => setScope(s.id)} style={[styles.seg, scope === s.id && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: scope === s.id }}>
            <Text style={[styles.segText, scope === s.id && { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={font.tiny}>
        {scope === 'city' && board?.city ? `${board.city} · ` : ''}Resets Monday · Apple Health steps only
      </Text>
      {!verified ? (
        <View style={styles.note}>
          <Text style={font.small}>Connect Apple Health on your iPhone to join the leaderboards.</Text>
        </View>
      ) : null}
      {scope === 'city' && !board?.city && !busy ? (
        <View style={styles.note}>
          <Text style={font.small}>Pick your city to see who’s walking near you.</Text>
          <Button small primary label="Pick my city" onPress={openSettings} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : busy ? (
        <ActivityIndicator color={colors.mintDark} style={{ marginVertical: space.lg }} />
      ) : rows.length === 0 ? (
        <Text style={[font.small, { textAlign: 'center', marginVertical: space.md }]}>No steps here yet this week. Be the first!</Text>
      ) : (
        <View style={{ gap: 6 }}>
          {rows.slice(0, 25).map((r) => (
            <Row key={r.id} r={r} />
          ))}
          {!meInTop && mine ? (
            <>
              <Text style={{ textAlign: 'center', color: '#8A9590', fontWeight: '900' }}>· · ·</Text>
              <Row r={{ id: 'me', place: mine.place, steps: mine.steps, username: 'You', card: null, me: true }} />
            </>
          ) : null}
          {mine && mine.next ? (
            <Text style={styles.next}>
              {(mine.next - mine.steps + 1).toLocaleString()} steps to pass #{mine.place - 1}
            </Text>
          ) : mine && mine.place === 1 ? (
            <Text style={styles.next}>You’re in first place!</Text>
          ) : null}
        </View>
      )}
      <Text style={font.tiny}>Last week’s top 3 in your city or everywhere get a gold, silver or bronze title next to their name, and places 4 to 10 a Top 10 title, all week.</Text>
    </Card>
  );
}

function Row({ r }: { r: Board['rows'][number] }) {
  const pet = r.card?.active;
  const sp = pet ? SPECIES_BY_ID[pet.speciesId] : null;
  const medal = MEDAL[r.place];
  return (
    <View style={[styles.row, r.me && { backgroundColor: '#E3F5EC' }]}>
      {medal ? (
        <View style={[styles.medal, { backgroundColor: medal.bg }]}>
          <Text style={[styles.medalText, { color: medal.fg }]}>{r.place}</Text>
        </View>
      ) : (
        <Text style={styles.place}>{r.place}</Text>
      )}
      {sp && pet ? <PetSprite species={sp} stage={stageFor(pet.xp)} size={36} shiny={pet.shiny} skin={pet.skin} /> : <View style={{ width: 36 }} />}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[font.body, { fontWeight: '900' }]} numberOfLines={1}>
          {r.username}
          {r.me && r.username !== 'You' ? ' (you)' : ''}
        </Text>
        {r.id !== 'me' ? <GuildTag userId={r.id} small /> : null}
        {r.id !== 'me' ? <RankTag userId={r.id} small /> : null}
      </View>
      <Text style={styles.steps}>{r.steps.toLocaleString()}</Text>
    </View>
  );
}

function RankSettings({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [city, setCity] = useState('');
  const [hidden, setHidden] = useState(false);
  const [suggest, setSuggest] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: sess }) => {
      const id = sess.session?.user.id;
      if (!id) return;
      supabase
        .from('profiles')
        .select('city, lb_hidden')
        .eq('id', id)
        .single()
        .then(({ data }) => {
        if (data) {
          setCity((data as any).city ?? '');
          setHidden(!!(data as any).lb_hidden);
        }
        });
    });
  }, []);
  useEffect(() => {
    const t = setTimeout(async () => setSuggest(await citySuggestions(city)), 300);
    return () => clearTimeout(t);
  }, [city]);
  const save = async () => {
    setBusy(true);
    const ok = await saveRankPrefs(city.trim() || null, hidden);
    setBusy(false);
    if (!ok) return setMsg('Couldn’t save right now. Try again in a moment.');
    onSaved();
    onClose();
  };
  return (
    <View style={styles.backdrop}>
      <FitSheet onClose={onClose}>
        <View style={styles.sheet}>
          <Text style={font.title}>Leaderboard settings</Text>
          <Text style={[font.small, { fontWeight: '900' }]}>Your city</Text>
          <TextInput value={city} onChangeText={setCity} placeholder="e.g. Orlando" placeholderTextColor="#9AA7A2" style={styles.input} autoCapitalize="words" maxLength={40} accessibilityLabel="Your city" />
          {suggest.filter((c) => c.toLowerCase() !== city.trim().toLowerCase()).length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {suggest
                .filter((c) => c.toLowerCase() !== city.trim().toLowerCase())
                .map((c) => (
                  <Pressable key={c} onPress={() => setCity(c)} style={styles.chip} accessibilityRole="button">
                    <Text style={styles.chipText}>{c}</Text>
                  </Pressable>
                ))}
            </View>
          ) : null}
          <Text style={font.tiny}>Only the city name is used, never your location.</Text>
          <Pressable onPress={() => setHidden((h) => !h)} style={styles.switchRow} accessibilityRole="switch" accessibilityState={{ checked: hidden }}>
            <View style={{ flex: 1 }}>
              <Text style={[font.body, { fontWeight: '900' }]}>Hide me from City and Everyone</Text>
              <Text style={font.tiny}>Friends and your guild can still see your steps.</Text>
            </View>
            <View style={[styles.switch, hidden && styles.switchOn]}>
              <View style={[styles.knob, hidden && { alignSelf: 'flex-end' }]} />
            </View>
          </Pressable>
          {msg ? <Text style={{ color: '#C4562F', fontWeight: '800' }}>{msg}</Text> : null}
          <Button primary label={busy ? 'Saving…' : 'Save'} disabled={busy} onPress={save} style={{ alignSelf: 'stretch' }} />
        </View>
      </FitSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: 14, fontWeight: '900', color: colors.mintDark },
  segs: { flexDirection: 'row', backgroundColor: '#E4EEEA', borderRadius: 14, padding: 3, gap: 3 },
  seg: { flex: 1, minHeight: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segOn: { backgroundColor: '#FFFFFF' },
  segText: { fontSize: 13, fontWeight: '900', color: '#6A7A75' },
  note: { backgroundColor: '#F4F9F6', borderRadius: 14, padding: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F4F9F6', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8 },
  medal: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  medalText: { fontWeight: '900', fontSize: 15 },
  place: { width: 30, textAlign: 'center', fontWeight: '900', color: '#6A7A75' },
  steps: { fontSize: 15, fontWeight: '900', color: colors.ink },
  next: { fontSize: 13, fontWeight: '900', color: colors.mintDark },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.55)', zIndex: 120 },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 36, gap: 10, width: '100%', maxWidth: 560, alignSelf: 'center' },
  input: { height: 50, borderRadius: 14, borderWidth: 2, borderColor: '#DDE6E2', paddingHorizontal: 14, fontSize: 17, fontWeight: '800', color: colors.ink },
  chip: { backgroundColor: '#E3F5EC', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: '900', color: colors.mintDark },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  switch: { width: 50, height: 30, borderRadius: 15, backgroundColor: '#D5DEDA', padding: 3 },
  switchOn: { backgroundColor: '#2FB58A' },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' },
});
