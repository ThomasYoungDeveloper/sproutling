import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import { Card, SectionHead, Button, RarityBadge } from '../components/ui';
import { useReveal } from '../components/RevealOverlay';
import { colors, font, space } from '../theme';
import { CHESTS, oddsFor } from '../game/loot';
import { RARITIES, RARITY_INFO } from '../game/rarity';
import * as A from '../game/actions';
import type { ChestKind } from '../game/types';

const CHEST_COLORS: Record<ChestKind, [string, string]> = {
  bronze: ['#C98A54', '#A86B3A'],
  silver: ['#C9D3DA', '#9AA8B2'],
  gold: ['#FFD25E', '#E3A81E'],
};

function ChestArt({ kind, size = 64 }: { kind: ChestKind; size?: number }) {
  const [a, b] = CHEST_COLORS[kind];
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x={8} y={26} width={48} height={30} rx={5} fill={a} stroke="#24323A" strokeWidth={2.5} />
      <Path d="M8 28 Q8 12 32 12 Q56 12 56 28 Z" fill={b} stroke="#24323A" strokeWidth={2.5} strokeLinejoin="round" />
      <Rect x={27} y={24} width={10} height={12} rx={2} fill="#FFE27A" stroke="#24323A" strokeWidth={2} />
    </Svg>
  );
}

export default function ChestsScreen() {
  const { state, apply } = useGame();
  const reveal = useReveal();
  const [showOdds, setShowOdds] = useState<ChestKind | null>(null);

  return (
    <View style={{ gap: space.md }}>

      <Card>
        <SectionHead title="Your chests" meta={`${state.chests.length} unopened`} />
        {state.chests.length === 0 ? <Text style={font.small}>Finish your daily quests to earn a chest.</Text> : null}
        {state.chests.map((c) => (
          <View key={c.id} style={styles.row}>
            <ChestArt kind={c.kind} />
            <View style={{ flex: 1 }}>
              <Text style={[font.body, { fontWeight: '800' }]}>{CHESTS[c.kind].label}</Text>
              <Text style={font.small}>{c.reason}</Text>
            </View>
            <Button
              primary
              label="Open"
              onPress={() => {
                const r = A.openChestById(state, c.id);
                if (!r) return;
                apply(() => r.state);
                reveal({ kind: 'chest', chest: c.kind, result: r.result });
              }}
            />
          </View>
        ))}
      </Card>

      <Card>
        <SectionHead title="How to earn chests" meta="Never sold" />
        {(Object.keys(CHESTS) as ChestKind[]).map((k) => (
          <View key={k} style={{ gap: 6, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm }}>
            <View style={styles.row2}>
              <ChestArt kind={k} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={[font.body, { fontWeight: '800' }]}>{CHESTS[k].label}</Text>
                <Text style={font.small}>{CHESTS[k].howToEarn}</Text>
              </View>
              <Button small label={showOdds === k ? 'Hide odds' : 'See odds'} onPress={() => setShowOdds(showOdds === k ? null : k)} />
            </View>
            {showOdds === k ? (
              <View style={styles.odds}>
                <Text style={font.small}>Coins: {CHESTS[k].coins[0]}–{CHESTS[k].coins[1]} · Egg chance: {CHESTS[k].eggChance}%</Text>
                {RARITIES.map((r) => (
                  <View key={r} style={styles.oddsRow}>
                    <Text style={[font.small, { color: RARITY_INFO[r].color, width: 90 }]}>{RARITY_INFO[r].label}</Text>
                    <Text style={[font.small, { color: colors.ink }]}>{oddsFor(k)[r]}% per chest</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}
        <Text style={font.tiny}>Chests are earned by being active and can never be bought. We show the odds anyway.</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm },
  row2: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  odds: { backgroundColor: '#FAFBF9', borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: space.sm, gap: 3 },
  oddsRow: { flexDirection: 'row' },
});
