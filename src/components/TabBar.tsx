import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const ICONS: Record<string, string> = {
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  eggs: 'M12 3c4 0 7 6 7 11a7 7 0 0 1-14 0c0-5 3-11 7-11z',
  chests: 'M4 10h16v10H4zM4 10a8 6 0 0 1 16 0M11 12h2v3h-2z',
  dex: 'M8 10a2 2 0 1 0 0-.1M16 10a2 2 0 1 0 0-.1M5 6a2 2 0 1 0 0-.1M19 6a2 2 0 1 0 0-.1M12 13c-3 0-5 3-5 5 0 2 2 2 5 1 3 1 5 1 5-1 0-2-2-5-5-5z',
  friends: 'M9 11a3 3 0 1 0 0-.1M3 20c0-4 3-6 6-6s6 2 6 6M16 11a3 3 0 1 0 0-.1M15 14c3 0 6 2 6 6',
};

/** The dark, rounded bottom bar with an icon per tab and a number badge for things waiting. */
export default function TabBar<T extends string>({ tabs, active, badges, onPick }: { tabs: { id: T; label: string }[]; active: T; badges: Partial<Record<T, number>>; onPick: (id: T) => void }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {tabs.map((t) => {
          const on = t.id === active;
          const fg = on ? '#FFFFFF' : '#CFE3DA';
          const badge = badges[t.id] ?? 0;
          return (
            <Pressable key={t.id} onPress={() => onPick(t.id)} style={[styles.btn, on && styles.on]} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={badge ? `${t.label}, ${badge} waiting` : t.label}>
              <Svg width={24} height={24} viewBox="0 0 24 24">
                <Path d={ICONS[t.id] ?? ICONS.home} fill="none" stroke={fg} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={[styles.label, { color: fg }]}>{t.label}</Text>
              {badge > 0 ? (
                <View style={styles.badge}><Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text></View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 10, paddingBottom: 8, paddingTop: 4 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#24323A', borderRadius: 24, paddingHorizontal: 6, height: 66, maxWidth: 520, width: '100%', alignSelf: 'center' },
  btn: { width: 64, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 2 },
  on: { backgroundColor: '#2FB58A' },
  label: { fontSize: 11, fontWeight: '900' },
  badge: { position: 'absolute', top: 3, right: 7, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: '#FF6B5B', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
});
