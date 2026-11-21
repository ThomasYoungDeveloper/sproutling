import React, { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import PetSprite from './PetSprite';
import { SPECIES_BY_ID } from '../game/species';
import { RARITY_INFO } from '../game/rarity';
import { levelFor, stageFor } from '../game/scoring';
import { SKIN_INFO } from '../game/skins';
import { ELEMENT_COLOR, ELEMENT_LABEL } from '../game/battle';
import { PERSONALITIES, gradeInfo, gradeOf, personalityOf, statsFor } from '../game/stats';
import type { OwnedPet } from '../game/types';

/** The pet share card as a normal view (4:5, like the 1080×1350 image). The phone app snapshots it to share. */
export const ShareCardView = forwardRef<any, { pet: OwnedPet; trainer: string; friendCode: string | null; width: number }>(function ShareCardView(
  { pet, trainer, friendCode, width },
  ref,
) {
  const k = width / 360;
  const H = width * 1.25;
  const sp = SPECIES_BY_ID[pet.speciesId];
  const el = ELEMENT_COLOR[sp.element];
  const rarity = RARITY_INFO[sp.rarity];
  const grade = gradeOf(pet);
  const st = statsFor(pet);
  const glow = pet.skin || pet.shiny || sp.rarity === 'legendary' || sp.rarity === 'epic';
  const badges: { text: string; color: string }[] = [
    { text: rarity.label.toUpperCase(), color: rarity.color },
    { text: ELEMENT_LABEL[sp.element].toUpperCase(), color: el },
  ];
  if (pet.skin) badges.push({ text: `${SKIN_INFO[pet.skin].label.toUpperCase()} SKIN`, color: SKIN_INFO[pet.skin].color });
  if (pet.shiny) badges.push({ text: 'SHINY', color: '#E3A81E' });
  badges.push({ text: grade >= 100 ? '💯 PERFECT' : `${grade}%`, color: gradeInfo(grade).color });
  const s = (n: number) => n * k;

  return (
    <View ref={ref} collapsable={false} style={{ width, height: H, overflow: 'hidden', backgroundColor: '#1B2240' }}>
      <Svg width={width} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={el} />
            <Stop offset="1" stopColor="#1B2240" />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={H} fill="url(#bg)" />
        {Array.from({ length: 40 }, (_, i) => (
          <Circle key={i} cx={((i * 137) % 1080) * (width / 1080)} cy={((i * 251) % 1350) * (width / 1080)} r={s((6 + (i % 5) * 4) / 3)} fill="#FFFFFF" opacity={0.12} />
        ))}
      </Svg>
      <Text style={[styles.title, { fontSize: s(19), marginTop: s(16) }]}>🌱 SPROUTLING</Text>
      <View style={[styles.panel, { marginHorizontal: s(23), marginTop: s(10), borderRadius: s(19), padding: s(13), height: s(353) }]}>
        <View style={{ height: s(200), borderRadius: s(13), backgroundColor: '#EEF7FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {glow ? (
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="gl" cx="50%" cy="50%" r="55%">
                  <Stop offset="0" stopColor={pet.skin ? SKIN_INFO[pet.skin].color : rarity.color} stopOpacity={0.5} />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#gl)" />
            </Svg>
          ) : null}
          <PetSprite species={sp} stage={stageFor(pet.xp)} size={s(185)} shiny={false} skin={pet.skin} hat={pet.look?.hat} aura={pet.look?.aura} />
          {pet.shiny ? <Text style={{ position: 'absolute', top: s(8), right: s(18), fontSize: s(21), color: '#E3A81E', fontWeight: '900' }}>✦</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: s(5), marginTop: s(9) }}>
          {badges.map((b) => (
            <View key={b.text} style={{ backgroundColor: b.color, borderRadius: 999, paddingHorizontal: s(8), paddingVertical: s(3) }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: s(10) }}>{b.text}</Text>
            </View>
          ))}
        </View>
        <Text style={{ textAlign: 'center', fontWeight: '900', color: '#1F2A2E', fontSize: s(27), marginTop: s(6) }} numberOfLines={1}>
          {pet.nickname}
        </Text>
        <Text style={{ textAlign: 'center', fontWeight: '700', color: '#5B6B70', fontSize: s(12.5) }} numberOfLines={1}>
          Level {levelFor(pet.xp)} {sp.name} · {PERSONALITIES[personalityOf(pet)].label} nature
        </Text>
        <View style={{ flexDirection: 'row', gap: s(5), marginTop: s(9) }}>
          {([['HP', st.hp], ['ATK', st.atk], ['DEF', st.def], ['SPD', st.spd]] as const).map(([label, v]) => (
            <View key={label} style={{ flex: 1, backgroundColor: '#F2F6F4', borderRadius: s(8), paddingVertical: s(6), alignItems: 'center' }}>
              <Text style={{ fontWeight: '900', color: '#1F2A2E', fontSize: s(15) }}>{v}</Text>
              <Text style={{ fontWeight: '800', color: '#5B6B70', fontSize: s(9) }}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={[styles.foot, { fontSize: s(12), marginTop: s(12) }]} numberOfLines={1}>
        {trainer}’s pet{friendCode ? ` · Friend code ${friendCode}` : ''}
      </Text>
      <Text style={[styles.foot, { fontSize: s(10), opacity: 0.85, marginTop: s(3) }]} numberOfLines={1}>
        Grow your own pet with healthy habits · sproutling.vercel.app
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  title: { color: '#FFFFFF', fontWeight: '900', textAlign: 'center' },
  panel: { backgroundColor: '#FFFFFF' },
  foot: { color: '#FFFFFF', fontWeight: '800', textAlign: 'center', paddingHorizontal: 12 },
});
