import * as I from '../game/intro';
import { getLastHealthSync, healthAvailable, nativeHealth } from '../lib/health';
import * as A from '../game/actions';
import { ChatSettings, HelpRows } from './Chat';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from './ScaledText';
import { useAuth } from '../state/AuthContext';
import { useGame } from '../state/GameContext';
import { Button } from './ui';
import { Group, SRow, Switch } from './Settings';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isMuted, onMuteChange, play, setMuted } from '../lib/sound';
import { useOverlay } from './Overlay';
import PremiumSheet from './PremiumSheet';
import { colors, font, space } from '../theme';
import { ReportsScreen, SpotsScreen, useAdmin } from './Admin';
import { useTeam } from '../state/TeamContext';
import { guildReminderOpts, planReminders } from '../game/reminders';
import { getRemindersOn, onRemindersChange, remindersSupported, setRemindersOn } from '../lib/remindersState';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appBuild } from '../lib/appBuild';

function SoundToggle() {
  const [muted, setM] = useState(isMuted());
  useEffect(() => {
    const off = onMuteChange(setM);
    return () => {
      off();
    };
  }, []);
  return (
    <SRow
      icon={muted ? 'volumeOff' : 'volume'}
      title="Sound effects"
      switchOn={!muted}
      onPress={() => {
        setMuted(!muted);
        if (muted) setTimeout(() => play('chime'), 50);
      }}
    />
  );
}

const REMINDER_KINDS: { id: 'evening' | 'trips' | 'eggs' | 'raid'; title: string; sub: string }[] = [
  { id: 'evening', title: 'Evening check-in', sub: 'Only if today’s habits aren’t done yet' },
  { id: 'trips', title: 'Trip is home', sub: 'When your pet gets back' },
  { id: 'eggs', title: 'Eggs', sub: 'Ready to hatch, almost ready, or done nesting' },
  { id: 'raid', title: 'Guild raid', sub: 'Saturday evening, if you still have hits' },
];

function ReminderSettings() {
  const { state, apply } = useGame();
  const prefs = state.reminderPrefs ?? {};
  const hour = prefs.hour ?? 19;
  const set = (patch: NonNullable<typeof state.reminderPrefs>) => apply((s) => ({ ...s, reminderPrefs: { ...s.reminderPrefs, ...patch } }));
  return (
    <View style={styles.coming}>
      <Text style={font.tiny}>Never more than one habit reminder a day.</Text>
      {REMINDER_KINDS.map((k) => {
        const on = prefs[k.id] !== false;
        return (
          <View key={k.id} style={{ gap: 6 }}>
            <Pressable onPress={() => set({ [k.id]: !on })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={k.title}>
              <View style={{ flex: 1 }}>
                <Text style={styles.subTitle}>{k.title}</Text>
                <Text style={font.tiny}>{k.sub}</Text>
              </View>
              <Switch on={on} />
            </Pressable>
            {k.id === 'evening' && on ? (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[18, 19, 20, 21].map((h) => (
                  <Pressable key={h} onPress={() => set({ hour: h })} style={[styles.hourChip, hour === h && styles.hourChipOn]} accessibilityRole="radio" accessibilityState={{ selected: hour === h }}>
                    <Text style={[styles.hourText, hour === h && { color: '#FFFFFF' }]}>{h - 12} pm</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function RemindersToggle() {
  const { state } = useGame();
  const { team } = useTeam();
  const [on, setOn] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    getRemindersOn().then(setOn);
    return onRemindersChange(setOn);
  }, []);
  const list = on ? planReminders(state, guildReminderOpts(team)).slice(0, 4) : [];
  const when = (t: number) => new Date(t).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  return (
    <View>
      <SRow
        icon="bell"
        title="Reminders and alerts"
        sub={`Streaks, eggs, trips, raids, friends and trades${remindersSupported ? '' : ' · phone app only'}`}
        switchOn={on}
        a11y="Reminders"
        onPress={async () => {
          const r = await setRemindersOn(!on);
          setNote(!on && !r ? 'Notifications are off for Sproutling. Turn them on in iPhone Settings › Sproutling.' : null);
        }}
      />
      {note ? <Text style={[styles.msg, { paddingHorizontal: 16, paddingBottom: 10 }]}>{note}</Text> : null}
      {on ? <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}><ReminderSettings /></View> : null}
      {list.length ? (
        <View style={[styles.coming, { marginHorizontal: 16, marginBottom: 12, marginTop: 0 }]}>
          <Text style={[font.tiny, { color: colors.ink }]}>Coming up</Text>
          {list.map((r) => (
            <Text key={r.id} style={font.tiny} numberOfLines={1}>
              <Text style={{ fontWeight: '600', color: colors.ink }}>{when(r.at)}</Text> · {r.title}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PremiumRow() {
  const overlay = useOverlay();
  return (
    <SRow icon="star" tint="#ECE7FB" iconColor="#6E56CF" title="Sproutling Premium" value="Coming soon" chevron onPress={() => overlay.open(<PremiumSheet onClose={overlay.close} />)} />
  );
}

const TEST_KEY = 'sproutling/test-mode';
const appVersion = () => {
  const b = appBuild();
  return `1.0${b ? ` (build ${b})` : ''}`;
};

export default function AccountSheet({ onClose, onTour }: { onClose: () => void; onTour?: () => void }) {
  const adm = useAdmin();
  const [adminPage, setAdminPage] = useState<'reports' | 'spots' | null>(null);
  const { user, username, signOut, saveUsername, deleteAccount } = useAuth();
  const [askDelete, setAskDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const { sync, apply, reset } = useGame();
  const [confirmReset, setConfirmReset] = useState(false);
  const [testMode, setTestModeState] = useState(false);
  const taps = React.useRef(0);
  React.useEffect(() => {
    AsyncStorage.getItem(TEST_KEY).then((v) => setTestModeState(v === '1')).catch(() => {});
  }, []);
  const setTestMode = (on: boolean) => {
    setTestModeState(on);
    AsyncStorage.setItem(TEST_KEY, on ? '1' : '0').catch(() => {});
  };
  const tapVersion = () => {
    taps.current += 1;
    if (taps.current >= 7) {
      taps.current = 0;
      setTestMode(!testMode);
    }
  };
  const [name, setName] = useState(username ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

  const insets = useSafeAreaInsets();
  const syncLabel = { local: 'Saved on this device', syncing: 'Saving to the cloud…', saved: 'Saved to the cloud', error: 'Couldn’t reach the cloud. We’ll keep trying.' }[sync];

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.grab} />
        <View style={styles.topRow}>
          <Text style={font.title}>Account</Text>
          <Pressable onPress={onClose} style={styles.doneBtn} hitSlop={8} accessibilityRole="button">
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ gap: space.xl, paddingBottom: space.lg }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {user ? (
          <>
            <View style={styles.profile}>
              <View style={styles.bigAvatar}><Text style={styles.bigAvatarText}>{(username ?? 'T')[0].toUpperCase()}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={font.h2} numberOfLines={1}>{username ?? 'Trainer'}</Text>
                <Text style={font.small} numberOfLines={1}>{user.email}</Text>
                <View style={styles.syncRow}>
                  <View style={[styles.syncDot, sync === 'error' && { backgroundColor: '#E0703C' }, sync === 'syncing' && { backgroundColor: colors.gold }]} />
                  <Text style={[font.tiny, sync === 'error' && { color: '#C4562F' }]}>{syncLabel}</Text>
                </View>
              </View>
            </View>

            <Group label="Trainer name" note={msg ? undefined : 'Friends and guildmates see this name.'}>
              <View style={styles.nameRow}>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. PixelTom" autoCapitalize="none" maxLength={20} accessibilityLabel="Trainer name" />
                <Pressable
                  disabled={busy || !name.trim() || name.trim() === username}
                  onPress={async () => {
                    setBusy(true);
                    const r = await saveUsername(name);
                    setMsg(r.error ? { text: r.error } : { text: 'Name saved', ok: true });
                    setBusy(false);
                  }}
                  style={({ pressed }) => [styles.saveBtn, (busy || !name.trim() || name.trim() === username) && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.saveText}>{busy ? 'Saving…' : 'Save'}</Text>
                </Pressable>
              </View>
            </Group>
            {msg ? <Text style={[styles.msg, msg.ok && styles.ok, { marginTop: -16, paddingHorizontal: 16 }]}>{msg.text}</Text> : null}

            <GoalSettings />

            <Group label="App">
              <SoundToggle />
              <RemindersToggle />
              {onTour ? <SRow icon="sparkle" tint="#FFF1C9" iconColor="#B86E00" title="See what’s new" chevron onPress={onTour} /> : null}
            </Group>

            <ChatSettings />

            <HelpRows
              extra={[
                <SRow key="p" icon="shield" title="Privacy policy" chevron onPress={() => Linking.openURL('https://sproutling.vercel.app/privacy')} />,
                <SRow key="t" icon="doc" title="Terms" chevron onPress={() => Linking.openURL('https://sproutling.vercel.app/terms')} />,
              ]}
            />

            {adm.admin ? (
              <Group label="Admin" note="Only you see Reports and Spots.">
                <SRow icon="ban" tint="#FBE7E3" iconColor="#C2412D" title="Reports" a11y={`Reports, ${adm.reports} new`} right={adm.reports ? <View style={styles.adminCount}><Text style={styles.adminCountText}>{adm.reports} new</Text></View> : null} chevron onPress={() => setAdminPage('reports')} />
                <SRow icon="compass" title="Spots" a11y={`Spots, ${adm.spots} requests`} right={adm.spots ? <View style={styles.adminCount}><Text style={styles.adminCountText}>{adm.spots} new</Text></View> : null} chevron onPress={() => setAdminPage('spots')} />
              </Group>
            ) : null}

            {/* Premium stays hidden until it's real: Apple rejects "coming soon" features. */}
            {testMode ? (
            <Group label="Testing (preview build)">
              <View style={[styles.row, { flexWrap: 'wrap', padding: 12 }]}>
                <Button small label="Skip to tomorrow" onPress={() => { apply(A.nextDay); onClose(); }} />
                <Button small label="Replay tutorial" onPress={() => { apply((s) => ({ ...s, tutorialDone: false })); onClose(); }} />
                <Button small label="Replay intro" onPress={() => { apply((s) => ({ ...s, onboard: { ...s.onboard, done: false } })); onClose(); }} />
                <Button
                  small
                  label={confirmReset ? 'Tap again to reset' : 'Reset game'}
                  onPress={() => {
                    if (confirmReset) {
                      reset();
                      setConfirmReset(false);
                      onClose();
                    } else {
                      setConfirmReset(true);
                      setTimeout(() => setConfirmReset(false), 3000);
                    }
                  }}
                />
              </View>
              <PremiumRow />
              <SRow title="Hide testing tools" onPress={() => setTestMode(false)} />
            </Group>
            ) : null}

            <Group>
              <SRow icon="logout" tint={colors.tile} iconColor={colors.ink} title="Sign out" onPress={signOut} />
              <SRow title="Delete account" danger onPress={() => { setAskDelete(true); setDeleteErr(null); }} />
            </Group>

            {askDelete ? (
              <View style={styles.danger}>
                <Text style={[font.body, { fontWeight: '700', color: '#A23B1B' }]}>Delete your account for good?</Text>
                <Text style={font.small}>This removes your login, your pets and saved game, friends, trades and guild spot on every device. It can’t be undone.</Text>
                {deleteErr ? <Text style={styles.msg}>{deleteErr}</Text> : null}
                <View style={styles.row}>
                  <Button label="Keep it" onPress={() => setAskDelete(false)} />
                  <Pressable
                    disabled={deleting}
                    style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
                    accessibilityRole="button"
                    onPress={async () => {
                      setDeleting(true);
                      const r = await deleteAccount();
                      setDeleting(false);
                      if (r.error) setDeleteErr(r.error);
                      else onClose();
                    }}
                  >
                    <Text style={styles.deleteText}>{deleting ? 'Deleting…' : 'Delete forever'}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* Testers: tap the version 7 times to show the testing tools (skip a day, reset). */}
            <Pressable onPress={tapVersion} accessibilityRole="text">
              <Text style={styles.version}>Sproutling {appVersion()}</Text>
            </Pressable>
          </>
        ) : null}
        </ScrollView>
      </View>
    {adminPage === 'reports' ? <ReportsScreen onClose={() => setAdminPage(null)} onChange={adm.reload} /> : null}
      {adminPage === 'spots' ? <SpotsScreen onClose={() => setAdminPage(null)} onChange={adm.reload} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  adminCount: { backgroundColor: '#E0567A', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 1 },
  adminCountText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  healthBox: { backgroundColor: colors.tile, borderRadius: 12, padding: 12, gap: 6 },
  hourChip: { flex: 1, borderRadius: 10, backgroundColor: colors.tile, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  hourChipOn: { backgroundColor: colors.mint },
  hourText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  coming: { backgroundColor: colors.tile, borderRadius: 12, padding: 12, gap: 4, marginTop: 6 },
  subTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,28,32,0.45)', justifyContent: 'flex-end', alignItems: 'center', zIndex: 50 },
  sheet: { backgroundColor: '#F2F6F4', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: space.lg, paddingTop: 8, width: '100%', maxWidth: 560, maxHeight: '94%' },
  grab: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: '#CBD5D1', marginBottom: 6 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, marginBottom: 4 },
  doneBtn: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  doneText: { fontSize: 16, fontWeight: '700', color: colors.mintDark },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: '#FFFFFF', borderRadius: 16, padding: space.lg },
  bigAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  bigAvatarText: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.mint },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.lg, paddingRight: 8, minHeight: 52 },
  input: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '500', color: colors.ink, paddingVertical: 12 },
  saveBtn: { minHeight: 36, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  version: { fontSize: 12, fontWeight: '500', color: colors.muted, textAlign: 'center' },
  deleteBtn: { flex: 1, height: 48, borderRadius: 14, backgroundColor: '#D9483B', alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  danger: { backgroundColor: '#FFF1EC', borderRadius: 16, padding: space.lg, gap: 8 },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  msg: { fontSize: 13, fontWeight: '600', color: '#C4562F' },
  ok: { color: colors.mintDark },
});

/**
 * "Check Apple Health": reads today's steps straight from Apple Health and compares them with the game.
 * iPhone never tells apps whether reading was allowed (a "no" just looks like 0 steps), so 0 gets the settings path.
 */
function HealthCheck() {
  const { state } = useGame();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ health: number; game: number } | null>(null);
  const check = async () => {
    const h = nativeHealth();
    if (!h) return;
    setBusy(true);
    await h.requestAccess().catch(() => false);
    const day = await h.readDay(A.todayKey(state)).catch(() => null);
    setBusy(false);
    setRes({ health: day?.steps ?? 0, game: A.today(state).steps ?? 0 });
  };
  const last = getLastHealthSync();
  const ago = last ? Math.max(0, Math.round((Date.now() - last.at) / 60000)) : null;
  return (
    <View style={styles.healthBox}>
      <View style={[styles.row, { alignItems: 'center', justifyContent: 'space-between' }]}>
        <Text style={[styles.subTitle, { flex: 1 }]}>Apple Health</Text>
        <Button small label={busy ? 'Checking…' : 'Check it'} disabled={busy} onPress={check} />
      </View>
      {!res ? (
        <Text style={font.tiny}>{ago === null ? 'Tap Check it to see if your steps are coming in.' : `Last read ${ago === 0 ? 'just now' : `${ago} min ago`}.`}</Text>
      ) : res.health > 0 ? (
        <Text style={[font.small, { color: colors.mintDark }]}>
          Connected. Apple Health has {res.health.toLocaleString()} steps today and Sproutling has {Math.max(res.game, res.health).toLocaleString()}.
        </Text>
      ) : (
        <Text style={[font.small, { color: '#B4532A' }]}>
          Apple Health shows 0 steps today. If you’ve walked with your phone, open the iPhone Settings app, then Health › Data Access & Devices › Sproutling, and turn on Steps.
        </Text>
      )}
    </View>
  );
}

/** Daily step goal, water units, and Apple Health for players who skipped it. */
function GoalSettings() {
  const { state, apply } = useGame();
  const goal = I.stepGoal(state);
  const unit = state.goals?.unit ?? 'oz';
  const skipped = state.onboard?.health === 'skipped';
  const set = (patch: Partial<NonNullable<typeof state.goals>>) =>
    apply((s) => {
      const goals = { steps: I.stepGoal(s), water: I.waterGoal(s), ...s.goals, ...patch };
      const key = A.todayKey(s);
      const d = s.days[key];
      return { ...s, goals, days: d ? { ...s.days, [key]: { ...d, stepGoal: goals.steps, waterGoal: goals.water } } : s.days };
    });
  return (
    <Group label="Daily goals" note={state.goals?.auto ? 'Your step goal moves with you each week: up after good weeks, down after slow ones.' : undefined}>
      <SRow
        icon="steps"
        title="Steps a day"
        right={
          <View style={styles.row}>
            <Button small label="−" onPress={() => set({ steps: I.clampGoal(goal - 500) })} />
            <Text style={[styles.subTitle, { minWidth: 56, textAlign: 'center', fontVariant: ['tabular-nums'] }]}>{goal.toLocaleString()}</Text>
            <Button small label="+" onPress={() => set({ steps: I.clampGoal(goal + 500) })} />
          </View>
        }
      />
      <SRow
        icon="drop"
        tint="#DDEEFB"
        iconColor="#2E7FB8"
        title="Water"
        sub={`${I.waterText(I.waterGoal(state), unit)} a day`}
        right={
          <View style={styles.row}>
            <Button small primary={unit === 'oz'} label="oz" onPress={() => set({ unit: 'oz' })} />
            <Button small primary={unit === 'ml'} label="mL" onPress={() => set({ unit: 'ml' })} />
          </View>
        }
      />
      {!skipped && healthAvailable() ? <View style={{ padding: 12 }}><HealthCheck /></View> : null}
      {skipped && healthAvailable() ? (
        <SRow
          icon="heart"
          tint="#FBE3EA"
          iconColor="#D6456B"
          title="Connect Apple Health"
          chevron
          onPress={async () => {
            const h = nativeHealth();
            if (!h) return;
            await h.requestAccess();
            apply((s) => ({ ...s, onboard: { ...s.onboard, health: 'connected' } }));
          }}
        />
      ) : null}
    </Group>
  );
}
