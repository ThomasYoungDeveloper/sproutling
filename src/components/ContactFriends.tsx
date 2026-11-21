import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from './ScaledText';
import { Button, Card, FitSheet, SectionHead } from './ui';
import PetSprite from './PetSprite';
import { useGame } from '../state/GameContext';
import { useFriends } from '../state/FriendsContext';
import { useOverlay } from './Overlay';
import { colors, font } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { levelFor, stageFor } from '../game/scoring';
import { readCard } from '../game/card';
import { isTeen } from '../game/intro';
import { buzz } from './fx';
import { contactsSupported, findContactFriends, getContactPrefs, setContactPrefs, type ContactMatch } from '../lib/contactFind';

/** Friends tab: see which contacts already play. Contacts are scrambled on the phone and never saved. */
export function ContactFriendsCard() {
  const overlay = useOverlay();
  const { addFriend, friends } = useFriends();
  const [state, setState] = useState<'idle' | 'checking' | 'done'>('idle');
  const [matches, setMatches] = useState<ContactMatch[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, string>>({});
  if (!contactsSupported) return null;
  const friendIds = new Set(friends.map((f) => f.id));
  const check = async () => {
    setState('checking');
    setErr(null);
    const r = await findContactFriends();
    if ('error' in r) {
      setErr(r.error);
      setState('idle');
      return;
    }
    setMatches(r.matches.filter((m) => !friendIds.has(m.id)));
    setState('done');
  };
  return (
    <Card>
      <SectionHead title="Find friends from your contacts" />
      {state !== 'done' ? (
        <>
          <Text style={font.small}>See which of your contacts already play. Your contacts are checked and then forgotten. Only people who turned on “Let friends find me” show up, and only their trainer name and pet.</Text>
          <Button primary label={state === 'checking' ? 'Checking…' : 'Check my contacts'} disabled={state === 'checking'} onPress={check} />
        </>
      ) : matches.length === 0 ? (
        <Text style={font.small}>None of your contacts have turned on “Let friends find me” yet. Share your invite link instead!</Text>
      ) : (
        <View style={{ gap: 8 }}>
          <Text style={[font.small, { fontWeight: '900' }]}>{matches.length === 1 ? '1 contact plays Sproutling' : `${matches.length} contacts play Sproutling`}</Text>
          {matches.map((m) => {
            const card = readCard(m.card);
            const pet = card?.active;
            const sp = pet ? SPECIES_BY_ID[pet.speciesId] : null;
            return (
              <View key={m.id} style={styles.match}>
                {sp && pet ? <PetSprite species={sp} stage={stageFor(pet.xp)} size={44} shiny={pet.shiny} /> : <View style={{ width: 44 }} />}
                <View style={{ flex: 1 }}>
                  <Text style={[font.body, { fontWeight: '900' }]}>{m.username}</Text>
                  {pet && sp ? <Text style={font.tiny}>Lv {levelFor(pet.xp)} · {pet.nickname}</Text> : null}
                  {sent[m.id] ? <Text style={[font.tiny, { color: colors.mintDark }]}>{sent[m.id]}</Text> : null}
                </View>
                <Button
                  small
                  primary={!sent[m.id]}
                  label={sent[m.id] ? 'Sent' : 'Add'}
                  disabled={!!sent[m.id]}
                  onPress={async () => {
                    buzz('light');
                    const r = await addFriend(m.username);
                    setSent((x) => ({ ...x, [m.id]: r.ok ? 'Request sent' : r.text }));
                  }}
                />
              </View>
            );
          })}
        </View>
      )}
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Pressable onPress={() => overlay.open(<FindMeSheet onClose={overlay.close} />)} hitSlop={6} accessibilityRole="button">
        <Text style={styles.link}>Let friends find me</Text>
      </Pressable>
    </Card>
  );
}

/** Your number and the "Let friends find me" switch. Teens can search but can't be found. */
export function FindMeSheet({ onClose }: { onClose: () => void }) {
  const { state } = useGame();
  const birthYear = state.onboard?.birthYear;
  const adult = !!birthYear && !isTeen(birthYear);
  const [loaded, setLoaded] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [findable, setFindable] = useState(false);
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getContactPrefs().then((p) => {
      setHasPhone(p.hasPhone);
      setFindable(p.findable);
      setLoaded(true);
    });
  }, []);
  const save = async (nextFindable: boolean, newPhone: string | null) => {
    setBusy(true);
    setMsg(null);
    // Keep the saved number unless a new one was typed (the phone never stores it in plain text).
    const r = await setContactPrefs(newPhone, nextFindable, adult);
    setBusy(false);
    if (r === 'ok') {
      setFindable(nextFindable);
      if (newPhone) {
        setHasPhone(true);
        setPhone('');
      }
      setMsg(nextFindable ? 'Saved. Friends who have your number or email can find you.' : 'Saved. Nobody can find you from their contacts.');
    } else if (r === 'taken') setMsg('That number is already on another Sproutling account.');
    else if (r === 'bad') setMsg('That doesn’t look like a phone number.');
    else setMsg('Couldn’t save right now. Try again.');
  };
  return (
    <View style={styles.backdrop}>
      <FitSheet onClose={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Let friends find me</Text>
          <Text style={font.small}>People who have your number or email in their contacts can find your trainer name. Neither is ever shown, and we only keep a scrambled version.</Text>
          {!adult ? (
            <Text style={[font.small, { fontWeight: '900', color: '#9C4C77' }]}>Players under 18 can’t be found this way, but you can still check your contacts for friends.</Text>
          ) : !loaded ? null : (
            <>
              <Text style={[font.small, { fontWeight: '900' }]}>Your phone number {hasPhone ? '(saved)' : '(optional)'}</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder={hasPhone ? 'Type a new number to change it' : '(555) 555-0123'}
                keyboardType="phone-pad"
                style={styles.input}
                accessibilityLabel="Your phone number"
              />
              <Pressable onPress={() => save(!findable, phone.trim() || null)} disabled={busy} style={styles.row} accessibilityRole="switch" accessibilityState={{ checked: findable }}>
                <Text style={[font.body, { fontWeight: '900', flex: 1 }]}>Let friends find me</Text>
                <View style={[styles.switch, findable && styles.switchOn]}><View style={[styles.knob, findable && { alignSelf: 'flex-end' }]} /></View>
              </Pressable>
              {phone.trim() ? <Button primary label={busy ? 'Saving…' : 'Save number'} disabled={busy} onPress={() => save(true, phone.trim())} /> : null}
            </>
          )}
          {adult && hasPhone ? (
            <Pressable onPress={async () => { await setContactPrefs(null, findable, adult, true); setHasPhone(false); setMsg('Your number was removed.'); }} hitSlop={6} accessibilityRole="button">
              <Text style={styles.link}>Remove my number</Text>
            </Pressable>
          ) : null}
          {msg ? <Text style={[font.small, { color: colors.mintDark, fontWeight: '800' }]}>{msg}</Text> : null}
          <Button label="Done" onPress={onClose} />
        </View>
      </FitSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  match: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F6FAF8', borderRadius: 16, padding: 10 },
  err: { fontSize: 13, fontWeight: '800', color: '#C4562F' },
  link: { fontSize: 14, fontWeight: '900', color: colors.mintDark, textAlign: 'center', paddingTop: 4 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.55)', zIndex: 120 },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 36, gap: 12 },
  title: { fontSize: 22, fontWeight: '900', color: colors.ink },
  input: { height: 50, borderRadius: 14, borderWidth: 2, borderColor: colors.line, paddingHorizontal: 14, fontSize: 17, fontWeight: '800', color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  switch: { width: 50, height: 30, borderRadius: 15, backgroundColor: '#D5DEDA', padding: 3 },
  switchOn: { backgroundColor: colors.mint },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' },
});
