import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import QRCode from 'qrcode';
import { Text } from './ScaledText';
import { Button, useSidePad } from './ui';
import { buzz } from './fx';
import { supabase } from '../lib/supabase';
import { colors, font } from '../theme';

/** Your account only: is this the admin account, and how many reports and Spot requests are waiting. */
export function useAdmin(): { admin: boolean; reports: number; spots: number; reload: () => void } {
  const [v, setV] = useState<{ reports: number; spots: number } | null>(null);
  const reload = () => {
    supabase.rpc('admin_counts').then(({ data }) => setV(data ? { reports: (data as any).reports ?? 0, spots: (data as any).spots ?? 0 } : null));
  };
  useEffect(reload, []);
  return { admin: !!v, reports: v?.reports ?? 0, spots: v?.spots ?? 0, reload };
}

function Page({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const pad = useSidePad();
  return (
    <View style={styles.full}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: pad, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button"><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
        {children}
      </ScrollView>
    </View>
  );
}

const Chip = ({ text, tone = 'soft' }: { text: string; tone?: 'soft' | 'warn' | 'bad' }) => (
  <View style={[styles.chip, tone === 'warn' && { backgroundColor: '#FFE3DA' }, tone === 'bad' && { backgroundColor: '#B4532A' }]}>
    <Text style={[styles.chipText, tone === 'warn' && { color: '#B4532A' }, tone === 'bad' && { color: '#FFFFFF' }]}>{text}</Text>
  </View>
);

const ago = (at: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(at).getTime()) / 60000));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

type Report = { message_id: number; room_name: string; body: string; sender: string; sender_name: string; sender_level: number | null; sender_joined: string; hidden_until: string | null; reasons: string[]; reporters: number; at: string; week_reports: number };

/** Account › Reports: reported Plaza, group and chat messages, newest first, with what to do about each. */
export function ReportsScreen({ onClose, onChange }: { onClose: () => void; onChange?: () => void }) {
  const [list, setList] = useState<Report[] | null>(null);
  const [open, setOpen] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => supabase.rpc('admin_reports', { p_reviewed: false }).then(({ data }) => setList((data as Report[]) ?? []));
  useEffect(() => {
    load();
  }, []);
  const act = async (r: Report, action: string) => {
    setBusy(true);
    await supabase.rpc('admin_report_action', { p_message: r.message_id, p_sender: r.sender, p_action: action });
    setBusy(false);
    buzz('success');
    setOpen(null);
    load();
    onChange?.();
  };
  const hidden = (r: Report) => !!r.hidden_until && new Date(r.hidden_until).getTime() > Date.now();
  const card = (r: Report, tap: boolean) => (
    <Pressable key={r.message_id} disabled={!tap} onPress={() => setOpen(r)} style={styles.card} accessibilityRole={tap ? 'button' : undefined}>
      <View style={styles.chips}>
        <Chip text={r.room_name} />
        <Chip text={`${r.reporters} report${r.reporters === 1 ? '' : 's'}`} tone={r.reporters >= 3 ? 'warn' : 'soft'} />
        {hidden(r) ? <Chip text="Hidden" tone="bad" /> : null}
        <View style={{ flex: 1 }} />
        <Text style={styles.time}>{ago(r.at)}</Text>
      </View>
      <Text style={styles.name}>{r.sender_name}</Text>
      <View style={styles.quote}><Text style={styles.quoteText}>“{r.body}”</Text></View>
      <Text style={styles.meta}>Reason: {r.reasons.filter(Boolean).join(', ') || 'Not given'}</Text>
    </Pressable>
  );
  if (open) {
    const r = open;
    return (
      <Page title="Report" onClose={() => setOpen(null)}>
        {card(r, false)}
        <View style={styles.card}>
          <Text style={styles.name}>{r.sender_name}</Text>
          <Text style={styles.meta}>
            Level {r.sender_level ?? 1} · joined {ago(r.sender_joined)} · {r.week_reports} report{r.week_reports === 1 ? '' : 's'} this week
            {hidden(r) ? ` · hidden until ${new Date(r.hidden_until!).toLocaleDateString()}` : ''}
          </Text>
          <Button primary label="Remove message" disabled={busy} onPress={() => act(r, 'remove')} />
          <Button label="Hide from the Plaza for 30 days" disabled={busy} onPress={() => act(r, 'hide30')} />
          {hidden(r) ? <Button label="Unhide (the reports were wrong)" disabled={busy} onPress={() => act(r, 'unhide')} /> : null}
          <Button label="Dismiss, nothing wrong" disabled={busy} onPress={() => act(r, 'dismiss')} />
        </View>
      </Page>
    );
  }
  return (
    <Page title="Reports" sub={list ? (list.length ? `${list.length} to review` : 'Nothing to review. Nice.') : undefined} onClose={onClose}>
      {list === null ? <ActivityIndicator color={colors.mintDark} /> : list.map((r) => card(r, true))}
    </Page>
  );
}

type SpotReq = { ids: number[]; name: string; city: string; count: number; why: string; owner: boolean; kind: string; contact: string | null; by: string; at: string };
type LiveSpot = { code: string; name: string; city: string | null; logo: string | null; members: number };
const spotLink = (code: string) => `https://sproutling.vercel.app/?spot=${code}`;

/** Account › Spots: suggestions and requests, live Spots, and Make Spot. */
export function SpotsScreen({ onClose, onChange }: { onClose: () => void; onChange?: () => void }) {
  const [data, setData] = useState<{ requests: SpotReq[]; live: LiveSpot[] } | null>(null);
  const [making, setMaking] = useState<Partial<SpotReq> | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const load = () => supabase.rpc('admin_spots').then(({ data: d }) => setData((d as any) ?? { requests: [], live: [] }));
  useEffect(() => {
    load();
  }, []);
  if (qr) return <QrPage code={qr} onClose={() => setQr(null)} />;
  if (making)
    return (
      <MakeSpot
        start={making}
        onClose={() => setMaking(null)}
        onMade={(code) => {
          setMaking(null);
          load();
          onChange?.();
          setQr(code);
        }}
      />
    );
  return (
    <Page title="Spots" sub={data ? `${data.live.length} live · ${data.requests.length} request${data.requests.length === 1 ? '' : 's'}` : undefined} onClose={onClose}>
      <Button primary label="Make a new Spot" onPress={() => setMaking({})} />
      {data === null ? <ActivityIndicator color={colors.mintDark} /> : null}
      {data?.requests.map((r) => (
        <View key={r.ids.join()} style={styles.card}>
          <View style={styles.chips}>
            <Chip text={r.owner || r.kind === 'business' ? 'Owner or staff' : 'Player'} tone={r.owner ? 'warn' : 'soft'} />
            <View style={{ flex: 1 }} />
            <Text style={styles.time}>{ago(r.at)}</Text>
          </View>
          <Text style={styles.name}>{r.name}</Text>
          <Text style={styles.meta}>{r.city} · suggested by {r.by}{r.count > 1 ? ` + ${r.count - 1} other${r.count > 2 ? 's' : ''}` : ''}</Text>
          {r.why ? <View style={styles.quote}><Text style={styles.quoteText}>“{r.why}”</Text></View> : null}
          {r.contact ? <Text style={styles.meta}>Contact: {r.contact}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button primary label="Make Spot" onPress={() => setMaking(r)} style={{ flex: 1 }} />
            <Button
              label="Decline"
              onPress={async () => {
                await supabase.rpc('admin_decline_spot', { p_ids: r.ids });
                load();
                onChange?.();
              }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ))}
      {data?.live.length ? <Text style={styles.head}>Live Spots</Text> : null}
      {data?.live.map((s) => (
        <Pressable key={s.code} onPress={() => setQr(s.code)} style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 10 }]} accessibilityRole="button" accessibilityLabel={`${s.name}, show QR code`}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{s.name}</Text>
            <Text style={styles.meta}>{s.city ?? ''} · code {s.code} · {s.members} member{s.members === 1 ? '' : 's'}</Text>
          </View>
          <Text style={styles.link}>QR code ›</Text>
        </Pressable>
      ))}
    </Page>
  );
}

/** Web only: pick an image file and put it in the public 'spots' storage. Returns its address. */
async function pickAndUpload(prefix: string): Promise<string | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  const file: File | null = await new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
  if (!file) return null;
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z]/g, '') || 'jpg';
  const path = `${prefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('spots').upload(path, file, { contentType: file.type, upsert: true });
  if (error) return null;
  return supabase.storage.from('spots').getPublicUrl(path).data.publicUrl;
}

function MakeSpot({ start, onClose, onMade }: { start: Partial<SpotReq>; onClose: () => void; onMade: (code: string) => void }) {
  const [name, setName] = useState(start.name ?? '');
  const [city, setCity] = useState(start.city ?? '');
  const [about, setAbout] = useState('');
  const [photo, setPhoto] = useState('');
  const [logo, setLogo] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const web = Platform.OS === 'web';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) || 'spot';
  const upload = async (kind: 'photo' | 'logo') => {
    setMsg(null);
    const url = await pickAndUpload(`${slug}-${kind}`);
    if (url) (kind === 'photo' ? setPhoto : setLogo)(url);
    else setMsg('Couldn’t upload that image. Try a JPG or PNG.');
  };
  return (
    <Page title="New Spot" sub="Nothing goes live until you tap Create Spot." onClose={onClose}>
      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Lakeside Coffee" maxLength={40} />
        <Text style={styles.label}>City</Text>
        <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Orlando" maxLength={40} />
        <Text style={styles.label}>About (shows on the group)</Text>
        <TextInput style={[styles.input, { minHeight: 70 }]} value={about} onChangeText={setAbout} placeholder="Coffee after the lake loop. Say hi!" maxLength={140} multiline />
        <Text style={styles.label}>Photo of the place</Text>
        {web ? <Button label={photo ? 'Photo added. Change it' : 'Choose photo'} onPress={() => upload('photo')} /> : <TextInput style={styles.input} value={photo} onChangeText={setPhoto} placeholder="Image link (or add it from the website)" autoCapitalize="none" />}
        <Text style={styles.label}>Logo (optional)</Text>
        {web ? <Button label={logo ? 'Logo added. Change it' : 'Choose logo'} onPress={() => upload('logo')} /> : <TextInput style={styles.input} value={logo} onChangeText={setLogo} placeholder="Image link (or add it from the website)" autoCapitalize="none" />}
        {!web ? <Text style={styles.meta}>Picking photos from your phone comes with the next iPhone build. For now, add photos at sproutling.vercel.app (sign in, tap your picture, Spots).</Text> : null}
        {msg ? <Text style={styles.err}>{msg}</Text> : null}
        <Button
          primary
          label={busy ? 'Creating…' : 'Create Spot'}
          disabled={busy || name.trim().length < 2}
          onPress={async () => {
            setBusy(true);
            const { data, error } = await supabase.rpc('admin_make_spot', { p_name: name, p_city: city, p_about: about, p_photo: photo, p_logo: logo, p_request_ids: start.ids ?? null });
            setBusy(false);
            if (error || !data || String(data).length > 14 || data === 'missing' || data === 'not_admin') return setMsg('Couldn’t create the Spot. Check the name and try again.');
            buzz('success');
            onMade(String(data));
          }}
        />
      </View>
    </Page>
  );
}

function QrPage({ code, onClose }: { code: string; onClose: () => void }) {
  const [svg, setSvg] = useState<string | null>(null);
  const link = spotLink(code);
  useEffect(() => {
    QRCode.toString(link, { type: 'svg', errorCorrectionLevel: 'H', margin: 2, color: { dark: '#1F2A2E', light: '#FFFFFF' } }).then(setSvg).catch(() => setSvg(null));
  }, [link]);
  const download = async () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const png = await QRCode.toDataURL(link, { errorCorrectionLevel: 'H', margin: 2, width: 1200, color: { dark: '#1F2A2E', light: '#FFFFFF' } });
    const a = document.createElement('a');
    a.href = png;
    a.download = `Sproutling-Spot-${code}.png`;
    a.click();
  };
  return (
    <Page title={`Code ${code} is live`} sub="Print this for the counter. Scanning it opens the Spot's welcome screen." onClose={onClose}>
      <View style={[styles.card, { alignItems: 'center' }]}>
        {svg ? <SvgXml xml={svg} width={240} height={240} /> : <ActivityIndicator color={colors.mintDark} />}
        <Text style={styles.meta} selectable>{link}</Text>
      </View>
      {Platform.OS === 'web' ? <Button primary label="Download QR image" onPress={download} /> : null}
      <Button label="Share link" onPress={() => Share.share({ message: link }).catch(() => {})} />
    </Page>
  );
}

const styles = StyleSheet.create({
  full: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, zIndex: 220 },
  back: { fontSize: 15, fontWeight: '700', color: colors.mintDark },
  title: { fontSize: 28, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 14, fontWeight: '700', color: colors.muted },
  head: { fontSize: 17, fontWeight: '800', color: colors.ink, marginTop: 6 },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 14, gap: 8 , borderWidth: 1, borderColor: colors.line},
  chips: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  chip: { backgroundColor: '#E3F5EC', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  chipText: { fontSize: 11, fontWeight: '600', color: '#1F7A58' },
  time: { fontSize: 11, fontWeight: '600', color: '#9AA7A2' },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  quote: { backgroundColor: '#F4F9F6', borderRadius: 12, padding: 10 },
  quoteText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 12, fontWeight: '600', color: colors.muted },
  link: { fontSize: 13, fontWeight: '600', color: colors.mintDark },
  label: { fontSize: 12, fontWeight: '600', color: colors.muted, marginTop: 4 },
  input: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16, color: colors.ink, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E4EEEA' },
  err: { fontSize: 13, fontWeight: '600', color: '#C4562F' },
});
