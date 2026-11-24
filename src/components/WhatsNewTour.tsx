import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from './ScaledText';
import { Button } from './ui';
import { PopIn } from './fx';
import LevelBadge from './LevelBadge';
import CrestArt from './CrestArt';
import BadgeMedal from './BadgeMedal';
import { DEFAULT_CREST } from '../game/crest';
import { colors } from '../theme';

/**
 * After an update: one card per big new feature, with Show me to jump straight there. Shown once per tour
 * version to players who already played (new players learn things as they unlock). Reopen from the account.
 */
export const TOUR_VERSION = 16;
const KEY = 'sproutling/tour-seen';

export type TourGo = { tab: 'home' | 'eggs' | 'chests' | 'dex' | 'friends'; spot?: string; hint?: string };
const CARDS: { title: string; text: string; art: React.ReactNode; go: TourGo }[] = [
  { title: 'Your own account level', text: 'Walking, logging water and sleep, hatching and battling now level you up. Every level pays coins and opens something new.', art: <LevelBadge level={7} size={96} />, go: { tab: 'friends', spot: 'level', hint: 'Tap your level to see your level road' } },
  { title: 'Guilds got crests', text: 'Join a guild, beat the weekly boss together, and level your guild up for better crest borders.', art: <CrestArt crest={{ ...DEFAULT_CREST, c1: '#B8452E', c2: '#F08A4B', symbol: 'heart', trim: 'bronze' }} size={96} id="tour" />, go: { tab: 'friends', spot: 'guild', hint: 'Find a guild or make your crest here' } },
  { title: 'Guild quests', text: 'Every week your guild gets 3 quests to do together. Finish them for guild chests and guild XP.', art: <CrestArt crest={{ ...DEFAULT_CREST, c1: '#3B3F9E', c2: '#6C72E0', pattern: 'chevron', symbol: 'star', trim: 'silver' }} size={96} id="tour2" />, go: { tab: 'friends', spot: 'guild', hint: 'This week’s quests are in your guild' } },
  { title: 'Groups', text: 'Join groups for cafes, walking clubs, work or pets. Chat and see who walked the most this week.', art: <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: '#FFFFFF', backgroundColor: '#C98042' }} />, go: { tab: 'friends', spot: 'groups', hint: 'Find groups here' } },
  { title: 'Plaza and Global Chat', text: 'Open chat with every player in your city, or everyone. Like a town square, with a word filter and reporting.', art: <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: '#FFFFFF', backgroundColor: '#2FB58A' }} />, go: { tab: 'friends', spot: 'plaza', hint: 'Say hi to players near you' } },
  { title: 'Badges with tiers', text: '16 badges, each going Wooden, Bronze, Silver, Gold and Rainbow. Show your best 3 on your profile.', art: <BadgeMedal icon="walk" tier={4} size={96} id="tour" />, go: { tab: 'dex', spot: 'badges', hint: 'Your badges are here' } },
];

export async function shouldShowTour(played: boolean): Promise<boolean> {
  const v = Number(await AsyncStorage.getItem(KEY).catch(() => null)) || 0;
  if (v >= TOUR_VERSION) return false;
  if (!played) {
    await AsyncStorage.setItem(KEY, String(TOUR_VERSION)).catch(() => {});
    return false;
  }
  return true;
}
export const markTourSeen = () => AsyncStorage.setItem(KEY, String(TOUR_VERSION)).catch(() => {});

export default function WhatsNewTour({ onGo, onClose }: { onGo: (g: TourGo) => void; onClose: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    markTourSeen();
  }, []);
  const c = CARDS[i];
  const last = i === CARDS.length - 1;
  return (
    <View style={styles.backdrop}>
      <PopIn key={i} from={0.9}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.kicker}>NEW · {i + 1} OF {CARDS.length}</Text>
          <View style={styles.art}>{c.art}</View>
          <Text style={styles.title} accessibilityRole="header">{c.title}</Text>
          <Text style={styles.text}>{c.text}</Text>
          <View style={styles.dots}>
            {CARDS.map((_, k) => (
              <View key={k} style={[styles.dot, k === i && styles.dotOn]} />
            ))}
          </View>
          <View style={styles.row}>
            <Button label={last ? 'Done' : 'Next'} onPress={() => (last ? onClose() : setI(i + 1))} style={{ flex: 1 }} />
            <Button primary label="Show me" onPress={() => onGo(c.go)} style={{ flex: 1.4 }} />
          </View>
          {!last ? (
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
              <Text style={styles.skip}>Skip tour</Text>
            </Pressable>
          ) : null}
        </View>
      </PopIn>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,30,35,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 250 },
  card: { width: '100%', maxWidth: 400, backgroundColor: '#FFFFFF', borderRadius: 28, padding: 22, alignItems: 'center', gap: 10 },
  kicker: { fontSize: 12, fontWeight: '600', letterSpacing: 1.5, color: colors.mintDark },
  art: { width: 128, height: 128, borderRadius: 32, backgroundColor: '#EEF5F2', alignItems: 'center', justifyContent: 'center' },
  bubble: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: '#FFFFFF' },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  text: { fontSize: 15, fontWeight: '700', color: colors.muted, textAlign: 'center', lineHeight: 21 },
  dots: { flexDirection: 'row', gap: 6, marginVertical: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D5E3DD' },
  dotOn: { width: 20, backgroundColor: colors.mint },
  row: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  skip: { fontSize: 13, fontWeight: '600', color: colors.muted, paddingTop: 2 },
});
