import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ItemIcon } from './Cosmetics';
import { Button } from './ui';
import { buzz, PopIn } from './fx';
import { colors, font, space } from '../theme';

/**
 * Sproutling Premium. Prices and perks are set; checkout turns on once payments are connected
 * (Stripe on the web, Apple and Google in the phone apps).
 */

export const PREMIUM_PLANS = [
  { id: 'monthly', name: 'Monthly', price: '$1.99', per: 'per month', note: '' },
  { id: 'yearly', name: 'Yearly', price: '$14.99', per: 'per year', note: 'Save 37%' },
] as const;

export const PREMIUM_PERKS = [
  { icon: '🚫', title: 'No ads, ever', text: 'Play without any ads.' },
  { icon: '👑', title: 'Premium dress-up', text: 'Golden Crown, Galaxy Swirl and Northern Lights, plus a new item every month.' },
  { icon: '🥚', title: 'Extra incubator', text: 'Hatch two eggs at once.' },
  { icon: '🧭', title: 'Second expedition', text: 'Send two pets exploring at the same time.' },
  { icon: '🎁', title: 'Monthly Gold chest', text: 'A free Gold chest on the first of every month.' },
  { icon: '❤️', title: 'Support Sproutling', text: 'Help keep the game growing with new pets and features.' },
];

export const ADD_ONS = [
  { icon: '🌟', name: 'Founder’s Pack', price: '$4.99', text: 'One-time: Founder badge, Golden Crown, 2 Gold chests and 1,000 coins.' },
  { icon: '🔕', name: 'Remove Ads', price: '$2.99', text: 'One-time: no ads, forever. No subscription.' },
];

export default function PremiumSheet({ onClose }: { onClose: () => void }) {
  const [plan, setPlan] = useState<string>('yearly');
  const [tapped, setTapped] = useState(false);
  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={{ gap: space.sm }}>
          <View style={styles.hero}>
            <Text style={{ fontSize: 40 }}>⭐</Text>
            <Text style={[font.title, { color: '#FFFFFF' }]}>Sproutling Premium</Text>
            <Text style={styles.heroSub}>More fun for your pets. Healthy habits stay free for everyone.</Text>
            <View style={styles.items}>
              {['goldcrown', 'galaxy', 'aurora'].map((id) => (
                <View key={id} style={styles.item}>
                  <ItemIcon id={id} size={54} />
                </View>
              ))}
            </View>
          </View>

          {PREMIUM_PERKS.map((p) => (
            <View key={p.title} style={styles.perk}>
              <Text style={{ fontSize: 22 }}>{p.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.perkTitle}>{p.title}</Text>
                <Text style={font.small}>{p.text}</Text>
              </View>
            </View>
          ))}

          <View style={styles.plans}>
            {PREMIUM_PLANS.map((p) => (
              <Pressable key={p.id} onPress={() => { buzz('light'); setPlan(p.id); }} style={[styles.plan, plan === p.id && styles.planOn]} accessibilityRole="radio" accessibilityState={{ selected: plan === p.id }}>
                {p.note ? <Text style={styles.save}>{p.note}</Text> : null}
                <Text style={styles.planName}>{p.name}</Text>
                <Text style={styles.planPrice}>{p.price}</Text>
                <Text style={font.tiny}>{p.per}</Text>
              </Pressable>
            ))}
          </View>

          <Button primary label="Coming soon" onPress={() => { buzz('light'); setTapped(true); }} />
          {tapped ? (
            <PopIn>
              <Text style={styles.soon}>Premium isn’t on sale yet. It’s launching soon, and everything you’ve earned stays yours!</Text>
            </PopIn>
          ) : null}

          <Text style={[font.h2, { marginTop: space.sm }]}>One-time add-ons</Text>
          {ADD_ONS.map((a) => (
            <View key={a.name} style={styles.perk}>
              <Text style={{ fontSize: 22 }}>{a.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.perkTitle}>{a.name} · {a.price}</Text>
                <Text style={font.small}>{a.text}</Text>
              </View>
            </View>
          ))}
          <Text style={[font.tiny, { textAlign: 'center' }]}>Chests are earned by playing and can’t be bought with money. Their odds are shown on the Chests tab.</Text>
          <Button label="Maybe later" onPress={onClose} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,30,48,0.6)', justifyContent: 'center', alignItems: 'center', padding: space.md, zIndex: 80 },
  sheet: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: space.lg, width: '100%', maxWidth: 440, maxHeight: '96%' },
  hero: { alignItems: 'center', gap: 4, backgroundColor: '#6E56CF', borderRadius: 18, padding: space.md },
  heroSub: { color: '#E5DEFF', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  items: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  item: { width: 70, height: 62, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  perk: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4 },
  perkTitle: { fontWeight: '900', fontSize: 14, color: colors.ink },
  plans: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  plan: { flex: 1, alignItems: 'center', padding: space.sm, borderRadius: 16, borderWidth: 2, borderColor: colors.line, backgroundColor: '#FAFCFB' },
  planOn: { borderColor: '#6E56CF', backgroundColor: '#F2EEFF' },
  planName: { fontWeight: '900', fontSize: 14, color: colors.ink },
  planPrice: { fontWeight: '900', fontSize: 24, color: '#6E56CF' },
  save: { position: 'absolute', top: -10, backgroundColor: colors.gold, color: '#5A3E00', fontWeight: '900', fontSize: 12, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  soon: { fontWeight: '800', fontSize: 13, color: '#6E56CF', textAlign: 'center' },
});
