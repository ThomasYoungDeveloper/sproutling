import * as A from '../game/actions';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../state/AuthContext';
import { useGame } from '../state/GameContext';
import { Button } from './ui';
import { isMuted, onMuteChange, play, setMuted } from '../lib/sound';
import { useOverlay } from './Overlay';
import PremiumSheet from './PremiumSheet';
import { colors, font, space } from '../theme';
import { useTeam } from '../state/TeamContext';
import { planReminders } from '../game/reminders';
import { getRemindersOn, onRemindersChange, remindersSupported, setRemindersOn } from '../lib/remindersState';

function SoundToggle() {
  const [muted, setM] = useState(isMuted());
  useEffect(() => {
    const off = onMuteChange(setM);
    return () => {
      off();
    };
  }, []);
  return (
    <Pressable
      onPress={() => {
        setMuted(!muted);
        if (muted) setTimeout(() => play('chime'), 50);
      }}
      style={styles.soundRow}
      accessibilityRole="switch"
      accessibilityState={{ checked: !muted }}
      accessibilityLabel="Sound effects"
    >
      <Text style={{ fontSize: 20 }}>{muted ? '🔇' : '🔊'}</Text>
      <Text style={[font.body, { flex: 1, fontWeight: '800' }]}>Sound effects</Text>
      <View style={[styles.switch, !muted && styles.switchOn]}>
        <View style={[styles.knob, !muted && { alignSelf: 'flex-end' }]} />
      </View>
    </Pressable>
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
  const list = on ? planReminders(state, { inGuild: !!team, raidHitsLeft: team?.raid.hits_left }).slice(0, 4) : [];
  const when = (t: number) => new Date(t).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  return (
    <View>
      <Pressable
        onPress={async () => {
          const r = await setRemindersOn(!on);
          setNote(!on && !r ? 'Notifications are off for Sproutling. Turn them on in iPhone Settings › Sproutling.' : null);
        }}
        style={styles.soundRow}
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        accessibilityLabel="Reminders"
      >
        <Text style={{ fontSize: 20 }}>{on ? '🔔' : '🔕'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[font.body, { fontWeight: '800' }]}>Reminders & alerts</Text>
          <Text style={font.tiny}>Streaks, eggs, expeditions, guild raids, plus friend requests, gifts and trades{remindersSupported ? '' : ' · phone app only'}</Text>
        </View>
        <View style={[styles.switch, on && styles.switchOn]}>
          <View style={[styles.knob, on && { alignSelf: 'flex-end' }]} />
        </View>
      </Pressable>
      {note ? <Text style={styles.msg}>{note}</Text> : null}
      {list.length ? (
        <View style={styles.coming}>
          <Text style={[font.tiny, { fontWeight: '900' }]}>Coming up</Text>
          {list.map((r) => (
            <Text key={r.id} style={font.tiny} numberOfLines={1}>
              <Text style={{ fontWeight: '900' }}>{when(r.at)}</Text> · {r.title}
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
    <Pressable onPress={() => overlay.open(<PremiumSheet onClose={overlay.close} />)} style={styles.soundRow} accessibilityRole="button" accessibilityLabel="Sproutling Premium">
      <Text style={{ fontSize: 20 }}>⭐</Text>
      <Text style={[font.body, { flex: 1, fontWeight: '800' }]}>Sproutling Premium</Text>
      <Text style={{ fontWeight: '900', color: '#6E56CF' }}>Coming soon ›</Text>
    </Pressable>
  );
}

export default function AccountSheet({ onClose }: { onClose: () => void }) {
  const { user, username, signOut, saveUsername } = useAuth();
  const { sync, apply, reset } = useGame();
  const [confirmReset, setConfirmReset] = useState(false);
  const [name, setName] = useState(username ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

  const syncLabel = { local: 'Saved on this device', syncing: 'Saving to the cloud…', saved: 'Saved to the cloud', error: 'Couldn’t reach the cloud. We’ll keep trying.' }[sync];

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        {user ? (
          <>
            <Text style={font.h2}>Your account</Text>
            <Text style={font.small}>{user.email}</Text>
            <View style={[styles.status, sync === 'error' && { backgroundColor: '#FFE7DD' }]}>
              <Text style={[font.small, { color: sync === 'error' ? '#C4562F' : colors.mintDark }]}>{syncLabel}</Text>
            </View>
            <Text style={[font.body, { fontWeight: '800', marginTop: space.sm }]}>Trainer name</Text>
            <Text style={font.small}>Friends and guildmates will see this.</Text>
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1 }]} value={name} onChangeText={setName} placeholder="e.g. PixelTom" autoCapitalize="none" maxLength={20} />
              <Button
                primary
                label="Save"
                disabled={busy || !name.trim() || name.trim() === username}
                onPress={async () => {
                  setBusy(true);
                  const r = await saveUsername(name);
                  setMsg(r.error ? { text: r.error } : { text: 'Name saved!', ok: true });
                  setBusy(false);
                }}
              />
            </View>
            {msg ? <Text style={[styles.msg, msg.ok && styles.ok]}>{msg.text}</Text> : null}
            <SoundToggle />
            <RemindersToggle />
            <PremiumRow />
            <View style={styles.testing}>
              <Text style={[font.small, { fontWeight: '900' }]}>Testing (preview build)</Text>
              <View style={[styles.row, { flexWrap: 'wrap' }]}>
                <Button small label="Skip to tomorrow" onPress={() => { apply(A.nextDay); onClose(); }} />
                <Button small label="Replay tutorial" onPress={() => { apply((s) => ({ ...s, tutorialDone: false })); onClose(); }} />
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
            </View>
            <View style={[styles.row, { marginTop: space.md }]}>
              <Button label="Sign out" onPress={signOut} />
              <Button primary label="Done" onPress={onClose} style={{ flex: 1 }} />
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  coming: { backgroundColor: '#F6FAF8', borderRadius: 12, padding: 10, gap: 3, marginTop: 6 },
  soundRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  switch: { width: 46, height: 26, borderRadius: 13, backgroundColor: '#D6DEDA', padding: 3, justifyContent: 'center' },
  switchOn: { backgroundColor: colors.mint },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.55)', justifyContent: 'center', alignItems: 'center', padding: space.lg, zIndex: 50 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: space.lg, gap: space.sm, width: '100%', maxWidth: 420 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16, color: colors.ink, backgroundColor: '#FAFCFB' },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  msg: { fontSize: 13, fontWeight: '700', color: '#C4562F' },
  ok: { color: colors.mintDark },
  testing: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm, gap: 6, marginTop: space.sm },
  status: { backgroundColor: colors.mintSoft, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'flex-start' },
});
