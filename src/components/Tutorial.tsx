import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../state/GameContext';
import * as A from '../game/actions';
import { PET_IMAGES } from './petImages';
import { Button } from './ui';
import { PopIn } from './fx';
import { colors, font, space } from '../theme';
import { play } from '../lib/sound';
import { remindersSupported, setRemindersOn } from '../lib/remindersState';

interface Step {
  art: string | 'pet';
  tint: string;
  title: string;
  body: string;
  tips?: string[];
}

/** A short first-time walkthrough: care, habits, hatching, battling, then reminders. */
export default function Tutorial() {
  const { state, apply } = useGame();
  const pet = A.activePet(state);
  const name = pet?.nickname ?? 'your pet';
  const [i, setI] = useState(0);

  const steps: Step[] = [
    { art: 'pet', tint: colors.sky, title: `Meet ${name}!`, body: `${name} grows when you take care of yourself. Here's how it works. It only takes a minute.` },
    {
      art: '🍎', tint: '#FFE7DC', title: `Look after ${name}`,
      body: 'Use the buttons under your pet to feed, play, give treats and dress them up.',
      tips: ['🧸 Open Toys and drag one into the scene to play together', '😊 Feed, play and treat each day for up to +30% XP'],
    },
    {
      art: '👟', tint: colors.mintSoft, title: 'Your habits become XP',
      body: 'Walking, drinking water and sleeping well all earn XP for your pet.',
      tips: ['✅ Finish all 3 each day for a free chest', '🔥 Keep your streak going for bigger rewards', '❤️ On iPhone, Apple Health fills these in for you'],
    },
    {
      art: '🥚', tint: '#FFF4CC', title: 'Hatch and collect',
      body: 'Eggs come from chests and adventures, and they hatch as you walk.',
      tips: ['🎒 Send pets on expeditions to find loot', '✨ Hunt for rare skins, shinies and perfect grades'],
    },
    {
      art: '⚔️', tint: '#E9E3FF', title: 'Battle and team up',
      body: 'Battle wild pets and friends from the Friends tab. Your healthy habits power up your pet in battle.',
      tips: ['🏆 Climb the ranked season', '🛡️ Join a guild and beat the weekly raid boss together'],
    },
    {
      art: '🔔', tint: '#FFE9F0', title: 'Want a nudge?',
      body: remindersSupported
        ? `We'll remind you to keep your streak, when an egg is ready to hatch, and when ${name} is home from an adventure. Never more than one habit reminder a day.`
        : `In the iPhone app we can remind you to keep your streak, when an egg is ready to hatch, and when ${name} is home from an adventure.`,
    },
  ];
  const step = steps[i];
  const last = i === steps.length - 1;
  const finish = () => apply((s) => ({ ...s, tutorialDone: true }));
  const next = () => {
    play('tap');
    setI(i + 1);
  };

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        {!last ? (
          <Pressable onPress={finish} style={styles.skip} accessibilityRole="button" accessibilityLabel="Skip tutorial">
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : null}
        <PopIn key={i} from={0.85}>
          <View style={{ alignItems: 'center', gap: space.sm }}>
            <View style={[styles.art, { backgroundColor: step.tint }]}>
              {step.art === 'pet' && pet && PET_IMAGES[pet.speciesId] ? (
                <Image source={PET_IMAGES[pet.speciesId]} style={{ width: 120, height: 120 }} resizeMode="contain" />
              ) : (
                <Text style={{ fontSize: 64 }}>{step.art === 'pet' ? '🌱' : step.art}</Text>
              )}
            </View>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>
            {step.tips ? (
              <View style={styles.tips}>
                {step.tips.map((t) => (
                  <Text key={t} style={styles.tip}>{t}</Text>
                ))}
              </View>
            ) : null}
          </View>
        </PopIn>
        <View style={styles.dots} accessibilityLabel={`Step ${i + 1} of ${steps.length}`}>
          {steps.map((_, j) => (
            <View key={j} style={[styles.dot, j === i && styles.dotOn]} />
          ))}
        </View>
        {last ? (
          remindersSupported ? (
            <View style={{ gap: space.sm }}>
              <Button primary label="Turn on reminders" onPress={async () => { await setRemindersOn(true); finish(); }} />
              <Button label="Maybe later" onPress={finish} />
            </View>
          ) : (
            <Button primary label="Let's go!" onPress={() => { play('chime'); finish(); }} />
          )
        ) : (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {i > 0 ? <Button label="Back" onPress={() => setI(i - 1)} /> : null}
            <Button primary label="Next" onPress={next} style={{ flex: 1 }} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.6)', justifyContent: 'center', alignItems: 'center', padding: space.md, zIndex: 90 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 26, padding: space.lg, paddingTop: space.xl, width: '100%', maxWidth: 420, gap: space.md },
  skip: { position: 'absolute', top: 12, right: 14, padding: 6, zIndex: 2 },
  skipText: { fontWeight: '900', color: colors.muted, fontSize: 14 },
  art: { width: 150, height: 150, borderRadius: 75, alignItems: 'center', justifyContent: 'center' },
  title: { ...font.title, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  body: { ...font.body, textAlign: 'center', color: colors.muted, fontWeight: '700', lineHeight: 21 },
  tips: { alignSelf: 'stretch', backgroundColor: '#F6FAF8', borderRadius: 14, padding: 12, gap: 6 },
  tip: { fontSize: 14, fontWeight: '800', color: colors.ink },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
  dotOn: { width: 22, backgroundColor: colors.mint },
});
