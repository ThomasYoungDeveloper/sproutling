import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { FitSheet, Button } from './ui';
import CrestArt from './CrestArt';
import { COLORS, PATTERNS, SHAPES, SYMBOLS, TRIMS, VIBES, readCrest, type Crest } from '../game/crest';
import { supabase } from '../lib/supabase';
import { buzz } from './fx';

const GOLD = '#F2C14E';

function Tile({ on, locked, onPress, children, label }: { on: boolean; locked?: number; onPress: () => void; children: React.ReactNode; label: string }) {
  return (
    <Pressable onPress={locked ? undefined : onPress} style={[styles.tile, on && styles.tileOn, !!locked && { opacity: 0.45 }]} accessibilityRole="button" accessibilityState={{ selected: on, disabled: !!locked }} accessibilityLabel={locked ? `${label}, opens at guild level ${locked}` : label}>
      {children}
      {locked ? <Text style={styles.lock}>Lv {locked}</Text> : null}
    </Pressable>
  );
}

/** Leader only: build the guild's crest from parts, and pick the guild's vibe. */
export default function CrestMaker({ start, vibe: startVibe, guildLevel, onClose, onSaved }: { start: unknown; vibe?: string | null; guildLevel: number; onClose: () => void; onSaved: () => void }) {
  const [c, setC] = useState<Crest>(readCrest(start));
  const [vibe, setVibe] = useState<string | null>(startVibe ?? null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (p: Partial<Crest>) => setC((x) => ({ ...x, ...p }));
  const save = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('set_team_crest', { p_crest: c, p_vibe: vibe });
    setBusy(false);
    if (!error && data === 'ok') {
      buzz('success');
      onSaved();
      onClose();
    } else setMsg(data === 'locked' ? 'That border isn’t unlocked yet.' : 'Couldn’t save the crest. Try again.');
  };
  return (
    <View style={styles.backdrop}>
      <FitSheet onClose={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title} accessibilityRole="header">Make your crest</Text>
          <View style={styles.preview}><CrestArt crest={c} size={128} id="maker" /></View>
          <Text style={styles.label}>Shape</Text>
          <View style={styles.row}>
            {SHAPES.map((s) => (
              <Tile key={s} on={c.shape === s} onPress={() => set({ shape: s })} label={s}>
                <CrestArt crest={{ ...c, shape: s, symbol: 'none' }} size={34} id={`s${s}`} />
              </Tile>
            ))}
          </View>
          <Text style={styles.label}>Main color</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {COLORS.map((col) => (
              <Pressable key={col} onPress={() => set({ c1: col })} style={[styles.swatch, { backgroundColor: col }, c.c1 === col && styles.swatchOn]} accessibilityRole="button" accessibilityLabel={`Main color ${col}`} accessibilityState={{ selected: c.c1 === col }} />
            ))}
          </ScrollView>
          <Text style={styles.label}>Accent color</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {COLORS.map((col) => (
              <Pressable key={col} onPress={() => set({ c2: col })} style={[styles.swatch, { backgroundColor: col }, c.c2 === col && styles.swatchOn]} accessibilityRole="button" accessibilityLabel={`Accent color ${col}`} accessibilityState={{ selected: c.c2 === col }} />
            ))}
          </ScrollView>
          <Text style={styles.label}>Pattern</Text>
          <View style={styles.row}>
            {PATTERNS.map((p) => (
              <Tile key={p} on={c.pattern === p} onPress={() => set({ pattern: p })} label={p}>
                <CrestArt crest={{ ...c, pattern: p, symbol: 'none' }} size={34} id={`p${p}`} />
              </Tile>
            ))}
          </View>
          <Text style={styles.label}>Symbol</Text>
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {SYMBOLS.map((s) => (
              <Tile key={s.id} on={c.symbol === s.id} locked={guildLevel < s.level ? s.level : undefined} onPress={() => set({ symbol: s.id })} label={s.label}>
                <CrestArt crest={{ ...c, symbol: s.id }} size={34} id={`y${s.id}`} />
              </Tile>
            ))}
          </View>
          <Text style={styles.label}>Border</Text>
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {TRIMS.map((t) => {
              const locked = guildLevel < t.level;
              return (
                <Pressable key={t.id} onPress={locked ? undefined : () => set({ trim: t.id })} style={[styles.chip, c.trim === t.id && { backgroundColor: GOLD }, locked && { opacity: 0.45 }]} accessibilityRole="button" accessibilityState={{ selected: c.trim === t.id, disabled: locked }}>
                  <View style={[styles.dot, { backgroundColor: t.color }]} />
                  <Text style={[styles.chipText, c.trim === t.id && { color: '#4A3200' }]}>{locked ? `${t.label} · Lv ${t.level}` : t.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.label}>Guild vibe</Text>
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {VIBES.map((v) => (
              <Pressable key={v.id} onPress={() => setVibe(v.id)} style={[styles.chip, vibe === v.id && { backgroundColor: GOLD }]} accessibilityRole="button" accessibilityState={{ selected: vibe === v.id }}>
                <Text style={[styles.chipText, vibe === v.id && { color: '#4A3200' }]}>{v.label}</Text>
              </Pressable>
            ))}
          </View>
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
          <View style={[styles.row, { marginTop: 4 }]}>
            <Button label="Cancel" onPress={onClose} style={{ flex: 1 }} />
            <Button primary label={busy ? 'Saving…' : 'Save crest'} disabled={busy} onPress={save} style={{ flex: 1.4 }} />
          </View>
        </View>
      </FitSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,14,30,0.6)' },
  sheet: { backgroundColor: '#1E2547', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 8, width: '100%', maxWidth: 560, alignSelf: 'center' },
  title: { fontSize: 26, fontWeight: '900', color: '#FFF6D8' },
  preview: { alignItems: 'center', paddingVertical: 6 },
  label: { fontSize: 13, fontWeight: '900', color: '#B9C2E8', marginTop: 4 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  tile: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#2A3366', borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  tileOn: { borderColor: GOLD, backgroundColor: '#3A4590' },
  lock: { position: 'absolute', bottom: 1, right: 3, fontSize: 9, fontWeight: '900', color: GOLD },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: 'transparent' },
  swatchOn: { borderColor: '#FFF6D8' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: '#2A3366' },
  chipText: { fontSize: 13, fontWeight: '900', color: '#C9D3FF' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  msg: { fontSize: 13, fontWeight: '800', color: '#FFB9A6' },
});
