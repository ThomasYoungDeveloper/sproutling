import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '../state/GameContext';
import { Button } from './ui';
import { colors, font, space } from '../theme';
import { FOODS, boostOf } from '../game/food';
import { STAT_INFO } from '../game/stats';
import { COLLECTIBLES } from '../game/loot';
import { CRYSTAL } from '../game/powerups';
import { FULL, POTION_INFO, SMALL } from '../game/hp';
import PotionIcon from './PotionIcon';
import { DyeIcon, UseDyeSheet } from './Dyes';
import * as Dy from '../game/dyes';
import type { Skin } from '../game/types';

/** Everything you're carrying in one place: food, potions, crystals and treasures, each with what it does. */
export default function BagSheet({ onClose, onFeed }: { onClose: () => void; onFeed?: () => void }) {
  const { state } = useGame();
  const insets = useSafeAreaInsets();
  const foods = FOODS.filter((f) => (state.foods?.[f.id] ?? 0) > 0);
  const potions = ([['small', SMALL], ['full', FULL]] as const).filter(([, k]) => (state.items[k] ?? 0) > 0);
  const crystals = state.items[CRYSTAL] ?? 0;
  const treasures = COLLECTIBLES.filter((k) => (state.items[k] ?? 0) > 0);
  const dyes = Dy.ownedDyes(state);
  const [dyeFor, setDyeFor] = useState<Skin | null>(null);
  const known = new Set<string>([SMALL, FULL, CRYSTAL, ...COLLECTIBLES, ...Dy.DYES.map((d) => Dy.dyeName(d.skin))]);
  const other = Object.entries(state.items).filter(([k, n]) => n > 0 && !known.has(k));
  const empty = !dyes.length && !foods.length && !potions.length && !crystals && !treasures.length && !other.length;

  if (dyeFor) return <UseDyeSheet skin={dyeFor} onClose={() => setDyeFor(null)} />;
  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
        <View style={styles.grab} />
        <Text style={font.title}>Your bag</Text>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: space.md }}>
          {empty ? <Text style={font.small}>Nothing here yet. Walks, chests and trips fill your bag with food, potions and treasures.</Text> : null}
          {dyes.length ? (
            <Section title="Dyes" hint="Gives one pet that skin for good.">
              {dyes.map((d) => (
                <Pressable key={d.skin} onPress={() => setDyeFor(d.skin)} accessibilityRole="button" accessibilityLabel={`Use ${Dy.dyeName(d.skin)}`}>
                  <Item icon={<DyeIcon skin={d.skin} size={22} />} name={Dy.dyeName(d.skin)} count={Dy.dyesOwned(state, d.skin)} text={`${Dy.DYE_RARITY_LABEL[d.rarity]} · tap to use`} />
                </Pressable>
              ))}
            </Section>
          ) : null}
          {foods.length ? (
            <Section title="Food" hint="Feed your pet to fill its food bar. Each food also adds a little to one battle stat (up to 3 a day).">
              {foods.map((f) => (
                <Item key={f.id} icon={<Text style={{ fontSize: 22 }}>{f.emoji}</Text>} name={f.name} count={state.foods?.[f.id] ?? 0} text={`+${boostOf(f)}% ${STAT_INFO[f.stat].label}`} />
              ))}
              {onFeed ? <Button small primary label="Feed your pet" onPress={onFeed} /> : null}
            </Section>
          ) : null}
          {potions.length ? (
            <Section title="Potions" hint="Use one from a pet’s page or before a trip to heal HP.">
              {potions.map(([kind, k]) => (
                <Item key={k} icon={<PotionIcon kind={kind} size={26} />} name={k} count={state.items[k] ?? 0} text={POTION_INFO[kind]} />
              ))}
            </Section>
          ) : null}
          {crystals ? (
            <Section title="Training Crystals" hint="Open a pet’s page and use one to add +1 to any stat’s hidden quality.">
              <Item icon={<View style={styles.crystal} />} name={CRYSTAL} count={crystals} text="+1 to one stat’s quality" />
            </Section>
          ) : null}
          {treasures.length ? (
            <Section title="Treasures" hint="Give one to your pet as a Treat each day for +10% XP.">
              {treasures.map((k) => (
                <Item key={k} icon={<View style={styles.treasure} />} name={k} count={state.items[k] ?? 0} text="A treat for your pet" />
              ))}
            </Section>
          ) : null}
          {other.length ? (
            <Section title="Other">
              {other.map(([k, n]) => (
                <Item key={k} icon={<View style={styles.treasure} />} name={k} count={n} />
              ))}
            </Section>
          ) : null}
        </ScrollView>
        <Button label="Close" onPress={onClose} />
      </View>
    </View>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.section}>{title}</Text>
      {hint ? <Text style={font.small}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function Item({ icon, name, count, text }: { icon: React.ReactNode; name: string; count: number; text?: string }) {
  return (
    <View style={styles.item} accessible accessibilityLabel={`${name}, ${count}${text ? `. ${text}` : ''}`}>
      <View style={styles.icon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{name}</Text>
        {text ? <Text style={font.small}>{text}</Text> : null}
      </View>
      <Text style={styles.count}>×{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.5)', justifyContent: 'flex-end', alignItems: 'center', zIndex: 60 },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.lg, paddingTop: 10, gap: space.md, width: '100%', maxWidth: 560, maxHeight: '88%' },
  grab: { width: 44, height: 5, borderRadius: 999, backgroundColor: colors.line, alignSelf: 'center' },
  section: { fontSize: 16, fontWeight: '900', color: colors.ink },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F6FAF8', borderRadius: 14, padding: 10 },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '900', color: colors.ink },
  count: { fontSize: 16, fontWeight: '900', color: colors.mintDark },
  crystal: { width: 18, height: 26, backgroundColor: '#7FD3F0', borderRadius: 4, transform: [{ rotate: '45deg' }], borderWidth: 2, borderColor: '#3B9CC2' },
  treasure: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFD98A', borderWidth: 2, borderColor: '#E0A33A' },
});
