import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import PetSprite from './PetSprite';
import { Button, RarityBadge } from './ui';
import { buzz } from './fx';
import { colors, font, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import { levelFor, stageFor } from '../game/scoring';
import { gradeOf } from '../game/stats';
import type { OwnedPet } from '../game/types';
import { HpBar, HP_COLOR, HP_LABEL } from './HpCard';
import { hpState } from '../game/hp';

export interface PickerPet {
  pet: OwnedPet;
  /** Why this pet can't be picked, if it can't. */
  disabled?: string;
  /** Show this pet's HP bar (trips and wild fights). */
  showHp?: boolean;
}

/** A sheet for choosing one or more of your pets (for a trade or a battle team). */
export default function PetPicker({
  title,
  subtitle,
  pets,
  max = 1,
  initial = [],
  confirmLabel,
  onConfirm,
  onClose,
  busy,
  message,
  header,
}: {
  title: string;
  subtitle?: string;
  pets: PickerPet[];
  max?: number;
  initial?: string[];
  confirmLabel: (n: number) => string;
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
  busy?: boolean;
  message?: { ok: boolean; text: string } | null;
  /** Shown above the grid, given the pets picked so far (e.g. a 'You get / You give' summary). */
  header?: (picked: string[]) => React.ReactNode;
}) {
  const [picked, setPicked] = useState<string[]>(initial);
  const [why, setWhy] = useState<string | null>(null);

  const toggle = (p: PickerPet) => {
    if (p.disabled) {
      setWhy(p.disabled);
      return;
    }
    setWhy(null);
    buzz('light');
    setPicked((list) => (list.includes(p.pet.id) ? list.filter((x) => x !== p.pet.id) : max === 1 ? [p.pet.id] : list.length >= max ? [...list.slice(1), p.pet.id] : [...list, p.pet.id]));
  };

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <Text style={font.title}>{title}</Text>
        {subtitle ? <Text style={font.small}>{subtitle}</Text> : null}
        {header ? header(picked) : null}
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={styles.grid}>
          {pets.map((p) => {
            const sp = SPECIES_BY_ID[p.pet.speciesId];
            const on = picked.includes(p.pet.id);
            const order = picked.indexOf(p.pet.id);
            return (
              <Pressable key={p.pet.id} onPress={() => toggle(p)} style={[styles.tile, on && styles.on, !!p.disabled && styles.off]} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: !!p.disabled }} accessibilityLabel={`${p.pet.nickname}, level ${levelFor(p.pet.xp)}`}>
                <PetSprite species={sp} stage={stageFor(p.pet.xp)} size={70} shiny={p.pet.shiny} skin={p.pet.skin} hat={(p.pet as any).look?.hat ?? (p.pet as any).hat} aura={(p.pet as any).look?.aura ?? (p.pet as any).aura} />
                <View style={styles.lv}><Text style={styles.lvText}>Lv {levelFor(p.pet.xp)} · {gradeOf(p.pet)}%</Text></View>
                {on && max > 1 ? <View style={styles.num}><Text style={styles.numText}>{order + 1}</Text></View> : null}
                {on && max === 1 ? <View style={styles.num}><Text style={styles.numText}>✓</Text></View> : null}
                <Text style={styles.name} numberOfLines={1}>{p.pet.nickname}</Text>
                {p.showHp ? (
                  <View style={{ alignSelf: 'stretch', gap: 2 }}>
                    <HpBar pet={p.pet} height={6} />
                    <Text style={[styles.hpText, { color: HP_COLOR[hpState(p.pet)] }]}>{HP_LABEL[hpState(p.pet)]}</Text>
                  </View>
                ) : (
                  <RarityBadge rarity={sp.rarity} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
        {why ? <Text style={styles.why}>{why}</Text> : null}
        {message ? <Text style={[styles.why, message.ok && { color: colors.mintDark }]}>{message.text}</Text> : null}
        <View style={styles.row}>
          <Button label="Back" onPress={onClose} />
          <Button primary label={busy ? 'One moment…' : confirmLabel(picked.length)} disabled={busy || picked.length === 0} onPress={() => onConfirm(picked)} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hpText: { fontSize: 10, fontWeight: '900', textAlign: 'center' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.6)', justifyContent: 'center', alignItems: 'center', padding: space.lg, zIndex: 80 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: space.lg, gap: space.sm, width: '100%', maxWidth: 440 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: '3.5%', rowGap: space.sm, paddingVertical: space.xs },
  tile: { width: '31%', alignItems: 'center', gap: 3, padding: space.xs, paddingTop: space.sm, borderRadius: 16, borderWidth: 2, borderColor: colors.line, backgroundColor: '#FAFCFB' },
  on: { borderColor: colors.mint, backgroundColor: colors.mintSoft },
  off: { opacity: 0.4 },
  lv: { position: 'absolute', top: 4, left: 4, backgroundColor: colors.ink, borderRadius: 7, paddingHorizontal: 5, paddingVertical: 1 },
  lvText: { color: '#fff', fontWeight: '900', fontSize: 10 },
  num: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  numText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  name: { fontWeight: '800', fontSize: 12, color: colors.ink },
  why: { fontSize: 13, fontWeight: '700', color: '#C4562F' },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center', marginTop: space.xs },
});
