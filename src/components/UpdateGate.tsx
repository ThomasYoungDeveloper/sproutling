import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { appBuild } from '../lib/appBuild';
import { colors } from '../theme';

type Note = { build: number; title: string; notes: string[] };
const SEEN_KEY = 'sproutling/whats-new-seen';

/**
 * On the phone: if this build is older than the minimum allowed (set in the app_config table),
 * shows a full-screen "Time to update!" with what changed. After an update, shows a one-time
 * "What's new" card. On the web (always up to date) only "What's new" is shown.
 */
export default function UpdateGate({ children }: { children: React.ReactNode }) {
  const [block, setBlock] = useState<{ url: string; notes: Note[] } | null>(null);
  const [whatsNew, setWhatsNew] = useState<Note | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const build = appBuild();
        const [{ data: cfg }, { data: rows }] = await Promise.all([
          supabase.from('app_config').select('min_build, update_url').eq('id', 1).maybeSingle(),
          supabase.from('release_notes').select('build, title, notes').order('build', { ascending: false }).limit(5),
        ]);
        if (cancelled) return;
        const notes = (rows ?? []) as Note[];
        if (build !== null && cfg && build < cfg.min_build) {
          setBlock({ url: cfg.update_url || 'itms-beta://', notes: notes.filter((n) => n.build > build) });
          return;
        }
        // Newest notes this install already has (the web has everything).
        const mine = notes.find((n) => build === null || n.build <= build);
        if (!mine) return;
        const seenRaw = await AsyncStorage.getItem(SEEN_KEY).catch(() => null);
        if (seenRaw === null) {
          // Brand-new players have nothing to compare with: only show "What's new" to people who already played.
          const keys = await AsyncStorage.getAllKeys().catch(() => [] as readonly string[]);
          if (!keys.some((k) => k.startsWith('sproutling/game/'))) {
            await AsyncStorage.setItem(SEEN_KEY, String(mine.build)).catch(() => {});
            return;
          }
        }
        if (mine.build > (Number(seenRaw) || 0)) setWhatsNew(mine);
      } catch {
        // Offline or not set up: never stop someone from playing.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const closeWhatsNew = () => {
    if (whatsNew) AsyncStorage.setItem(SEEN_KEY, String(whatsNew.build)).catch(() => {});
    setWhatsNew(null);
  };

  if (block) {
    return (
      <View style={styles.full}>
        <Text style={styles.big}>🌱</Text>
        <Text style={styles.title}>Time to update!</Text>
        <Text style={styles.body}>A new version of Sproutling is ready. Update to keep playing; your pets and progress are saved.</Text>
        {block.notes.length ? (
          <ScrollView style={styles.notesBox} contentContainerStyle={{ gap: 6 }}>
            {block.notes.map((n) => (
              <View key={n.build} style={{ gap: 4 }}>
                <Text style={styles.noteTitle}>{n.title}</Text>
                {n.notes.map((line, i) => (
                  <Text key={i} style={styles.note}>• {line}</Text>
                ))}
              </View>
            ))}
          </ScrollView>
        ) : null}
        <Pressable onPress={() => Linking.openURL(block.url).catch(() => {})} style={styles.btn} accessibilityRole="button">
          <Text style={styles.btnText}>{block.url.startsWith('itms-beta') ? 'Open TestFlight' : 'Update now'}</Text>
        </Pressable>
        <Text style={styles.hint}>{Platform.OS === 'ios' ? 'In TestFlight, tap Update next to Sproutling.' : 'Install the latest version, then reopen Sproutling.'}</Text>
      </View>
    );
  }

  return (
    <>
      {children}
      {whatsNew ? (
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.kicker}>WHAT'S NEW</Text>
            <Text style={styles.cardTitle}>{whatsNew.title}</Text>
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 8 }}>
              {whatsNew.notes.map((line, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.dot}>✦</Text>
                  <Text style={styles.note}>{line}</Text>
                </View>
              ))}
            </ScrollView>
            <Pressable onPress={closeWhatsNew} style={styles.btn} accessibilityRole="button">
              <Text style={styles.btnText}>Let's play!</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  big: { fontSize: 64 },
  title: { fontSize: 28, fontWeight: '900', color: colors.ink },
  body: { fontSize: 16, fontWeight: '700', color: colors.muted, textAlign: 'center' },
  notesBox: { maxHeight: 280, alignSelf: 'stretch', backgroundColor: '#FFFCF5', borderRadius: 18, padding: 14 },
  noteTitle: { fontSize: 15, fontWeight: '900', color: colors.ink },
  note: { flex: 1, fontSize: 14, fontWeight: '700', color: '#3D4F55', lineHeight: 20 },
  btn: { alignSelf: 'stretch', height: 54, borderRadius: 16, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  btnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  hint: { fontSize: 13, fontWeight: '700', color: colors.muted, textAlign: 'center' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,30,35,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 200 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#FFFCF5', borderRadius: 24, padding: 20, gap: 10 },
  kicker: { fontSize: 12, fontWeight: '900', color: colors.mintDark, letterSpacing: 1 },
  cardTitle: { fontSize: 22, fontWeight: '900', color: colors.ink },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  dot: { fontSize: 14, color: colors.mint, marginTop: 2 },
});
