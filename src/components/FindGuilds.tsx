import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { Button } from './ui';
import { buzz } from './fx';
import { colors, font, space } from '../theme';
import { supabase } from '../lib/supabase';
import { useTeam } from '../state/TeamContext';

type OpenTeam = { id: string; name: string; emoji: string; code: string; city: string | null; spot_name: string | null; spot: boolean; members: number; active?: number; steps: number };

/** Open guilds near you (your leaderboard city) or the busiest ones this week. */
export default function FindGuilds() {
  const { join } = useTeam();
  const [scope, setScope] = useState<'nearby' | 'popular'>('nearby');
  const [list, setList] = useState<OpenTeam[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    setList(null);
    supabase.rpc('open_teams', { p_scope: scope }).then(({ data }) => setList(((data as OpenTeam[]) ?? [])));
  }, [scope]);
  return (
    <View style={styles.box}>
      <Text style={[font.h2, { color: colors.ink }]}>Find a guild</Text>
      <View style={styles.segs}>
        {(['nearby', 'popular'] as const).map((s) => (
          <Pressable key={s} onPress={() => setScope(s)} style={[styles.seg, scope === s && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: scope === s }}>
            <Text style={[styles.segText, scope === s && { color: colors.ink }]}>{s === 'nearby' ? 'Nearby' : 'Popular'}</Text>
          </Pressable>
        ))}
      </View>
      {list === null ? (
        <ActivityIndicator color={colors.mintDark} />
      ) : list.length === 0 ? (
        <Text style={font.small}>
          {scope === 'nearby' ? 'No open guilds in your city yet. Set your city in Social › Ranks › Settings, or start one and make it Open.' : 'No open guilds yet. Start one and make it Open!'}
        </Text>
      ) : (
        list.map((t) => (
          <View key={t.id} style={styles.row}>
            <Text style={{ fontSize: 24 }}>{t.emoji}</Text>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[font.body, { fontWeight: '900', flexShrink: 1 }]} numberOfLines={1}>{t.name}</Text>
                {t.spot ? <View style={styles.spotTag}><Text style={styles.spotText}>Spot</Text></View> : null}
              </View>
              <Text style={font.tiny}>{t.members} member{t.members === 1 ? '' : 's'}{t.active ? ` · ${t.active} active this week` : ''}</Text>
            </View>
            <Button
              small
              primary
              label={busy === t.id ? 'Joining…' : 'Join'}
              disabled={!!busy}
              onPress={async () => {
                setBusy(t.id);
                const r = await join(t.code);
                setBusy(null);
                if (r.ok) buzz('success');
                else setMsg(r.text);
              }}
            />
          </View>
        ))
      )}
      {msg ? <Text style={{ color: '#C4562F', fontWeight: '800' }}>{msg}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#FFFCF5', borderRadius: 18, padding: space.md, gap: 8 },
  segs: { flexDirection: 'row', backgroundColor: '#E4EEEA', borderRadius: 14, padding: 3, gap: 3 },
  seg: { flex: 1, minHeight: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#FFFFFF' },
  segText: { fontSize: 13, fontWeight: '900', color: '#6A7A75' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F4F9F6', borderRadius: 14, padding: 10 },
  spotTag: { backgroundColor: '#FFE3C2', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  spotText: { fontSize: 11, fontWeight: '900', color: '#8A4A10' },
});
