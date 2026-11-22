import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from './ScaledText';
import { Button, Card, FitSheet } from './ui';
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
import { shareInvite } from '../screens/friendsShared';
import { contactsSupported, findContactFriends, getContactPrefs, normalizePhone, setContactPrefs, type ContactMatch } from '../lib/contactFind';
import { getLast2, getLastCheck, markAsk, setLast2, setLastCheck, shouldAsk, type LastCheck } from '../lib/findMeAsk';

const MINT_BG = '#E3F5EC';
const MINT_INK = '#1F7A58';
const OFF_BG = '#FBE7DC';
const OFF_INK = '#B4532A';
const GREY_BG = '#E9EEEC';
const GREY_INK = '#6A7A75';

function useAdult() {
  const { state } = useGame();
  const y = state.onboard?.birthYear;
  return !!y && !isTeen(y);
}

/** Whether your number is saved and turned on, plus the "ending in 23" digits kept on this phone. */
function useFindMe() {
  const [s, setS] = useState<{ loaded: boolean; hasPhone: boolean; findable: boolean; last2: string | null }>({ loaded: false, hasPhone: false, findable: false, last2: null });
  const refresh = useCallback(async () => {
    const [p, last2] = await Promise.all([getContactPrefs(), getLast2()]);
    setS({ loaded: true, hasPhone: p.hasPhone, findable: p.findable && p.hasPhone, last2: p.hasPhone ? last2 : null });
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { ...s, refresh };
}

/** A status tag and the buttons beside it share one height. */
function Tag({ label, tone }: { label: string; tone: 'on' | 'off' | 'grey' }) {
  const bg = tone === 'on' ? MINT_BG : tone === 'off' ? OFF_BG : GREY_BG;
  const ink = tone === 'on' ? MINT_INK : tone === 'off' ? OFF_INK : GREY_INK;
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: bg }]}>
      <Text style={[styles.pillText, { color: ink }]}>{label}</Text>
    </View>
  );
}
function PillButton({ label, onPress, primary, disabled }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} style={({ pressed }) => [styles.pill, primary ? styles.pillPrimary : styles.pillPlain, (pressed || disabled) && { opacity: 0.7 }]} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}>
      <Text style={[styles.pillText, { color: primary ? '#FFFFFF' : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

function Step({ n, title, sub, children }: { n: number; title: string; sub: string; children?: React.ReactNode }) {
  return (
    <View style={styles.step}>
      <View style={styles.num}>
        <Text style={styles.numText}>{n}</Text>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepSub}>{sub}</Text>
        {children ? <View style={styles.pillRow}>{children}</View> : null}
      </View>
    </View>
  );
}

const checkedLabel = (c: LastCheck) => {
  const d = new Date(c.at);
  return d.toDateString() === new Date().toDateString() ? 'Checked today' : `Checked ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
};
const playsText = (n: number) => (n === 0 ? 'No friends found yet.' : n === 1 ? '1 of your contacts plays.' : `${n} of your contacts play.`);

/** Social tab: two jobs, each with its status. 1. Find friends from your contacts. 2. Let friends find you. */
export function ContactFriendsCard() {
  const overlay = useOverlay();
  const adult = useAdult();
  const findMe = useFindMe();
  const { addFriend, friends, myCode } = useFriends();
  const inviteLink = myCode ? () => shareInvite(myCode) : null;
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ matches: ContactMatch[]; total: number } | null>(null);
  const [last, setLast] = useState<LastCheck | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, string>>({});
  useEffect(() => {
    getLastCheck().then(setLast);
  }, []);
  if (!contactsSupported) return null;
  const friendIds = new Set(friends.map((f) => f.id));

  const check = async () => {
    setChecking(true);
    setErr(null);
    const r = await findContactFriends();
    setChecking(false);
    if ('error' in r) return setErr(r.error);
    const matches = r.matches.filter((m) => !friendIds.has(m.id));
    const c = { at: Date.now(), found: matches.length, total: r.total };
    setResult({ matches, total: r.total });
    setLast(c);
    setLastCheck(c);
    buzz(matches.length ? 'success' : 'light');
  };
  const openTurnOn = () => overlay.open(<TurnOnSheet onClose={overlay.close} onDone={findMe.refresh} />);
  const openManage = () => overlay.open(<ManageSheet onClose={overlay.close} onChanged={findMe.refresh} onChangeNumber={() => { overlay.close(); setTimeout(openTurnOn, 50); }} />);

  const step2 = !adult ? (
    <Step n={2} title="Let friends find you" sub="Friends can’t find players under 18 this way, but you can still find them.">
      <Tag label="Not available under 18" tone="grey" />
    </Step>
  ) : !findMe.loaded ? (
    <Step n={2} title="Let friends find you" sub="Add your number so friends who have it can find you." />
  ) : findMe.findable ? (
    <Step n={2} title="Let friends find you" sub={findMe.last2 ? `Your number ending in ${findMe.last2}.` : 'Your number is saved.'}>
      <Tag label="On" tone="on" />
      <PillButton label="Manage" onPress={openManage} />
    </Step>
  ) : (
    <Step n={2} title="Let friends find you" sub={findMe.hasPhone ? 'Your number is saved but turned off.' : 'Add your number so friends who have it can find you.'}>
      <Tag label="Off" tone="off" />
      <PillButton label="Turn on" onPress={findMe.hasPhone ? openManage : openTurnOn} />
    </Step>
  );

  return (
    <Card>
      <Text style={styles.cardTitle}>Friends from your contacts</Text>
      {result ? (
        <View style={{ gap: 8 }}>
          <View style={[styles.banner, !result.matches.length && { backgroundColor: '#F4F9F6' }]}>
            {result.matches.length ? (
              <View style={styles.tick}>
                <Text style={styles.tickText}>✓</Text>
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>{result.matches.length ? playsText(result.matches.length).replace('.', '') : 'No friends found yet'}</Text>
              <Text style={styles.bannerSub}>
                {`Checked ${result.total} contact${result.total === 1 ? '' : 's'} just now.`}
                {result.matches.length ? '' : ' Friends show up after they turn on “Let friends find you.”'}
              </Text>
            </View>
          </View>
          {result.matches.map((m) => {
            const card = readCard(m.card);
            const pet = card?.active;
            const sp = pet ? SPECIES_BY_ID[pet.speciesId] : null;
            return (
              <View key={m.id} style={styles.match}>
                {sp && pet ? <PetSprite species={sp} stage={stageFor(pet.xp)} size={44} shiny={pet.shiny} /> : <View style={{ width: 44 }} />}
                <View style={{ flex: 1 }}>
                  <Text style={[font.body, { fontWeight: '900' }]}>{m.username}</Text>
                  {pet && sp ? <Text style={font.tiny}>Lv {levelFor(pet.xp)} {pet.nickname}</Text> : null}
                  {sent[m.id] && sent[m.id] !== 'Request sent' ? <Text style={[font.tiny, { color: OFF_INK }]}>{sent[m.id]}</Text> : null}
                </View>
                {sent[m.id] === 'Request sent' ? (
                  <Text style={styles.sentText}>Request sent</Text>
                ) : (
                  <PillButton
                    primary
                    label="Add"
                    onPress={async () => {
                      buzz('light');
                      const r = await addFriend(m.username);
                      setSent((x) => ({ ...x, [m.id]: r.ok ? 'Request sent' : r.text }));
                    }}
                  />
                )}
              </View>
            );
          })}
          {!result.matches.length && inviteLink ? <Button primary label="Share invite link" onPress={inviteLink} style={{ alignSelf: 'stretch' }} /> : null}
          <View style={styles.linkRow}>
            <Pressable onPress={check} disabled={checking} hitSlop={8} accessibilityRole="button">
              <Text style={styles.link}>{checking ? 'Checking…' : 'Check again'}</Text>
            </Pressable>
            {inviteLink && result.matches.length ? (
              <Pressable onPress={inviteLink} hitSlop={8} accessibilityRole="button">
                <Text style={styles.link}>Invite others</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : (
        <Step n={1} title="Find friends" sub={last ? playsText(last.found) : 'See which of your contacts already play.'}>
          {checking ? (
            <View style={[styles.pill, styles.pillPlain, { flexDirection: 'row', gap: 8 }]}>
              <ActivityIndicator size="small" color={MINT_INK} />
              <Text style={styles.pillText}>Checking…</Text>
            </View>
          ) : (
            <>
              <Tag label={last ? checkedLabel(last) : 'Not checked yet'} tone={last ? 'on' : 'grey'} />
              <PillButton primary={!last} label={last ? 'Check again' : 'Check contacts'} onPress={check} />
            </>
          )}
        </Step>
      )}
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {step2}
      <Text style={styles.fine}>Contacts are checked, then forgotten. Your number is never shown.</Text>
    </Card>
  );
}

/** Type your number, tap Turn on, see "You're all set!". Used by the card, Manage and the one-time ask. */
function TurnOnBody({ onDone, onNotNow, ask }: { onDone: () => void; onNotNow: () => void; ask?: boolean }) {
  const adult = useAdult();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const valid = !!normalizePhone(phone);
  const turnOn = async () => {
    const n = normalizePhone(phone);
    if (!n) return setMsg('That doesn’t look like a phone number.');
    setBusy(true);
    setMsg(null);
    const r = await setContactPrefs(phone, true, adult);
    setBusy(false);
    if (r === 'ok') {
      const last2 = n.slice(-2);
      await setLast2(last2);
      if (ask) markAsk('on');
      buzz('success');
      setDone(last2);
    } else if (r === 'taken') setMsg('That number is already on another Sproutling account.');
    else if (r === 'bad') setMsg('That doesn’t look like a phone number.');
    else setMsg('Couldn’t save right now. Try again in a moment.');
  };
  if (done)
    return (
      <View style={{ alignItems: 'center', gap: 10 }}>
        <View style={styles.bigTick}>
          <Text style={styles.bigTickText}>✓</Text>
        </View>
        <Text style={[styles.title, { textAlign: 'center' }]}>You’re all set!</Text>
        <Text style={[styles.body, { textAlign: 'center' }]}>Friends with your number (ending in {done}) can now find you when they check their contacts.</Text>
        <Button primary label="Done" onPress={onDone} style={{ alignSelf: 'stretch', marginTop: 6 }} />
      </View>
    );
  return (
    <View style={{ gap: 12 }}>
      <Text style={[styles.title, ask && { textAlign: 'center' }]}>{ask ? 'Want friends to find you?' : 'Let friends find you'}</Text>
      <Text style={[styles.body, ask && { textAlign: 'center' }]}>
        {ask
          ? 'Add your number and friends who have it in their contacts can send you a friend request. Your number is never shown to anyone.'
          : 'Friends who have your number in their contacts will see your trainer name. Your number is never shown to anyone.'}
      </Text>
      {!ask ? <Text style={[font.small, { fontWeight: '900' }]}>Your phone number</Text> : null}
      <TextInput
        value={phone}
        onChangeText={(t) => {
          setPhone(t);
          setMsg(null);
        }}
        placeholder={ask ? 'Your phone number' : '(555) 555-0123'}
        placeholderTextColor="#9AA7A2"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        style={[styles.input, valid && { borderColor: '#2FB58A' }]}
        accessibilityLabel="Your phone number"
        returnKeyType="done"
        onSubmitEditing={turnOn}
      />
      {msg ? <Text style={styles.err}>{msg}</Text> : null}
      <Button primary label={busy ? 'Turning on…' : 'Turn on'} disabled={busy || !phone.trim()} onPress={turnOn} style={{ alignSelf: 'stretch' }} />
      <Pressable onPress={onNotNow} hitSlop={8} accessibilityRole="button">
        <Text style={styles.notNow}>Not now</Text>
      </Pressable>
    </View>
  );
}

function TurnOnSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  return (
    <View style={styles.backdrop}>
      <FitSheet onClose={onClose}>
        <View style={styles.sheet}>
          <TurnOnBody
            onDone={() => {
              onDone();
              onClose();
            }}
            onNotNow={onClose}
          />
        </View>
      </FitSheet>
    </View>
  );
}

/** The switch, Change number and Remove my number. */
function ManageSheet({ onClose, onChanged, onChangeNumber }: { onClose: () => void; onChanged: () => void; onChangeNumber: () => void }) {
  const adult = useAdult();
  const findMe = useFindMe();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const toggle = async () => {
    setBusy(true);
    const r = await setContactPrefs(null, !findMe.findable, adult);
    setBusy(false);
    if (r !== 'ok') return setMsg('Couldn’t save right now. Try again in a moment.');
    await findMe.refresh();
    onChanged();
    setMsg(findMe.findable ? 'Turned off. Nobody can find you from their contacts.' : 'Turned on. Friends with your number can find you.');
  };
  const remove = async () => {
    setBusy(true);
    const r = await setContactPrefs(null, false, adult, true);
    setBusy(false);
    if (r !== 'ok') return setMsg('Couldn’t remove it right now. Try again in a moment.');
    await setLast2(null);
    onChanged();
    onClose();
  };
  return (
    <View style={styles.backdrop}>
      <FitSheet onClose={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Let friends find you</Text>
          <Text style={styles.body}>{findMe.last2 ? `Your number ending in ${findMe.last2} is saved.` : 'Your number is saved.'} It’s never shown to anyone.</Text>
          <Pressable onPress={toggle} disabled={busy || !findMe.loaded} style={styles.switchRow} accessibilityRole="switch" accessibilityState={{ checked: findMe.findable }} accessibilityLabel="Let friends find you">
            <Text style={[font.body, { fontWeight: '900', flex: 1 }]}>Let friends find you</Text>
            <View style={[styles.switch, findMe.findable && styles.switchOn]}>
              <View style={[styles.knob, findMe.findable && { alignSelf: 'flex-end' }]} />
            </View>
          </Pressable>
          {msg ? <Text style={[font.small, { color: MINT_INK, fontWeight: '800' }]}>{msg}</Text> : null}
          <View style={styles.linkRow}>
            <Pressable onPress={onChangeNumber} hitSlop={8} accessibilityRole="button">
              <Text style={styles.link}>Change number</Text>
            </Pressable>
            <Pressable onPress={remove} disabled={busy} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.link, { color: OFF_INK }]}>Remove my number</Text>
            </Pressable>
          </View>
          <Button label="Done" onPress={onClose} style={{ alignSelf: 'stretch' }} />
        </View>
      </FitSheet>
    </View>
  );
}

/**
 * The one-time "Want friends to find you?" pop-up. Shows only for players 18+ who haven't turned it on,
 * never in the same session as What's New. "Not now" asks once more in two weeks, then never.
 */
export function FindMeAsk({ where }: { where: 'open' | 'social' }) {
  const { state } = useGame();
  const adult = useAdult();
  const [show, setShow] = useState(false);
  const tutorialDone = !!state.tutorialDone;
  useEffect(() => {
    if (!contactsSupported || !adult) return;
    let cancelled = false;
    // Wait a moment so What's New (which loads from the internet) gets first say.
    const t = setTimeout(async () => {
      const p = await getContactPrefs();
      if (cancelled || p.findable) return;
      if (await shouldAsk(where, tutorialDone)) {
        if (!cancelled) setShow(true);
      }
    }, where === 'open' ? 4000 : 1200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [adult, where]);
  if (!show) return null;
  const later = () => {
    markAsk('later');
    setShow(false);
  };
  const pets = state.pets.slice(0, 3);
  return (
    <View style={[styles.backdrop, { zIndex: 260 }]}>
      <FitSheet onClose={later} center>
        <View style={styles.askCard}>
          <View style={styles.askPets}>
            {pets.map((p, i) => {
              const sp = SPECIES_BY_ID[p.speciesId];
              return sp ? <PetSprite key={p.id} species={sp} stage={stageFor(p.xp)} size={i === 1 ? 84 : 66} shiny={p.shiny} skin={p.skin} /> : null;
            })}
          </View>
          <TurnOnBody ask onDone={() => setShow(false)} onNotNow={later} />
        </View>
      </FitSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 20, fontWeight: '900', color: colors.ink },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: '#F4F9F6', borderRadius: 18, padding: 12 },
  num: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#DDF1E7', alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 17, fontWeight: '900', color: MINT_INK },
  stepTitle: { fontSize: 17, fontWeight: '900', color: colors.ink },
  stepSub: { fontSize: 13, fontWeight: '700', color: GREY_INK, lineHeight: 18 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  pill: { minHeight: 36, paddingHorizontal: 14, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pillPrimary: { backgroundColor: colors.mint, borderColor: colors.mint },
  pillPlain: { backgroundColor: '#FFFFFF', borderColor: '#DDE6E2' },
  pillText: { fontSize: 14, fontWeight: '900', color: colors.ink },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: MINT_BG, borderRadius: 16, padding: 12 },
  bannerTitle: { fontSize: 16, fontWeight: '900', color: colors.ink },
  bannerSub: { fontSize: 12, fontWeight: '800', color: '#3D6B58' },
  tick: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  tickText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  match: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F4F9F6', borderRadius: 16, padding: 10 },
  sentText: { fontSize: 14, fontWeight: '900', color: MINT_INK },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  link: { fontSize: 14, fontWeight: '900', color: MINT_INK },
  fine: { fontSize: 12, fontWeight: '700', color: '#8A9590', textAlign: 'center' },
  err: { fontSize: 13, fontWeight: '800', color: '#C4562F' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.55)', zIndex: 120 },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 36, gap: 12, width: '100%', maxWidth: 560, alignSelf: 'center' },
  askCard: { width: '90%', maxWidth: 400, backgroundColor: '#FFFCF5', borderRadius: 26, padding: 22, gap: 6 },
  askPets: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 4, marginBottom: 4 },
  title: { fontSize: 23, fontWeight: '900', color: colors.ink },
  body: { fontSize: 15, fontWeight: '700', color: GREY_INK, lineHeight: 21 },
  input: { height: 52, borderRadius: 14, borderWidth: 2, borderColor: '#DDE6E2', backgroundColor: '#FFFFFF', paddingHorizontal: 14, fontSize: 18, fontWeight: '800', color: colors.ink },
  notNow: { fontSize: 15, fontWeight: '900', color: GREY_INK, textAlign: 'center', paddingVertical: 4 },
  bigTick: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', borderWidth: 10, borderColor: '#DDF1E7', marginTop: 6 },
  bigTickText: { color: '#FFFFFF', fontSize: 38, fontWeight: '900' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  switch: { width: 50, height: 30, borderRadius: 15, backgroundColor: '#D5DEDA', padding: 3 },
  switchOn: { backgroundColor: colors.mint },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' },
});
