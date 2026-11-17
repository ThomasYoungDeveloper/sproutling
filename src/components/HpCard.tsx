import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../state/GameContext';
import * as H from '../game/hp';
import * as St from '../game/stats';
import type { OwnedPet } from '../game/types';
import PotionIcon, { POTION_COLOR } from './PotionIcon';
import { buzz, PopIn } from './fx';
import { colors, font, space } from '../theme';

export const HP_COLOR = { ready: '#2EB88A', hurt: '#F0B429', out: '#C4562F' } as const;
export const HP_LABEL = { ready: 'Ready', hurt: 'Hurt', out: 'Knocked out' } as const;

/** A thin HP bar with the pet's state, for lists like the trip picker. */
export function HpBar({ pet, height = 8 }: { pet: OwnedPet; height?: number }) {
  const pct = H.hpPct(pet);
  const st = H.hpState(pet);
  return (
    <View style={{ height, borderRadius: height, backgroundColor: '#E6EEEA', overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: HP_COLOR[st] }} />
    </View>
  );
}

/** HP and potions for one pet (in the pet sheet). */
export default function HpCard({ pet }: { pet: OwnedPet }) {
  const { state, apply } = useGame();
  const [msg, setMsg] = useState<string | null>(null);
  const pct = H.hpPct(pet);
  const st = H.hpState(pet);
  const max = St.statsFor(pet).hp;
  const now = Math.round((max * pct) / 100);
  const use = (k: H.PotionKind) => {
    const r = H.usePotion(state, pet.id, k);
    if (!r.ok) {
      setMsg(r.reason);
      return;
    }
    buzz('success', 'chime');
    apply(() => r.state);
    setMsg(`${pet.nickname} healed ${r.healed}% HP.`);
  };
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>HP</Text>
        <Text style={[styles.state, { color: HP_COLOR[st] }]}>{HP_LABEL[st]}</Text>
      </View>
      <HpBar pet={pet} height={12} />
      <Text style={font.small}>
        {now} / {max} HP.{' '}
        {st === 'out'
          ? `${pet.nickname} is resting and wakes up tomorrow with ${H.WAKE_HP}% HP. Potions can’t wake a knocked-out pet.`
          : pct < 100
            ? 'HP only comes back with a potion.'
            : 'Fights on trips and with wild pets lower HP. Friend battles never do.'}
      </Text>
      {pct < 100 && pct > 0 ? (
        <View style={styles.potions}>
          {(['small', 'full'] as const).map((k) => {
            const n = H.potionsOf(state, k);
            return (
              <Pressable key={k} disabled={!n} onPress={() => use(k)} style={[styles.potion, { borderColor: POTION_COLOR[k] }, !n && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel={`Use ${H.POTION_ITEM[k]}, ${n} left`}>
                <PotionIcon kind={k} size={34} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.potionName}>{H.POTION_ITEM[k]}</Text>
                  <Text style={styles.potionSub}>{n ? `${n} left · +${H.POTION_HEAL[k]}%` : 'None left'}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {msg ? (
        <PopIn>
          <Text style={[font.small, { color: colors.mintDark, fontWeight: '800' }]}>{msg}</Text>
        </PopIn>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: space.md, gap: 8, borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '900', color: colors.ink },
  state: { fontSize: 14, fontWeight: '900' },
  potions: { flexDirection: 'row', gap: 8 },
  potion: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderRadius: 14, padding: 8, backgroundColor: '#FFFBF2' },
  potionName: { fontWeight: '900', fontSize: 13, color: colors.ink },
  potionSub: { fontWeight: '700', fontSize: 11, color: colors.muted },
});
