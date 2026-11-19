import React, { useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import { useOverlay } from './Overlay';
import { Button } from './ui';
import { buzz, Confetti, PopIn } from './fx';
import { colors, space } from '../theme';
import { ItemIcon } from './Cosmetics';
import { DyeIcon } from './Dyes';
import EggSprite from './EggSprite';
import PotionIcon from './PotionIcon';
import Coin from './Coin';
import * as Wh from '../game/wheel';
import * as Dy from '../game/dyes';
import { SKIN_INFO } from '../game/skins';
import { RARITY_INFO } from '../game/rarity';

const N = Wh.SLOTS.length;
const SVG_FONT = Platform.OS === 'web' ? 'Nunito, system-ui, sans-serif' : undefined;
const SEG = 360 / N;

/** The wheel itself: 10 slices, slice 0 at the top, going clockwise. */
function WheelArt({ size }: { size: number }) {
  const c = size / 2;
  const r = c - 8;
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={r + 6} fill="#24323A" />
      {Wh.SLOTS.map((sl, i) => {
        const a0 = rad(i * SEG - SEG / 2);
        const a1 = rad(i * SEG + SEG / 2);
        const d = `M${c},${c} L${c + r * Math.cos(a0)},${c + r * Math.sin(a0)} A${r},${r} 0 0 1 ${c + r * Math.cos(a1)},${c + r * Math.sin(a1)} Z`;
        const am = rad(i * SEG);
        const tx = c + r * 0.64 * Math.cos(am);
        const ty = c + r * 0.64 * Math.sin(am);
        // Text runs along the slice, turned around on the left half so it never reads upside down.
        let deg = (i * SEG - 90 + 360) % 360;
        if (deg > 90 && deg < 270) deg += 180;
        const light = sl.sub === 'RARE' || sl.sub === 'JACKPOT';
        const fill = light ? '#FFFFFF' : '#24323A';
        return (
          <G key={i}>
            <Path d={d} fill={sl.color} stroke="#FFFFFF" strokeWidth={3} />
            <G transform={`translate(${tx} ${ty}) rotate(${deg})`}>
              <SvgText textAnchor="middle" fontFamily={SVG_FONT} fontSize={size * 0.055} fontWeight="900" fill={fill} y={0}>{sl.label}</SvgText>
              {sl.sub ? <SvgText textAnchor="middle" fontFamily={SVG_FONT} fontSize={size * 0.034} fontWeight="900" fill={fill} y={size * 0.045} opacity={0.85}>{sl.sub}</SvgText> : null}
            </G>
          </G>
        );
      })}
      {Array.from({ length: 20 }, (_, k) => (
        <Circle key={k} cx={c + (r + 3) * Math.cos((k * 18 * Math.PI) / 180)} cy={c + (r + 3) * Math.sin((k * 18 * Math.PI) / 180)} r={2.6} fill="#FFE27A" />
      ))}
      <Circle cx={c} cy={c} r={size * 0.09} fill="#FFFCF5" stroke="#24323A" strokeWidth={4} />
    </Svg>
  );
}

function PrizeArt({ prize }: { prize: Wh.Prize }) {
  if (prize.kind === 'coins') return <Coin size={110} />;
  if (prize.kind === 'potion') return <PotionIcon kind="small" size={110} />;
  if (prize.kind === 'crystal') return <View style={styles.crystal} />;
  if (prize.kind === 'outfit') return <ItemIcon id={prize.item.id} size={130} />;
  if (prize.kind === 'dye') return <DyeIcon skin={prize.dye.skin} size={96} />;
  return <EggSprite rarity={prize.rarity} size={130} />;
}

function prizeText(p: Wh.Prize): { kicker: string; title: string; body: string; tag?: { text: string; color: string } } {
  if (p.kind === 'coins') return { kicker: p.jackpot ? 'JACKPOT!' : 'YOU WON', title: `${p.coins} coins`, body: p.jackpot ? 'The biggest prize on the wheel!' : 'Added to your coins.' };
  if (p.kind === 'potion') return { kicker: 'YOU WON', title: 'Small Potion', body: 'Heals 50% of max HP. It’s in your Bag.' };
  if (p.kind === 'crystal') return { kicker: 'YOU WON', title: 'Training Crystal', body: '+1 to one stat’s quality. Use it from a pet’s page.' };
  if (p.kind === 'outfit') return { kicker: 'NEW LOOK', title: p.item.name, body: 'Added to your looks. Put it on from Style.', tag: { text: p.item.rarity.toUpperCase(), color: '#5C6F69' } };
  if (p.kind === 'dye') return { kicker: 'YOU WON A DYE', title: Dy.dyeName(p.dye.skin), body: `Gives one pet the ${SKIN_INFO[p.dye.skin].label} skin for good. Saved in your Bag.`, tag: { text: Dy.DYE_RARITY_LABEL[p.dye.rarity].toUpperCase(), color: Dy.DYE_RARITY_COLOR[p.dye.rarity] } };
  return { kicker: 'MYSTERY EGG', title: `${RARITY_INFO[p.rarity].label} egg`, body: p.coins ? `Your basket was full, so it became ${p.coins} coins.` : 'It’s waiting in your Eggs tab.', tag: { text: RARITY_INFO[p.rarity].label.toUpperCase(), color: RARITY_INFO[p.rarity].color } };
}

/** The wheel screen: spin, watch it land, see the prize. */
export function WheelSheet({ onClose }: { onClose: () => void }) {
  const { state, apply } = useGame();
  const rot = useRef(new Animated.Value(0)).current;
  const [spinning, setSpinning] = useState(false);
  const [prize, setPrize] = useState<Wh.Prize | null>(null);
  const [turns, setTurns] = useState(0);
  const left = Wh.spinsLeft(state);
  const size = 300;

  const go = () => {
    const r = Wh.spin(state);
    if (!r) return;
    buzz('light');
    setSpinning(true);
    // Land the winning slice under the pointer at the top, after a few full turns.
    const jitter = (Math.random() - 0.5) * SEG * 0.6;
    const target = turns + 360 * 5 + (360 - r.slot * SEG) + jitter - (turns % 360);
    setTurns(target);
    Animated.timing(rot, { toValue: target, duration: 3600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      apply(() => r.state);
      setSpinning(false);
      setPrize(r.prize);
      buzz('success', r.prize.kind === 'coins' && !r.prize.jackpot ? 'coin' : 'win');
    });
  };

  const spinDeg = rot.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
  const t = prize ? prizeText(prize) : null;
  const rare = prize && (prize.kind === 'dye' || prize.kind === 'egg' || (prize.kind === 'coins' && prize.jackpot));

  return (
    <View style={styles.backdrop}>
      {prize && t ? (
        <View style={[styles.full, rare && { backgroundColor: '#2A1F5C' }]}>
          {rare ? <View pointerEvents="none" style={StyleSheet.absoluteFill}><Confetti amount={70} width={420} height={800} /></View> : null}
          <PopIn>
            <View style={{ alignItems: 'center', gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Text style={styles.kicker}>{t.kicker}</Text>
                {t.tag ? <View style={[styles.tag, { backgroundColor: t.tag.color }]}><Text style={styles.tagText}>{t.tag.text}</Text></View> : null}
              </View>
              <View style={styles.prizeGlow}><PrizeArt prize={prize} /></View>
              <Text style={styles.prizeTitle}>{t.title}</Text>
              <Text style={styles.prizeBody}>{t.body}</Text>
              <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 10 }}>
                {left > 0 ? <Button primary label="Spin again" onPress={() => setPrize(null)} /> : null}
                <Button primary={left === 0} label="Collect" onPress={onClose} />
              </View>
            </View>
          </PopIn>
        </View>
      ) : (
        <View style={styles.full}>
          <Text style={styles.kicker}>LUCKY WHEEL</Text>
          <Text style={styles.title}>Today’s spin</Text>
          <View style={{ width: size, height: size + 24, alignItems: 'center', marginTop: 8 }}>
            <Animated.View style={{ position: 'absolute', top: 24, transform: [{ rotate: spinDeg }] }}>
              <WheelArt size={size} />
            </Animated.View>
            <Svg width={34} height={34} style={{ position: 'absolute', top: 4 }}>
              <Path d="M3 3 L31 3 L17 31 Z" fill="#F2617A" stroke="#24323A" strokeWidth={3} strokeLinejoin="round" />
            </Svg>
          </View>
          <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 16 }}>
            <Button primary label={spinning ? 'Spinning…' : left > 0 ? 'Spin!' : 'No spins left today'} onPress={go} disabled={spinning || left < 1} />
            {!spinning ? <Button label="Close" onPress={onClose} /> : null}
          </View>
          <Text style={styles.odds}>Odds: coins 60% (jackpot 1%) · outfit 10% · potion 12% · crystal 9% · dye 6% · egg 3%. Dye and egg rarity are rolled after the spin.</Text>
        </View>
      )}
    </View>
  );
}

/** Banner on the Today card: lights up once the day's 3 habits are done. */
export function WheelBanner() {
  const { state } = useGame();
  const overlay = useOverlay();
  const left = Wh.spinsLeft(state);
  if (left < 1) return null;
  return (
    <Pressable onPress={() => { buzz('light'); overlay.open(<WheelSheet onClose={overlay.close} />); }} style={({ pressed }) => [styles.banner, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button" accessibilityLabel="Spin the Lucky Wheel">
      <View style={styles.bannerWheel}><WheelArt size={54} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bannerTitle}>Spin the Lucky Wheel</Text>
        <Text style={styles.bannerSub}>You earned it by finishing your goals</Text>
      </View>
      <View style={styles.bannerBtn}><Text style={styles.bannerBtnText}>Spin</Text></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(16,18,38,0.92)', zIndex: 90, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  full: { width: '100%', maxWidth: 420, alignItems: 'center', gap: 6, borderRadius: 28, padding: space.lg, backgroundColor: '#1E2240' },
  kicker: { fontSize: 12, fontWeight: '900', letterSpacing: 2, color: '#FFE27A' },
  title: { fontSize: 26, fontWeight: '900', color: '#FFFFFF' },
  odds: { fontSize: 11, fontWeight: '700', color: '#C9CDE8', textAlign: 'center', marginTop: 8 },
  prizeGlow: { width: 190, height: 190, borderRadius: 95, backgroundColor: '#3A3470', alignItems: 'center', justifyContent: 'center' },
  prizeTitle: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', textAlign: 'center' },
  prizeBody: { fontSize: 14, fontWeight: '700', color: '#D8CEFF', textAlign: 'center', maxWidth: 300 },
  tag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 11, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
  crystal: { width: 60, height: 84, backgroundColor: '#7FD3F0', borderRadius: 10, transform: [{ rotate: '45deg' }], borderWidth: 3, borderColor: '#3B9CC2' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 12, backgroundColor: '#FF8A4C', borderWidth: 3, borderColor: '#FFE7B0' },
  bannerWheel: { width: 54, height: 54 },
  bannerTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  bannerSub: { fontSize: 12, fontWeight: '800', color: '#FFF3E0' },
  bannerBtn: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  bannerBtnText: { fontSize: 15, fontWeight: '900', color: '#E8590C' },
});
