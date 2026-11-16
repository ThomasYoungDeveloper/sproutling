import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import { Card, SectionHead, Button, ProgressBar, Chip, RarityBadge } from '../components/ui';
import PetSprite from '../components/PetSprite';
import { colors, font, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { scoreDay, dailyQuests, stageFor, nextStage, STAGE_XP } from '../game/scoring';
import * as A from '../game/actions';

const STAGE_LABEL = { baby: 'Baby', teen: 'Teen', adult: 'Adult' } as const;

export default function HomeScreen() {
  const { state, apply } = useGame();
  const d = A.today(state);
  const score = scoreDay(d);
  const pet = A.activePet(state);
  const [mealName, setMealName] = useState('');
  const [mealCal, setMealCal] = useState('');
  const [veg, setVeg] = useState(false);

  const mood = d.sleepHours > 0 && d.sleepHours < 6 ? 'sleepy' : score.total >= 150 ? 'joy' : 'happy';
  const say = mood === 'sleepy' ? 'So sleepy… early bedtime tonight?' : score.total >= 150 ? 'Best day ever!' : d.water < 6 ? 'Could I have some water?' : 'A walk would be fun!';

  return (
    <View style={{ gap: space.md }}>
      {pet ? <PetCard petId={pet.id} mood={mood} say={say} /> : null}

      <Card>
        <SectionHead title="Daily quests" meta="+15 XP each" />
        {dailyQuests(d).map((q) => (
          <View key={q.id} style={styles.quest}>
            <View style={[styles.qbox, q.done && styles.qdone]}>{q.done ? <Text style={styles.check}>✓</Text> : null}</View>
            <Text style={[font.body, { flex: 1, fontWeight: '700' }]}>{q.label}</Text>
            <Text style={font.small}>{q.progress}</Text>
          </View>
        ))}
        <Text style={font.small}>Finish all three to earn a Bronze chest.</Text>
      </Card>

      <Card>
        <SectionHead title="Today" meta={`+${score.total} XP`} />

        <Habit label={`${d.steps.toLocaleString()} steps`} sub="Also warms your eggs" xp={score.steps}>
          <Button small label="+500" onPress={() => apply((s) => A.addSteps(s, 500))} />
          <Button small label="+1,000" onPress={() => apply((s) => A.addSteps(s, 1000))} />
          <Button small label="+5,000" onPress={() => apply((s) => A.addSteps(s, 5000))} />
        </Habit>

        <Habit label={`${d.sleepHours} h sleep`} sub="Sweet spot 7–9 hours" xp={score.sleep}>
          <Button small label="− 30 min" onPress={() => apply((s) => A.setSleep(s, d.sleepHours - 0.5))} />
          <Button small label="+ 30 min" onPress={() => apply((s) => A.setSleep(s, d.sleepHours + 0.5))} />
        </Habit>

        <Habit label={`${d.water} of 8 glasses`} sub="Tap a glass to fill it" xp={score.water}>
          {Array.from({ length: 8 }, (_, i) => {
            const on = i < d.water;
            return (
              <Pressable key={i} accessibilityLabel={`${i + 1} glasses`} onPress={() => apply((s) => A.setWater(s, d.water === i + 1 ? i : i + 1))}>
                <Svg width={26} height={30} viewBox="0 0 28 32">
                  <Path d="M5 4 H23 L20.5 28 Q20 30 18 30 H10 Q8 30 7.5 28 Z" fill={on ? '#8FC9F0' : '#fff'} stroke={on ? '#2E7FB8' : '#B9CDD6'} strokeWidth={2.2} strokeLinejoin="round" />
                </Svg>
              </Pressable>
            );
          })}
        </Habit>

        <Habit label={`${d.workoutMinutes} min workout`} sub="1 XP per minute, up to 60" xp={score.workout}>
          <Button small label="− 10" onPress={() => apply((s) => A.addWorkout(s, -10))} />
          <Button small label="+ 10 min" onPress={() => apply((s) => A.addWorkout(s, 10))} />
        </Habit>

        <Habit label={`${d.meals.length} meals logged`} sub="XP for logging and for fruit or veggies" xp={score.meals}>
          <View style={{ width: '100%', gap: 4 }}>
            {d.meals.map((m, i) => (
              <View key={i} style={styles.meal}>
                <Text style={font.body}>
                  {m.name}
                  {m.calories ? <Text style={font.small}> · {m.calories} cal</Text> : null}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  {m.veggies ? <Chip label="+ fruit/veg" /> : null}
                  <Pressable accessibilityLabel={`Remove ${m.name}`} onPress={() => apply((s) => A.removeMeal(s, i))}>
                    <Text style={[font.small, { fontSize: 16 }]}>×</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            <View style={styles.mealForm}>
              <TextInput style={[styles.input, { flex: 1, minWidth: 140 }]} placeholder="What did you eat?" value={mealName} onChangeText={setMealName} />
              <TextInput style={[styles.input, { width: 100 }]} placeholder="Calories" keyboardType="numeric" value={mealCal} onChangeText={setMealCal} />
              <Pressable onPress={() => setVeg(!veg)} style={styles.vegToggle} accessibilityRole="checkbox" accessibilityState={{ checked: veg }}>
                <View style={[styles.qbox, veg && styles.qdone, { width: 18, height: 18 }]}>{veg ? <Text style={[styles.check, { fontSize: 11 }]}>✓</Text> : null}</View>
                <Text style={font.small}>Fruit or veg</Text>
              </Pressable>
              <Button
                small
                primary
                label="Log meal"
                disabled={!mealName.trim()}
                onPress={() => {
                  const cal = parseInt(mealCal, 10);
                  apply((s) => A.addMeal(s, { name: mealName.trim(), calories: isNaN(cal) ? null : cal, veggies: veg }));
                  setMealName('');
                  setMealCal('');
                  setVeg(false);
                }}
              />
            </View>
          </View>
        </Habit>
        <Text style={font.tiny}>Web preview: you enter habits by hand. The phone app will read verified data from Apple Health or Health Connect.</Text>
      </Card>
    </View>
  );
}

function PetCard({ petId, mood, say }: { petId: string; mood: 'happy' | 'joy' | 'sleepy'; say: string }) {
  const { state, apply } = useGame();
  const pet = state.pets.find((p) => p.id === petId)!;
  const sp = SPECIES_BY_ID[pet.speciesId];
  const stage = stageFor(pet.xp);
  const nxt = nextStage(stage);
  const from = STAGE_XP[stage];
  const to = nxt ? STAGE_XP[nxt] : from;
  return (
    <View style={styles.petCard}>
      <View style={styles.petHead}>
        <View style={{ flex: 1 }}>
          <TextInput
            style={styles.petName}
            defaultValue={pet.nickname}
            key={pet.id + pet.nickname}
            onEndEditing={(e) => apply((s) => A.renamePet(s, pet.id, e.nativeEvent.text))}
            onBlur={(e: any) => e?.nativeEvent?.text !== undefined && apply((s) => A.renamePet(s, pet.id, e.nativeEvent.text))}
            accessibilityLabel="Pet name"
            maxLength={14}
          />
          <Text style={styles.stage}>{sp.name} · {STAGE_LABEL[stage]}{pet.shiny ? ' · Shiny' : ''}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <RarityBadge rarity={sp.rarity} />
          <Chip label={sp.element[0].toUpperCase() + sp.element.slice(1)} tone="muted" />
        </View>
      </View>
      <View style={styles.petStage}>
        <View style={styles.bubble}><Text style={[font.small, { color: colors.ink }]}>{say}</Text></View>
        <PetSprite species={sp} stage={stage} size={190} shiny={pet.shiny} mood={mood} />
      </View>
      <View style={styles.xpRow}>
        <Text style={font.small}>{nxt ? `${(to - pet.xp).toLocaleString()} XP to ${STAGE_LABEL[nxt]}` : 'Fully grown'}</Text>
        <Text style={font.small}>{pet.xp.toLocaleString()} XP</Text>
      </View>
      <ProgressBar value={nxt ? (pet.xp - from) / (to - from) : 1} height={12} />
    </View>
  );
}

function Habit({ label, sub, xp, children }: { label: string; sub: string; xp: number; children: React.ReactNode }) {
  return (
    <View style={styles.habit}>
      <View style={styles.habitTop}>
        <View style={{ flex: 1 }}>
          <Text style={[font.body, { fontWeight: '800' }]}>{label}</Text>
          <Text style={font.small}>{sub}</Text>
        </View>
        <Chip label={`+${xp} XP`} tone={xp ? 'mint' : 'muted'} />
      </View>
      <View style={styles.controls}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  petCard: { backgroundColor: colors.sky, borderRadius: 24, borderWidth: 1, borderColor: colors.line, padding: space.lg, overflow: 'hidden' },
  petHead: { flexDirection: 'row', gap: space.sm },
  petName: { fontSize: 24, fontWeight: '800', color: colors.ink, padding: 0 },
  stage: { fontSize: 12, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  petStage: { alignItems: 'center', justifyContent: 'center', height: 200 },
  bubble: { position: 'absolute', top: 0, right: 0, maxWidth: 150, backgroundColor: '#fff', borderRadius: 14, borderBottomRightRadius: 4, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, zIndex: 2 },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  quest: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line },
  qbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: '#BFD3CB', alignItems: 'center', justifyContent: 'center' },
  qdone: { backgroundColor: colors.mint, borderColor: colors.mint },
  check: { color: '#fff', fontWeight: '900', fontSize: 13 },
  habit: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm, gap: space.sm },
  habitTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  meal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FAFBF9', borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  mealForm: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#fff', fontSize: 15, color: colors.ink },
  vegToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
});
