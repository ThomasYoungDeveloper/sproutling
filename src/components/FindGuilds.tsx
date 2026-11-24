import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { Button } from './ui';
import { buzz } from './fx';
import { colors, font, space } from '../theme';
import { supabase } from '../lib/supabase';
import { useTeam } from '../state/TeamContext';
import CrestArt from './CrestArt';
import { readCrest, vibeLabel } from '../game/crest';

type OpenTeam = { id: string; name: string; emoji: string; code: string; city: string | null; spot_name: string | null; spot: boolean; members: number; active?: number; steps: number; crest?: unknown; vibe?: string | null; level?: number };

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
      <View style={styles.segs}>
        {(['nearby', 'popular'] as const).map((s) => (
          <Pressable key={s} onPress={() => setScope(s)} style={[styles.seg, scope === s && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: scope === s }}>
            <Text style={[styles.segText, scope === s && { color: '#4A3200' }]}>{s === 'nearby' ? 'Nearby' : 'Popular'}</Text>
          </Pressable>
        ))}
      </View>
      {list === null ? (
        <ActivityIndicator color="#F2C14E" />
      ) : list.length === 0 ? (
        <Text style={[font.small, { color: '#B9C2E8' }]}>
          {scope === 'nearby' ? 'No open guilds in your city yet. Set your city in Social › Ranks › Settings, or start one and make it Open.' : 'No open guilds yet. Start one and make it Open!'}
        </Text>
      ) : (
        list.map((t) => (
          <View key={t.id} style={styles.row}>
            <CrestArt crest={readCrest(t.crest)} size={48} id={t.id} />
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.name} numberOfLines={1}>{t.name}</Text>
                <View style={styles.lv}><Text style={styles.lvText}>Lv {t.level ?? 1}</Text></View>
              </View>
              <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap' }}>
                {t.spot ? <View style={styles.spotTag}><Text style={styles.spotText}>Cafe</Text></View> : null}
                {vibeLabel(t.vibe) ? <View style={styles.tag}><Text style={styles.tagText}>{vibeLabel(t.vibe)}</Text></View> : null}
              </View>
              <Text style={styles.meta}>{t.members} member{t.members === 1 ? '' : 's'}{t.active ? ` · ${t.active} active this week` : ''}</Text>
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
      {msg ? <Text style={{ color: '#FFB9A6', fontWeight: '800' }}>{msg}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8 },
  segs: { flexDirection: 'row', backgroundColor: '#2A3366', borderRadius: 14, padding: 3, gap: 3 },
  seg: { flex: 1, minHeight: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#F2C14E' },
  segText: { fontSize: 13, fontWeight: '600', color: '#B9C2E8' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#2A3366', borderRadius: 16, padding: 10, borderWidth: 2, borderColor: '#3D4785' },
  name: { fontSize: 16, fontWeight: '700', color: '#FFF6D8', flexShrink: 1 },
  lv: { backgroundColor: '#F2C14E', borderRadius: 7, paddingHorizontal: 6, paddingVertical: 1 },
  lvText: { fontSize: 11, fontWeight: '600', color: '#4A3200' },
  tag: { backgroundColor: '#3D4785', borderRadius: 7, paddingHorizontal: 6, paddingVertical: 1 },
  tagText: { fontSize: 11, fontWeight: '600', color: '#C9D3FF' },
  meta: { fontSize: 11, fontWeight: '600', color: '#B9C2E8' },
  spotTag: { backgroundColor: '#FFE3C2', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  spotText: { fontSize: 11, fontWeight: '600', color: '#8A4A10' },
});
