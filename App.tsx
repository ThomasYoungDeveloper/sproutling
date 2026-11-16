import React, { useEffect, useRef, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GameProvider, useGame } from './src/state/GameContext';
import HomeScreen from './src/screens/HomeScreen';
import EggsScreen from './src/screens/EggsScreen';
import ChestsScreen from './src/screens/ChestsScreen';
import DexScreen from './src/screens/DexScreen';
import StarterScreen from './src/screens/StarterScreen';
import { RevealProvider, useReveal } from './src/components/RevealOverlay';
import { stageFor } from './src/game/scoring';
import { Button } from './src/components/ui';
import { colors, font, space } from './src/theme';
import * as A from './src/game/actions';

type Tab = 'home' | 'eggs' | 'chests' | 'dex';
const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'eggs', label: 'Eggs' },
  { id: 'chests', label: 'Chests' },
  { id: 'dex', label: 'Pets' },
];

function Shell() {
  const { state, apply, reset } = useGame();
  const [tab, setTab] = useState<Tab>('home');
  const [confirmReset, setConfirmReset] = useState(false);
  const readyEggs = state.eggs.filter(A.isReady).length;
  const reveal = useReveal();
  const starter = A.needsStarter(state);

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
          <View style={styles.pill}><Text style={styles.pillText}>▲ {A.streak(state)}-day</Text></View>
          <View style={styles.pill}><Text style={styles.pillText}>● {state.coins.toLocaleString()}</Text></View>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {starter ? <StarterScreen /> : null}
        {!starter && tab === 'home' && <HomeScreen />}
        {!starter && tab === 'eggs' && <EggsScreen />}
        {!starter && tab === 'chests' && <ChestsScreen />}
        {!starter && tab === 'dex' && <DexScreen />}
        <View style={styles.demo}>
          <Text style={[font.tiny, { flex: 1 }]}>Preview build. Progress saves in this browser only.</Text>
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
          const badge = t.id === 'eggs' ? readyEggs : t.id === 'chests' ? state.chests.length : 0;
          return (
            <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.navBtn, tab === t.id && styles.navActive]} accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }}>
              <Text style={[styles.navText, tab === t.id && { color: colors.mintDark }]}>{t.label}</Text>
              {badge > 0 ? <View style={styles.dot}><Text style={styles.dotText}>{badge}</Text></View> : null}
            </Pressable>
          );
        })}
      </View>}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <GameProvider>
      <RevealProvider>
        <Shell />
      </RevealProvider>
    </GameProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, maxWidth: 520, width: '100%', alignSelf: 'center' },
  brand: { fontSize: 24, fontWeight: '900', color: colors.ink },
  pills: { flexDirection: 'row', gap: 6 },
  pill: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontWeight: '800', fontSize: 13, color: colors.ink },
  scroll: { padding: space.lg, paddingTop: space.sm, paddingBottom: 40, gap: space.md, maxWidth: 520, width: '100%', alignSelf: 'center' },
  demo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginTop: space.md },
  nav: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: '#fff', paddingHorizontal: space.sm, paddingVertical: 6 },
  navBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  navActive: { backgroundColor: colors.mintSoft },
  navText: { fontWeight: '800', color: colors.muted, fontSize: 14 },
  dot: { backgroundColor: colors.peach, borderRadius: 999, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  dotText: { color: '#fff', fontWeight: '900', fontSize: 11 },
});
