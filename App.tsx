import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Coin from './src/components/Coin';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Linking, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './src/components/ScaledText';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ErrorBoundary from './src/components/ErrorBoundary';
import UpdateGate from './src/components/UpdateGate';
import { GameProvider, useGame } from './src/state/GameContext';
import { AuthProvider, useAuth } from './src/state/AuthContext';
import AccountSheet from './src/components/AccountSheet';
import AuthFlow from './src/screens/AuthFlow';
import IntroFlow from './src/screens/IntroFlow';
import * as I from './src/game/intro';
import { dateKey } from './src/game/dates';
import HomeScreen from './src/screens/HomeScreen';
import EggsScreen from './src/screens/EggsScreen';
import ChestsScreen from './src/screens/ChestsScreen';
import DexScreen from './src/screens/DexScreen';
import StarterScreen from './src/screens/StarterScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import DailyLoginSheet from './src/components/DailyLoginSheet';
import { FriendsProvider, useFriends } from './src/state/FriendsContext';
import { LiveBattleProvider, useLive } from './src/state/LiveBattleContext';
import { syncWidgets } from './src/lib/widgetSync';
import { ChatProvider, useChat } from './src/state/ChatContext';
import * as H from './src/game/hp';
import { OverlayProvider, useOverlay } from './src/components/Overlay';
import { LevelUpPopup } from './src/components/Unlocks';
import { spotlight } from './src/components/Spotlight';
import { ShopSheet, WardrobeSheet } from './src/components/ShopSheets';
import * as U from './src/game/unlocks';
import * as W from './src/game/wishes';
import { useStartAds } from './src/components/Ads';
import { TeamProvider } from './src/state/TeamContext';
import { RankedProvider } from './src/state/RankedContext';
import { useHealthSync } from './src/lib/useHealthSync';
import { useReminders } from './src/lib/useReminders';
import { onPushTap, registerPushToken } from './src/lib/pushTokens';
import { onRemindersChange } from './src/lib/remindersState';
import { useWalkFinds } from './src/lib/useWalkFinds';
import YardTips from './src/components/YardTips';
import TabBar from './src/components/TabBar';
import { yardSkyTop } from './src/components/PetScene';
import { DayComplete, QuestBanner, useCelebrations } from './src/components/Celebrations';
import * as Ach from './src/game/achievements';
import LabScreen from './src/screens/LabScreen';
import { FadeSwitch, PopIn, RollingNumber } from './src/components/fx';
import { RevealProvider, useReveal } from './src/components/RevealOverlay';
import { stageFor } from './src/game/scoring';
import { Button } from './src/components/ui';
import { colors, font, space } from './src/theme';
import * as A from './src/game/actions';

const COIN_PILE = require('./assets/items/coin_pile.png');

type Tab = 'home' | 'eggs' | 'chests' | 'dex' | 'friends';
/** Page title and a short line under it, for every tab but Home. */
const PAGE: Record<Tab, { title: string; sub: (s: ReturnType<typeof useGame>['state']) => string }> = {
  home: { title: 'Home', sub: () => '' },
  eggs: { title: 'Eggs', sub: (s) => `${s.eggs.filter((e) => e.incubating).length} of ${s.incubatorSlots} incubators in use` },
  chests: { title: 'Chests', sub: (s) => (s.chests.length ? `${s.chests.length} waiting to be opened` : 'Earn more by being active') },
  dex: { title: 'Pets', sub: (s) => `${s.pets.length} pets · ${Object.keys(s.dex).length} in the Pet-dex` },
  friends: { title: 'Social', sub: () => 'Friends, guild, battles and trades' },
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'eggs', label: 'Eggs' },
  { id: 'chests', label: 'Chests' },
  { id: 'dex', label: 'Pets' },
  { id: 'friends', label: 'Social' },
];

/** A friend code from an invite link (sproutling.app/?add=CODE), read once and removed from the address bar. */
/** A friend or guild code inside an invite link the phone opened the app with. */
function codeFromUrl(link: string | null | undefined, param: string): string | null {
  if (!link) return null;
  const m = link.match(new RegExp(`[?&]${param}=([^&#]+)`));
  return m ? decodeURIComponent(m[1]).slice(0, 20) : null;
}

function takeInviteCode(param = 'add'): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const code = url.searchParams.get(param);
  if (!code) return null;
  url.searchParams.delete(param);
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  return code.slice(0, 20);
}

function Shell() {
  const { state, apply, reset, sync, loaded } = useGame();
  useHealthSync();
  useReminders();
  const { incoming, tradesForMe, notice, dismissNotice } = useFriends();
  const { waiting: liveWaiting } = useLive();
  const { unread: chatUnread } = useChat();
  const [invite, setInvite] = useState<string | null>(null);
  const [guildInvite, setGuildInvite] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const loginShownFor = useRef<string | null>(null);
  const { user, username } = useAuth();
  const [showAccount, setShowAccount] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [confirmReset, setConfirmReset] = useState(false);
  const readyEggs = state.eggs.filter(A.isReady).length;
  const reveal = useReveal();
  // Brand-new players (and, once, players from before the intro) go through the intro first.
  const intro = I.needsIntro(state);
  const introShown = useRef(false);
  const layerInsets = useSafeAreaInsets();
  const starter = A.needsStarter(state) || intro;
  const login = A.loginStatus(state);
  const today = A.todayKey(state);

  // Knocked-out pets rest and slowly get some HP back.
  useEffect(() => {
    apply((s) => H.restPets(s));
    const t = setInterval(() => apply((s) => H.restPets(s)), 60_000);
    return () => clearInterval(t);
  }, []);

  // Home screen widget + adventure Live Activity (iPhone only; a second after the save settles).
  const wildWaiting = (state.wildPending ?? []).length;
  useEffect(() => {
    const waiting = liveWaiting ? 'Your move in a live battle' : readyEggs ? 'Egg ready to hatch' : wildWaiting ? 'A wild pet is waiting' : null;
    const t = setTimeout(() => syncWidgets(state, waiting), 1200);
    return () => clearTimeout(t);
  }, [state, liveWaiting, readyEggs, wildWaiting]);

  // Opened from a friend's invite link: jump to Friends with their code filled in.
  useEffect(() => {
    const code = takeInviteCode();
    if (code) {
      setInvite(code);
      setTab('friends');
    }
    const guild = takeInviteCode('guild');
    if (guild) {
      setGuildInvite(guild.toUpperCase());
      setTab('friends');
    }
  }, []);

  // Real push notifications: register this phone for the signed-in player (once Reminders allowed
  // notifications), and open the right tab when a notification is tapped.
  useEffect(() => {
    registerPushToken(user?.id ?? null);
    return onRemindersChange((on) => {
      if (on) registerPushToken(user?.id ?? null);
    });
  }, [user?.id]);
  useEffect(() => onPushTap((t) => {
    if (t === 'home' || t === 'eggs' || t === 'chests' || t === 'dex' || t === 'friends') setTab(t);
    if (t === 'chat') setTab('friends');
  }), []);

  // On the phone, invite links open the app directly (Universal Links): read the code from the link.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const handle = (link: string | null | undefined) => {
      const code = codeFromUrl(link, 'add');
      const guild = codeFromUrl(link, 'guild');
      if (code) setInvite(code);
      if (guild) setGuildInvite(guild.toUpperCase());
      if (code || guild) setTab('friends');
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  // Pop up the daily reward once a day, after the save has synced (so it isn't shown twice across devices).
  const settled = loaded && (sync === 'saved' || sync === 'error');

  // Every 1,000 steps your pet might find a chest (or, with Apple Health, an egg).
  const [walkNote, dismissWalkNote] = useWalkFinds(settled && !starter);
  // Confetti and banners when quests and care are finished.
  const cheer = useCelebrations(settled && !starter && !!state.tutorialDone);
  const layers = useOverlay();
  useEffect(() => {
    layers.setTop(
      cheer.big ? (
        <DayComplete onClose={cheer.dismissBig} onChests={() => { layers.close(); setTab('chests'); }} />
      ) : cheer.banner ? (
        <QuestBanner key={cheer.banner.id} banner={cheer.banner} onDone={cheer.dismissBanner} />
      ) : null,
    );
  }, [cheer.big, cheer.banner?.id]);

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
    if (settled && !starter && state.tutorialDone && login.canClaim && loginShownFor.current !== today) {
      loginShownFor.current = today;
      setShowLogin(true);
    }
  }, [settled, starter, state.tutorialDone, login.canClaim, today]);

  // Once a week the step goal moves with you (up after a strong week, down after a slow one).
  useEffect(() => {
    if (!settled || intro) return;
    apply((s) => I.adjustGoal(s, new Date(), (o) => dateKey(s.dayOffset + o)));
  }, [settled, intro, today]);

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

  // Level-up pop-up: the first time, just record the current level so existing players don't get a pop-up for old levels.
  useEffect(() => {
    if (settled && !starter && state.pets.length && state.onboard?.levelShown === undefined) apply((s) => U.markLevelShown(s));
  }, [settled, starter, state.pets.length, state.onboard?.levelShown]);
  useStartAds();
  // Pet wishes: notice a newly appeared wish (checked every minute) so it starts counting from now.
  useEffect(() => {
    if (!settled || starter) return;
    const tick = () => { if (W.noticeWishes(state) !== state) apply((s) => W.noticeWishes(s)); };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [settled, starter, state]);
  const goUnlock = (f: U.FeatureInfo) => {
    if (f.go === 'shop') {
      setTab('home');
      const openWardrobe = () => layers.open(<WardrobeSheet onClose={layers.close} onShop={openShop} />);
      const openShop = () => layers.open(<ShopSheet onClose={layers.close} onWardrobe={openWardrobe} />);
      openShop();
      return;
    }
    setTab(f.go);
    if (f.hint) setTimeout(() => spotlight(f.id, f.hint!), 350);
  };


  // Once the intro is showing, keep it up while the save syncs (otherwise it would restart mid-way).
  if (intro && (settled || introShown.current)) {
    introShown.current = true;
    return <IntroFlow />;
  }
  if (intro) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.brand}>Sprout<Text style={{ color: colors.mint }}>ling</Text></Text>
      </View>
    );
  }
  return (
    <SafeAreaView style={styles.root}>
      {/* Sky colour only behind the status bar; the rest of the edges stay mint so no stray band shows by the tab bar. */}
      {tab === 'home' && !starter && pet ? <View pointerEvents="none" style={[styles.skyCap, { backgroundColor: yardSkyTop(state) }]} /> : null}
      <StatusBar style={tab === 'home' && !starter && pet && yardSkyTop(state, true) ? 'light' : 'dark'} />
      {tab === 'home' && !starter ? null : (
        <View style={styles.top}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.pageTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1.15}>{starter ? 'Sproutling' : PAGE[tab].title}</Text>
          </View>
          <View style={styles.pills}>
            <View style={styles.pill}><Text style={styles.pillText} maxFontSizeMultiplier={1.15}>🔥 {A.streak(state)}{state.shields ? ` 🛡️${state.shields}` : ''}</Text></View>
            <View style={[styles.pill, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}><Image source={COIN_PILE} style={{ width: 26, height: 26 }} resizeMode="contain" /><RollingNumber value={state.coins} prefix="" short style={styles.pillText} /></View>
            <Pressable onPress={() => setShowAccount(true)} style={[styles.avatar, (!user || sync === 'error') && { backgroundColor: '#E8590C' }]} accessibilityRole="button" accessibilityLabel={user ? `Account: ${username ?? 'you'}${sync === 'error' ? ', offline' : ''}` : 'Sign in to save your pets'}>
              <Text style={styles.avatarText}>{!user || sync === 'error' ? '!' : (username ?? 'T')[0].toUpperCase()}</Text>
            </Pressable>
          </View>
        </View>
      )}
      <ScrollView style={tab === 'home' && !starter ? { backgroundColor: colors.bg } : undefined} contentContainerStyle={[styles.scroll, tab === 'home' && !starter && styles.scrollHome]}>
        {starter ? <StarterScreen /> : null}
        {!starter && (
          <FadeSwitch id={tab}>
            <View style={{ gap: space.md }}>
        {tab === 'home' && login.canClaim && false && (
          <Pressable onPress={() => setShowLogin(true)} style={[styles.daily, login.canClaim && styles.dailyReady]} accessibilityRole="button" accessibilityLabel="Daily rewards">
            <Text style={{ fontSize: 22 }}>{login.canClaim ? '🎁' : '✅'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.dailyTitle}>{login.canClaim ? `Day ${login.index + 1} reward is ready!` : `Day ${login.index + 1} reward collected`}</Text>
              <Text style={font.small}>{login.canClaim ? 'Tap to collect' : 'Come back tomorrow for the next one'}</Text>
            </View>
          </Pressable>
        )}
        {tab === 'home' && (
          <HomeScreen
            onNavigate={setTab}
            banner={login.canClaim ? (
              <Pressable onPress={() => setShowLogin(true)} style={[styles.daily, styles.dailyReady]} accessibilityRole="button" accessibilityLabel="Daily rewards">
                <Text style={{ fontSize: 22 }}>🎁</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dailyTitle}>Day {login.index + 1} reward is ready!</Text>
                  <Text style={font.small}>Tap to collect</Text>
                </View>
              </Pressable>
            ) : null}
            onAccount={() => setShowAccount(true)}
            account={{ initial: (username ?? (user ? 'T' : '?'))[0].toUpperCase(), label: user ? `Account: ${username ?? 'you'}${sync === 'error' ? ', offline' : ''}` : 'Sign in to save your pets', warn: sync === 'error' || !user }}
          />
        )}
        {tab === 'eggs' && <EggsScreen />}
        {tab === 'chests' && <ChestsScreen />}
        {tab === 'dex' && <DexScreen />}
        {tab === 'friends' && <FriendsScreen initialAdd={invite} onUsedInitialAdd={() => setInvite(null)} initialGuild={guildInvite} onUsedInitialGuild={() => setGuildInvite(null)} />}
            </View>
          </FadeSwitch>
        )}
      </ScrollView>
      {!starter && (
        <TabBar
          tabs={TABS}
          active={tab}
          onPick={setTab}
          badges={{ eggs: readyEggs, chests: state.chests.length, friends: incoming.length + tradesForMe + liveWaiting + chatUnread, dex: Ach.claimable(state).length ? -1 : 0 }}
        />
      )}
      {/* Pop-ups and toasts stay inside the app's own area (never under a side camera column). */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, bottom: 0, left: layerInsets.left, right: layerInsets.right, zIndex: 70 }}>
      {settled && !starter && !state.tutorialDone && tab === 'home' ? <YardTips /> : null}
      {settled && !starter && state.tutorialDone && !showLogin ? <LevelUpPopup onGo={goUnlock} /> : null}
      {showAccount && <AccountSheet onClose={() => setShowAccount(false)} />}
      {showLogin && !starter && <DailyLoginSheet onClose={() => setShowLogin(false)} />}
      {walkNote && !notice ? (
        <View style={styles.toastWrap} pointerEvents="box-none">
          <PopIn>
            <Pressable onPress={dismissWalkNote} style={[styles.toast, styles.findsToast]} accessibilityRole="alert" accessibilityLabel={`Found on your walk: ${walkNote.map((r) => `${r.label} times ${r.count}`).join(', ')}`}>
              <Text style={styles.findsTitle}>Found on your walk</Text>
              {walkNote.map((r) => (
                <View key={r.key} style={styles.findRow}>
                  <Text style={styles.findIcon}>{r.icon}</Text>
                  <Text style={[styles.findLabel, { color: r.color }]}>{r.label}</Text>
                  <Text style={styles.findCount}>×{r.count}</Text>
                </View>
              ))}
            </Pressable>
          </PopIn>
        </View>
      ) : null}
      {shieldNote && !notice && !walkNote ? (
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
      </View>
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
      <View style={styles.root}>
        <StatusBar style="dark" />
        <AuthFlow />
      </View>
    );
  }
  return (
    <GameProvider key={user.id}>
      <RevealProvider>
        <FriendsProvider>
          <LiveBattleProvider>
            <TeamProvider>
              <ChatProvider>
                <RankedProvider>
                  <OverlayProvider>
                    <Shell />
                  </OverlayProvider>
                </RankedProvider>
              </ChatProvider>
            </TeamProvider>
          </LiveBattleProvider>
        </FriendsProvider>
      </RevealProvider>
    </GameProvider>
  );
}

export default function App() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.search.includes('lab=hats')) return <LabScreen />;
  return (
    <ErrorBoundary>
    <SafeAreaProvider>
      <UpdateGate>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </UpdateGate>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  findsToast: { alignItems: 'stretch', gap: 4, minWidth: 220 },
  findsTitle: { color: '#CFE3DA', fontSize: 12, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  findRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  findIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  findLabel: { flex: 1, fontSize: 15, fontWeight: '900' },
  findCount: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  root: { flex: 1, backgroundColor: colors.bg },
  skyCap: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%' },
  top: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm, maxWidth: 520, width: '100%', alignSelf: 'center' },
  pageTitle: { fontSize: 30, fontWeight: '900', color: '#1F3A33' },
  pageSub: { fontSize: 13, fontWeight: '800', color: '#3E6B5E' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.mint, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  scrollHome: { paddingHorizontal: 0, paddingTop: 0, maxWidth: undefined },
  brand: { fontSize: 24, fontWeight: '900', color: colors.ink },
  pills: { flexDirection: 'row', gap: 6 },
  pill: { backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: 12, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  pillText: { fontWeight: '800', fontSize: 13, color: colors.ink },
  signIn: { backgroundColor: colors.mint, borderColor: colors.mint },
  scroll: { padding: space.lg, paddingTop: space.sm, paddingBottom: 40, gap: space.md, maxWidth: 520, width: '100%', alignSelf: 'center' },
  demo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginTop: space.md },
  nav: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: '#fff', paddingHorizontal: space.sm, paddingVertical: 6 },
  navBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  navActive: { backgroundColor: colors.mintSoft },
  navText: { fontWeight: '800', color: colors.muted, fontSize: 14 },
  dot: { backgroundColor: colors.peach, borderRadius: 999, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  dotText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  daily: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: colors.line, paddingVertical: space.sm, paddingHorizontal: space.md },
  dailyReady: { backgroundColor: '#FFF6DD', borderColor: colors.gold },
  dailyTitle: { fontWeight: '900', fontSize: 15, color: colors.ink },
  toastWrap: { position: 'absolute', top: 64, left: 0, right: 0, alignItems: 'center', paddingHorizontal: space.lg, zIndex: 70 },
  toast: { backgroundColor: colors.ink, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, maxWidth: 420 },
  toastText: { color: '#fff', fontWeight: '800', fontSize: 14, textAlign: 'center' },
});
