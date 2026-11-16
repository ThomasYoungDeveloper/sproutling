import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../state/AuthContext';
import { useGame } from '../state/GameContext';
import { Button } from './ui';
import { colors, font, space } from '../theme';

export default function AccountSheet({ onClose }: { onClose: () => void }) {
  const { user, username, signOut, saveUsername } = useAuth();
  const { sync } = useGame();
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
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.55)', justifyContent: 'center', alignItems: 'center', padding: space.lg, zIndex: 50 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: space.lg, gap: space.sm, width: '100%', maxWidth: 420 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16, color: colors.ink, backgroundColor: '#FAFCFB' },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  msg: { fontSize: 13, fontWeight: '700', color: '#C4562F' },
  ok: { color: colors.mintDark },
  status: { backgroundColor: colors.mintSoft, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'flex-start' },
});
