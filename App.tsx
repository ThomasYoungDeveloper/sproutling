import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GameProvider, useGame } from './src/state/GameContext';
import { AuthProvider, useAuth } from './src/state/AuthContext';
import AccountSheet from './src/components/AccountSheet';
import AuthFlow from './src/screens/AuthFlow';
import HomeScreen from './src/screens/HomeScreen';
import EggsScreen from './src/screens/EggsScreen';
import ChestsScreen from './src/screens/ChestsScreen';
import DexScreen from './src/screens/DexScreen';
import StarterScreen from './src/screens/StarterScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import DailyLoginSheet from './src/components/DailyLoginSheet';
import { FriendsProvider, useFriends } from './src/state/FriendsContext';
import { OverlayProvider } from './src/components/Overlay';
import { TeamProvider } from './src/state/TeamContext';
import * as Ach from './src/game/achievements';
import LabScreen from './src/screens/LabScreen';
import { FadeSwitch, PopIn, RollingNumber } from './src/components/fx';
import { RevealProvider, useReveal } from './src/components/RevealOverlay';
import { stageFor } from './src/game/scoring';
import { Button } from './src/components/ui';
import { colors, font, space } from './src/theme';
import * as A from './src/game/actions';

type Tab = 'home' | 'eggs' | 'chests' | 'dex' | 'friends';
const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'eggs', label: 'Eggs' },
  { id: 'chests', label: 'Chests' },
  { id: 'dex', label: 'Pets' },
  { id: 'friends', label: 'Friends' },
];

/** A friend code from an invite link (sproutling.app/?add=CODE), read once and removed from the address bar. */
function takeInviteCode(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const code = url.searchParams.get('add');
  if (!code) return null;
  url.searchParams.delete('add');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  return code.slice(0, 20);
}

function Shell() {
  const { state, apply, reset, sync, loaded } = useGame();
  const { incoming, tradesForMe, notice, dismissNotice } = useFriends();
  const [invite, setInvite] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const loginShownFor = useRef<string | null>(null);
  const { user, username } = useAuth();
  const [showAccount, setShowAccount] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [confirmReset, setConfirmReset] = useState(false);
  const readyEggs = state.eggs.filter(A.isReady).length;
  const reveal = useReveal();
  const starter = A.needsStarter(state);
  const login = A.loginStatus(state);
  const today = A.todayKey(state);

  // Opened from a friend's invite link: jump to Friends with their code filled in.
  useEffect(() => {
    const code = takeInviteCode();
    if (code) {
      setInvite(code);
      setTab('friends');
    }
  }, []);

  // Pop up the daily reward once a day, after the save has synced (so it isn't shown twice across devices).
  const settled = loaded && (sync === 'saved' || sync === 'error');

  // Once a day, let streak shields cover any missed day.
  const [shieldNote, setShieldNote] = useState<string | null>(null);
  const shieldsCheckedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!settled || shieldsCheckedFor.current === today) return;
    shieldsCheckedFor.current = today;
    const r = A.applyShields(state);
    if (r.used) {
      apply(() => r.state);
      setShieldNote(`🛡️ A streak shield saved your ${r.saved}-day streak!`);
      setTimeout(() => setShieldNote(null), 6000);
    }
  }, [settled, today]);
  useEffect(() => {
    if (settled && !starter && login.canClaim && loginShownFor.current !== today) {
      loginShownFor.current = today;
      setShowLogin(true);
    }
  }, [settled, starter, login.canClaim, today]);

  // Notices (like opened gifts) fade away on their own.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(dismissNotice, 5000);
    return () => clearTimeout(t);
  }, [notice?.id]);

  // Celebrate when the active pet reaches a new growth stage.
  const pet = A.activePet(state);
  const stage = pet ? stageFor(pet.xp) : null;
  const last = useRef<{ id: string | null; stage: string | null }>({ id: null, stage: null });
  useEffect(() => {
    const order = ['baby', 'teen', 'adult'];
    if (pet && stage && last.current.id === pet.id && last.current.stage && order.indexOf(stage) > order.indexOf(last.current.stage)) {
      reveal({ kind: 'grow', pet, stage });
    }
    last.current = { id: pet?.id ?? null, stage };
  }, [pet?.id, stage]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.top}>
        <Text style={styles.brand}>Sprout<Text style={{ color: colors.mint }}>ling</Text></Text>
        <View style={styles.pills}>
          <View style={styles.pill}><Text style={styles.pillText}>▲ {A.streak(state)}-day{state.shields ? ` 🛡️${state.shields}` : ''}</Text></View>
          <View style={styles.pill}><RollingNumber value={state.coins} prefix="● " style={styles.pillText} /></View>
          <Pressable onPress={() => setShowAccount(true)} style={[styles.pill, user ? null : styles.signIn]} accessibilityRole="button" accessibilityLabel={user ? 'Account' : 'Sign in to save your pets'}>
            <Text style={[styles.pillText, !user && { color: '#fff' }]} numberOfLines={1}>{sync === 'error' ? '⚠ Offline' : `☁ ${username ?? 'Me'}`}</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {starter ? <StarterScreen /> : null}
        {!starter && (
          <FadeSwitch id={tab}>
            <View style={{ gap: space.md }}>
        {tab === 'home' && (
          <Pressable onPress={() => setShowLogin(true)} style={[styles.daily, login.canClaim && styles.dailyReady]} accessibilityRole="button" accessibilityLabel="Daily rewards">
            <Text style={{ fontSize: 22 }}>{login.canClaim ? '🎁' : '✅'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.dailyTitle}>{login.canClaim ? `Day ${login.index + 1} reward is ready!` : `Day ${login.index + 1} reward collected`}</Text>
              <Text style={font.small}>{login.canClaim ? 'Tap to collect' : 'Come back tomorrow for the next one'}</Text>
            </View>
          </Pressable>
        )}
        {tab === 'home' && <HomeScreen onNavigate={setTab} />}
        {tab === 'eggs' && <EggsScreen />}
        {tab === 'chests' && <ChestsScreen />}
        {tab === 'dex' && <DexScreen />}
        {tab === 'friends' && <FriendsScreen initialAdd={invite} onUsedInitialAdd={() => setInvite(null)} />}
            </View>
          </FadeSwitch>
        )}
        <View style={styles.demo}>
          <Text style={[font.tiny, { flex: 1 }]}>Preview build. Your progress saves to your account.</Text>
          <Button small label="Skip to tomorrow" onPress={() => apply(A.nextDay)} />
          <Button
            small
            label={confirmReset ? 'Tap again to reset' : 'Reset'}
            onPress={() => {
              if (confirmReset) {
                reset();
                setConfirmReset(false);
              } else {
                setConfirmReset(true);
                setTimeout(() => setConfirmReset(false), 3000);
              }
            }}
          />
        </View>
      </ScrollView>
      {!starter && <View style={styles.nav}>
        {TABS.map((t) => {
          const badge = t.id === 'eggs' ? readyEggs : t.id === 'chests' ? state.chests.length : t.id === 'friends' ? incoming.length + tradesForMe : t.id === 'dex' ? Ach.claimable(state).length : 0;
          return (
            <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.navBtn, tab === t.id && styles.navActive]} accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }}>
              <Text style={[styles.navText, tab === t.id && { color: colors.mintDark }]}>{t.label}</Text>
              {badge > 0 ? <View style={styles.dot}><Text style={styles.dotText}>{badge}</Text></View> : null}
            </Pressable>
          );
        })}
      </View>}
      {showAccount && <AccountSheet onClose={() => setShowAccount(false)} />}
      {showLogin && !starter && <DailyLoginSheet onClose={() => setShowLogin(false)} />}
      {shieldNote && !notice ? (
        <View style={styles.toastWrap} pointerEvents="box-none">
          <PopIn>
            <Pressable onPress={() => setShieldNote(null)} style={styles.toast} accessibilityRole="alert">
              <Text style={styles.toastText}>{shieldNote}</Text>
            </Pressable>
          </PopIn>
        </View>
      ) : null}
      {notice && (
        <View style={styles.toastWrap} pointerEvents="box-none">
          <PopIn key={notice.id}>
            <Pressable onPress={dismissNotice} style={styles.toast} accessibilityRole="alert">
              <Text style={styles.toastText}>{notice.text}</Text>
            </Pressable>
          </PopIn>
        </View>
      )}
    </SafeAreaView>
  );
}

function Gate() {
  const { user, loading, recovering } = useAuth();
  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.brand}>Sprout<Text style={{ color: colors.mint }}>ling</Text></Text>
      </View>
    );
  }
  if (!user || recovering) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        <AuthFlow />
      </SafeAreaView>
    );
  }
  return (
    <GameProvider key={user.id}>
      <RevealProvider>
        <FriendsProvider>
          <TeamProvider>
            <OverlayProvider>
              <Shell />
            </OverlayProvider>
          </TeamProvider>
        </FriendsProvider>
      </RevealProvider>
    </GameProvider>
  );
}

export default function App() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.search.includes('lab=hats')) return <LabScreen />;
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, maxWidth: 520, width: '100%', alignSelf: 'center' },
  brand: { fontSize: 24, fontWeight: '900', color: colors.ink },
  pills: { flexDirection: 'row', gap: 6 },
  pill: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontWeight: '800', fontSize: 13, color: colors.ink },
  signIn: { backgroundColor: colors.mint, borderColor: colors.mint },
  scroll: { padding: space.lg, paddingTop: space.sm, paddingBottom: 40, gap: space.md, maxWidth: 520, width: '100%', alignSelf: 'center' },
  demo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginTop: space.md },
  nav: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: '#fff', paddingHorizontal: space.sm, paddingVertical: 6 },
  navBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  navActive: { backgroundColor: colors.mintSoft },
  navText: { fontWeight: '800', color: colors.muted, fontSize: 14 },
  dot: { backgroundColor: colors.peach, borderRadius: 999, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  dotText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  daily: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: colors.line, paddingVertical: space.sm, paddingHorizontal: space.md },
  dailyReady: { backgroundColor: '#FFF6DD', borderColor: colors.gold },
  dailyTitle: { fontWeight: '900', fontSize: 15, color: colors.ink },
  toastWrap: { position: 'absolute', top: 64, left: 0, right: 0, alignItems: 'center', paddingHorizontal: space.lg, zIndex: 70 },
  toast: { backgroundColor: colors.ink, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, maxWidth: 420 },
  toastText: { color: '#fff', fontWeight: '800', fontSize: 14, textAlign: 'center' },
});
