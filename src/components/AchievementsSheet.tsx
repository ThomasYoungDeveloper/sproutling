import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from './ScaledText';
import { useGame } from '../state/GameContext';
import { Button, ProgressBar } from './ui';
import { buzz, Confetti, PopIn } from './fx';
import { colors, font, space } from '../theme';
import * as Ach from '../game/achievements';

export default function AchievementsSheet({ onClose }: { onClose: () => void }) {
  const { state, apply } = useGame();
  const { width, height } = useWindowDimensions();
  const [party, setParty] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const all = Ach.statusAll(state);
  const groups: string[] = [...new Set(all.map((x) => x.a.group as string))];
  const earned = all.filter((x) => x.claimed).length;
  const ready = all.filter((x) => x.done && !x.claimed);

  const claim = (id: string) => {
    const next = Ach.claim(state, id);
    if (!next) return;
    const a = Ach.ACHIEVEMENT_BY_ID[id];
    buzz('success', 'levelup');
    apply(() => next);
    setParty((p) => p + 1);
    setMsg(`${a.emoji} ${a.name.replace(/!$/, '')} unlocked! You got ${Ach.rewardText(a.reward, true)}.`);
  };

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      {party ? <Confetti key={party} amount={50} width={width} height={height} /> : null}
      <View style={styles.sheet}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={font.title}>Badges</Text>
            <Text style={font.small}>{earned} of {all.length} earned{ready.length ? ` · ${ready.length} ready to claim!` : ''}</Text>
          </View>
        </View>
        {msg ? (
          <PopIn key={msg}>
            <Text style={styles.msg}>{msg}</Text>
          </PopIn>
        ) : null}
        <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ gap: space.sm, paddingBottom: space.sm }}>
          {[...(ready.length ? ['Ready to claim'] : []), ...groups].map((g) => (
            <View key={g} style={{ gap: 6 }}>
              <Text style={styles.group}>{g === 'Ready to claim' ? 'Ready to claim' : g}</Text>
              {all
                .filter((x) => (g === 'Ready to claim' ? x.done && !x.claimed : x.a.group === g && !(x.done && !x.claimed)))
                .sort((x, y) => Number(y.done && !y.claimed) - Number(x.done && !x.claimed))
                .map(({ a, value, done, claimed }) => (
                  <View key={a.id} style={[styles.row, claimed && styles.rowClaimed, done && !claimed && styles.rowReady]}>
                    <View style={[styles.badge, !claimed && !done && { opacity: 0.35 }]}>
                      <Text style={{ fontSize: 24 }}>{a.emoji}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.name}>{a.name}</Text>
                      <Text style={styles.desc}>{a.desc}</Text>
                      {!claimed && !done ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ flex: 1 }}>
                            <ProgressBar value={value / a.goal} height={6} />
                          </View>
                          <Text style={styles.prog}>{value.toLocaleString()} / {a.goal.toLocaleString()}</Text>
                        </View>
                      ) : (
                        <Text style={styles.reward}>{claimed ? '✓ Earned' : `Reward: ${Ach.rewardText(a.reward)}`}</Text>
                      )}
                    </View>
                    {done && !claimed ? (
                      <PopIn>
                        <Button small primary label="Claim!" onPress={() => claim(a.id)} />
                      </PopIn>
                    ) : null}
                  </View>
                ))}
            </View>
          ))}
        </ScrollView>
        <Button primary label="Done" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.6)', justifyContent: 'center', alignItems: 'center', padding: space.md, zIndex: 80 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: space.lg, gap: space.sm, width: '100%', maxWidth: 460, maxHeight: '96%' },
  group: { fontWeight: '900', fontSize: 15, color: colors.ink, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: 8, borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, backgroundColor: '#FAFCFB' },
  rowReady: { borderColor: colors.gold, backgroundColor: '#FFF8E2' },
  rowClaimed: { backgroundColor: colors.mintSoft, borderColor: '#BFE8D6' },
  badge: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: '900', fontSize: 14, color: colors.ink },
  desc: { fontWeight: '600', fontSize: 12, color: colors.muted },
  prog: { fontWeight: '800', fontSize: 12, color: colors.muted },
  reward: { fontWeight: '800', fontSize: 12, color: colors.mintDark },
  msg: { fontSize: 14, fontWeight: '900', color: '#9A6A00', textAlign: 'center', backgroundColor: '#FFF6DD', borderRadius: 12, padding: 8 },
});
